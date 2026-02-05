// src/scenes/overworld/ai/commands.ts
import type { Direction } from "../../../input/input";
import { rsvp } from "../dialog";
import type { Entity } from "../entities";

export type Command = {
	tick: (props: { entity: Entity; dt: number }) => boolean | Promise<boolean>;
};

function wait(ms: number): Command {
	let elapsed = 0;
	return {
		tick({ dt }) {
			elapsed += dt;
			return elapsed >= ms;
		},
	};
}

function face(dir: Direction): Command {
	return {
		tick({ entity }) {
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
		tick({ entity, dt }) {
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
			entity.intentDir = nextDir;

			// next attempt next tick
			attemptIndex = (attemptIndex + 1) % tries.length;

			// after a full cycle, pause a bit more to avoid jitter
			if (attemptIndex === 0) retryCooldownMs = 120;
			else retryCooldownMs = 40;

			return false;
		},
	};
}

/** sayCmd: immediate RSVP and finish */
function say(id: string, text: string): Command {
	return {
		tick() {
			rsvp(id, text);
			return true;
		},
	};
}

export const cmd = {
	wait,
	face,
	step,
	say,
};
