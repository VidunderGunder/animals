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
	musicId?: MusicId; // <--- NEW: remember current music id

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
			// ignore
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
	init(): void {
		ensure();
		bindAutoUnlock();
	},

	isUnlocked(): boolean {
		const { ctx } = ensure();
		return ctx.state === "running";
	},

	async unlock(): Promise<void> {
		const { ctx } = ensure();
		await safeResume(ctx);
	},

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

	async playBuffer(
		url: string,
		opts: {
			bus?: Exclude<AudioBus, "master" | "music" | "ambience">;
			volume?: number;
			playbackRate?: number;
			detuneCents?: number;
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

	/**
	 * "Smart" setter: only (re)starts when the track actually changes.
	 * Pass null to stop.
	 */
	async setMusic(id: MusicId | null, opts: MusicOptions = {}): Promise<void> {
		const s = ensure();
		if (id === null) {
			if (s.musicId !== undefined) audio.stopMusic();
			return;
		}
		if (s.musicId === id) return;
		await audio.playMusic(id, opts);
	},

	async playMusic(id: MusicId, opts: MusicOptions = {}): Promise<void> {
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
		s.musicId = id; // <--- NEW

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
		s.musicId = undefined; // <--- NEW
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

		const target = new Map<AmbienceId, number>();
		for (const k in mix) {
			const id = k as AmbienceId;
			const w = mix[id];
			if (typeof w === "number") {
				target.set(id, clamp(w, 0, 1));
			}
		}

		s.ambienceDesired = target;

		const playPromises: Promise<void>[] = [];

		for (const [id, weight] of target) {
			if (weight > 0) cancelAmbienceStopTimer(s, id);

			const ch = getOrCreateAmbienceTrack(s, id, { loop });
			ch.el.loop = loop;

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
						disconnectAndUnloadMedia(ch);
						s.ambienceStopTimers.delete(id);
					}, fadeMs + 50);

					s.ambienceStopTimers.set(id, timer);
				}
			}
		}

		await Promise.all(playPromises);
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
					disconnectAndUnloadMedia(ch);
					s.ambienceStopTimers.delete(id);
				}, fadeMs + 50);

				s.ambienceStopTimers.set(id, timer);
			}
		}
	},
} as const;
