// src/scenes/overworld/ai/pathfinding.ts

// ADD near the top (after imports)
import type { MoveMode } from "../../../config";
import { TILE_SIZE_PX } from "../../../config";
import { distanceManhattan } from "../../../functions/general";
import type { Direction } from "../../../input/input";
import { cellKey, getCell, getEdge, worldBounds } from "../cells";
import type { Entity } from "../entity";
import { getOccupant } from "../occupancy";
import type { Transition } from "../transition/transition";

export type PathStep = { dir: Direction; moveMode: MoveMode };

// Small cost so we prefer staying in current moveMode,
// but can switch when it unlocks a shorter / only valid path.
const MOVE_MODE_SWITCH_COST = 0.35;

// Default: walk+run, but always include current mode too (eg skate)
function getAllowedMoveModes(entity: Entity, allowed?: readonly MoveMode[]) {
	const base = allowed?.length ? [...allowed] : (["walk", "run"] as MoveMode[]);
	const cur = entity.moveMode ?? "walk";
	if (!base.includes(cur)) base.unshift(cur);
	// de-dupe preserving order
	return base.filter((m, i) => base.indexOf(m) === i);
}

function moveModeIndex(m: MoveMode) {
	switch (m) {
		case "walk":
			return 0;
		case "run":
			return 1;
		case "skate":
			return 2;
	}
}
function indexToMoveMode(i: number): MoveMode {
	switch (i) {
		case 0:
			return "walk";
		case 1:
			return "run";
		case 2:
			return "skate";
		default:
			return "walk";
	}
}

// Pack node key = (cellKey << 2) | modeIndex
function nodeKey(tileKey: number, mode: MoveMode) {
	return (tileKey << 2) | moveModeIndex(mode);
}
function unpackNodeKey(k: number) {
	const modeIdx = k & 0b11;
	const tileK = k >> 2;
	return { tileK, mode: indexToMoveMode(modeIdx) };
}

export function tryPlanMove(
	desired: Direction,
	entity: Entity,
): Transition | null {
	const edge = getEdge(entity.x, entity.y, entity.z, desired);
	if (edge?.blocked) return null;

	if (edge?.transition) {
		const transitions = Array.isArray(edge.transition)
			? edge.transition
			: [edge.transition];

		for (const transition of transitions) {
			if (transition.condition && !transition.condition(entity)) continue;

			const end = transition.end;
			const endCell = getCell(end.x, end.y, end.z);
			if (endCell?.blocked) return null;

			return transition;
		}

		return null;
	}

	// --- simple step ---
	const { dx, dy } = dirToDxDy(desired);
	const nx = entity.x + dx;
	const ny = entity.y + dy;
	const nz = entity.z;

	if (nx < 0 || ny < 0 || nx >= worldBounds.x || ny >= worldBounds.y)
		return null;

	const destination = getCell(nx, ny, nz);
	if (destination?.blocked) return null;

	// Block if destination is occupied by someone else
	// const occupant = getOccupant(nx, ny, nz);
	// if (occupant && occupant !== entity.id) return null;

	return {
		path: [{ xPx: nx * TILE_SIZE_PX, yPx: ny * TILE_SIZE_PX, z: nz }],
		end: { x: nx, y: ny, z: nz },
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

// ADD this type near Tile/Step definitions
type Node = { tile: Tile; mode: MoveMode };

type Step2 = {
	dir: Direction;
	to: Tile;
	viaTransition: boolean;
	mode: MoveMode; // mode used/kept after taking this step
	cost: number; // movement cost (1) etc.
};

function getNeighbors(node: Node, entity: Entity, goal: Tile): Step2[] {
	const out: Step2[] = [];
	const care = shouldCareAboutOccupancy(entity);
	const from = node.tile;
	const mode = node.mode;

	// 1) In-place moveMode switches (small cost)
	const allowedModes = getAllowedMoveModes(entity);
	for (const m of allowedModes) {
		if (m === mode) continue;
		out.push({
			dir: entity.direction, // not used for movement; placeholder
			to: { ...from },
			viaTransition: false,
			mode: m,
			cost: MOVE_MODE_SWITCH_COST,
		});
	}

	// 2) Movement edges under current virtual mode
	for (const dir of dirOrderFacingFirst(entity.direction)) {
		const edge = getEdge(from.x, from.y, from.z, dir);
		if (edge?.blocked) continue;

		// transition(s)
		if (edge?.transition) {
			const transitions = pickTransitions(edge.transition, entity, mode);
			for (const t of transitions) {
				const to = t.end;
				if (isBlockedCell(to.x, to.y, to.z)) continue;

				if (care && !isSameTile(to, goal)) {
					if (isOccupiedByOther(to.x, to.y, to.z, entity.id)) continue;
				}

				out.push({
					dir,
					to: { x: to.x, y: to.y, z: to.z },
					viaTransition: true,
					mode, // mode persists (we switched before taking transition)
					cost: 1,
				});
			}
			continue;
		}

		// simple step
		const { dx, dy } = dirToDxDy(dir);
		const nx = from.x + dx;
		const ny = from.y + dy;
		const nz = from.z;

		if (worldBounds) {
			if (nx < 0 || ny < 0 || nx >= worldBounds.x || ny >= worldBounds.y)
				continue;
		} else {
			continue;
		}

		if (isBlockedCell(nx, ny, nz)) continue;

		if (care && !isSameTile({ x: nx, y: ny, z: nz }, goal)) {
			if (isOccupiedByOther(nx, ny, nz, entity.id)) continue;
		}

		out.push({
			dir,
			to: { x: nx, y: ny, z: nz },
			viaTransition: false,
			mode,
			cost: 1,
		});
	}

	return out;
}

export function dirToDxDy(dir: Direction) {
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

function isBlockedCell(x: number, y: number, z: number) {
	return !!getCell(x, y, z)?.blocked;
}

function isOccupiedByOther(x: number, y: number, z: number, selfId: string) {
	const occ = getOccupant(x, y, z);
	return !!occ && occ !== selfId;
}

function shouldCareAboutOccupancy(entity: Entity) {
	return entity.solid === true;
}

// REPLACE pickTransition(...) with this version
function pickTransitions(
	edgeTransition: Transition | Transition[],
	entity: Entity,
	virtualMoveMode: MoveMode,
) {
	const list = Array.isArray(edgeTransition)
		? edgeTransition
		: [edgeTransition];

	// Create a cheap "virtual" view for condition checks
	const prev = entity.moveMode;
	entity.moveMode = virtualMoveMode;

	try {
		const out: Transition[] = [];
		for (const t of list) {
			if (t.condition && !t.condition(entity)) continue;
			out.push(t);
		}
		return out;
	} finally {
		entity.moveMode = prev;
	}
}

function dirOrderFacingFirst(facing: Direction): Direction[] {
	return [facing, leftOf(facing), rightOf(facing), backOf(facing)];
}

// ADD this new export (leave old findPathDirections if you want)
export function findPathPlan(
	entity: Entity,
	start: Tile,
	goal: Tile,
	opts?: {
		maxExpanded?: number;
		allowedMoveModes?: readonly MoveMode[];
	},
): PathStep[] | null {
	const maxExpanded = opts?.maxExpanded ?? 2500;
	const allowedModes = getAllowedMoveModes(entity, opts?.allowedMoveModes);

	const startTileK = cellKey(start.x, start.y, start.z);
	const goalTileK = cellKey(goal.x, goal.y, goal.z);

	// We'll accept goal in ANY mode, but prefer reaching it without extra switches.
	const startMode = entity.moveMode ?? "walk";
	const startK = nodeKey(startTileK, startMode);

	const goalKs = new Set<number>(
		allowedModes.map((m) => nodeKey(goalTileK, m)),
	);

	// open set
	const open = [startK];
	const openHas = new Set<number>([startK]);

	const gScore = new Map<number, number>([[startK, 0]]);
	const fScore = new Map<number, number>([
		[startK, distanceManhattan(start, goal)],
	]);

	// cameFrom: node -> {prevKey, dirUsed, modeUsed}
	const cameFrom = new Map<
		number,
		{ prev: number; dir: Direction; mode: MoveMode }
	>();

	const decodeCache = new Map<number, Tile>();
	const decodeTile = (k: number): Tile => {
		const cached = decodeCache.get(k);
		if (cached) return cached;
		const x = k & 0x3ff;
		const y = (k >> 10) & 0x3ff;
		const z = k >> 20;
		const t = { x, y, z };
		decodeCache.set(k, t);
		return t;
	};

	let expanded = 0;

	while (open.length) {
		// pick best f (tie-break by facing penalty)
		let bestIdx = 0;
		let bestK = open[0];
		if (bestK === undefined) break;
		let bestF = fScore.get(bestK) ?? Infinity;
		let bestPenalty = facingPenalty(entity.direction, cameFrom.get(bestK)?.dir);

		for (let i = 1; i < open.length; i++) {
			const k = open[i];
			if (k === undefined) continue;
			const f = fScore.get(k) ?? Infinity;
			if (f > bestF) continue;

			const penalty = facingPenalty(entity.direction, cameFrom.get(k)?.dir);
			if (f < bestF || penalty < bestPenalty) {
				bestF = f;
				bestPenalty = penalty;
				bestK = k;
				bestIdx = i;
			}
		}

		open.splice(bestIdx, 1);
		openHas.delete(bestK);

		// reached goal in any mode
		if (goalKs.has(bestK)) {
			const steps: PathStep[] = [];
			let cur = bestK;

			while (cur !== startK) {
				const step = cameFrom.get(cur);
				if (!step) break;
				steps.push({ dir: step.dir, moveMode: step.mode });
				cur = step.prev;
			}

			steps.reverse();

			// Filter out pure "mode switch in place" edges (they had placeholder dir)
			// Those edges exist only to enable transitions; they shouldn't be issued as movement.
			return steps.filter(
				(s) =>
					s.dir === "up" ||
					s.dir === "down" ||
					s.dir === "left" ||
					s.dir === "right",
			);
		}

		expanded++;
		if (expanded > maxExpanded) return null;

		const { tileK, mode } = unpackNodeKey(bestK);
		const curTile = decodeTile(tileK);

		const neighbors = getNeighbors({ tile: curTile, mode }, entity, goal);

		for (const n of neighbors) {
			const nkTile = cellKey(n.to.x, n.to.y, n.to.z);
			const nk = nodeKey(nkTile, n.mode);

			const tentativeG = (gScore.get(bestK) ?? Infinity) + n.cost;

			if (tentativeG < (gScore.get(nk) ?? Infinity)) {
				cameFrom.set(nk, { prev: bestK, dir: n.dir, mode: n.mode });
				gScore.set(nk, tentativeG);
				fScore.set(nk, tentativeG + distanceManhattan(n.to, goal));

				if (!openHas.has(nk)) {
					open.push(nk);
					openHas.add(nk);
				}
			}
		}
	}

	return null;
}
