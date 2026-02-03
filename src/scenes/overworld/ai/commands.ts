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
			// immediate
			return true;
		},
	};
}

/**
 * stepCmd: requests a one-tile step in given direction.
 *
 * Behavior:
 * - On first tick it attempts to plan the move (via tryPlanMove).
 * - It sets entity.intentDir for that tick (so overworld can call tryPlanMove and start movement).
 * - It completes only after the movement has started AND finished.
 */
function step(dir: Direction): Command {
	let state: "init" | "started" | "waitingFinish" = "init";
	return {
		tick({ entity }) {
			if (state === "init") {
				// Request the direction for this tick
				entity.intentDir = dir;
				// mark as requested; the overworld will call tryPlanMove and start the move if possible.
				state = "started";
				return false;
			}

			// Once movement actually started, wait until it's finished.
			if (state === "started") {
				if (entity.isMoving) {
					state = "waitingFinish";
					return false;
				} else {
					// Movement did not start (blocked) -> treat as done to avoid deadlock
					return true;
				}
			}

			// waitingFinish
			if (!entity.isMoving) {
				return true;
			}
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
