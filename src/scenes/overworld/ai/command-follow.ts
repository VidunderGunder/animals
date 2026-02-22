// src/scenes/overworld/ai/command-follow.ts
import {
	distanceManhattan,
	oppositeDirection,
} from "../../../functions/general";
import { type Direction, rotate } from "../../../input/input";
import { type Entity, type EntityState, entities } from "../entity";
import { forceOccupy, getOccupant, occupy, vacate } from "../occupancy";
import { setCurrentSegment, type Transition } from "../transition/transition";
import { goToTile } from "./command-goto";
import type { Command } from "./commands";
import { tryPlanMove } from "./pathfinding";

export type FollowState = {
	targetId: string;
	swapCooldownMs: number;

	moveModeHoldMs: number;
	moveMode: "walk" | "run" | "skate";

	// yield
	yieldMs: number;
	isYielding: boolean;
	wasSolidBeforeYield: boolean;

	// NEW: mode latch to avoid flapping
	catchUpMs: number;
};

export const defaultFollowState = {
	targetId: "",
	swapCooldownMs: 0,
	moveModeHoldMs: 0,
	moveMode: "walk",
	yieldMs: 0,
	isYielding: false,
	wasSolidBeforeYield: false,
	catchUpMs: 0,
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

function updateMoveModeStable(target: Entity, follower: Entity) {
	const state = getFollowState(follower);
	if (!state) return;

	const targetMove = target.moveMode ?? "walk";

	const dist = distanceManhattan(follower, target);

	const trailBacklog = target.trail.length;

	// Engage catch-up when we are falling behind (planar + trail only)
	const shouldCatchUp =
		dist >= 2 || trailBacklog >= 2 || (targetMove === "run" && dist >= 2);

	// Release only when we are close again (planar)
	const closeEnough = dist <= 1;

	// If already catching up, keep it latched a bit
	if (state.catchUpMs > 0) {
		if (!closeEnough) {
			state.moveMode = "run";
			return;
		}
		// closeEnough: allow release below
	}

	if (shouldCatchUp && !closeEnough) {
		state.moveMode = "run";
		state.catchUpMs = 420; // latch window
		return;
	}

	state.moveMode = "walk";
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

				follower.solid = false;
				vacate({ id: follower.id });
				follower.brainDesiredDirection = null;
				return false;
			}

			// EXIT yield (one-shot)
			if (state.yieldMs === 0 && state.isYielding) {
				state.isYielding = false;

				follower.solid = state.wasSolidBeforeYield;
				state.wasSolidBeforeYield = false;

				if (follower.solid)
					occupy({
						x: follower.x,
						y: follower.y,
						z: follower.z,
						id: follower.id,
					});
			}

			updateMoveModeStable(target, follower);

			// small hold only when actually switching
			if (state.moveModeHoldMs <= 0 && follower.moveMode !== state.moveMode) {
				follower.moveMode = state.moveMode;
				state.moveModeHoldMs = 260;
			} else if (state.moveModeHoldMs <= 0) {
				follower.moveMode = state.moveMode;
			}

			state.moveModeHoldMs = decToZero(state.moveModeHoldMs ?? 0, dt);
			state.catchUpMs = decToZero(state.catchUpMs ?? 0, dt);

			// while moving, do nothing
			if (follower.isMoving) return false;

			// Prefer breadcrumbs (MOST recent first; Pokémon-tight)
			const trail = target.trail;
			if (trail.length > 0) {
				// keep bounded defensively
				if (trail.length > maxTrail) trail.splice(0, trail.length - maxTrail);

				// 1) Prefer the newest crumb (last item)
				// 2) If blocked, walk backwards until we find a usable one
				let pickIndex = -1;

				for (let i = trail.length - 1; i >= 0; i--) {
					const crumb = trail[i];
					if (!crumb) continue;

					// If someone else occupies it, can't step there
					const occ = getOccupant(crumb.x, crumb.y, crumb.z);
					if (occ && occ !== follower.id) continue;

					pickIndex = i;
					break;
				}

				if (pickIndex !== -1) {
					// Drop ALL older crumbs than the one we picked
					// so we always bias to "latest known good"
					if (pickIndex > 0) trail.splice(0, pickIndex);

					const goal = trail[0];
					if (goal) {
						// If we already reached this crumb, consume and continue next tick
						if (
							follower.x === goal.x &&
							follower.y === goal.y &&
							follower.z === goal.z
						) {
							trail.shift();
							return false;
						}

						// If goal got occupied after we checked (race), wait
						const occ = getOccupant(goal.x, goal.y, goal.z);
						if (occ && occ !== follower.id) return false;

						// One-shot: head directly to the crumb (typically 1 step behind leader)
						follower.brain?.runner.interrupt(
							goToTile(goal, { stopAdjacentIfTargetBlocked: false }),
						);
						return false;
					}
				}
			}

			if (follower.z !== target.z) {
				const occ = getOccupant(target.x, target.y, target.z);
				const targetIsOccupyingSelf = occ === target.id;

				// No crumbs to follow right now (or all crumbs are unusable)
				const hasUsableCrumb = (() => {
					const trail = target.trail;
					for (let i = trail.length - 1; i >= 0; i--) {
						const c = trail[i];
						if (!c) continue;
						const occ2 = getOccupant(c.x, c.y, c.z);
						if (occ2 && occ2 !== follower.id) continue;
						return true;
					}
					return false;
				})();

				if (targetIsOccupyingSelf && !hasUsableCrumb) {
					// Optional: reduce “panic running” while waiting at chokepoint
					follower.moveMode = "walk";
					return false;
				}
			}

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

				follower.direction = oppositeDirection(d);
				follower.isMoving = true;
				follower.transitionEndTile = sidestepPlanned.end;
				follower.animationOverride = sidestepPlanned.animation ?? null;
				follower.transitionPath = sidestepPlanned.path.map((p) => ({ ...p }));

				const first = follower.transitionPath[0];
				if (first) {
					const prev = first.onSegmentEnd;
					const endIsStartTile =
						distanceManhattan(follower, sidestepPlanned.end) === 0;
					first.onSegmentEnd = (e) => {
						// when we actually leave, ensure we’re not “ghost occupying”

						if (e.solid && !endIsStartTile) vacate(e);

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
