import type { Direction } from "../../../input/input";
import { inWorldBounds } from "../cells";
import type { Entity } from "../entity";
import { getOccupant } from "../occupancy";
import type { Command } from "./commands";
import { findPathPlan, type PathStep } from "./pathfinding";

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
			const approach = stopAdjacentIfTargetBlocked
				? findApproachPlanIfTargetOccupied({ entity, target })
				: null;

			const effectiveTarget = approach?.goal ?? target;

			if (
				entity.x === effectiveTarget.x &&
				entity.y === effectiveTarget.y &&
				entity.z === effectiveTarget.z
			) {
				return true;
			}

			if (stopAdjacentIfTargetBlocked) {
				const occ = getOccupant(target.x, target.y, target.z);
				if (occ && occ !== entity.id) {
					const adjacent =
						Math.abs(entity.x - target.x) + Math.abs(entity.y - target.y) ===
							1 && entity.z === target.z;
					if (adjacent) return true;
				}
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
				// Prefer the precomputed "approach" plan if present
				cached =
					approach?.plan ??
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

				// If approach plan is empty, we might already be adjacent and will return true above next tick.
				repathCooldownMs = 120;
				stuckMs = 0;
			}

			const next = cached?.[0];
			if (!next) return false;

			if (next.kind === "mode") {
				// Execute mode switch in-place (no movement intent this tick).
				if (entity.moveMode !== next.moveMode) entity.moveMode = next.moveMode;
				cached?.shift();
				repathCooldownMs = Math.min(repathCooldownMs, 60);
				return false;
			}

			// kind === "move"
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

	// If already adjacent (cardinal), we can finish immediately.
	const alreadyAdjacent =
		Math.abs(entity.x - target.x) + Math.abs(entity.y - target.y) === 1 &&
		entity.z === target.z;
	if (alreadyAdjacent) {
		return { goal: { x: entity.x, y: entity.y, z: entity.z }, plan: [] };
	}

	const candidates = getCardinalNeighbors(target)
		.filter((c) => inWorldBounds(c.x, c.y, c.z))
		.filter((c) => {
			const occ2 = getOccupant(c.x, c.y, c.z);
			if (occ2 && occ2 !== entity.id) return false;
			return true;
		});

	let bestGoal: { x: number; y: number; z: number } | null = null;
	let bestPlan: PathStep[] | null = null;
	let bestModeSwitches = Number.POSITIVE_INFINITY;

	for (const goal of candidates) {
		const plan = findPathPlan(
			entity,
			{ x: entity.x, y: entity.y, z: entity.z },
			goal,
			{ maxExpanded: 2500 },
		);
		if (!plan) continue;

		// Prefer shortest plan. Tie-break: fewer moveMode switches.
		let modeSwitches = 0;
		let prevMode = entity.moveMode ?? "walk";
		for (const step of plan) {
			if (step.moveMode !== prevMode) modeSwitches++;
			prevMode = step.moveMode;
		}

		if (!bestPlan) {
			bestGoal = goal;
			bestPlan = plan;
			bestModeSwitches = modeSwitches;
			continue;
		}

		if (plan.length < bestPlan.length) {
			bestGoal = goal;
			bestPlan = plan;
			bestModeSwitches = modeSwitches;
			continue;
		}

		if (plan.length === bestPlan.length && modeSwitches < bestModeSwitches) {
			bestGoal = goal;
			bestPlan = plan;
			bestModeSwitches = modeSwitches;
		}
	}

	if (!bestGoal || !bestPlan) return null;
	return { goal: bestGoal, plan: bestPlan };
}
