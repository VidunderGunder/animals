// src/scenes/overworld/ai/pathfinding.ts
import type { Direction } from "../../../input/input";
import { cellKey, getCell, getEdge, worldBounds } from "../cells";
import type { Entity } from "../entities";
import { getOccupant } from "../occupancy";
import type { Transition } from "../transition/transition";

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
 * Smaller is better. 0 = straight, 1 = slight turn, 2 = U-turn.
 * If we don't know how we got here (start), treat as neutral.
 */
function facingPenalty(
	entityFacing: Direction,
	incomingDir: Direction | null | undefined,
) {
	if (!incomingDir) return 0;
	if (incomingDir === entityFacing) return 0;
	if (
		incomingDir === leftOf(entityFacing) ||
		incomingDir === rightOf(entityFacing)
	)
		return 1;
	return 2; // backOf
}

type Tile = { x: number; y: number; z: number };

function isSameTile(a: Tile, b: Tile) {
	return a.x === b.x && a.y === b.y && a.z === b.z;
}

type Step = {
	dir: Direction;
	to: Tile;
	viaTransition: boolean;
};

function dirToDxDy(dir: Direction) {
	switch (dir) {
		case "up":
			return { dx: 0, dy: -1 };
		case "down":
			return { dx: 0, dy: 1 };
		case "left":
			return { dx: -1, dy: 0 };
		case "right":
			return { dx: 1, dy: 0 };
	}
}

function manhattan3(a: Tile, b: Tile) {
	return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.z - b.z) * 4;
}

function isBlockedCell(x: number, y: number, z: number) {
	return !!getCell(x, y, z)?.blocked;
}

function isOccupiedByOther(x: number, y: number, z: number, selfId: string) {
	const occ = getOccupant(x, y, z);
	return !!occ && occ !== selfId;
}

function pickTransition(
	edgeTransition: Transition | Transition[],
	entity: Entity,
) {
	const list = Array.isArray(edgeTransition)
		? edgeTransition
		: [edgeTransition];
	for (const t of list) {
		if (t.condition && !t.condition(entity)) continue;
		return t;
	}
	return null;
}

function dirOrderFacingFirst(facing: Direction): Direction[] {
	return [facing, leftOf(facing), rightOf(facing), backOf(facing)];
}

function getNeighbors(from: Tile, entity: Entity, goal: Tile): Step[] {
	const out: Step[] = [];

	for (const dir of dirOrderFacingFirst(entity.direction)) {
		const edge = getEdge(from.x, from.y, from.z, dir);
		if (edge?.blocked) continue;

		// If there's a transition, it defines the resulting tile.
		if (edge?.transition) {
			const t = pickTransition(edge.transition, entity);
			if (!t) continue;

			const to = t.end;

			// Destination rules
			if (isBlockedCell(to.x, to.y, to.z)) continue;

			// Allow goal even if occupied (so we can still move *towards* it)
			if (!isSameTile(to, goal)) {
				if (isOccupiedByOther(to.x, to.y, to.z, entity.id)) continue;
			}

			out.push({
				dir,
				to: { x: to.x, y: to.y, z: to.z },
				viaTransition: true,
			});
			continue;
		}

		// Otherwise it's a simple step.
		const { dx, dy } = dirToDxDy(dir);
		const nx = from.x + dx;
		const ny = from.y + dy;
		const nz = from.z;

		if (worldBounds) {
			if (nx < 0 || ny < 0 || nx >= worldBounds.x || ny >= worldBounds.y) {
				continue;
			}
		} else {
			// If we don't know bounds yet, be conservative.
			continue;
		}

		if (isBlockedCell(nx, ny, nz)) continue;

		// Allow goal even if occupied (so we can still move *towards* it)
		if (!isSameTile({ x: nx, y: ny, z: nz }, goal)) {
			if (isOccupiedByOther(nx, ny, nz, entity.id)) continue;
		}

		out.push({
			dir,
			to: { x: nx, y: ny, z: nz },
			viaTransition: false,
		});
	}

	return out;
}

/**
 * A* pathfind to a target tile.
 * Returns a list of directions (first is next move), or null if no path.
 */
export function findPathDirections(
	entity: Entity,
	start: Tile,
	goal: Tile,
	opts?: {
		/** safety cap so NPCs can't blow up CPU on huge maps */
		maxExpanded?: number;
	},
): Direction[] | null {
	const maxExpanded = opts?.maxExpanded ?? 2500;

	const startK = cellKey(start.x, start.y, start.z);
	const goalK = cellKey(goal.x, goal.y, goal.z);

	if (startK === goalK) return [];

	// open set (tiny maps: array is fine)
	const open = [startK];
	const openHas = new Set<number>([startK]);

	// scores
	const gScore = new Map<number, number>([[startK, 0]]);
	const fScore = new Map<number, number>([[startK, manhattan3(start, goal)]]);

	// cameFrom: node -> {prevKey, dirUsedToReachNode}
	const cameFrom = new Map<number, { prev: number; dir: Direction }>();

	// key -> tile decode cache (because we use cellKey bit packing)
	const decodeCache = new Map<number, Tile>();
	const decode = (k: number): Tile => {
		const cached = decodeCache.get(k);
		if (cached) return cached;

		// cellKey: (z<<20)|(y<<10)|x, with x,y up to 1023, z up to ~4095
		const x = k & 0x3ff;
		const y = (k >> 10) & 0x3ff;
		const z = k >> 20;

		const t = { x, y, z };
		decodeCache.set(k, t);
		return t;
	};

	let expanded = 0;

	while (open.length) {
		// pick lowest fScore, tie-break by "keep going where I'm facing"
		let bestIdx = 0;
		let bestK = open[0];
		if (bestK === undefined) {
			throw new Error("Could not find path: open set is empty");
		}

		let bestF = fScore.get(bestK) ?? Infinity;
		let bestPenalty = facingPenalty(entity.direction, cameFrom.get(bestK)?.dir);

		for (let i = 1; i < open.length; i++) {
			const k = open[i];
			if (k === undefined) {
				throw new Error("Could not find path: open set is empty");
			}

			const f = fScore.get(k) ?? Infinity;
			if (f > bestF) continue;

			const penalty = facingPenalty(entity.direction, cameFrom.get(k)?.dir);

			// primary: lower f
			// secondary: lower facing penalty
			if (f < bestF || penalty < bestPenalty) {
				bestF = f;
				bestPenalty = penalty;
				bestK = k;
				bestIdx = i;
			}
		}

		// pop best
		open.splice(bestIdx, 1);
		openHas.delete(bestK);

		if (bestK === goalK) {
			// reconstruct directions by walking back from goal
			const dirs: Direction[] = [];
			let cur = goalK;
			while (cur !== startK) {
				const step = cameFrom.get(cur);
				if (!step) break;
				dirs.push(step.dir);
				cur = step.prev;
			}
			dirs.reverse();
			return dirs;
		}

		expanded++;
		if (expanded > maxExpanded) return null;

		const curTile = decode(bestK);
		const neighbors = getNeighbors(curTile, entity, goal);

		for (const n of neighbors) {
			const nk = cellKey(n.to.x, n.to.y, n.to.z);

			const tentativeG = (gScore.get(bestK) ?? Infinity) + 1;

			if (tentativeG < (gScore.get(nk) ?? Infinity)) {
				cameFrom.set(nk, { prev: bestK, dir: n.dir });
				gScore.set(nk, tentativeG);
				fScore.set(nk, tentativeG + manhattan3(n.to, goal));

				if (!openHas.has(nk)) {
					open.push(nk);
					openHas.add(nk);
				}
			}
		}
	}

	return null;
}
