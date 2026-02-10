import { TILE_SIZE_PX } from "../../config";
import type { Direction } from "../../input/input";
import type { Vec2Px } from "../../types";
import type { Entity } from "./entity";
import type { Transition } from "./transition/transition";

type WorldImageLayer = {
	z?: number;
	back?: HTMLImageElement[];
	front?: HTMLImageElement[];
};

export let worldImageLayers: WorldImageLayer[] = [];

export function setWorldImageLayers(layers: WorldImageLayer[]) {
	worldImageLayers = layers;
}

export function setTilesCountsAndSetWorldBounds(force = false) {
	if (!force && worldBounds.x !== 0 && worldBounds.y !== 0) return;
	const firstImage =
		worldImageLayers[0]?.back?.[0] || worldImageLayers[0]?.front?.[0];
	if (!firstImage || !firstImage.complete || firstImage.naturalWidth === 0)
		return;
	setWorldBounds(
		firstImage.naturalWidth / TILE_SIZE_PX,
		firstImage.naturalHeight / TILE_SIZE_PX,
	);
}

export const cells = new Map<number, Cell>();
export const edges = new Map<number, Edge>();

export type Cell = {
	blocked?: boolean;
	onActivate?: (props: { activator: Entity; activated?: Entity }) => void;
	/**
	 * Camera offset when player is in this cell
	 */
	camera?: {
		xPx: number;
		yPx: number;
	};
};

export type Edge = {
	blocked?: boolean;
	transition?: Transition | Transition[];
	interact?: {
		id: string;
		onActivate: (props: { activator: Entity; activated?: Entity }) => void;
	};
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
export function cellToPx(x: number, y: number): Vec2Px {
	return { xPx: x * TILE_SIZE_PX, yPx: y * TILE_SIZE_PX };
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

type WorldBounds = { x: number; y: number };

export let worldBounds: WorldBounds = { x: 0, y: 0 };

export function setWorldBounds(x: number, y: number) {
	worldBounds = { x, y };
}

/** A single outline edge segment */
export type OutlineEdge = {
	x: number; // cell x
	y: number; // cell y
	z: number; // layer
	dir: Direction;
	a: Vec2Px; // segment start
	b: Vec2Px; // segment end
};

/**
 * Gets the outline edges of a set of cells
 */
export function getCellsOutline(cells: [number, number, number][]): {
	x: number;
	y: number;
	z: number;
	dir: Direction;
	edge: Edge | undefined;
}[] {
	// Membership lookup
	const included = new Set<number>();
	for (const [x, y, z] of cells) included.add(cellKey(x, y, z));

	const out: {
		x: number;
		y: number;
		z: number;
		dir: Direction;

		edge: Edge | undefined;
	}[] = [];

	function hasCell(x: number, y: number, z: number): boolean {
		return included.has(cellKey(x, y, z));
	}

	for (const [x, y, z] of cells) {
		if (!hasCell(x, y - 1, z)) {
			out.push({ x, y, z, dir: "up", edge: getEdge(x, y, z, "up") });
		}
		if (!hasCell(x + 1, y, z)) {
			out.push({ x, y, z, dir: "right", edge: getEdge(x, y, z, "right") });
		}
		if (!hasCell(x, y + 1, z)) {
			out.push({ x, y, z, dir: "down", edge: getEdge(x, y, z, "down") });
		}
		if (!hasCell(x - 1, y, z)) {
			out.push({ x, y, z, dir: "left", edge: getEdge(x, y, z, "left") });
		}
	}

	return out;
}

export function range(
	x: number | [number, number],
	y: number | [number, number],
	z: number | [number, number] = 0,
): [number, number, number][] {
	const [x0, x1] = Array.isArray(x) ? x : [x, x];
	const [y0, y1] = Array.isArray(y) ? y : [y, y];
	const [z0, z1] = Array.isArray(z) ? z : [z, z];

	const out: [number, number, number][] = [];

	for (let xi = x0; xi <= x1; xi++) {
		for (let yi = y0; yi <= y1; yi++) {
			for (let zi = z0; zi <= z1; zi++) {
				out.push([xi, yi, zi]);
			}
		}
	}

	return out;
}
