import { TILE_SIZE_PX } from "../../../config";
import type { Entity } from "../../../state";
import {
	cellToPx,
	getCellsOutline,
	getJumpTransition,
	range,
	setCell,
	setEdge,
} from "../data";
import { rsvp } from "../dialog";

export function initializeArea() {
	// dock camera position
	setCell(12, 37, 0, {
		camera: {
			xPx: 0,
			yPx: -4 * TILE_SIZE_PX,
		},
	});
	setCell(12, 38, 0, {
		camera: {
			xPx: 0,
			yPx: -3 * TILE_SIZE_PX,
		},
	});
	setCell(12, 39, 0, {
		camera: {
			xPx: 0,
			yPx: -2 * TILE_SIZE_PX,
		},
	});
	setCell(12, 40, 0, {
		camera: {
			xPx: 0,
			yPx: -1 * TILE_SIZE_PX,
		},
	});

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

	setCell(12, 36, 0, {
		interact: {
			id: "dock_lookout",
			onActivate: () => {
				const sentence = "The clouds look like cotton candy";
				rsvp("dock_lookout", sentence);
			},
		},
		blocked: true,
	});

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
			interact: {
				id: `jumpable_platform`,
				onActivate: () => {
					const sentence = "I could jump down with some speed!";
					rsvp("jumpable_platform", sentence);
				},
			},
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
					const sentence = "Mushrooms! ... ... Let's leave them alone ❤";
					rsvp("pretty_mushrooms", sentence);
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
		interact: {
			id: "ladder_up",
			onActivate: () => {
				const sentence = "I could climb this";
				rsvp("ladder_up", sentence);
			},
		},
	});

	// Walk back down: moving LEFT from (14,45,1)
	setEdge(14, 45, 1, "left", {
		transition: [
			{
				condition: (entity) => entity.animationCurrent === "walk",
				animation: "walk",
				path: [
					{ ...cellToPx(13, 45), z: 1 },
					{
						...cellToPx(13, 46),
						z: 0,
						onSegment: (entity: Entity) => {
							entity.facingDirection = "right";
						},
					},
				],
				end: { x: 13, y: 46, z: 0 },
			},
			{
				...getJumpTransition({
					x: 14,
					y: 45,
					z: 1,
					dir: "left",
				}),
				condition: (entity) => entity.animationCurrent === "run",
			},
		],
	});

	setEdge(14, 46, 0, "left", { blocked: true });

	// Fence roll
	setEdge(8, 52, 0, "down", {
		transition: {
			condition: (entity) => entity.animationCurrent === "run",
			animation: "spin",
			path: [{ ...cellToPx(8, 54), z: 0 }],
			end: { x: 8, y: 54, z: 0 },
		},
	});
	setEdge(8, 53, 0, "up", {
		transition: {
			condition: (entity) => entity.animationCurrent === "run",
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
