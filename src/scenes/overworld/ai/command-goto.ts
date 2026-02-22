import type { Direction } from "../../../input/input";
import { inWorldBounds } from "../cells";
import type { Entity } from "../entity";
import { getOccupant } from "../occupancy";
import type { Command } from "./commands";
import { findPathPlan, type PathStep, tryPlanMove } from "./pathfinding";

/**
 * goToTile: A* to a target tile.
 *
 * - If blocked by dynamic occupancy (player/NPC), it will replan.
 * - It only ever requests ONE step at a time through `entity.intentDir`.
 * - It completes once the entity is snapped to the goal tile.
 */
export function goToTile(
	target: { x: number; y: number; z: number },
	opts?: {
		stopAdjacentIfTargetBlocked?: boolean;
	},
): Command {
	const stopAdjacentIfTargetBlocked =
		opts?.stopAdjacentIfTargetBlocked ?? false;

	let cached: PathStep[] | null = null;
	let repathCooldownMs = 0;
	let lastAt: { x: number; y: number; z: number } | null = null;
	let stuckMs = 0;
	let lastGoal: { x: number; y: number; z: number } | null = null;
	let lastIssued: Direction | null = null;

	return {
		onUpdate({ entity, dt }) {
			// If we want "stop adjacent" explicitly, keep existing behavior:
			const approach = findApproachPlanIfTargetOccupied({ entity, target });

			let effectiveTarget = approach?.goal ?? target;
			let forcedApproachPlan: PathStep[] | null = approach?.plan ?? null;

			// ✅ NEW: Even when stopAdjacentIfTargetBlocked=false,
			// NEVER try to path into an occupied goal tile (unless it's us).
			// Instead, automatically switch into "approach" mode.
			if (isOccupiedByOtherEntity(effectiveTarget, entity.id)) {
				// If we are already adjacent (same z, cardinal), we're done.
				const adjacent =
					Math.abs(entity.x - effectiveTarget.x) +
						Math.abs(entity.y - effectiveTarget.y) ===
						1 && entity.z === effectiveTarget.z;

				if (adjacent) return true;

				const autoApproach = findApproachPlanIfTargetOccupied({
					entity,
					target: effectiveTarget,
				});

				if (autoApproach) {
					effectiveTarget = autoApproach.goal;
					forcedApproachPlan = autoApproach.plan;
				} else {
					// No reachable adjacent tile; back off a bit and retry later.
					cached = null;
					repathCooldownMs = 200;
					return false;
				}
			}

			if (
				entity.x === effectiveTarget.x &&
				entity.y === effectiveTarget.y &&
				entity.z === effectiveTarget.z
			) {
				return true;
			}

			// Existing: if stopAdjacentIfTargetBlocked is on, allow "finish" when adjacent to occupied target.
			if (stopAdjacentIfTargetBlocked) {
				const occ = getOccupant(target.x, target.y, target.z);
				if (occ && occ !== entity.id) {
					const adjacent =
						Math.abs(entity.x - target.x) + Math.abs(entity.y - target.y) ===
							1 && entity.z === target.z;
					if (adjacent) return true;
				}
			}

			if (entity.isMoving) return false;

			// If something rotated us externally, drop cache.
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

			const goalChanged =
				!lastGoal ||
				lastGoal.x !== effectiveTarget.x ||
				lastGoal.y !== effectiveTarget.y ||
				lastGoal.z !== effectiveTarget.z;

			const shouldRepath =
				!cached ||
				cached.length === 0 ||
				repathCooldownMs === 0 ||
				stuckMs > 350 ||
				goalChanged;

			if (shouldRepath) {
				cached =
					forcedApproachPlan ??
					findPathPlan(
						entity,
						{ x: entity.x, y: entity.y, z: entity.z },
						effectiveTarget,
						{ maxExpanded: 2500 },
					);

				lastGoal = { ...effectiveTarget };

				if (!cached) {
					repathCooldownMs = 200;
					return false;
				}

				repathCooldownMs = 120;
				stuckMs = 0;
			}

			const next = cached?.[0];
			if (!next) return false;

			if (next.kind === "mode") {
				if (entity.moveMode !== next.moveMode) entity.moveMode = next.moveMode;
				cached?.shift();
				repathCooldownMs = Math.min(repathCooldownMs, 60);
				return false;
			}

			// ✅ NEW: sanity guard — if the immediate move can’t be planned *right now*,
			// drop cache and force a repath. This prevents “spam the same dir forever”
			// when a transition condition or dynamic occupancy changes mid-command.
			{
				const planned = tryPlanMove(next.dir, entity);
				if (!planned) {
					cached = null;
					repathCooldownMs = 0;
					return false;
				}
			}

			if (entity.moveMode !== next.moveMode) entity.moveMode = next.moveMode;

			entity.brainDesiredDirection = next.dir;
			lastIssued = next.dir;

			cached?.shift();
			repathCooldownMs = Math.min(repathCooldownMs, 90);
			return false;
		},
	};
}
function getCardinalNeighbors(t: { x: number; y: number; z: number }) {
	return [
		{ x: t.x + 1, y: t.y, z: t.z },
		{ x: t.x - 1, y: t.y, z: t.z },
		{ x: t.x, y: t.y + 1, z: t.z },
		{ x: t.x, y: t.y - 1, z: t.z },
	] as const;
}

/**
 * If `target` is occupied by someone else and we want to "stop adjacent",
 * pick the best reachable adjacent tile and plan to that instead.
 *
 * Returns `{ goal, plan }` or `null` if no adjacent reachable tile exists.
 */
function findApproachPlanIfTargetOccupied(args: {
	entity: Entity;
	target: { x: number; y: number; z: number };
}): { goal: { x: number; y: number; z: number }; plan: PathStep[] } | null {
	const { entity, target } = args;

	const occ = getOccupant(target.x, target.y, target.z);
	if (!occ || occ === entity.id) return null;

	// If already adjacent (cardinal) on same z, we are "close enough" and can finish.
	const alreadyAdjacent =
		Math.abs(entity.x - target.x) + Math.abs(entity.y - target.y) === 1 &&
		entity.z === target.z;

	if (alreadyAdjacent) {
		return { goal: { x: entity.x, y: entity.y, z: entity.z }, plan: [] };
	}

	// Candidates are adjacent tiles around the target (same z as target).
	const candidates = getCardinalNeighbors(target)
		.filter((c) => inWorldBounds(c.x, c.y, c.z))
		.filter((c) => {
			const occ2 = getOccupant(c.x, c.y, c.z);
			return !occ2 || occ2 === entity.id;
		});

	let bestGoal: { x: number; y: number; z: number } | null = null;
	let bestPlan: PathStep[] | null = null;
	let bestModeSwitches = Number.POSITIVE_INFINITY;
	let bestCloseness = Number.POSITIVE_INFINITY; // Manhattan goal->target

	for (const goal of candidates) {
		const plan = findPathPlan(
			entity,
			{ x: entity.x, y: entity.y, z: entity.z },
			goal,
			{ maxExpanded: 2500 },
		);
		if (!plan) continue;

		// Count move mode switches in this plan (prefer fewer)
		let modeSwitches = 0;
		let prevMode = entity.moveMode ?? "walk";
		for (const step of plan) {
			if (step.moveMode !== prevMode) modeSwitches++;
			prevMode = step.moveMode;
		}

		const closeness =
			Math.abs(goal.x - target.x) +
			Math.abs(goal.y - target.y) +
			(goal.z === target.z ? 0 : 4);

		if (!bestPlan) {
			bestGoal = goal;
			bestPlan = plan;
			bestModeSwitches = modeSwitches;
			bestCloseness = closeness;
			continue;
		}

		// Primary: shortest plan
		if (plan.length < bestPlan.length) {
			bestGoal = goal;
			bestPlan = plan;
			bestModeSwitches = modeSwitches;
			bestCloseness = closeness;
			continue;
		}

		// Tie-break: fewer mode switches
		if (plan.length === bestPlan.length && modeSwitches < bestModeSwitches) {
			bestGoal = goal;
			bestPlan = plan;
			bestModeSwitches = modeSwitches;
			bestCloseness = closeness;
			continue;
		}

		// Tie-break: closer to target (keeps it tight / less “orbiting”)
		if (
			plan.length === bestPlan.length &&
			modeSwitches === bestModeSwitches &&
			closeness < bestCloseness
		) {
			bestGoal = goal;
			bestPlan = plan;
			bestCloseness = closeness;
		}
	}

	if (!bestGoal || !bestPlan) return null;
	return { goal: bestGoal, plan: bestPlan };
}

function isOccupiedByOtherEntity(
	t: { x: number; y: number; z: number },
	selfId: string,
) {
	const occ = getOccupant(t.x, t.y, t.z);
	return !!occ && occ !== selfId;
}
