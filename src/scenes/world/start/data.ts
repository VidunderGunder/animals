import type { CharacterAnimationID } from "../../../characters/characters";
import { TILE_SIZE } from "../../../config";
import type { Direction } from "../../../input/input";

export type CellRule = {
	blocked?: boolean;
	interact?: {
		id: string;
		onActivate: () => void;
	};
	jumpStub?: {
		heightPx: number; // e.g. 6
	};
};

export type Transition = {
	requireFaster?: boolean;

	// optional: force animation during the transition
	animation?: CharacterAnimationID;

	// Path in pixel space (tile-top-left in world pixels), INCLUDING destination.
	path: { xPx: number; yPx: number; z: number }[];

	// Final snapped logical state once path completes
	end: { tileX: number; tileY: number; z: number };
};

export type EdgeRule = {
	blocked?: boolean;
	transition?: Transition;
};

// --- key packing helpers ---
const DIR_INDEX: Record<Direction, number> = {
	up: 0,
	right: 1,
	down: 2,
	left: 3,
};

function cellKey(x: number, y: number, z: number): number {
	// 10 bits x, 10 bits y, 6 bits z => 26 bits total
	return (z << 20) | (y << 10) | x;
}
function edgeKey(x: number, y: number, z: number, dir: Direction): number {
	return (cellKey(x, y, z) << 2) | DIR_INDEX[dir];
}
function toPx(x: number, y: number): { xPx: number; yPx: number } {
	return { xPx: x * TILE_SIZE, yPx: y * TILE_SIZE };
}

// --- cell rules (sparse) ---
const cells = new Map<number, CellRule>();

function range(
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

// Jump stubs (height configurable)
const jumpStubHeightPx = 6;
(
	[
		[10, 44],
		[9, 44],
		[8, 44],
		[8, 45],
		[8, 46],
		[10, 46],
	] as const
).forEach(([x, y]) => {
	cells.set(cellKey(x, y, 0), { jumpStub: { heightPx: jumpStubHeightPx } });
});

// --- edge rules (sparse) ---
const edges = new Map<number, EdgeRule>();

function setEdgeTransition(
	x: number,
	y: number,
	z: number,
	dir: Direction,
	transition: Transition,
) {
	edges.set(edgeKey(x, y, z, dir), { transition });
}
function setEdgeBlocked(x: number, y: number, z: number, dir: Direction) {
	edges.set(edgeKey(x, y, z, dir), { blocked: true });
}

const blockedCells = [
	// Dock
	[12, 36, 0],
	...range(11, [37, 39]),
	...range(13, [37, 39]),

	// Beach
	...range([6, 11], 40),
	...range([13, 18], 40),

	// Woods
	[6, 41, 0],
	...range(19, [41, 57]),
	...range(5, [41, 57]),

	// Fence Woods
	...range([0, 4], 57),
	...range([20, 24], 57),

	// Skateboard
	[14, 58, 0],
] as const satisfies [number, number, number][];

for (const cell of blockedCells) {
	cells.set(cellKey(cell[0], cell[1], cell[2]), {
		blocked: true,
	});
}

const stoneFenceCells = [
	...range([5, 10], 57),
	...range([14, 19], 57),
] as const;

stoneFenceCells.forEach((cell) => {
	setEdgeBlocked(cell[0], cell[1], cell[2], "down");
	setEdgeBlocked(cell[0], cell[1] + 1, cell[2], "up");
});

const bridgeCells = [...range([10, 14], 49, 1)] as const;

bridgeCells.forEach((cell) => {
	setEdgeBlocked(cell[0], cell[1], cell[2], "up");
	setEdgeBlocked(cell[0], cell[1], cell[2], "down");
});

const jumpablePlatformEdges = [
	["up", [...range([14, 17], 45, 1)]],
	["down", [...range([14, 16], 45, 1), [17, 49, 1]]],
	["right", [...range(17, [45, 49], 1)]],
	["left", [...range(17, [46, 49], 1)]],
] as const satisfies [Direction, [number, number, number][]][];

jumpablePlatformEdges.forEach(([direction, cells]) => {
	cells.forEach((cell) => {
		// setEdgeBlocked(cell[0], cell[1], cell[2], direction);
		setEdgeTransition(cell[0], cell[1], cell[2], direction, {
			path: [],
			animation: "hop",
			end: {
				tileX: cell[0],
				tileY: cell[1],
				z: cell[2],
			},
		});
	});
});

const mushroomCells = [
	[6, 51, 0],
	[17, 42, 0],
] as const;

// Mushroom at 17,42,0 blocks and is interactable
mushroomCells.forEach((cell) => {
	cells.set(cellKey(cell[0], cell[1], cell[2]), {
		blocked: true,
		interact: {
			id: "pretty_mushrooms",
			onActivate: () => console.log("Mushroom activated!"),
		},
	});
});

// Ladder:
// trigger when moving RIGHT from (13,46,0):
// (13,46,0) -> (13,45,1) -> (14,45,1)
setEdgeTransition(13, 46, 0, "right", {
	animation: "walk",
	path: [
		{ ...toPx(13, 45), z: 1 },
		{ ...toPx(14, 45), z: 1 },
	],
	end: { tileX: 14, tileY: 45, z: 1 },
});

// Walk back down: moving LEFT from (14,45,1)
setEdgeTransition(14, 45, 1, "left", {
	animation: "walk",
	path: [
		{ ...toPx(13, 45), z: 1 },
		{ ...toPx(13, 46), z: 0 },
	],
	end: { tileX: 13, tileY: 46, z: 0 },
});

setEdgeBlocked(14, 46, 0, "left");

// Fence roll
setEdgeTransition(8, 52, 0, "down", {
	requireFaster: true,
	animation: "spin",
	path: [{ ...toPx(8, 54), z: 0 }],
	end: { tileX: 8, tileY: 54, z: 0 },
});
setEdgeTransition(8, 53, 0, "up", {
	requireFaster: true,
	animation: "spin",
	path: [{ ...toPx(8, 51), z: 0 }],
	end: { tileX: 8, tileY: 51, z: 0 },
});

// Blocking poles
setEdgeBlocked(7, 53, 0, "up");
setEdgeBlocked(7, 52, 0, "down");
setEdgeBlocked(9, 53, 0, "up");
setEdgeBlocked(9, 52, 0, "down");

// Stairs
setEdgeTransition(15, 50, 0, "left", {
	animation: "walk",
	path: [{ ...toPx(14, 49), z: 1 }],
	end: { tileX: 14, tileY: 49, z: 1 },
});
setEdgeTransition(14, 49, 1, "right", {
	animation: "walk",
	path: [{ ...toPx(15, 50), z: 0 }],
	end: { tileX: 15, tileY: 50, z: 0 },
});

setEdgeTransition(9, 50, 0, "right", {
	animation: "walk",
	path: [{ ...toPx(10, 49), z: 1 }],
	end: { tileX: 10, tileY: 49, z: 1 },
});
setEdgeTransition(10, 49, 1, "left", {
	animation: "walk",
	path: [{ ...toPx(9, 50), z: 0 }],
	end: { tileX: 9, tileY: 50, z: 0 },
});

cells.set(cellKey(10, 50, 0), {
	blocked: true,
});
cells.set(cellKey(14, 50, 0), {
	blocked: true,
});

export const startWorldRules = {
	getCellRule(x: number, y: number, z: number): CellRule | undefined {
		return cells.get(cellKey(x, y, z));
	},
	getEdgeRule(
		x: number,
		y: number,
		z: number,
		dir: Direction,
	): EdgeRule | undefined {
		return edges.get(edgeKey(x, y, z, dir));
	},
};
