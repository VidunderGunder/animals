import type { Direction } from "../../../input/input";
import type { Entity } from "../entity";
import { getOccupant } from "../occupancy";
import type { Command } from "./commands";
import { dirToDxDy, findPathPlan, type PathStep } from "./pathfinding";

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

	// NEW: detect when something else (eg. interaction) changed facing
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

			const shouldRepath =
				!cached ||
				cached.length === 0 ||
				repathCooldownMs === 0 ||
				stuckMs > 350 ||
				// Important: if effective target changed since last time, repath.
				!(
					lastAt &&
					lastAt.x === effectiveTarget.x &&
					lastAt.y === effectiveTarget.y &&
					lastAt.z === effectiveTarget.z
				);

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

			if (entity.moveMode !== next.moveMode) entity.moveMode = next.moveMode;

			const nextDir = next.dir;

			entity.brainDesiredDirection = nextDir;
			lastIssued = nextDir;

			cached?.shift();
			repathCooldownMs = Math.min(repathCooldownMs, 90);
			return false;
		},
	};
}

function inBounds(x: number, y: number, z: number) {
	// worldBounds exists in cells.ts, but commands.ts doesn't import it.
	// We'll just rely on blocked/occupancy checks and allow edges to reject out of bounds.
	return x >= 0 && y >= 0; // cheap guard; real bounds handled by pathfinding/cells
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
}) {
	const { entity, target } = args;

	const occ = getOccupant(target.x, target.y, target.z);
	if (!occ || occ === entity.id) return null;

	// If already adjacent (cardinal), we can finish immediately.
	const alreadyAdjacent =
		Math.abs(entity.x - target.x) + Math.abs(entity.y - target.y) === 1 &&
		entity.z === target.z;
	if (alreadyAdjacent) {
		return { goal: { ...entity }, plan: [] as PathStep[] };
	}

	const candidates = getCardinalNeighbors(target)
		.filter((c) => inBounds(c.x, c.y, c.z))
		// Can't stand on blocked/occupied tiles.
		.filter((c) => {
			const occ2 = getOccupant(c.x, c.y, c.z);
			if (occ2 && occ2 !== entity.id) return false;
			return true;
		});

	let best: {
		goal: { x: number; y: number; z: number };
		plan: PathStep[];
	} | null = null;

	for (const goal of candidates) {
		const plan = findPathPlan(
			entity,
			{ x: entity.x, y: entity.y, z: entity.z },
			goal,
			{ maxExpanded: 2500 },
		);
		if (!plan) continue;

		// Prefer shortest plan. Tie-break: fewer mode switches.
		const modeSwitches = plan.reduce((acc, s, i) => {
			const step = plan[i - 1];
			if (!step) return acc;
			const prev = i === 0 ? (entity.moveMode ?? "walk") : step.moveMode;
			return acc + (s.moveMode !== prev ? 1 : 0);
		}, 0);

		if (!best) {
			best = { goal, plan };
			(best as any).modeSwitches = modeSwitches;
			continue;
		}

		const bestModeSwitches = (best as any).modeSwitches as number;

		if (plan.length < best.plan.length) {
			best = { goal, plan };
			(best as any).modeSwitches = modeSwitches;
			continue;
		}

		if (plan.length === best.plan.length && modeSwitches < bestModeSwitches) {
			best = { goal, plan };
			(best as any).modeSwitches = modeSwitches;
		}
	}

	return best;
}
