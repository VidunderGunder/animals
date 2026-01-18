import type { CharacterAnimationID } from "../../characters/characters";
import { TILE_SIZE } from "../../config";
import { type Direction, directions } from "../../input/input";

export const cells = new Map<number, Cell>();
export const edges = new Map<number, Edge>();

export type Cell = {
	blocked?: boolean;
	interact?: {
		id: string;
		onActivate: () => void;
	};
};

export type Transition = {
	condition?: () => boolean;

	/* optional: force animation during the transition */
	animation?: CharacterAnimationID;

	/* Path in pixel space (tile-top-left in world pixels), INCLUDING destination. */
	path: { xPx: number; yPx: number; z: number }[];

	/* Final snapped logical state once path completes */
	end: { x: number; y: number; z: number };
};

export type Edge = {
	blocked?: boolean;
	transition?: Transition;
};

export const DIR_INDEX = {
	up: 0,
	right: 1,
	down: 2,
	left: 3,
} as const satisfies Record<Direction, number>;

export function cellKey(x: number, y: number, z: number): number {
	return (z << 20) | (y << 10) | x;
}
export function edgeKey(
	x: number,
	y: number,
	z: number,
	dir: Direction,
): number {
	return (cellKey(x, y, z) << 2) | DIR_INDEX[dir];
}
export function cellToPx(x: number, y: number): { xPx: number; yPx: number } {
	return { xPx: x * TILE_SIZE, yPx: y * TILE_SIZE };
}

export function setCell(x: number, y: number, z: number, cell: Cell) {
	cells.set(cellKey(x, y, z), cell);
}

export function setEdge(
	x: number,
	y: number,
	z: number,
	dir: Direction,
	edge: Edge,
) {
	edges.set(edgeKey(x, y, z, dir), edge);
}

export function getCell(x: number, y: number, z: number): Cell | undefined {
	return cells.get(cellKey(x, y, z));
}

export function getEdge(
	x: number,
	y: number,
	z: number,
	dir: Direction,
): Edge | undefined {
	return edges.get(edgeKey(x, y, z, dir));
}

export function clearCellsAndEdges() {
	cells.clear();
	edges.clear();
}
