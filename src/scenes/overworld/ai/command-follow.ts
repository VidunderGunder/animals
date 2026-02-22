// src/scenes/overworld/ai/command-follow.ts
import { distanceChebyshev } from "../../../functions/general";
import { type Direction, rotate } from "../../../input/input";
import { type Entity, type EntityState, entities } from "../entity";
import { forceOccupy, getOccupant, occupy, vacate } from "../occupancy";
import { setCurrentSegment, type Transition } from "../transition/transition";
import { type Command, goToTile } from "./commands";
import { tryPlanMove } from "./pathfinding";

export type FollowState = {
	targetId: string;
	swapCooldownMs: number;

	// NEW: smooth moveMode switching
	moveModeHoldMs: number;
	moveMode: "walk" | "run" | "skate";

	// NEW: short window where follower becomes non-solid so it never blocks target
	yieldMs: number;
	isYielding: boolean;
	wasSolidBeforeYield: boolean;
};

export const defaultFollowState = {
	targetId: "",
	swapCooldownMs: 0,
	moveModeHoldMs: 0,
	moveMode: "walk",
	yieldMs: 0,
	isYielding: false,
	wasSolidBeforeYield: false,
} as const satisfies FollowState;
export const getDefaultFollowState = (
	follower: Entity,
	target: Entity | string,
): FollowState => ({
	...defaultFollowState,
	targetId: typeof target === "string" ? target : target.id,
	wasSolidBeforeYield: follower.solid,
});

export function isFollowStateFast(
	state: EntityState | null | undefined,
): state is FollowState {
	return !!state && typeof state.targetId === "string";
}
export function getFollowState(entity: Entity): FollowState | null {
	return isFollowStateFast(entity.state) ? entity.state : null;
}

export function getFollowTargetId(entity: Entity): string | null {
	const s = getFollowState(entity);
	return s?.targetId ?? null;
}

export function isFollowLinked(
	a: Entity | undefined,
	b: Entity | undefined,
): boolean {
	if (!a || !b) return false;
	const aT = getFollowTargetId(a);
	const bT = getFollowTargetId(b);
	return aT === b.id || bT === a.id;
}

function decrementCooldown(state: FollowState, dt: number) {
	const cur = state.swapCooldownMs ?? 0;
	if (cur <= 0) return;
	state.swapCooldownMs = Math.max(0, cur - dt);
}

function decToZero(n: number, dt: number) {
	return n <= 0 ? 0 : Math.max(0, n - dt);
}

function updateMoveModeWithHysteresis(
	state: FollowState,
	dist: number,
	targetMove: Entity["moveMode"],
) {
	// Hold prevents rapid flip-flop
	if (state.moveModeHoldMs > 0) return;

	// Thresholds (tweakable)
	const RUN_ON = 3; // switch to run when 3+ tiles away
	const RUN_OFF = 1; // switch back when within 1 tile

	// If target is running and we're >=2 away, run sooner
	const wantsRun = dist >= RUN_ON || (targetMove === "run" && dist >= 2);

	if (wantsRun) {
		if (state.moveMode !== "run") {
			state.moveMode = "run";
			state.moveModeHoldMs = 320;
		}
		return;
	}

	// Only drop back to walk when close enough
	if (dist <= RUN_OFF) {
		if (state.moveMode !== "walk") {
			state.moveMode = "walk";
			state.moveModeHoldMs = 260;
		}
	}
}

export function follow({
	follower,
	target,
	condition,
	maxTrail = 8,
}: {
	follower: Entity;
	target: Entity;
	condition?: () => boolean;
	maxTrail?: number;
}): Command {
	// Ensure state exists
	follower.interactionLock = false;
	follower.state ??= getDefaultFollowState(follower, target);
	const state = isFollowStateFast(follower.state) ? follower.state : null;
	if (!state) throw new Error("Failed to initialize follow state");

	function resetState() {
		follower.state = null;
		follower.moveMode = "walk";
	}

	return {
		onUpdate({ dt }) {
			decrementCooldown(state, dt);

			// stop condition
			const shouldContinue = (condition?.() ?? true) && target;
			if (!shouldContinue) {
				resetState();
				return true;
			}

			// tick timers
			state.swapCooldownMs = decToZero(state.swapCooldownMs ?? 0, dt);
			state.moveModeHoldMs = decToZero(state.moveModeHoldMs ?? 0, dt);
			state.yieldMs = Math.max(0, (state.yieldMs ?? 0) - dt);

			// ENTER yield (one-shot)
			if (state.yieldMs > 0 && !state.isYielding) {
				state.isYielding = true;
				state.wasSolidBeforeYield = follower.solid;

				// become non-blocking
				follower.solid = false;

				// release any reservation / standing occupancy ONCE
				vacate({ id: follower.id });

				// optional: clear intent so we don't "fight" during yield
				follower.brainDesiredDirection = null;

				return false;
			}

			// EXIT yield (one-shot)
			if (state.yieldMs === 0 && state.isYielding) {
				state.isYielding = false;

				// restore solidity
				follower.solid = state.wasSolidBeforeYield;
				state.wasSolidBeforeYield = false;

				// re-occupy standing tile if solid again (safe + idempotent)
				if (follower.solid)
					occupy({
						x: follower.x,
						y: follower.y,
						z: follower.z,
						id: follower.id,
					});

				// continue normal follow logic this tick
			}

			// Yield ended: restore solidity
			if (!follower.solid && state.wasSolidBeforeYield) {
				follower.solid = true;
				state.wasSolidBeforeYield = false;
			}

			// Smooth moveMode
			const dist = distanceChebyshev(follower, target);
			updateMoveModeWithHysteresis(state, dist, target.moveMode ?? "walk");
			follower.moveMode = state.moveMode;

			// while moving, do nothing
			if (follower.isMoving) return false;

			// Prefer breadcrumbs
			// Prefer breadcrumbs (most recent first => <1 tile behind most of the time)
			const trail = target.trail;
			if (trail.length > 0) {
				// keep bounded defensively
				if (trail.length > maxTrail) trail.splice(0, trail.length - maxTrail);

				// Pick the NEWEST breadcrumb we can actually step into soon.
				// Scan from end (latest) backwards until we find one that isn't occupied by others.
				let pickIndex = -1;
				for (let i = trail.length - 1; i >= 0; i--) {
					const t = trail[i];
					if (!t) continue;

					const occ = getOccupant(t.x, t.y, t.z);
					if (occ && occ !== follower.id) continue;

					pickIndex = i;
					break;
				}

				if (pickIndex !== -1) {
					// Drop stale older crumbs so we don’t “chase the past”
					if (pickIndex > 0) trail.splice(0, pickIndex);

					const goal = trail[0];
					if (goal) {
						// If we already reached this breadcrumb, consume it
						if (
							follower.x === goal.x &&
							follower.y === goal.y &&
							follower.z === goal.z
						) {
							trail.shift();
							return false;
						}

						// If goal still occupied by the target, wait (reservation timing)
						const occ = getOccupant(goal.x, goal.y, goal.z);
						if (occ && occ !== follower.id) return false;

						follower.brain?.runner.interrupt(
							goToTile(goal, { stopAdjacentIfTargetBlocked: false }),
						);
						return false;
					}
				}
			}

			// No breadcrumbs: just try to get adjacent (Pokémon-like fallback)
			follower.brain?.runner.interrupt(
				goToTile(
					{ x: target.x, y: target.y, z: target.z },
					{ stopAdjacentIfTargetBlocked: true },
				),
			);

			return false;
		},
	};
}

export function overworldFollowerCollision({
	target,
	planned,
}: {
	target: Entity;
	planned: Transition;
}): boolean {
	const occId = getOccupant(planned.end.x, planned.end.y, planned.end.z);
	const other = occId ? entities.get(occId) : undefined;

	// Only care if the blocker is OUR follower (linked)
	const otherIsFollower =
		!!other &&
		isFollowStateFast(other.state) &&
		other.state.targetId === target.id;

	if (!otherIsFollower) return false;

	const follower = other;
	const state = getFollowState(follower);
	if (!state) return false;

	// If either is mid-move or the planned move is a multi-segment/transition,
	// we still yield — we just do it without trying to sidestep.
	const isTransitionMove =
		planned.path.length > 1 || planned.end.z !== target.z;

	// Arm yield window (prevents immediate re-occupy/jitter)
	state.swapCooldownMs = Math.max(state.swapCooldownMs ?? 0, 120);
	state.yieldMs = Math.max(state.yieldMs ?? 0, isTransitionMove ? 220 : 160);
	state.isYielding = false;

	// Clear follower occupancy and ensure target reserves the destination
	vacate({ id: follower.id });
	forceOccupy({ ...planned.end, id: target.id });

	// If follower is idle and this was a simple step, try to step aside (nice-to-have).
	// If it can’t, target still goes through because follower is non-solid during yield.
	if (!isTransitionMove && !follower.isMoving) {
		// "planned end" is follower's current tile; try to move follower out of the lane
		const dx = planned.end.x - target.x;
		const dy = planned.end.y - target.y;
		const dir: Direction | null =
			dx === 1 && dy === 0
				? "right"
				: dx === -1 && dy === 0
					? "left"
					: dx === 0 && dy === 1
						? "down"
						: dx === 0 && dy === -1
							? "up"
							: null;

		if (dir) {
			const directionCandidates: Direction[] = [
				rotate(dir, "counterclockwise"),
				rotate(dir, "clockwise"),
				rotate(dir, "counterclockwise", 2),
			];

			for (const d of directionCandidates) {
				const sidestepPlanned = tryPlanMove(d, follower);
				if (!sidestepPlanned) continue;

				// Reserve sidestep end for follower (only if solid right now; it might already be false)
				const okSidestep = follower.solid
					? occupy({ ...sidestepPlanned.end, id: follower.id })
					: true;

				if (!okSidestep) continue;

				follower.isMoving = true;
				follower.transitionEndTile = sidestepPlanned.end;
				follower.animationOverride = sidestepPlanned.animation ?? null;
				follower.transitionPath = sidestepPlanned.path.map((p) => ({ ...p }));

				const first = follower.transitionPath[0];
				if (first) {
					const prev = first.onSegmentEnd;
					first.onSegmentEnd = (e) => {
						// when we actually leave, ensure we’re not “ghost occupying”
						if (e.solid) vacate({ id: e.id });
						prev?.(e);
					};
				}

				setCurrentSegment(follower);
				break;
			}
		}
	}

	return true; // ✅ allow leader to proceed
}
