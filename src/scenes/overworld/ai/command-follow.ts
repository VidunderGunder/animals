// src/scenes/overworld/ai/command-follow.ts
import { TILE_SIZE_PX } from "../../../config";
import {
	distanceChebyshev,
	oppositeDirection,
} from "../../../functions/general";
import { type Direction, rotate } from "../../../input/input";
import { getEdge } from "../cells";
import { type Entity, type EntityState, entities } from "../entity";
import { getOccupant, occupy, swapOccupants, vacate } from "../occupancy";
import { setCurrentSegment, type Transition } from "../transition/transition";
import { type Command, goToTile } from "./commands";
import { tryPlanMove } from "./pathfinding";

export type FollowState = {
	targetId: string;
	swapCooldownMs: number;
};

export function isFollowState(
	state: EntityState | null | undefined,
): state is FollowState {
	return !!state && typeof state.targetId === "string";
}
export function getFollowState(entity: Entity): FollowState | null {
	return isFollowState(entity.state) ? entity.state : null;
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
	follower.state ??= {
		targetId: "",
		swapCooldownMs: 0,
	} satisfies FollowState;
	const state = isFollowState(follower.state) ? follower.state : null;
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

			// Match move mode-ish
			follower.moveMode = target.moveMode ?? "walk";
			if (distanceChebyshev(follower, target) > 2) follower.moveMode = "run";

			// while moving, do nothing
			if (follower.isMoving) return false;

			// Prefer breadcrumbs
			const trail = target.trail;
			if (trail.length > 0 && trail[0]) {
				// keep trail bounded defensively
				if (trail.length > maxTrail) trail.splice(0, trail.length - maxTrail);

				const goal = trail[0];
				// If we already reached this breadcrumb, consume it
				if (
					follower.x === goal.x &&
					follower.y === goal.y &&
					follower.z === goal.z
				) {
					trail.shift();
					return false;
				}

				// If the goal tile is still occupied by the target (reservation timing), just wait a tick
				const occ = getOccupant(goal.x, goal.y, goal.z);
				if (occ && occ !== follower.id) {
					return false;
				}

				follower.brain?.runner.interrupt(
					goToTile(goal, { stopAdjacentIfTargetBlocked: false }),
				);
				return false;
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
}) {
	// Destination occupied by someone else.
	// If it's our follow-linked partner, attempt swap, else attempt sidestep.

	const occId = getOccupant(planned.end.x, planned.end.y, planned.end.z);
	const other = occId ? entities.get(occId) : undefined;

	const canTryPair =
		!!other &&
		isFollowLinked(target, other) &&
		!target.isMoving &&
		!other.isMoving &&
		!target.interactionLock &&
		!other.interactionLock;

	// Only for simple steps on same z (no transitions)
	const dx = planned.end.x - target.x;
	const dy = planned.end.y - target.y;
	const manhattan = Math.abs(dx) + Math.abs(dy);
	const isSimpleStepSameZ = planned.end.z === target.z && manhattan === 1;

	// Helper to check edge rules for swap in both directions
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

	const backDir = dir ? rotate(dir, "counterclockwise", 2) : null;

	// Follow-scoped cooldown stored on the follower
	const otherIsFollower =
		isFollowState(other?.state) && other.state.targetId === target.id;
	if (!otherIsFollower) return;
	const follower = other;
	const state = isFollowState(follower?.state) ? follower.state : null;

	if (!state) {
		console.warn("Follower has no follow state during collision handling");
		return;
	}

	const cdMs = state?.swapCooldownMs ?? 0;

	// --- Attempt SWAP ---
	if (canTryPair && isSimpleStepSameZ && dir && backDir && cdMs <= 0) {
		// Ensure edges are normal walkable edges both ways (no blocked or transitions)
		const e1 = getEdge(target.x, target.y, target.z, dir);
		const e2 = getEdge(follower.x, follower.y, follower.z, backDir);
		const edgesOk =
			!e1?.blocked && !e1?.transition && !e2?.blocked && !e2?.transition;

		if (edgesOk) {
			// Both must currently occupy their own tiles for swapOccupants to succeed
			// (Idle entities already occupy; this is just defensive.)
			occupy({ x: target.x, y: target.y, z: target.z, id: target.id });
			occupy({
				x: follower.x,
				y: follower.y,
				z: follower.z,
				id: follower.id,
			});

			const swapped = swapOccupants(
				{ x: target.x, y: target.y, z: target.z },
				{ x: follower.x, y: follower.y, z: follower.z },
				target.id,
				follower.id,
			);

			if (swapped) {
				// Arm cooldown on the follower (contained in follow state)
				if (state) state.swapCooldownMs = 250;

				follower.isMoving = true;
				follower.direction = oppositeDirection(dir);
				follower.transitionEndTile = {
					x: target.x,
					y: target.y,
					z: target.z,
				};
				follower.animationOverride = null;
				follower.transitionPath = [
					{
						xPx: target.x * TILE_SIZE_PX,
						yPx: target.y * TILE_SIZE_PX,
						z: target.z,
					},
				].map((p) => ({ ...p }));

				// Ensure follower vacates its start tile correctly on first segment end
				const fFirst = follower.transitionPath[0];
				if (fFirst) {
					const prev = fFirst.onSegmentEnd;
					fFirst.onSegmentEnd = (e) => {
						if (e.solid) vacate({ id: e.id });
						prev?.(e);
					};
				}
				setCurrentSegment(follower);

				// Now proceed to start leader movement WITHOUT re-occupying destination (already swapped)
				// We'll treat ok=true and skip occupy({end,id}) (already done).
				// So just fall through by setting ok=true-like behavior:
			} else {
				// swap failed -> fall back to sidestep / block
			}
		}
	}

	// Re-check: after swap, the destination should now be occupied by leader id, so we can continue.
	const occNow = getOccupant(planned.end.x, planned.end.y, planned.end.z);
	const okAfterSwap = occNow === target.id;

	if (!okAfterSwap) {
		// --- Attempt SIDESTEP (move follower out of the way) ---
		if (canTryPair && isSimpleStepSameZ && dir && cdMs <= 0) {
			const directionCandidates: Direction[] = [
				rotate(dir, "counterclockwise"),
				rotate(dir, "clockwise"),
				rotate(dir, "counterclockwise", 2),
			];

			for (const directionCandidate of directionCandidates) {
				// sidestep only if follower idle
				if (follower.isMoving) break;

				const sidestepPlanned = tryPlanMove(directionCandidate, follower);
				if (!sidestepPlanned) continue;

				// attempt reserve and start follower move
				const okSidestep = follower.solid
					? occupy({ ...sidestepPlanned.end, id: follower.id })
					: true;

				if (!okSidestep) continue;

				follower.isMoving = true;
				follower.transitionEndTile = sidestepPlanned.end;
				follower.animationOverride = sidestepPlanned.animation ?? null;
				follower.transitionPath = sidestepPlanned.path.map((p) => ({
					...p,
				}));

				const fFirst = follower.transitionPath[0];
				if (fFirst) {
					const prev = fFirst.onSegmentEnd;
					fFirst.onSegmentEnd = (e) => {
						if (e.solid) vacate({ id: e.id });

						prev?.(e);
					};
				}

				setCurrentSegment(follower);

				// Arm cooldown
				if (state) state.swapCooldownMs = 150;

				break;
			}
		}

		// Leader stays idle this tick; next tick it can try again.
		return;
	}

	// If we got here, swap succeeded and leader can start its move without reserving end again.
	// NOTE: Do NOT call occupy({end,id}) again; it would fail (occupied by leader already is fine, but your occupy is idempotent for same id).
	// We'll just proceed to start movement below.
}
