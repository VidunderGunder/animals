let ctx: AudioContext | null = null;

let masterGain: GainNode | null = null;
let sfxGain: GainNode | null = null;
let musicGain: GainNode | null = null;
let hapticsGain: GainNode | null = null;

export function getAudio() {
	if (!ctx) {
		const Ctx =
			window.AudioContext ||
			(window as unknown as { webkitAudioContext: typeof AudioContext })
				.webkitAudioContext;
		ctx = new Ctx();

		masterGain = ctx.createGain();
		masterGain.gain.value = 1;
		masterGain.connect(ctx.destination);

		sfxGain = ctx.createGain();
		sfxGain.gain.value = 1;
		sfxGain.connect(masterGain);

		musicGain = ctx.createGain();
		musicGain.gain.value = 1;
		musicGain.connect(masterGain);

		hapticsGain = ctx.createGain();
		hapticsGain.gain.value = 1; // default subtle
		hapticsGain.connect(masterGain);
	}

	if (!ctx || !masterGain || !sfxGain || !musicGain || !hapticsGain) {
		throw new Error("Audio context not initialized");
	}

	return {
		ctx,
		masterGain,
		sfxGain,
		musicGain,
		hapticsGain,
	};
}

export async function unlockAudio() {
	const { ctx } = getAudio();
	if (ctx.state === "suspended") await ctx.resume();
}

// Automatically unlock on first user interaction
const unlockEvents = [
	"touchstart",
	"touchend",
	"pointerdown",
	"pointerup",
	"mousedown",
	"keydown",
] as const;

function unlockHandler() {
	void unlockAudio().catch(() => {});
	unlockEvents.forEach((eventName) => {
		window.removeEventListener(eventName, unlockHandler);
	});
}

unlockEvents.forEach((eventName) => {
	window.addEventListener(eventName, unlockHandler, { passive: true });
});

export function setHapticsVolume(v: number) {
	const { hapticsGain } = getAudio();
	if (!ctx || !hapticsGain) throw new Error("Audio context not initialized");
	hapticsGain.gain.value = Math.max(0, Math.min(1, v));
}
