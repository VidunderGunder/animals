// ambience.ts
import { TILE_SIZE_PX } from "../config";
import { player } from "../state";
import { objectKeys } from "../types";
import { type AmbienceMix, audio } from "./audio-engine";
import { isAmbienceId } from "./audio-paths";

/**
 * Call this from your game loop with dtMs.
 * Example:
 *   updateAmbience(dtMs)
 */
export function updateAmbience(dtMs: number) {
	accMs += dtMs;

	// Throttle: avoid hammering audio automation every frame.
	// ~13 Hz feels responsive but stable.
	if (accMs < UPDATE_EVERY_MS) return;
	accMs = 0;

	const next = getAmbienceMixForPosition(player);

	// Skip tiny changes (boundary jitter, floating drift, etc)
	if (mixEquals(next, lastMix, MIX_EPS)) return;

	lastMix = next;

	// Fire and forget; audio engine handles fades.
	void audio.setAmbienceMix(next);
}

// --------------------
// Field definitions
// --------------------

type AmbienceFieldDynamic = {
	a: { x: number; y: number; z: number; mix: AmbienceMix };
	b: { x: number; y: number; z: number; mix: AmbienceMix };
	axis: "x" | "y" | "z";
};
type AmbienceFieldStatic = {
	a: { x: number; y: number; z: number };
	b: { x: number; y: number; z: number };
	mix: AmbienceMix;
};
type AmbienceField = AmbienceFieldDynamic | AmbienceFieldStatic;

const ambienceFields: AmbienceField[] = [];

export function setAmbienceFields(fields: AmbienceField[]) {
	ambienceFields.length = 0;
	ambienceFields.push(...fields);
}

// --------------------
// Implementation
// --------------------

const UPDATE_EVERY_MS = 75;
const MIX_EPS = 0.01;

let accMs = 0;
let lastMix: AmbienceMix = {};

function getAmbienceMixForPosition(pos: {
	xPx: number;
	yPx: number;
	z: number;
}): AmbienceMix {
	// Work in "tile units" for x/y so transitions can be smooth (sub-tile precision).
	const p = {
		x: pos.xPx / TILE_SIZE_PX,
		y: pos.yPx / TILE_SIZE_PX,
		z: pos.z,
	};

	let chosen: AmbienceMix | undefined;

	for (const field of ambienceFields) {
		const mix = evalField(field, p);
		if (mix) chosen = mix; // last match wins
	}

	return chosen ?? {};
}

function evalField(
	field: AmbienceField,
	p: { x: number; y: number; z: number },
): AmbienceMix | undefined {
	// Bounds check uses a/b as corners; order doesn't matter.
	const ax = field.a.x;
	const ay = field.a.y;
	const az = field.a.z;
	const bx = field.b.x;
	const by = field.b.y;
	const bz = field.b.z;

	if (!inRange(p.x, ax, bx)) return;
	if (!inRange(p.y, ay, by)) return;
	if (!inRange(p.z, az, bz)) return;

	// Static field: just return its mix.
	if (!("axis" in field)) return field.mix;

	// Dynamic field: interpolate mixes along axis.
	const aV = field.a[field.axis];
	const bV = field.b[field.axis];
	const v = p[field.axis];

	const t = clamp01(safeDiv(v - aV, bV - aV));
	return lerpMix(field.a.mix, field.b.mix, t);
}

function inRange(v: number, a: number, b: number) {
	const lo = Math.min(a, b);
	const hi = Math.max(a, b);
	return v >= lo && v <= hi;
}

function clamp01(n: number) {
	return n < 0 ? 0 : n > 1 ? 1 : n;
}

function safeDiv(num: number, den: number) {
	return den === 0 ? 0 : num / den;
}

function lerpMix(a: AmbienceMix, b: AmbienceMix, t: number): AmbienceMix {
	const out: AmbienceMix = {};
	const keys = Array.from(new Set([...objectKeys(a), ...objectKeys(b)])).filter(
		isAmbienceId,
	);

	for (const k of keys) {
		const av = a[k] ?? 0;
		const bv = b[k] ?? 0;
		const v = av + (bv - av) * t;

		// Keep zeros if you want explicit 0s; usually nicer to omit.
		if (v !== 0) out[k] = v;
	}

	return out;
}

function mixEquals(a: AmbienceMix, b: AmbienceMix, eps = 0.01) {
	const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
	for (const k of keys) {
		const av = (a as Record<string, number | undefined>)[k] ?? 0;
		const bv = (b as Record<string, number | undefined>)[k] ?? 0;
		if (Math.abs(av - bv) > eps) return false;
	}
	return true;
}
