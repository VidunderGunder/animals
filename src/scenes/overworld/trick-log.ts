// src/scenes/overworld/trick-log.ts
import { gameState } from "../../game-state";
import type { Rotation } from "../../input/input";
import type { Entity } from "./entity";

// Transient per-entity history of recent tricks, read back by consequence
// systems (dizziness, scoring, combos).

export type Trick = {
	type: "spin";
	rotation: Rotation;
	/** Full rotations: 1 = 360°, 2 = 720°. */
	rounds: number;
};

export type TrickLogEntry = {
	trick: Trick;
	/** gameState.ms */
	at: number;
};

/** Identity for repeat detection; intentionally rounds-agnostic. */
export function trickKey(trick: Trick): string {
	switch (trick.type) {
		case "spin":
			return `spin:${trick.rotation}`;
	}
}

export function formatTrick(trick: Trick): string {
	switch (trick.type) {
		case "spin": {
			const dir = trick.rotation === "clockwise" ? "→" : "←";
			return `${dir} ${trick.rounds * 360}°`;
		}
	}
}

export const TRICK_CHAIN_WINDOW_MS = 2000;

const MAX_ENTRIES = 24;

const logs = new Map<string, TrickLogEntry[]>();

export function logTrick(entity: Entity, trick: Trick): TrickLogEntry {
	const now = gameState.ms;
	const entry: TrickLogEntry = { trick, at: now };

	const log = logs.get(entity.id);
	const last = log?.[log.length - 1];

	// Lapsed since the last trick: start a fresh chain.
	if (!log || !last || now - last.at > TRICK_CHAIN_WINDOW_MS) {
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

/** Drops lapsed chains; call once per frame. */
export function updateTrickLog(now: number = gameState.ms): void {
	for (const [id, log] of logs) {
		const newest = log[log.length - 1];
		if (!newest || now - newest.at > TRICK_CHAIN_WINDOW_MS) {
			logs.delete(id);
		}
	}
}

export type TrickRepeat = {
	key: string;
	trick: Trick;
	count: number;
};

/** Tail run of consecutive same-key tricks. */
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

	return { key, trick: newest.trick, count };
}

export type TrickChain = {
	count: number;
	startedAt: number;
	lastAt: number;
	/** Counts down to 0 as the chain lapses. */
	remainingMs: number;
};

/** Tail run of any tricks still within the chain window. */
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
