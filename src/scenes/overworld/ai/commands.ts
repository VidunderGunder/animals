// src/scenes/overworld/ai/commands.ts
import type { SpeechOptions } from "../../../audio/speak";
import type { MoveMode } from "../../../config";
import { type Direction, rotate } from "../../../input/input";
import { bubble, bubbles } from "../dialog";
import { type Entity, getEntityFacingTile } from "../entity";
import { follow } from "./command-follow";
import { goToTile } from "./command-goto";

export type Command = {
	/**
	 * Returns true if command is finished, false to continue next tick.
	 */
	onUpdate: (props: { entity: Entity; dt: number }) => boolean;
};

function wait(ms: number): Command {
	let elapsed = 0;
	return {
		onUpdate({ dt }) {
			elapsed += dt;
			return elapsed >= ms;
		},
	};
}

/** Wait until entity is fully stopped (not mid-path segment). */
function waitUntilStopped(): Command {
	return {
		onUpdate({ entity }) {
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
		onUpdate({ entity }) {
			if (typeof dir === "object") dir = dirToward(entity, dir);
			entity.direction = dir;
			return true;
		},
	};
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

	const tries: Direction[] = [
		dir,
		rotate(dir, "counterclockwise"),
		rotate(dir, "clockwise"),
		rotate(dir, "clockwise", 2),
	];

	return {
		onUpdate({ entity, dt }) {
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
		onUpdate({ entity }) {
			if (entity.moveMode !== target.moveMode)
				entity.moveMode = target.moveMode;
			return true;
		},
	});

	entity.brain.runner.push(
		cmd.goToTile(target, { stopAdjacentIfTargetBlocked: true }),
	);

	entity.brain.runner.push({
		onUpdate() {
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
	onStart,
	onEnd,
	options,
}: {
	activator?: Entity;
	activated: Entity;
	content: string;
	onStart?: () => void;
	onEnd?: () => void;
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
		onStart ?? null,
		cmd.waitUntilStopped(),
		activator
			? cmd.goToTile(getEntityFacingTile(activator), {
					stopAdjacentIfTargetBlocked: true,
				})
			: null,
		activator ? cmd.face(activator) : null,
		() => {
			bubble(bubbleId, content, activated, options);
			return {
				onUpdate: () => {
					return !bubbles.has(bubbleId);
				},
			};
		},
		{
			onUpdate: ({ entity }) => {
				entity.interactionLock = false;
				return true;
			},
		},
		onEnd ?? null,
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
	follow,
};
