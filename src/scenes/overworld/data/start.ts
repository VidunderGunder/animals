import { createImageElement } from "../../../assets/image";
import { setAmbienceFields } from "../../../audio/ambience";
import { TILE_SIZE_PX } from "../../../config";
import { CommandRunner } from "../ai/brain";
import { cmd } from "../ai/commands";
import {
	cellToPx,
	getCellsOutline,
	range,
	setCell,
	setEdge,
	setWorldImageLayers,
} from "../cells";
import { bubble, bubbles } from "../dialog";
import {
	type Entity,
	entities,
	getEntityAnimalDefaults,
	getEntityCharacterDefaults,
	getEntityFacingTile,
} from "../entities";
import { getJumpDownTransition } from "../transition/jump-down";
import { setStubJumpTransitions } from "../transition/jump-stub";

export function initializeArea() {
	initWorldImageLayers();
	initCellsAndEdges();
	initAudio();
	initEntities();
}

function initCellsAndEdges() {
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

	const trunks: [number, number][] = [
		[28, 44],
		[27, 44],
		[26, 44],
		[26, 45],
		[26, 46],
		[28, 46],
	] as const;

	setStubJumpTransitions(trunks);

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
			bubble("dock_lookout", sentence);
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
			transition: getJumpDownTransition({
				x,
				y,
				z,
				dir,
			}),
			interact: {
				id: `jumpable_platform`,
				onActivate: () => {
					const sentence = "I could jump down with some speed!";
					bubble("jumpable_platform", sentence);
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
				bubble("pretty_mushrooms", sentence);
			},
		});
	});

	// Ladder
	setEdge(31, 46, 0, "right", {
		transition: {
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
				bubble("ladder_up", sentence);
			},
		},
	});

	setEdge(32, 45, 1, "left", {
		transition: [
			{
				condition: (entity: Entity) => entity.moveMode === "walk",
				path: [
					{ ...cellToPx(31, 45), z: 1 },
					{
						...cellToPx(31, 46),
						z: 0,
						onSegmentStart: (entity: Entity) => {
							entity.direction = "right";
						},
					},
				],
				end: { x: 31, y: 46, z: 0 },
			},
			{
				...getJumpDownTransition({
					x: 32,
					y: 45,
					z: 1,
					dir: "left",
				}),
				condition: (entity: Entity) => entity.moveMode === "run",
			},
		],
	});

	setEdge(32, 46, 0, "left", { blocked: true });

	// Fence roll
	setEdge(26, 52, 0, "down", {
		transition: {
			condition: (entity: Entity) => entity.moveMode === "run",
			animation: "spin",
			path: [{ ...cellToPx(26, 54), z: 0 }],
			end: { x: 26, y: 54, z: 0 },
		},
	});
	setEdge(26, 53, 0, "up", {
		transition: {
			condition: (entity: Entity) => entity.moveMode === "run",
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
			path: [{ ...cellToPx(32, 49), z: 1 }],
			end: { x: 32, y: 49, z: 1 },
		},
	});
	setEdge(32, 49, 1, "right", {
		transition: {
			path: [{ ...cellToPx(33, 50), z: 0 }],
			end: { x: 33, y: 50, z: 0 },
		},
	});

	setEdge(27, 50, 0, "right", {
		transition: {
			path: [{ ...cellToPx(28, 49), z: 1 }],
			end: { x: 28, y: 49, z: 1 },
		},
	});
	setEdge(28, 49, 1, "left", {
		transition: {
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
}

function initAudio() {
	setAmbienceFields([
		{
			mix: {
				beach: 0.2,
			},
			a: {
				x: -Infinity,
				y: -Infinity,
				z: -Infinity,
			},
			b: {
				x: Infinity,
				y: 30,
				z: Infinity,
			},
		},
		{
			axis: "y",
			a: {
				x: 24,
				y: 30,
				z: -Infinity,
				mix: {
					beach: 0.2,
					forest: 0,
				},
			},
			b: {
				x: 36,
				y: 47,
				z: Infinity,
				mix: {
					beach: 0,
					forest: 1,
				},
			},
		},
		{
			mix: {
				forest: 1,
			},
			a: {
				x: -Infinity,
				y: 47,
				z: -Infinity,
			},
			b: {
				x: Infinity,
				y: Infinity,
				z: Infinity,
			},
		},
	]);
}

function initWorldImageLayers() {
	setWorldImageLayers([
		{
			z: 0,
			back: [
				createImageElement("/world/start/scenery-frame-1.png"),
				createImageElement("/world/start/scenery-frame-2.png"),
			],
		},
		{
			z: 0,
			back: [
				createImageElement("/world/start/obstacle-course/0-back-frame-1.png"),
				createImageElement("/world/start/obstacle-course/0-back-frame-2.png"),
			],
			front: [
				createImageElement(
					"/world/start/obstacle-course/0-front-frame-1-2.png",
				),
			],
		},
		{
			z: 1,
			back: [
				createImageElement("/world/start/obstacle-course/1-back-frame-1-2.png"),
			],

			front: [
				createImageElement(
					"/world/start/obstacle-course/1-front-frame-1-2.png",
				),
			],
		},
	]);
}

function initEntities() {
	const npcId = "npc-1";
	entities.set(npcId, {
		...getEntityCharacterDefaults({ x: 30, y: 44, id: npcId }),
		sheet: "npc-1",
		onActivate: ({ activator, activated }) => {
			const bubbleId = `${activated.id}_interact`;
			if (bubbles.has(bubbleId)) return;
			if (activated.interactionLock) return;
			if (!activated.brain) return;

			activated.interactionLock = true;

			// Preempt whatever it was doing, then continue its queued routine.
			activated.brain?.runner.interrupt([
				cmd.waitUntilStopped(),
				cmd.goToTile(getEntityFacingTile(activator)),
				cmd.face(activator),
				() => bubble(bubbleId, "Hello!", activated),
				cmd.wait(1000),
				{
					onTick: ({ entity }) => {
						entity.interactionLock = false;
						return true;
					},
				},
			]);
		},
		brain: {
			runner: new CommandRunner(),
			routine(entity) {
				entity.moveMode = "run";
				if (!entity.brain?.runner.isIdle()) return;

				const route = [
					{ x: 26, y: 44, z: 0, moveMode: "walk" },
					{ x: 26, y: 46, z: 0, moveMode: "walk" },
					{ x: 30, y: 46, z: 0, moveMode: "walk" },
					{ x: 35, y: 49, z: 1, moveMode: "walk" },
					{ x: 30, y: 49, z: 1, moveMode: "run" },
					{ x: 26, y: 50, z: 0, moveMode: "run" },
					{ x: 26, y: 55, z: 0, moveMode: "run" },
					{ x: 30, y: 55, z: 0, moveMode: "run" },
					{ x: 30, y: 44, z: 0, moveMode: "walk" },
				] as const;

				for (const point of route) {
					entity.brain.runner.push({
						onTick({ entity }) {
							if (entity.moveMode !== point.moveMode) {
								entity.moveMode = point.moveMode;
							}
							return true;
						},
					});
					entity.brain.runner.push(
						cmd.goToTile(point, { stopAdjacentIfTargetBlocked: true }),
					);
				}
			},
		},
	});

	const foxId1 = "fox-1";
	entities.set(foxId1, {
		...getEntityAnimalDefaults({ x: 30, y: 44, id: foxId1 }),
		sheet: "fox",
		onActivate: ({ activator, activated }) => {
			const bubbleId = `${activated.id}_interact`;
			if (bubbles.has(bubbleId)) return;
			if (activated.interactionLock) return;
			if (!activated.brain) return;

			activated.interactionLock = true;

			// Preempt whatever it was doing, then continue its queued routine.
			activated.brain?.runner.interrupt([
				cmd.waitUntilStopped(),
				cmd.goToTile(getEntityFacingTile(activator)),
				cmd.face(activator),
				() =>
					bubble(bubbleId, "Yip!", activated, {
						pitch: 3.5,
					}),
				cmd.wait(1000),
				{
					onTick: ({ entity }) => {
						entity.interactionLock = false;
						return true;
					},
				},
			]);
		},
		brain: {
			runner: new CommandRunner(),
			routine(entity) {
				entity.moveMode = "run";
				if (!entity.brain?.runner.isIdle()) return;

				const route = [
					{ x: 26, y: 44, z: 0, moveMode: "walk" },
					{ x: 26, y: 46, z: 0, moveMode: "walk" },
					{ x: 30, y: 46, z: 0, moveMode: "walk" },
					{ x: 35, y: 49, z: 1, moveMode: "walk" },
					{ x: 30, y: 49, z: 1, moveMode: "run" },
					{ x: 26, y: 50, z: 0, moveMode: "run" },
					{ x: 26, y: 55, z: 0, moveMode: "run" },
					{ x: 30, y: 55, z: 0, moveMode: "run" },
					{ x: 30, y: 44, z: 0, moveMode: "walk" },
				] as const;

				for (const point of route) {
					entity.brain.runner.push({
						onTick({ entity }) {
							if (entity.moveMode !== point.moveMode) {
								entity.moveMode = point.moveMode;
							}
							return true;
						},
					});
					entity.brain.runner.push(
						cmd.goToTile(point, { stopAdjacentIfTargetBlocked: true }),
					);
				}
			},
		},
	});

	const foxId2 = "fox-2";
	const foxPos = { x: 33, y: 43 };
	entities.set(foxId2, {
		...getEntityAnimalDefaults({ ...foxPos, id: foxId2 }),
		sheet: "kitsune",
		onActivate: ({ activator, activated }) => {
			const bubbleId = `${activated.id}_interact`;
			if (bubbles.has(bubbleId)) return;
			if (activated.interactionLock) return;
			if (!activated.brain) return;

			activated.interactionLock = true;

			activated.brain?.runner.interrupt([
				cmd.waitUntilStopped(),
				cmd.goToTile(getEntityFacingTile(activator)),
				cmd.face(activator),
				() =>
					bubble(bubbleId, "Yip!", activated, {
						pitch: 3.5,
					}),
				cmd.wait(1000),
				{
					onTick: ({ entity }) => {
						entity.interactionLock = false;
						return true;
					},
				},
			]);
		},
		brain: {
			runner: new CommandRunner(),
			routine(entity) {
				// Idle randomly around the same spot
				if (!entity.brain?.runner.isIdle()) return;

				const randomOffset = () => Math.floor(Math.random() * 3) - 1;
				const pause = Math.floor(Math.random() * 2000) + 1000;

				entity.brain.runner.push(cmd.wait(pause));

				const dest = {
					x: foxPos.x + randomOffset(),
					y: foxPos.y + randomOffset(),
					z: 0,
				};

				entity.brain.runner.push(
					cmd.goToTile(dest, { stopAdjacentIfTargetBlocked: true }),
				);
			},
		},
	});

	const turtleId1 = "turtle-1";
	const turtlePos = { x: 27, y: 42 };
	entities.set(turtleId1, {
		...getEntityAnimalDefaults({ ...turtlePos, id: turtleId1 }),
		sheet: "turtle",
		onActivate: ({ activator, activated }) => {
			const bubbleId = `${activated.id}_interact`;
			if (bubbles.has(bubbleId)) return;
			if (activated.interactionLock) return;
			if (!activated.brain) return;

			activated.interactionLock = true;

			activated.brain?.runner.interrupt([
				cmd.waitUntilStopped(),
				cmd.goToTile(getEntityFacingTile(activator)),
				cmd.face(activator),
				() =>
					bubble(bubbleId, "Ah!", activated, {
						pitch: 4.5,
						tempo: 1.2,
						intensity: 0.1,
					}),
				cmd.wait(1000),
				{
					onTick: ({ entity }) => {
						entity.interactionLock = false;
						return true;
					},
				},
			]);
		},
		brain: {
			runner: new CommandRunner(),
			routine(entity) {
				// Idle randomly around the same spot
				if (!entity.brain?.runner.isIdle()) return;

				const randomOffset = () => Math.floor(Math.random() * 3) - 1;
				const pause = Math.floor(Math.random() * 2000) + 1000;

				entity.brain.runner.push(cmd.wait(pause));

				const dest = {
					x: turtlePos.x + randomOffset(),
					y: turtlePos.y + randomOffset(),
					z: 0,
				};

				entity.brain.runner.push(
					cmd.goToTile(dest, { stopAdjacentIfTargetBlocked: true }),
				);
			},
		},
	});
}
