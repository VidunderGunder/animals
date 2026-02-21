import {
	distanceChebyshev,
	distanceManhattan,
} from "../../../functions/general";
import type { Entity, EntityState } from "../entity";
import { vacate } from "../occupancy";
import { type Command, goToTile } from "./commands";

export type FollowState = {
	targetId?: string;
};
export function isFollowState(state: EntityState | null): state is FollowState {
	return typeof state?.targetId === "string";
}
export function follow({
	follower,
	target,
	condition,
}: {
	follower: Entity;
	target: Entity;
	condition?: () => boolean;
}): Command {
	const defaults = { ...follower };

	follower.solid = false; // don't block the target

	let goal = { x: follower.x, y: follower.y, z: follower.z };

	follower.state ??= { targetId: target.id } satisfies FollowState;

	vacate(follower);

	return {
		onUpdate() {
			const done = !(condition?.() ?? true);

			if (done) {
				follower = { ...defaults };
				follower.state = null;
				console.log(follower.state);

				return true;
			}

			follower.moveMode = target.moveMode;
			if (distanceChebyshev(follower, target) > 2) {
				follower.moveMode = "run";
			}

			if (follower.isMoving) return false;

			if (distanceManhattan(follower, target) !== 0) {
				goal = { x: target.x, y: target.y, z: target.z };
				follower.moveMode = target.moveMode || "walk";
			}

			if (distanceChebyshev(follower, goal) !== 0) {
				follower.brain?.runner.interrupt(
					goToTile(goal, { stopAdjacentIfTargetBlocked: true }),
				);
			}

			return false;
		},
	};
}
