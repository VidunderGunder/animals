// audio-engine.ts
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
 * - music/ambience are long streams (MediaElement)
 * - sfx/voice/haptics are short buffers (AudioBufferSource)
 */
export type AudioBus =
	| "master"
	| "music"
	| "ambience"
	| "sfx"
	| "voice"
	| "haptics";

type BusNodes = Record<AudioBus, GainNode>;

type MediaChannel = {
	el: HTMLAudioElement;
	src: MediaElementAudioSourceNode;
	gain: GainNode; // per-track trim (in addition to bus)
};

type AudioState = {
	ctx: AudioContext;
	bus: BusNodes;

	// Caches
	buffers: Map<string, AudioBuffer>;

	// Current media per channel
	music?: MediaChannel;

	// Ambience is a multi-track mix
	ambience: Map<AmbienceId, MediaChannel>;

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
	 * If true, tracks that fade to 0 will be paused+disconnected after the fade.
	 * Default true.
	 */
	stopWhenSilent?: boolean;

	/**
	 * Optional global trim on the ambience bus for this call.
	 * (If you want global ambience control, you may prefer setBusVolume("ambience", ...))
	 */
	busVolume?: number;
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

function setGainSmooth(
	param: AudioParam,
	target: number,
	fadeMs: number,
	ctx: AudioContext,
) {
	const t0 = ctx.currentTime;
	const t1 = t0 + Math.max(0, fadeMs) / 1000;

	// Prefer cancelAndHoldAtTime when available (better retargeting)
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

	// Linear is fine for ambience; if you prefer perceptual fades,
	// swap to exponential with a small floor.
	param.linearRampToValueAtTime(target, t1);
}

function disconnectAndUnloadMedia(ch?: MediaChannel) {
	if (!ch) return;
	try {
		ch.src.disconnect();
	} catch {}
	try {
		ch.gain.disconnect();
	} catch {}
	try {
		ch.el.pause();
		ch.el.src = "";
		ch.el.load();
	} catch {}
}

function getOrCreateAmbienceTrack(
	s: AudioState,
	id: AmbienceId,
	opts: { loop: boolean },
): MediaChannel {
	const existing = s.ambience.get(id);
	if (existing) return existing;

	const url = ambiencePaths[id];

	const el = new Audio();
	el.src = url;
	el.loop = opts.loop;
	el.preload = "auto";
	el.crossOrigin = "anonymous";

	const src = s.ctx.createMediaElementSource(el);

	const gain = s.ctx.createGain();
	gain.gain.value = 0; // start silent; setAmbienceMix will fade it

	src.connect(gain).connect(s.bus.ambience);

	const ch: MediaChannel = { el, src, gain };
	s.ambience.set(id, ch);

	return ch;
}

function ensure(): AudioState {
	if (state) return state;

	const Ctx = getCtor();
	const ctx = new Ctx();

	// --- bus graph ---
	//    [music] \
	// [ambience]  \
	//      [sfx]   -> [master] -> destination
	//    [voice]  /
	//  [haptics] /
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
		ambience: new Map(),
		ambienceStopTimers: new Map(),
		ambienceDesired: new Map(),
		unlockBound: false,
	};

	return state;
}

async function safeResume(ctx: AudioContext) {
	if (ctx.state === "suspended") {
		try {
			await ctx.resume();
		} catch {
			// ignore; gesture restrictions etc.
		}
	}
}

function disconnectMedia(ch?: MediaChannel) {
	if (!ch) return;
	try {
		ch.src.disconnect();
	} catch {}
	try {
		ch.gain.disconnect();
	} catch {}
	try {
		ch.el.pause();
		ch.el.src = "";
		ch.el.load();
	} catch {}
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
		const { ctx } = ensure();
		await safeResume(ctx);
	},

	/** Expose the low-level nodes for advanced use (haptics, custom synth, etc.). */
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
	// Buffer loading (SFX/voice)
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
	 * Play a short decoded sound. Good for SFX.
	 * Returns a stop() handle.
	 */
	async playBuffer(
		url: string,
		opts: {
			bus?: Exclude<AudioBus, "master" | "music" | "ambience">;
			volume?: number; // 0..1 (per-play trim)
			playbackRate?: number; // default 1
			detuneCents?: number; // +/- cents
			loop?: boolean;
		} = {},
	): Promise<{ stop: () => void }> {
		const { ctx, bus } = ensure();
		const targetBus = bus[opts.bus ?? "sfx"];

		const buffer = await audio.loadBuffer(url);

		void safeResume(ctx);

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
	// Media playback (Music/Ambience)
	// -------------------------
	async playMusic(
		id: MusicId,
		opts: { volume?: number; loop?: boolean } = {},
	): Promise<void> {
		const url = musicPaths[id];
		const s = ensure();
		void safeResume(s.ctx);

		disconnectMedia(s.music);

		const el = new Audio();
		el.src = url;
		el.loop = opts.loop ?? true;
		el.preload = "auto";
		el.crossOrigin = "anonymous";

		const src = s.ctx.createMediaElementSource(el);

		const gain = s.ctx.createGain();
		gain.gain.value = clamp(opts.volume ?? 1, 0, 1);

		src.connect(gain).connect(s.bus.music);

		s.music = { el, src, gain };

		try {
			await el.play();
		} catch {
			// ignore
		}
	},

	stopMusic(): void {
		const s = ensure();
		disconnectMedia(s.music);
		s.music = undefined;
	},

	async setAmbienceMix(
		mix: AmbienceMix,
		opts: AmbienceOptions = {},
	): Promise<void> {
		const s = ensure();
		void safeResume(s.ctx);

		const fadeMs = opts.fadeMs ?? 600;
		const loop = opts.loop ?? true;
		const stopWhenSilent = opts.stopWhenSilent ?? true;

		if (typeof opts.busVolume === "number") {
			s.bus.ambience.gain.value = clamp(opts.busVolume, 0, 1);
		}

		// Normalize inputs: clamp weights 0..1
		const target = new Map<AmbienceId, number>();
		for (const k in mix) {
			const id = k as AmbienceId;
			const w = mix[id];
			if (typeof w === "number") {
				target.set(id, clamp(w, 0, 1));
			}
		}

		// Publish latest desired weights so timers check current intent (not stale closure data)
		s.ambienceDesired = target;

		// Ensure all target tracks exist and start them (silent first, then fade)
		const playPromises: Promise<void>[] = [];

		for (const [id, weight] of target) {
			// If this track is desired (>0), it must not be killed by a previous fade-out timer
			if (weight > 0) cancelAmbienceStopTimer(s, id);

			const ch = getOrCreateAmbienceTrack(s, id, { loop });

			// Update loop behavior if caller changes it
			ch.el.loop = loop;

			// Start if needed (best-effort)
			if (ch.el.paused) {
				playPromises.push(
					ch.el.play().then(
						() => {},
						() => {},
					) as Promise<void>,
				);
			}

			setGainSmooth(ch.gain.gain, weight, fadeMs, s.ctx);
		}

		// Fade out any existing tracks not in target (or explicitly set to 0)
		for (const [id, ch] of s.ambience) {
			const desired = target.get(id) ?? 0;

			if (desired === 0) {
				setGainSmooth(ch.gain.gain, 0, fadeMs, s.ctx);

				if (stopWhenSilent) {
					// Cancel any existing timer and replace it
					cancelAmbienceStopTimer(s, id);

					const timer = window.setTimeout(() => {
						// Still alive?
						if (!s.ambience.has(id)) return;

						// Check *latest* desired state (not the state at scheduling time)
						const nowDesired = s.ambienceDesired.get(id) ?? 0;
						if (nowDesired > 0) return;

						s.ambience.delete(id);
						disconnectAndUnloadMedia(ch);
						s.ambienceStopTimers.delete(id);
					}, fadeMs + 50);

					s.ambienceStopTimers.set(id, timer);
				}
			}
		}

		// If a mix is empty, this function becomes “fade all out”
		await Promise.all(playPromises);
	},

	stopAmbience(opts: { fadeMs?: number; stopWhenSilent?: boolean } = {}): void {
		const s = ensure();
		const fadeMs = opts.fadeMs ?? 300;
		const stopWhenSilent = opts.stopWhenSilent ?? true;

		// Clear desired state
		s.ambienceDesired = new Map();

		for (const [id, ch] of s.ambience) {
			setGainSmooth(ch.gain.gain, 0, fadeMs, s.ctx);

			if (stopWhenSilent) {
				cancelAmbienceStopTimer(s, id);

				const timer = window.setTimeout(() => {
					if (!s.ambience.has(id)) return;

					// Still not desired?
					const nowDesired = s.ambienceDesired.get(id) ?? 0;
					if (nowDesired > 0) return;

					s.ambience.delete(id);
					disconnectAndUnloadMedia(ch);
					s.ambienceStopTimers.delete(id);
				}, fadeMs + 50);

				s.ambienceStopTimers.set(id, timer);
			}
		}
	},
} as const;
