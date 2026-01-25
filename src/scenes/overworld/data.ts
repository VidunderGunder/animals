import type { AnimationID } from "../../animations/animations";
import { TILE_SIZE_PX } from "../../config";
import type { Direction } from "../../input/input";
import { type Entity, player } from "../../state";

export const cells = new Map<number, Cell>();
export const edges = new Map<number, Edge>();

export type Cell = {
	blocked?: boolean;
	interact?: {
		id: string;
		onActivate: (entity: Entity) => void;
	};
	/**
	 * Camera offset when player is in this cell
	 */
	camera?: {
		xPx: number;
		yPx: number;
	};
};

export type Transition = {
	condition?: (entity: Entity) => boolean;

	/* optional: force animation during the tr ansition */
	animation?: AnimationID;

	/** Path in pixel space (tile-top-left in world pixels), INCLUDING destination. */
	path: {
		xPx: number;
		yPx: number;
		z: number;
		duration?: number;
		onSegment?: (entity: Entity) => void;
		onSegmentEnd?: (entity: Entity) => void;
		onSegmentStart?: (entity: Entity) => void;
	}[];

	/* Final snapped logical state once path completes */
	end: { x: number; y: number; z: number };
};

export type Edge = {
	blocked?: boolean;
	transition?: Transition | Transition[];
	interact?: {
		id: string;
		onActivate: (entity: Entity) => void;
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
export function cellToPx(x: number, y: number): { xPx: number; yPx: number } {
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

/** A single outline edge segment */
export type OutlineEdge = {
	x: number; // cell x
	y: number; // cell y
	z: number; // layer
	dir: Direction;
	a: { xPx: number; yPx: number }; // segment start
	b: { xPx: number; yPx: number }; // segment end
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

export function getJumpTransition({
	x,
	y,
	z,
	dir,
	drop,
}: {
	x: number;
	y: number;
	z: number;
	dir: Direction;
	/**
	 * How many z-levels to drop down during the jump and adjust y accordingly
	 *
	 * Defaults to 1
	 */
	drop?: number;
}) {
	drop ??= 1;

	let end: Transition["end"] | undefined;
	let path: Transition["path"] | undefined;

	const durUp = 100;
	const durDown = 220;

	if (dir === "left") {
		path = [
			{
				...cellToPx(x - 0.85, y - 0.25),
				z,
				duration: durUp,
			},
			{
				...cellToPx(x - 1, y + 1),
				z: z - drop,
				duration: durDown,
			},
		];
		end = {
			x: x - 1,
			y: y + 1,
			z: z - drop,
		};
	}
	if (dir === "down") {
		path = [
			{
				...cellToPx(x, y - 0.25),
				z,
				duration: durUp,
			},
			{
				...cellToPx(x, y + 2),
				z,
				duration: durDown,
			},
		];
		end = {
			x,
			y: y + 1 + drop,
			z: z - drop,
		};
	}
	if (dir === "right") {
		path = [
			{
				...cellToPx(x + 0.85, y - 0.25),
				z,
				duration: durUp,
			},
			{
				...cellToPx(x + 1, y + drop),
				z: z - drop,
				duration: durDown,
			},
		];
		end = {
			x: x + 1,
			y: y + 1,
			z: z - drop,
		};
	}
	if (dir === "up") {
		path = [
			{
				...cellToPx(x, y - 0.75),
				z,
				duration: durUp,
			},
			{
				...cellToPx(x, y - 1 + drop),
				z: z - drop,
				duration: durDown,
			},
		];
		end = {
			x,
			y,
			z: z - drop,
		};
	}

	if (!path || !end) {
		throw new Error(
			`Could not create jump transition for dir=${dir} at ${x},${y},${z}`,
		);
	}

	return {
		end,
		path,
		condition() {
			return player.animationCurrent === "run";
		},
		animation: "jump",
	} satisfies Transition;
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
