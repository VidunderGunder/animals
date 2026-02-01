import { playSfx } from "../../../audio/audio-api";
import { movementSpeeds, TILE_SIZE_PX } from "../../../config";
import type { Direction } from "../../../input/input";
import { cellToPx, setEdge } from "../cells";
import type { Entity } from "../entities";
import type { Transition } from "./transition";

export function setStubJumpTransitions(
	stubs: [number, number][],
	z: number = 0,
) {
	for (const [x, y] of stubs) {
		const neighbors: Record<Direction, boolean> = {
			up: stubs.some(([nx, ny]) => nx === x && ny === y - 1),
			right: stubs.some(([nx, ny]) => nx === x + 1 && ny === y),
			down: stubs.some(([nx, ny]) => nx === x && ny === y + 1),
			left: stubs.some(([nx, ny]) => nx === x - 1 && ny === y),
		};
		setStubJumpTransitionsSingle(x, y, z, neighbors);
	}
}

/**
 *
 * @param x - X cell
 * @param y - Y cell
 * @param z - Z layer
 * @param neighbors - Neighboring stubs the entity can jump to (same height as current stub)
 */
function setStubJumpTransitionsSingle(
	x: number,
	y: number,
	z: number,
	neighbors: Record<Direction, boolean> = {
		up: false,
		right: false,
		down: false,
		left: false,
	},
) {
	const { xPx, yPx } = cellToPx(x, y);

	const dirPxs = {
		up: cellToPx(x, y - 1),
		right: cellToPx(x + 1, y),
		down: cellToPx(x, y + 1),
		left: cellToPx(x - 1, y),
	} satisfies Record<Direction, { xPx: number; yPx: number }>;

	const TOP_Y = -6;

	const jumpLiftHorizontal = (entity: Entity) =>
		isRunning(entity) ? -TOP_Y : 10;
	const jumpLiftUp = (entity: Entity) => (isRunning(entity) ? -TOP_Y : 13);
	const jumpLiftDown = (entity: Entity) => (isRunning(entity) ? -TOP_Y : 15);

	const duration = (entity: Entity) =>
		isRunning(entity) ? 0.5 * (TILE_SIZE_PX / movementSpeeds.run) : 115;

	const HALF_TILE_PX = TILE_SIZE_PX / 2;

	// ============================================================
	// Right jump edges (always)
	// ============================================================

	setEdge(x + 1, y, z, "left", {
		transition: {
			end: { x, y, z },
			animation: "walk",
			path: pathWithEndPause([
				{
					onSegmentStart: playJumpSfx,
					xPx: dirPxs.right.xPx - HALF_TILE_PX,
					yPx: (entity) => dirPxs.right.yPx - jumpLiftHorizontal(entity),
					z,
					duration: duration,
				},
				{
					xPx,
					yPx: yPx + TOP_Y,
					z,
					duration,
					onSegmentEnd: playThudSfx,
				},
			]),
		},
	});

	// Destination is the right cell. If that right cell is a stub, land on TOP_Y.
	const rightDstTop = neighbors.right ? TOP_Y : 0;

	setEdge(x, y, z, "right", {
		transition: {
			end: { x: x + 1, y, z },
			animation: "walk",
			path: pathWithEndPause([
				{
					onSegmentStart: playJumpSfx,
					xPx: xPx + HALF_TILE_PX,
					yPx: (entity) => yPx - jumpLiftHorizontal(entity),
					z,
					duration,
				},
				{
					xPx: dirPxs.right.xPx,
					yPx: dirPxs.right.yPx + rightDstTop,
					z,
					duration,
					onSegmentEnd: playThudSfx,
				},
			]),
		},
	});

	// ============================================================
	// Left jump edges (only if no left neighbor, to avoid duplicates)
	// ============================================================

	if (!neighbors.left) {
		setEdge(x - 1, y, z, "right", {
			transition: {
				end: { x, y, z },
				animation: "walk",
				path: pathWithEndPause([
					{
						onSegmentStart: playJumpSfx,
						xPx: dirPxs.left.xPx + HALF_TILE_PX,
						yPx: (entity) => dirPxs.left.yPx - jumpLiftHorizontal(entity),
						z,
						duration,
					},
					{
						xPx,
						yPx: yPx + TOP_Y,
						z,
						duration,
						onSegmentEnd: playThudSfx,
					},
				]),
			},
		});
		setEdge(x, y, z, "left", {
			transition: {
				end: { x: x - 1, y, z },
				animation: "walk",
				path: pathWithEndPause([
					{
						onSegmentStart: playJumpSfx,
						xPx: xPx - HALF_TILE_PX,
						yPx: (entity) => yPx - jumpLiftHorizontal(entity),
						z,
						duration,
					},
					{
						xPx: dirPxs.left.xPx,
						yPx: dirPxs.left.yPx,
						z,
						duration,
						onSegmentEnd: playThudSfx,
					},
				]),
			},
		});
	}

	// ============================================================
	// Down jump edges (always)
	// ============================================================

	// Source is the down cell. If that down cell is a stub, base its arc from TOP_Y.
	// const downSrcTop = neighbors.down ? TOP_Y : 0;

	setEdge(x, y + 1, z, "up", {
		transition: {
			end: { x, y, z },
			animation: "walk",
			path: pathWithEndPause([
				{
					onSegmentStart: playJumpSfx,
					xPx: dirPxs.down.xPx,
					yPx: (entity) =>
						dirPxs.down.yPx -
						HALF_TILE_PX -
						jumpLiftUp(entity) * (neighbors.down ? 1 : 0.75),
					z,
					duration,
				},
				{
					xPx,
					yPx: yPx + TOP_Y,
					z,
					duration,
					onSegmentEnd: playThudSfx,
				},
			]),
		},
	});

	// Destination is the down cell. If that down cell is a stub, land on TOP_Y.
	const downDstTop = neighbors.down ? TOP_Y : 0;

	setEdge(x, y, z, "down", {
		transition: {
			end: { x, y: y + 1, z },
			animation: "walk",
			path: pathWithEndPause([
				{
					onSegmentStart: playJumpSfx,
					xPx,
					yPx: (entity) =>
						yPx +
						HALF_TILE_PX -
						jumpLiftDown(entity) * (neighbors.down ? 1 : 0.5),
					z,
					duration,
				},
				{
					xPx: dirPxs.down.xPx,
					yPx: dirPxs.down.yPx + downDstTop,
					z,
					duration,
					onSegmentEnd: playThudSfx,
				},
			]),
		},
	});

	// ============================================================
	// Up jump edges (only if no up neighbor, to avoid duplicates)
	// ============================================================

	if (!neighbors.up) {
		setEdge(x, y - 1, z, "down", {
			transition: {
				end: { x, y, z },
				animation: "walk",
				path: pathWithEndPause([
					{
						onSegmentStart: playJumpSfx,
						xPx: dirPxs.up.xPx,
						yPx: (entity) =>
							dirPxs.up.yPx +
							HALF_TILE_PX -
							jumpLiftDown(entity) *
								(neighbors.up || isRunning(entity) ? 1 : 0.75),
						z,
						duration,
					},
					{
						xPx,
						yPx: yPx + TOP_Y,
						z,
						duration,
						onSegmentEnd: playThudSfx,
					},
				]),
			},
		});
		setEdge(x, y, z, "up", {
			transition: {
				end: { x, y: y - 1, z },
				animation: "walk",
				path: pathWithEndPause([
					{
						onSegmentStart: playJumpSfx,
						xPx,
						yPx: (entity) =>
							yPx -
							HALF_TILE_PX -
							jumpLiftUp(entity) *
								(neighbors.up || isRunning(entity) ? 1 : 0.75),
						z,
						duration,
					},
					{
						xPx: dirPxs.up.xPx,
						yPx: dirPxs.up.yPx,
						z,
						duration,
						onSegmentEnd: playThudSfx,
					},
				]),
			},
		});
	}
}

function pathWithEndPause(
	path: Transition["path"],
	pauseMs: number = 25,
): Transition["path"] {
	const lastSegment = path[path.length - 1];
	if (!lastSegment) return path;
	return [
		...path,
		{
			...lastSegment,
			onSegmentStart: undefined,
			duration: (entity: Entity) => (isRunning(entity) ? 0 : pauseMs),
		},
	] satisfies Transition["path"];
}

function isRunning(entity: Entity): boolean {
	return entity.speed === movementSpeeds.run;
}

function playJumpSfx(entity: Entity) {
	if (isRunning(entity) && entity.yPx % TILE_SIZE_PX !== 0) {
		playSfx("jump", { volume: 0.1, detuneCents: -500, playbackRate: 1.5 });
		return;
	}
	if (!isRunning(entity) && entity.yPx % TILE_SIZE_PX !== 0) {
		playSfx("jump", { volume: 0.15, detuneCents: -400, playbackRate: 1.5 });
		return;
	}
	playSfx("jump", { volume: 0.25, detuneCents: -350, playbackRate: 1.1 });
}

function playThudSfx(entity: Entity) {
	if (entity.yPxf % TILE_SIZE_PX !== 0) return;
	playSfx("thud", { volume: 0.1 });
}
