import {
	CHARACTER_SPRITE_HEIGHT_PX,
	CHARACTER_SPRITE_WIDTH_PX,
	TILE_SIZE_PX,
} from "../../../config";
import {
	cellToPx,
	getCellsOutline,
	getJumpTransition,
	range,
	setCell,
	setEdge,
} from "../data";
import { rsvp } from "../dialog";
import { type Entity, entities } from "../entities";

export function initializeArea() {
	// dock camera position
	setCell(30, 37, 0, {
		camera: {
			xPx: 0,
			yPx: -4 * TILE_SIZE_PX,
		},
	});
	setCell(30, 38, 0, {
		camera: {
			xPx: 0,
			yPx: -3 * TILE_SIZE_PX,
		},
	});
	setCell(30, 39, 0, {
		camera: {
			xPx: 0,
			yPx: -2 * TILE_SIZE_PX,
		},
	});
	setCell(30, 40, 0, {
		camera: {
			xPx: 0,
			yPx: -1 * TILE_SIZE_PX,
		},
	});

	const stubs: [number, number][] = [
		[28, 44],
		[27, 44],
		[26, 44],
		[26, 45],
		[26, 46],
		[28, 46],
	] as const;

	for (const xy of stubs) {
		setCell(...xy, 0, { blocked: true });
	}

	const blockedCells: [number, number, number][] = [
		// Dock
		[30, 36, 0],
		...range(29, [37, 39]),
		...range(31, [37, 39]),

		// Beach
		...range([24, 29], 40),
		...range([31, 36], 40),

		// Woods
		[24, 41, 0],
		...range(37, [41, 57]),
		...range(23, [41, 57]),

		// Fence Woods
		...range([0, 22], 57),
		...range([38, 60], 57),
	] as const;

	for (const xyz of blockedCells) {
		setCell(...xyz, {
			blocked: true,
		});
	}

	setCell(30, 36, 0, {
		onActivate: () => {
			const sentence = "The clouds look like cotton candy";
			rsvp("dock_lookout", sentence);
		},
		blocked: true,
	});

	const stoneFenceCells: [number, number, number][] = [
		...range([23, 28], 57),
		...range([32, 37], 57),
	] as const;

	for (const xyz of stoneFenceCells) {
		setEdge(...xyz, "down", { blocked: true });
		setEdge(xyz[0], xyz[1] + 1, xyz[2], "up", { blocked: true });
	}

	const bridgeCells: [number, number, number][] = [
		...range([28, 32], 49, 1),
	] as const;

	for (const xyz of bridgeCells) {
		setEdge(...xyz, "up", { blocked: true });
		setEdge(...xyz, "down", { blocked: true });
	}

	const jumpablePlatformCells: [number, number, number][] = [
		...range([32, 35], 45, 1),
		...range(35, [45, 49], 1),
		...range([32, 34], 45, 1),
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
		[24, 51, 0],
		[35, 42, 0],
	] as const;

	mushroomCells.forEach((cell) => {
		setCell(...cell, {
			blocked: true,
			onActivate: () => {
				const sentence = "Mushrooms! ... ... Let's leave them alone ❤";
				rsvp("pretty_mushrooms", sentence);
			},
		});
	});

	// Ladder
	setEdge(31, 46, 0, "right", {
		transition: {
			animation: "walk",
			path: [
				{ ...cellToPx(31, 45), z: 1 },
				{ ...cellToPx(32, 45), z: 1 },
			],
			end: { x: 32, y: 45, z: 1 },
		},
		interact: {
			id: "ladder_up",
			onActivate: () => {
				const sentence = "I could climb this";
				rsvp("ladder_up", sentence);
			},
		},
	});

	setEdge(32, 45, 1, "left", {
		transition: [
			{
				condition: (entity) => entity.animationCurrent === "walk",
				animation: "walk",
				path: [
					{ ...cellToPx(31, 45), z: 1 },
					{
						...cellToPx(31, 46),
						z: 0,
						onSegment: (entity: Entity) => {
							entity.direction = "right";
						},
					},
				],
				end: { x: 31, y: 46, z: 0 },
			},
			{
				...getJumpTransition({
					x: 32,
					y: 45,
					z: 1,
					dir: "left",
				}),
				condition: (entity) => entity.animationCurrent === "run",
			},
		],
	});

	setEdge(32, 46, 0, "left", { blocked: true });

	// Fence roll
	setEdge(26, 52, 0, "down", {
		transition: {
			condition: (entity) => entity.animationCurrent === "run",
			animation: "spin",
			path: [{ ...cellToPx(26, 54), z: 0 }],
			end: { x: 26, y: 54, z: 0 },
		},
	});
	setEdge(26, 53, 0, "up", {
		transition: {
			condition: (entity) => entity.animationCurrent === "run",
			animation: "spin",
			path: [{ ...cellToPx(26, 51), z: 0 }],
			end: { x: 26, y: 51, z: 0 },
		},
	});

	// Blocking poles
	setEdge(25, 53, 0, "up", { blocked: true });
	setEdge(25, 52, 0, "down", { blocked: true });
	setEdge(27, 53, 0, "up", { blocked: true });
	setEdge(27, 52, 0, "down", { blocked: true });

	// Stairs
	setEdge(33, 50, 0, "left", {
		transition: {
			animation: "walk",
			path: [{ ...cellToPx(32, 49), z: 1 }],
			end: { x: 32, y: 49, z: 1 },
		},
	});
	setEdge(32, 49, 1, "right", {
		transition: {
			animation: "walk",
			path: [{ ...cellToPx(33, 50), z: 0 }],
			end: { x: 33, y: 50, z: 0 },
		},
	});

	setEdge(27, 50, 0, "right", {
		transition: {
			animation: "walk",
			path: [{ ...cellToPx(28, 49), z: 1 }],
			end: { x: 28, y: 49, z: 1 },
		},
	});
	setEdge(28, 49, 1, "left", {
		transition: {
			animation: "walk",
			path: [{ ...cellToPx(27, 50), z: 0 }],
			end: { x: 27, y: 50, z: 0 },
		},
	});

	setCell(28, 50, 0, {
		blocked: true,
	});
	setCell(32, 50, 0, {
		blocked: true,
	});

	populateArea();
}

function populateArea() {
	entities.set("npc_player", {
		renderVariant: "player",
		x: 32,
		y: 41,
		xPx: 32 * TILE_SIZE_PX,
		yPx: 41 * TILE_SIZE_PX,
		z: 0,
		direction: "down",
		width: CHARACTER_SPRITE_WIDTH_PX,
		height: CHARACTER_SPRITE_HEIGHT_PX,
		speed: 0,
		animationCurrent: "idle",
		animationFrameIndex: 0,
		animationTimer: 0,
		path: [],
		isMoving: false,
		xPxi: 0,
		yPxi: 0,
		zi: 0,
		xPxf: 0,
		yPxf: 0,
		zf: 0,
		pathSegmentProgress: 1,
		movingToTile: null,
		movingToAnimation: null,

		onActivate: () => {
			rsvp("npc_interact", "Hello!");
		},
	});
}
