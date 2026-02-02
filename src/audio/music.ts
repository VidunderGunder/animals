// music.ts
import { TILE_SIZE_PX } from "../config";
import { clamp } from "../functions/general";
import { player } from "../state";
import { audio, type MusicOptions } from "./audio-engine";
import { isMusicId, type MusicId } from "./audio-paths";

let accMs = 0;
const UPDATE_EVERY_MS = 500;

// last applied state (so we don't restart / re-apply constantly)
let lastId: MusicId | null = null;
let lastSig = "";

export function updateMusic(dtMs: number) {
	accMs += dtMs;
	if (accMs < UPDATE_EVERY_MS) return;
	accMs = 0;

	const next = getMusicForPosition(player);

	if (next === null || next.id === null) {
		// Stop only once
		if (lastId !== null) {
			lastId = null;
			lastSig = "";
			void audio.setMusic(null);
		}
		return;
	}

	const sig = optionsSig(next.options);

	// Only apply if id/options changed
	if (next.id === lastId && sig === lastSig) return;

	lastId = next.id;
	lastSig = sig;

	void audio.setMusic(next.id, next.options);
}

// --------------------
// Field definitions
// --------------------

type MusicField = {
	/** Inclusive bounds (tile units). Order doesn't matter. */
	a: { x: number; y: number; z: number };
	b: { x: number; y: number; z: number };

	/**
	 * Music to play while inside bounds.
	 * - null means "no music" (stop).
	 */
	music: MusicId | null;
	options?: MusicOptions;
};

const musicFields = [
	{
		a: { x: -Infinity, y: -Infinity, z: -Infinity },
		b: { x: Infinity, y: Infinity, z: Infinity },
		music: "placeholder",
		options: { volume: 0.025, loop: true },
	},
] as const satisfies readonly MusicField[];

// --------------------
// Implementation
// --------------------

function getMusicForPosition(pos: { xPx: number; yPx: number; z: number }) {
	const p = {
		x: pos.xPx / TILE_SIZE_PX,
		y: pos.yPx / TILE_SIZE_PX,
		z: pos.z,
	};

	let id: MusicId | null = null;
	let options: MusicOptions | undefined;

	for (const field of musicFields) {
		if (!inRange(p.x, field.a.x, field.b.x)) continue;
		if (!inRange(p.y, field.a.y, field.b.y)) continue;
		if (!inRange(p.z, field.a.z, field.b.z)) continue;

		id = field.music;
		options = field.options;
	}

	if (id !== null && !isMusicId(id)) return null;

	return { id, options };
}

function inRange(v: number, a: number, b: number) {
	const lo = Math.min(a, b);
	const hi = Math.max(a, b);
	return v >= lo && v <= hi;
}

function optionsSig(opts?: MusicOptions) {
	// normalize defaults to keep signature stable
	const volume = clamp(opts?.volume ?? 1, 0, 1);
	const loop = opts?.loop ?? true;
	return `${volume.toFixed(4)}|${loop ? 1 : 0}`;
}
