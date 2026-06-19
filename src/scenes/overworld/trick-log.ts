// src/scenes/overworld/trick-log.ts
import { gameState } from "../../game-state";
import type { Rotation } from "../../input/input";
import type { Entity } from "./entity";

/**
 * A record of the tricks an entity has performed, newest last.
 *
 * This is the shared substrate for the trick system (parkour / skating /
 * etc): individual tricks append a structured descriptor here when they
 * start, and *consequence* systems (dizziness, scoring, combos, ...) read
 * the log back to decide what should happen — e.g. "spun the same way 3×
 * in a row" or "back-flipped N times without touching the ground".
 *
 * The log is intentionally transient (not persisted): it represents recent
 * in-the-moment history, not saved progress.
 */

/**
 * Structured description of a single trick. Discriminated by `type` so new
 * trick families (flip, grind, grab, ...) can be added without touching the
 * consumers — they pattern-match on what they care about.
 */
export type Trick = {
	type: "spin";
	rotation: Rotation;
	/** Number of full rotations (1 = 360°, 2 = 720°, ...) */
	rounds: number;
};

export type TrickLogEntry = {
	trick: Trick;
	/** gameState.ms at which the trick began */
	at: number;
};

/**
 * Repeat-grouping signature: two tricks with the same key count as "the
 * same trick" for repeat detection. Deliberately ignores magnitude (rounds)
 * so a 360 then a 720 in the same direction still reads as a repeat.
 */
export function trickKey(trick: Trick): string {
	switch (trick.type) {
		case "spin":
			return `spin:${trick.rotation}`;
	}
}

/** Compact, human-readable label for a trick (debug overlays, logs). */
export function formatTrick(trick: Trick): string {
	switch (trick.type) {
		case "spin": {
			const dir = trick.rotation === "clockwise" ? "cw" : "ccw";
			return `spin ${dir} ×${trick.rounds}`;
		}
	}
}

/** Cap per-entity history so a long session can't grow unbounded. */
const MAX_ENTRIES = 24;

const logs = new Map<string, TrickLogEntry[]>();

/** Append a trick to an entity's log. Call when the trick actually starts. */
export function logTrick(entity: Entity, trick: Trick): TrickLogEntry {
	const entry: TrickLogEntry = { trick, at: gameState.ms };

	const log = logs.get(entity.id);
	if (!log) {
		logs.set(entity.id, [entry]);
		return entry;
	}

	log.push(entry);
	if (log.length > MAX_ENTRIES) log.splice(0, log.length - MAX_ENTRIES);
	return entry;
}

export function getTrickLog(entity: Entity): readonly TrickLogEntry[] {
	return logs.get(entity.id) ?? [];
}

export function clearTrickLog(entity: Entity): void {
	logs.delete(entity.id);
}

/**
 * How long after a trick you can perform another and still have it count as
 * part of the same chain (combo). Also bounds repeat detection, so "the same
 * trick N times in a row" only counts while you're actively chaining.
 */
export const TRICK_CHAIN_WINDOW_MS = 1500;

export type TrickRepeat = { key: string; count: number };

/**
 * The most recent run of consecutive *identical* tricks (same `trickKey`),
 * where each successive trick started within `maxGapMs` of the previous one.
 * This is the "same trick over and over" signal — e.g. dizziness when `count`
 * reaches a threshold. Returns `null` if the log is empty.
 */
export function currentTrickRepeat(
	entity: Entity,
	opts: { maxGapMs?: number } = {},
): TrickRepeat | null {
	const maxGapMs = opts.maxGapMs ?? TRICK_CHAIN_WINDOW_MS;
	const log = logs.get(entity.id);

	const newest = log?.[log.length - 1];
	if (!log || !newest) return null;

	const key = trickKey(newest.trick);
	let count = 1;
	let prevAt = newest.at;

	for (let i = log.length - 2; i >= 0; i--) {
		const entry = log[i];
		if (!entry) break;
		if (trickKey(entry.trick) !== key) break;
		if (prevAt - entry.at > maxGapMs) break;
		count++;
		prevAt = entry.at;
	}

	return { key, count };
}

export type TrickChain = {
	/** Number of tricks linked in the current chain (>= 1). */
	count: number;
	/** gameState.ms of the first trick in the chain. */
	startedAt: number;
	/** gameState.ms of the most recent trick in the chain. */
	lastAt: number;
	/** ms left before the chain lapses; 0 once it has expired. */
	remainingMs: number;
};

/**
 * The current chain (combo): the run of *any* tricks at the tail of the log,
 * each performed within `TRICK_CHAIN_WINDOW_MS` of the previous. `remainingMs`
 * counts down from the most recent trick and hits 0 when the chain breaks —
 * landing another trick before then extends it. Returns `null` if the log is
 * empty.
 */
export function currentTrickChain(
	entity: Entity,
	now: number = gameState.ms,
): TrickChain | null {
	const log = logs.get(entity.id);

	const newest = log?.[log.length - 1];
	if (!log || !newest) return null;

	let count = 1;
	let startedAt = newest.at;
	let prevAt = newest.at;

	for (let i = log.length - 2; i >= 0; i--) {
		const entry = log[i];
		if (!entry) break;
		if (prevAt - entry.at > TRICK_CHAIN_WINDOW_MS) break;
		count++;
		startedAt = entry.at;
		prevAt = entry.at;
	}

	const remainingMs = Math.max(0, TRICK_CHAIN_WINDOW_MS - (now - newest.at));

	return { count, startedAt, lastAt: newest.at, remainingMs };
}
