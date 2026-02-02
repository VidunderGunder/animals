// music.ts
import { TILE_SIZE_PX } from "../config";
import { player } from "../state";
import { audio, type MusicOptions } from "./audio-engine";
import { isMusicId, type MusicId } from "./audio-paths";

let accMs = 0;
const UPDATE_EVERY_MS = 500;

export function updateMusic(dtMs: number) {
	accMs += dtMs;

	if (accMs < UPDATE_EVERY_MS) return;
	accMs = 0;

	const next = getMusicForPosition(player);

	if (next === null) {
		void audio.setMusic(null);
		return;
	}

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
		options: { volume: 0.05, loop: true },
	},
] as const satisfies readonly MusicField[];

// --------------------
// Implementation
// --------------------

function getMusicForPosition(pos: { xPx: number; yPx: number; z: number }) {
	// Work in "tile units" (matches ambience semantics).
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

		// last match wins
		id = field.music;
		options = field.options;
	}

	// Extra safety if someone mistypes a music id.
	if (id !== null && !isMusicId(id)) return null;

	return {
		id,
		options,
	};
}

function inRange(v: number, a: number, b: number) {
	const lo = Math.min(a, b);
	const hi = Math.max(a, b);
	return v >= lo && v <= hi;
}
