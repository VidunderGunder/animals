import { player } from "../../../state";
import {
	cellToPx,
	getCellsOutline,
	getJumpTransition,
	setCell,
	setEdge,
} from "../data";

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

export function initializeArea() {
	const stubs: [number, number][] = [
		[10, 44],
		[9, 44],
		[8, 44],
		[8, 45],
		[8, 46],
		[10, 46],
	] as const;

	for (const xy of stubs) {
		setCell(...xy, 0, { blocked: true });
	}

	const blockedCells: [number, number, number][] = [
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
	] as const;

	for (const xyz of blockedCells) {
		setCell(...xyz, {
			blocked: true,
		});
	}

	const stoneFenceCells: [number, number, number][] = [
		...range([5, 10], 57),
		...range([14, 19], 57),
	] as const;

	// stoneFenceCells.forEach((cell) => {
	for (const xyz of stoneFenceCells) {
		setEdge(...xyz, "down", { blocked: true });
		setEdge(xyz[0], xyz[1] + 1, xyz[2], "up", { blocked: true });
	}

	const bridgeCells: [number, number, number][] = [
		...range([10, 14], 49, 1),
	] as const;

	for (const xyz of bridgeCells) {
		setEdge(...xyz, "up", { blocked: true });
		setEdge(...xyz, "down", { blocked: true });
	}

	const jumpablePlatformCells: [number, number, number][] = [
		...range([14, 17], 45, 1),
		...range(17, [45, 49], 1),
		...range([14, 16], 45, 1),
	] as const;

	const jumpablePlatformEdges = getCellsOutline(jumpablePlatformCells);

	for (const { x, y, z, dir } of jumpablePlatformEdges) {
		setEdge(x, y, z, dir, {
			transition: getJumpTransition({
				x,
				y,
				z,
				dir,
			}),
		});
	}

	const mushroomCells: [number, number, number][] = [
		[6, 51, 0],
		[17, 42, 0],
	] as const;

	// Mushroom at 17,42,0 blocks and is interactable
	mushroomCells.forEach((cell) => {
		setCell(...cell, {
			blocked: true,
			interact: {
				id: "pretty_mushrooms",
				onActivate: () => {
					const sentence = "Beatuiful. Let's leave this alone ♥";
					alert(sentence);
				},
			},
		});
	});

	// Ladder:
	// trigger when moving RIGHT from (13,46,0):
	// (13,46,0) -> (13,45,1) -> (14,45,1)
	setEdge(13, 46, 0, "right", {
		transition: {
			animation: "walk",
			path: [
				{ ...cellToPx(13, 45), z: 1 },
				{ ...cellToPx(14, 45), z: 1 },
			],
			end: { x: 14, y: 45, z: 1 },
		},
	});

	// Walk back down: moving LEFT from (14,45,1)
	setEdge(14, 45, 1, "left", {
		transition: {
			animation: "walk",
			path: [
				{ ...cellToPx(13, 45), z: 1 },
				{ ...cellToPx(13, 46), z: 0 },
			],
			end: { x: 13, y: 46, z: 0 },
		},
	});

	setEdge(14, 46, 0, "left", { blocked: true });

	// Fence roll
	setEdge(8, 52, 0, "down", {
		transition: {
			condition: () => player.animationCurrent === "run",
			animation: "spin",
			path: [{ ...cellToPx(8, 54), z: 0 }],
			end: { x: 8, y: 54, z: 0 },
		},
	});
	setEdge(8, 53, 0, "up", {
		transition: {
			condition: () => player.animationCurrent === "run",
			animation: "spin",
			path: [{ ...cellToPx(8, 51), z: 0 }],
			end: { x: 8, y: 51, z: 0 },
		},
	});

	// Blocking poles
	setEdge(7, 53, 0, "up", { blocked: true });
	setEdge(7, 52, 0, "down", { blocked: true });
	setEdge(9, 53, 0, "up", { blocked: true });
	setEdge(9, 52, 0, "down", { blocked: true });

	// Stairs
	setEdge(15, 50, 0, "left", {
		transition: {
			animation: "walk",
			path: [{ ...cellToPx(14, 49), z: 1 }],
			end: { x: 14, y: 49, z: 1 },
		},
	});
	setEdge(14, 49, 1, "right", {
		transition: {
			animation: "walk",
			path: [{ ...cellToPx(15, 50), z: 0 }],
			end: { x: 15, y: 50, z: 0 },
		},
	});

	setEdge(9, 50, 0, "right", {
		transition: {
			animation: "walk",
			path: [{ ...cellToPx(10, 49), z: 1 }],
			end: { x: 10, y: 49, z: 1 },
		},
	});
	setEdge(10, 49, 1, "left", {
		transition: {
			animation: "walk",
			path: [{ ...cellToPx(9, 50), z: 0 }],
			end: { x: 9, y: 50, z: 0 },
		},
	});

	setCell(10, 50, 0, {
		blocked: true,
	});
	setCell(14, 50, 0, {
		blocked: true,
	});
}
