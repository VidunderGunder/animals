// src/scenes/overworld/ai/commands.ts
import type { SpeechOptions } from "../../../audio/speak";
import type { MoveMode } from "../../../config";
import type { Direction } from "../../../input/input";
import { bubble, bubbles } from "../dialog";
import { type Entity, getEntityFacingTile } from "../entity";
import { getOccupant } from "../occupancy";
import { findPathDirections } from "./pathfinding";

export type Command = {
	/**
	 * Returns true if command is finished, false to continue next tick.
	 */
	onTick: (props: { entity: Entity; dt: number }) => boolean;
};

function wait(ms: number): Command {
	let elapsed = 0;
	return {
		onTick({ dt }) {
			elapsed += dt;
			return elapsed >= ms;
		},
	};
}

/** Wait until entity is fully stopped (not mid-path segment). */
function waitUntilStopped(): Command {
	return {
		onTick({ entity }) {
			return !entity.isMoving;
		},
	};
}

function dirToward(
	from: { x: number; y: number },
	to: { x: number; y: number },
) {
	const dx = to.x - from.x;
	const dy = to.y - from.y;

	// Prefer the dominant axis so it feels intentional
	if (Math.abs(dx) >= Math.abs(dy)) {
		return dx >= 0 ? "right" : "left";
	}
	return dy >= 0 ? "down" : "up";
}

function face(
	dir:
		| Direction
		| {
				x: number;
				y: number;
		  },
): Command {
	return {
		onTick({ entity }) {
			if (typeof dir === "object") dir = dirToward(entity, dir);
			entity.direction = dir;
			return true;
		},
	};
}

function leftOf(d: Direction): Direction {
	switch (d) {
		case "up":
			return "left";
		case "left":
			return "down";
		case "down":
			return "right";
		case "right":
			return "up";
	}
}
function rightOf(d: Direction): Direction {
	switch (d) {
		case "up":
			return "right";
		case "right":
			return "down";
		case "down":
			return "left";
		case "left":
			return "up";
	}
}
function backOf(d: Direction): Direction {
	switch (d) {
		case "up":
			return "down";
		case "down":
			return "up";
		case "left":
			return "right";
		case "right":
			return "left";
	}
}

/**
 * stepCmd: requests a one-tile step-ish.
 *
 * New behavior:
 * - It does NOT complete if blocked.
 * - It tries dir, then left, right, back as fallbacks.
 * - Once movement starts, it waits until movement finishes, then completes.
 */
function step(dir: Direction): Command {
	let phase: "requesting" | "moving" = "requesting";
	let attemptIndex = 0;
	let retryCooldownMs = 0;

	const tries: Direction[] = [dir, leftOf(dir), rightOf(dir), backOf(dir)];

	return {
		onTick({ entity, dt }) {
			// If we started moving, wait for finish.
			if (phase === "moving") {
				return !entity.isMoving;
			}

			// Overworld may have started movement already.
			if (entity.isMoving) {
				phase = "moving";
				return false;
			}

			// tiny cooldown so we don't spam direction flips every frame
			if (retryCooldownMs > 0) {
				retryCooldownMs -= dt;
				return false;
			}

			const nextDir = tries[attemptIndex] ?? dir;
			entity.brainDesiredDirection = nextDir;

			// next attempt next tick
			attemptIndex = (attemptIndex + 1) % tries.length;

			// after a full cycle, pause a bit more to avoid jitter
			if (attemptIndex === 0) retryCooldownMs = 120;
			else retryCooldownMs = 40;

			return false;
		},
	};
}

/**
 * goToTile: A* to a target tile.
 *
 * - If blocked by dynamic occupancy (player/NPC), it will replan.
 * - It only ever requests ONE step at a time through `entity.intentDir`.
 * - It completes once the entity is snapped to the goal tile.
 */
function goToTile(
	target: { x: number; y: number; z: number },
	opts?: {
		stopAdjacentIfTargetBlocked?: boolean;
	},
): Command {
	const stopAdjacentIfTargetBlocked =
		opts?.stopAdjacentIfTargetBlocked ?? false;

	let cached: Direction[] | null = null;
	let repathCooldownMs = 0;
	let lastAt: { x: number; y: number; z: number } | null = null;
	let stuckMs = 0;

	// NEW: detect when something else (eg. interaction) changed facing
	let lastIssued: Direction | null = null;

	function dirToDxDy(dir: Direction): { dx: number; dy: number } {
		switch (dir) {
			case "up":
				return { dx: 0, dy: -1 };
			case "down":
				return { dx: 0, dy: 1 };
			case "left":
				return { dx: -1, dy: 0 };
			case "right":
				return { dx: 1, dy: 0 };
		}
	}

	return {
		onTick({ entity, dt }) {
			if (
				entity.x === target.x &&
				entity.y === target.y &&
				entity.z === target.z
			) {
				return true;
			}

			// While moving, we don't issue new intents.
			if (entity.isMoving) return false;

			// NEW: if our last-issued direction doesn't match current facing,
			// something external likely rotated the NPC (eg. face(player)).
			// Drop cached plan so we don't take a "stale" first step.
			if (lastIssued && entity.direction !== lastIssued) {
				cached = null;
				repathCooldownMs = 0;
				stuckMs = 0;
				lastAt = null;
				lastIssued = null;
			}

			if (
				lastAt &&
				lastAt.x === entity.x &&
				lastAt.y === entity.y &&
				lastAt.z === entity.z
			) {
				stuckMs += dt;
			} else {
				stuckMs = 0;
				lastAt = { x: entity.x, y: entity.y, z: entity.z };
			}

			repathCooldownMs -= dt;
			if (repathCooldownMs < 0) repathCooldownMs = 0;

			const shouldRepath =
				!cached ||
				cached.length === 0 ||
				repathCooldownMs === 0 ||
				stuckMs > 350;

			if (shouldRepath) {
				cached = findPathDirections(
					entity,
					{ x: entity.x, y: entity.y, z: entity.z },
					target,
					{ maxExpanded: 2500 },
				);

				if (!cached || cached.length === 0) {
					repathCooldownMs = 200;
					return false;
				}

				repathCooldownMs = 120;
				stuckMs = 0;
			}

			const next = cached?.[0];
			if (!next) return false;

			if (stopAdjacentIfTargetBlocked && cached?.length === 1) {
				const { dx, dy } = dirToDxDy(next);
				const wouldEnter = { x: entity.x + dx, y: entity.y + dy, z: entity.z };

				if (
					wouldEnter.x === target.x &&
					wouldEnter.y === target.y &&
					wouldEnter.z === target.z
				) {
					const occ = getOccupant(target.x, target.y, target.z);
					if (occ && occ !== entity.id) {
						return true; // finish adjacent
					}
				}
			}

			entity.brainDesiredDirection = next;
			lastIssued = next; // NEW: remember what we asked for

			cached?.shift();
			repathCooldownMs = Math.min(repathCooldownMs, 90);
			return false;
		},
	};
}

export type Route = { x: number; y: number; z: number; moveMode: MoveMode }[];
type RouteState = { routeIndex?: number };

function routeLoop(entity: Entity, route: Route) {
	entity.state ??= { routeIndex: 0 };
	const state: RouteState = entity.state;

	entity.moveMode = "run";
	if (!entity.brain?.runner.isIdle()) return;

	let i = (typeof state.routeIndex === "number" ? state.routeIndex : 0) | 0;
	if (i < 0 || i >= route.length) i = 0;

	const cur = route[i];
	if (!cur) throw new Error(`Invalid brain route index ${i}`);

	if (entity.x === cur.x && entity.y === cur.y && entity.z === cur.z) {
		i = (i + 1) % route.length;
		state.routeIndex = i;
	} else {
		state.routeIndex = i;
	}

	if (typeof state.routeIndex !== "number") {
		throw new Error(`Invalid brain state routeIndex ${state.routeIndex}`);
	}

	const target = route[state.routeIndex];
	if (!target) {
		throw new Error(`Invalid brain route index ${state.routeIndex}`);
	}

	entity.brain.runner.push({
		onTick({ entity }) {
			if (entity.moveMode !== target.moveMode)
				entity.moveMode = target.moveMode;
			return true;
		},
	});

	entity.brain.runner.push(
		cmd.goToTile(target, { stopAdjacentIfTargetBlocked: true }),
	);

	entity.brain.runner.push({
		onTick() {
			entity.state ??= {};
			const s2 = entity.state;
			const i2 = (typeof s2.routeIndex === "number" ? s2.routeIndex : 0) | 0;
			s2.routeIndex = (i2 + 1) % route.length;
			return true;
		},
	});
}

function talk({
	activator,
	activated,
	content,
	onTalk,
	onAnswer,
	options,
}: {
	activator?: Entity;
	activated: Entity;
	content: string;
	onTalk?: () => void;
	onAnswer?: () => void;
	options?: SpeechOptions;
}) {
	const bubbleId = `${activated.id}_interact`;
	if (bubbles.has(bubbleId)) return;
	if (activated.interactionLock) return;

	const brain = activated.brain;

	if (!brain) {
		bubble(bubbleId, content, activated, options);
		return;
	}

	activated.interactionLock = true;

	activated.brain?.runner.interrupt([
		onTalk ?? null,
		cmd.waitUntilStopped(),
		activator
			? cmd.goToTile(getEntityFacingTile(activator), {
					stopAdjacentIfTargetBlocked: true,
				})
			: null,
		activator ? cmd.face(activator) : null,
		() => bubble(bubbleId, content, activated, options),
		cmd.wait(1000),
		onAnswer ?? null,
		{
			onTick: ({ entity }) => {
				entity.interactionLock = false;
				return true;
			},
		},
	]);
}

function wanderAround(entity: Entity, origin: { x: number; y: number }) {
	if (!entity.brain?.runner.isIdle()) return;

	const randomOffset = () => Math.floor(Math.random() * 3) - 1;
	const pause = Math.floor(Math.random() * 2000) + 1000;

	entity.brain.runner.push(cmd.wait(pause));

	const dest = {
		x: origin.x + randomOffset(),
		y: origin.y + randomOffset(),
		z: 0,
	};

	entity.brain.runner.push(
		cmd.goToTile(dest, { stopAdjacentIfTargetBlocked: true }),
	);
}

export const cmd = {
	face,
	step,
	goToTile,
	routeLoop,
	wanderAround,
	talk,
	wait,
	waitUntilStopped,
};
