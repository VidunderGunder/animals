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
	ambience?: MediaChannel;

	// Unlock listeners (so we can remove them)
	unlockBound: boolean;
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

		// If you call this before unlock, decoding can still work; playback just won’t start until unlocked.
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

		// best-effort resume, doesn’t hurt if already running
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

		// Try to play; if blocked, it’ll start once unlocked + user triggers play again via game logic.
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

	async playAmbience(
		id: AmbienceId,
		opts: { volume?: number; loop?: boolean } = {},
	): Promise<void> {
		const url = ambiencePaths[id];
		const s = ensure();
		void safeResume(s.ctx);

		disconnectMedia(s.ambience);

		const el = new Audio();
		el.src = url;
		el.loop = opts.loop ?? true;
		el.preload = "auto";
		el.crossOrigin = "anonymous";

		const src = s.ctx.createMediaElementSource(el);

		const gain = s.ctx.createGain();
		gain.gain.value = clamp(opts.volume ?? 1, 0, 1);

		src.connect(gain).connect(s.bus.ambience);

		s.ambience = { el, src, gain };

		try {
			await el.play();
		} catch {
			// ignore
		}
	},

	stopAmbience(): void {
		const s = ensure();
		disconnectMedia(s.ambience);
		s.ambience = undefined;
	},
} as const;
