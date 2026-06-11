import { clamp } from "../functions/general";
import {
	type AmbienceId,
	ambiencePaths,
	type MusicId,
	musicPaths,
	type SfxId,
	sfxPaths,
} from "./audio-paths";

/**
 * Audio buses (submixes).
 * - master is the final volume
 * - music/ambience are decoded buffers played as cross-faded loops
 * - sfx/voice/haptics are short buffers (AudioBufferSource)
 *
 * Everything is Web Audio buffer based (no HTMLMediaElement):
 * - cross-faded loops are gapless (mp3 encoder padding doesn't matter)
 * - no media session is created, so iOS hardware/lockscreen play-pause
 *   doesn't control us and we don't stop other apps' music
 */
export type AudioBus =
	| "master"
	| "music"
	| "ambience"
	| "sfx"
	| "voice"
	| "haptics";

type BusNodes = Record<AudioBus, GainNode>;

/** Cross-fade loop duration for ambience/music (seconds) */
const CROSSFADE_S = 1.5;

/** How far ahead of the splice point the scheduler wakes up (seconds) */
const SCHEDULE_LOOKAHEAD_S = 1;

type LoopHandle = {
	stop: () => void;
};

type AmbienceChannel = {
	/** Per-track weight (in addition to the ambience bus) */
	gain: GainNode;
	/** Set once the buffer is decoded and the loop is started */
	loop: LoopHandle | null;
};

type MusicChannel = {
	id: MusicId;
	gain: GainNode;
	loop: boolean;
	handle: LoopHandle | null;
};

type AudioState = {
	ctx: AudioContext;
	bus: BusNodes;

	// Caches
	buffers: Map<string, AudioBuffer>;

	// Current music (single track)
	music?: MusicChannel;
	musicGen: number;

	// Ambience is a multi-track mix
	ambience: Map<AmbienceId, AmbienceChannel>;

	// Track stop timers to avoid stale timeouts killing revived tracks
	ambienceStopTimers: Map<AmbienceId, number>;

	// Latest desired weights (used by stop timers for correctness)
	ambienceDesired: Map<AmbienceId, number>;

	// Unlock listeners (so we can remove them)
	unlockBound: boolean;
};

export type AmbienceMix = Partial<Record<AmbienceId, number>>;
export type AmbienceOptions = {
	/** Fade time for changes (ms). Default 600 */
	fadeMs?: number;

	/** Default true */
	loop?: boolean;

	/**
	 * If true, tracks that fade to 0 will be stopped+disconnected after the fade.
	 * Default true.
	 */
	stopWhenSilent?: boolean;

	/**
	 * Optional global trim on the ambience bus for this call.
	 * (If you want global ambience control, you may prefer setBusVolume("ambience", ...))
	 */
	busVolume?: number;
};

export type MusicOptions = {
	/** Volume trim for this track (0-1). Default 1 */
	volume?: number;

	/** Whether to loop the track. Default true */
	loop?: boolean;
};

let state: AudioState | null = null;

function getCtor(): typeof AudioContext {
	const AnyWindow = window as unknown as {
		AudioContext?: typeof AudioContext;
		webkitAudioContext?: typeof AudioContext;
	};
	const Ctx = AnyWindow.AudioContext ?? AnyWindow.webkitAudioContext;
	if (!Ctx) throw new Error("Web Audio API not supported in this browser");
	return Ctx;
}

/**
 * iOS Safari 16.4+: mix with other apps' audio (Music, podcasts, ...)
 * instead of hijacking the audio session.
 */
function configureAudioSession() {
	const nav = navigator as Navigator & {
		audioSession?: { type: string };
	};
	try {
		if (nav.audioSession) nav.audioSession.type = "ambient";
	} catch {
		// ignore
	}
}

function setGainSmooth(
	param: AudioParam,
	target: number,
	fadeMs: number,
	ctx: AudioContext,
) {
	const t0 = ctx.currentTime;
	const t1 = t0 + Math.max(0, fadeMs) / 1000;

	const anyParam = param as unknown as {
		cancelAndHoldAtTime?: (t: number) => void;
	};
	if (typeof anyParam.cancelAndHoldAtTime === "function") {
		anyParam.cancelAndHoldAtTime(t0);
	} else {
		param.cancelScheduledValues(t0);
		try {
			param.setValueAtTime(param.value, t0);
		} catch {
			// ignore
		}
	}

	if (fadeMs <= 0) {
		param.setValueAtTime(target, t0);
		return;
	}

	param.linearRampToValueAtTime(target, t1);
}

// Equal-power fade curves shared by all loop splices
const FADE_CURVE_LEN = 64;
const FADE_IN_CURVE = new Float32Array(FADE_CURVE_LEN);
const FADE_OUT_CURVE = new Float32Array(FADE_CURVE_LEN);
for (let i = 0; i < FADE_CURVE_LEN; i++) {
	const t = i / (FADE_CURVE_LEN - 1);
	FADE_IN_CURVE[i] = Math.sin((t * Math.PI) / 2);
	FADE_OUT_CURVE[i] = Math.cos((t * Math.PI) / 2);
}

/**
 * Gapless looping by overlapping the end of each pass with the start of the
 * next, using an equal-power cross-fade. Survives context suspension: all
 * times are in (frozen-while-suspended) AudioContext time.
 */
function startCrossfadeLoop(
	ctx: AudioContext,
	buffer: AudioBuffer,
	destination: AudioNode,
): LoopHandle {
	const duration = buffer.duration;
	const xf = clamp(CROSSFADE_S, 0.01, duration / 4);
	const period = duration - xf;

	let stopped = false;
	let timer: number | null = null;
	const active = new Set<AudioBufferSourceNode>();

	const scheduleOne = (at: number, fadeIn: boolean) => {
		const src = ctx.createBufferSource();
		src.buffer = buffer;

		const env = ctx.createGain();
		if (fadeIn) {
			env.gain.setValueAtTime(0, at);
			env.gain.setValueCurveAtTime(FADE_IN_CURVE, at, xf);
		}
		env.gain.setValueCurveAtTime(FADE_OUT_CURVE, at + duration - xf, xf);

		src.connect(env).connect(destination);

		active.add(src);
		src.onended = () => {
			active.delete(src);
			try {
				src.disconnect();
				env.disconnect();
			} catch {
				// ignore
			}
		};

		src.start(at);
		src.stop(at + duration);
	};

	let nextStart = ctx.currentTime;
	scheduleOne(nextStart, false);
	nextStart += period;

	const arm = () => {
		if (stopped) return;

		const wakeIn = (nextStart - SCHEDULE_LOOKAHEAD_S - ctx.currentTime) * 1000;
		timer = window.setTimeout(
			() => {
				if (stopped) return;

				// Context suspended (tab hidden): time is frozen, check back later.
				if (ctx.state !== "running") {
					timer = window.setTimeout(arm, 500);
					return;
				}

				scheduleOne(Math.max(nextStart, ctx.currentTime), true);
				nextStart += period;
				arm();
			},
			Math.max(0, wakeIn),
		);
	};
	arm();

	return {
		stop() {
			stopped = true;
			if (timer !== null) {
				clearTimeout(timer);
				timer = null;
			}
			for (const src of active) {
				try {
					src.stop();
				} catch {
					// ignore
				}
			}
			active.clear();
		},
	};
}

/** Play a decoded buffer once (used when loop is disabled) */
function startOneShot(
	ctx: AudioContext,
	buffer: AudioBuffer,
	destination: AudioNode,
): LoopHandle {
	const src = ctx.createBufferSource();
	src.buffer = buffer;
	src.connect(destination);
	src.onended = () => {
		try {
			src.disconnect();
		} catch {
			// ignore
		}
	};
	src.start();

	return {
		stop() {
			try {
				src.stop();
			} catch {
				// ignore
			}
		},
	};
}

function stopAmbienceChannel(ch?: AmbienceChannel) {
	if (!ch) return;
	ch.loop?.stop();
	ch.loop = null;
	try {
		ch.gain.disconnect();
	} catch {
		// ignore
	}
}

function stopMusicChannel(ch?: MusicChannel) {
	if (!ch) return;
	ch.handle?.stop();
	ch.handle = null;
	try {
		ch.gain.disconnect();
	} catch {
		// ignore
	}
}

/**
 * Create the channel synchronously (so concurrent setAmbienceMix calls can
 * never double-start the same track), then start the loop once decoded.
 */
function getOrCreateAmbienceTrack(
	s: AudioState,
	id: AmbienceId,
	opts: { loop: boolean },
): AmbienceChannel {
	const existing = s.ambience.get(id);
	if (existing) return existing;

	const gain = s.ctx.createGain();
	gain.gain.value = 0; // start silent; setAmbienceMix will fade it
	gain.connect(s.bus.ambience);

	const ch: AmbienceChannel = { gain, loop: null };
	s.ambience.set(id, ch);

	void (async () => {
		const buffer = await audio.loadBuffer(ambiencePaths[id]);

		// Track was stopped/replaced while decoding, or already started.
		if (s.ambience.get(id) !== ch) return;
		if (ch.loop) return;

		ch.loop = opts.loop
			? startCrossfadeLoop(s.ctx, buffer, ch.gain)
			: startOneShot(s.ctx, buffer, ch.gain);
	})();

	return ch;
}

function ensure(): AudioState {
	if (state) return state;

	const Ctx = getCtor();
	const ctx = new Ctx();

	configureAudioSession();

	const master = ctx.createGain();
	master.gain.value = 1;
	master.connect(ctx.destination);

	const mk = (v: number) => {
		const gainNode = ctx.createGain();
		gainNode.gain.value = v;
		gainNode.connect(master);
		return gainNode;
	};

	const bus: BusNodes = {
		master,
		music: mk(1),
		ambience: mk(1),
		sfx: mk(1),
		voice: mk(1),
		haptics: mk(1),
	};

	state = {
		ctx,
		bus,
		buffers: new Map(),
		music: undefined,
		musicGen: 0,
		ambience: new Map(),
		ambienceStopTimers: new Map(),
		ambienceDesired: new Map(),
		unlockBound: false,
	};

	// Silence everything while the tab is hidden (Web Audio keeps playing
	// in background tabs otherwise). Suspension freezes the loop scheduler
	// too, so tracks resume exactly where they left off.
	const onVisibility = () => {
		if (!state) return;
		if (document.hidden) {
			void state.ctx.suspend().catch(() => {});
		} else {
			void safeResume(state.ctx);
		}
	};
	document.addEventListener("visibilitychange", onVisibility);
	window.addEventListener("pagehide", () => {
		void state?.ctx.suspend().catch(() => {});
	});

	return state;
}

async function safeResume(ctx: AudioContext) {
	if (ctx.state === "suspended") {
		try {
			await ctx.resume();
		} catch {
			// ignore
		}
	}
}

export async function unlockAudio(): Promise<void> {
	await audio.unlock();
}

function bindAutoUnlock(): void {
	const s = ensure();
	if (s.unlockBound) return;
	s.unlockBound = true;

	const unlockEvents = [
		"touchstart",
		"touchend",
		"pointerdown",
		"pointerup",
		"mousedown",
		"keydown",
		"click",
		"dblclick",
		"contextmenu",
		"wheel",
		"focus",
		"focusin",
		"focusout",
	] as const satisfies readonly (keyof WindowEventMap)[];

	const handler = () => {
		void audio.unlock();
		for (const ev of unlockEvents) window.removeEventListener(ev, handler);
		s.unlockBound = false;
	};

	for (const ev of unlockEvents) {
		window.addEventListener(ev, handler, { passive: true });
	}
}

function cancelAmbienceStopTimer(s: AudioState, id: AmbienceId) {
	const t = s.ambienceStopTimers.get(id);
	if (t) {
		clearTimeout(t);
		s.ambienceStopTimers.delete(id);
	}
}

/** Public singleton API */
export const audio = {
	/** Create nodes lazily (does not force resume). Safe to call anytime. */
	init(): void {
		ensure();
		bindAutoUnlock();
	},

	/** Returns true if context is running. */
	isUnlocked(): boolean {
		const { ctx } = ensure();
		return ctx.state === "running";
	},

	/** Best-effort resume. Must be called from a user gesture to reliably unlock on iOS/Safari. */
	async unlock(): Promise<void> {
		const s = ensure();

		// Don't fight the visibility handler while hidden.
		if (document.hidden) return;

		await safeResume(s.ctx);

		// Buffer sources are scheduled on the context timeline, so anything
		// that was started while suspended plays as soon as the context runs.
	},

	/** Expose low-level nodes for advanced use. */
	get() {
		const { ctx, bus } = ensure();
		return { ctx, bus };
	},

	setBusVolume(bus: AudioBus, volume01: number): void {
		const { bus: buses } = ensure();
		buses[bus].gain.value = clamp(volume01, 0, 1);
	},

	getBusVolume(bus: AudioBus): number {
		const { bus: buses } = ensure();
		return buses[bus].gain.value;
	},

	// -------------------------
	// Buffer loading (SFX/voice/music/ambience)
	// -------------------------
	async loadBuffer(url: string): Promise<AudioBuffer> {
		const s = ensure();
		const cached = s.buffers.get(url);
		if (cached) return cached;

		const res = await fetch(url);
		if (!res.ok)
			throw new Error(`Failed to fetch audio: ${url} (${res.status})`);

		const arr = await res.arrayBuffer();
		const buf = await s.ctx.decodeAudioData(arr.slice(0));

		s.buffers.set(url, buf);
		return buf;
	},

	/**
	 * Play a short decoded sound. Good for SFX/voice/haptics.
	 * Returns a stop() handle.
	 */
	async playBuffer(
		url: string,
		opts: {
			bus?: Exclude<AudioBus, "master" | "music" | "ambience">;
			volume?: number; // 0..1
			playbackRate?: number; // default 1
			detuneCents?: number; // +/- cents
			loop?: boolean;
		} = {},
	): Promise<{ stop: () => void }> {
		const { ctx, bus } = ensure();
		const targetBus = bus[opts.bus ?? "sfx"];

		const buffer = await audio.loadBuffer(url);

		void audio.unlock();

		const src = ctx.createBufferSource();
		src.buffer = buffer;
		src.loop = opts.loop ?? false;

		if (typeof opts.playbackRate === "number") {
			src.playbackRate.value = opts.playbackRate;
		}
		if (typeof opts.detuneCents === "number") {
			src.detune.value = opts.detuneCents;
		}

		const g = ctx.createGain();
		g.gain.value = clamp(opts.volume ?? 1, 0, 1);

		src.connect(g).connect(targetBus);

		const stop = () => {
			try {
				src.stop();
			} catch {}
		};

		src.onended = () => {
			try {
				src.disconnect();
				g.disconnect();
			} catch {}
		};

		src.start();

		return { stop };
	},

	async playSfx(
		id: SfxId,
		opts: { volume?: number; playbackRate?: number; detuneCents?: number } = {},
	) {
		const url = sfxPaths[id];
		return audio.playBuffer(url, { bus: "sfx", ...opts });
	},

	async playVoice(
		url: string,
		opts: { volume?: number; playbackRate?: number; detuneCents?: number } = {},
	) {
		return audio.playBuffer(url, { bus: "voice", ...opts });
	},

	// -------------------------
	// Music (buffer-based, cross-faded loop)
	// -------------------------

	/**
	 * Smart setter: only (re)starts when track changes.
	 * Pass null to stop.
	 */
	async setMusic(id: MusicId | null, opts: MusicOptions = {}): Promise<void> {
		const s = ensure();

		if (id === null) {
			if (s.music) audio.stopMusic();
			return;
		}

		// Same track: just update gain/loop preference (loop change requires restart)
		if (s.music?.id === id) {
			s.music.gain.gain.value = clamp(opts.volume ?? 1, 0, 1);

			const wantLoop = opts.loop ?? true;
			if (s.music.loop !== wantLoop) {
				// restart to apply loop flag reliably
				await audio.playMusic(id, opts);
			}
			return;
		}

		await audio.playMusic(id, opts);
	},

	async playMusic(id: MusicId, opts: MusicOptions = {}): Promise<void> {
		const s = ensure();
		void audio.unlock();

		// Claim a generation BEFORE awaiting, so concurrent calls can never
		// start two overlapping tracks (the old phasing/distortion bug).
		const gen = ++s.musicGen;

		// Stop previous
		stopMusicChannel(s.music);
		s.music = undefined;

		const loop = opts.loop ?? true;

		const gain = s.ctx.createGain();
		gain.gain.value = clamp(opts.volume ?? 1, 0, 1);
		gain.connect(s.bus.music);

		const ch: MusicChannel = { id, gain, loop, handle: null };
		s.music = ch;

		const url = musicPaths[id];
		const buffer = await audio.loadBuffer(url);

		if (gen !== s.musicGen || s.music !== ch) {
			// Superseded while decoding
			try {
				gain.disconnect();
			} catch {}
			return;
		}

		ch.handle = loop
			? startCrossfadeLoop(s.ctx, buffer, gain)
			: startOneShot(s.ctx, buffer, gain);
	},

	stopMusic(): void {
		const s = ensure();
		s.musicGen++;
		stopMusicChannel(s.music);
		s.music = undefined;
	},

	// -------------------------
	// Ambience (buffer-based mix, cross-faded loops)
	// -------------------------
	async setAmbienceMix(
		mix: AmbienceMix,
		opts: AmbienceOptions = {},
	): Promise<void> {
		const s = ensure();
		void audio.unlock();

		const fadeMs = opts.fadeMs ?? 600;
		const loop = opts.loop ?? true;
		const stopWhenSilent = opts.stopWhenSilent ?? true;

		if (typeof opts.busVolume === "number") {
			s.bus.ambience.gain.value = clamp(opts.busVolume, 0, 1);
		}

		const target = new Map<AmbienceId, number>();
		for (const k in mix) {
			const id = k as AmbienceId;
			const w = mix[id];
			if (typeof w === "number") {
				target.set(id, clamp(w, 0, 1));
			}
		}

		s.ambienceDesired = target;

		for (const [id, weight] of target) {
			if (weight > 0) cancelAmbienceStopTimer(s, id);

			const ch = getOrCreateAmbienceTrack(s, id, { loop });
			setGainSmooth(ch.gain.gain, weight, fadeMs, s.ctx);
		}

		for (const [id, ch] of s.ambience) {
			const desired = target.get(id) ?? 0;

			if (desired === 0) {
				setGainSmooth(ch.gain.gain, 0, fadeMs, s.ctx);

				if (stopWhenSilent) {
					cancelAmbienceStopTimer(s, id);

					const timer = window.setTimeout(() => {
						if (!s.ambience.has(id)) return;

						const nowDesired = s.ambienceDesired.get(id) ?? 0;
						if (nowDesired > 0) return;

						s.ambience.delete(id);
						stopAmbienceChannel(ch);
						s.ambienceStopTimers.delete(id);
					}, fadeMs + 50);

					s.ambienceStopTimers.set(id, timer);
				}
			}
		}
	},

	stopAmbience(opts: { fadeMs?: number; stopWhenSilent?: boolean } = {}): void {
		const s = ensure();
		const fadeMs = opts.fadeMs ?? 300;
		const stopWhenSilent = opts.stopWhenSilent ?? true;

		s.ambienceDesired = new Map();

		for (const [id, ch] of s.ambience) {
			setGainSmooth(ch.gain.gain, 0, fadeMs, s.ctx);

			if (stopWhenSilent) {
				cancelAmbienceStopTimer(s, id);

				const timer = window.setTimeout(() => {
					if (!s.ambience.has(id)) return;

					const nowDesired = s.ambienceDesired.get(id) ?? 0;
					if (nowDesired > 0) return;

					s.ambience.delete(id);
					stopAmbienceChannel(ch);
					s.ambienceStopTimers.delete(id);
				}, fadeMs + 50);

				s.ambienceStopTimers.set(id, timer);
			}
		}
	},
} as const;
