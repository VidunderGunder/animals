import type { Direction } from "../../../input/input";
import { cellToPx, setEdge } from "../cells";
import type { Entity } from "../entities";
import type { Transition } from "./transition";

/**
 *
 * @param x - X cell
 * @param y - Y cell
 * @param z - Z layer
 * @param neighbors - Neighboring stubs the entity can jump to (same height as current stub)
 */
export function setStubJumpTransitions(
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

	// Horizontal "jump lift" stays as your working baseline
	const JUMP_LIFT_H = 10;

	// Vertical: slightly higher + slightly slower to read like a hop
	const JUMP_LIFT_V_UP = 9;
	const JUMP_LIFT_V_DOWN = 15;

	const durH1 = ({ animationCurrent }: Entity) =>
		animationCurrent === "run" ? 80 : 115;
	const durH2 = ({ animationCurrent }: Entity) =>
		animationCurrent === "run" ? 120 : 150;
	const durV1 = durH1;
	const durV2 = durH2;

	// ============================================================
	// Right jump edges (always)
	// ============================================================

	setEdge(x + 1, y, z, "left", {
		transition: {
			end: { x, y, z },
			animation: "walk",
			path: pathWithEndPause([
				{
					xPx: dirPxs.right.xPx - 8,
					yPx: dirPxs.right.yPx - JUMP_LIFT_H,
					z,
					duration: durH1,
				},
				{
					xPx,
					yPx: yPx + TOP_Y,
					z,
					duration: durH2,
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
					xPx: xPx + 8,
					yPx: yPx - JUMP_LIFT_H,
					z,
					duration: durH1,
				},
				{
					xPx: dirPxs.right.xPx,
					yPx: dirPxs.right.yPx + rightDstTop,
					z,
					duration: durH1,
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
						xPx: dirPxs.left.xPx + 8,
						yPx: dirPxs.left.yPx - JUMP_LIFT_H,
						z,
						duration: durH1,
					},
					{
						xPx,
						yPx: yPx + TOP_Y,
						z,
						duration: durH2,
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
						xPx: xPx - 8,
						yPx: yPx - JUMP_LIFT_H,
						z,
						duration: durH1,
					},
					{
						xPx: dirPxs.left.xPx,
						yPx: dirPxs.left.yPx,
						z,
						duration: durH1,
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
	const downSrcTop = neighbors.down ? TOP_Y : 0;

	setEdge(x, y + 1, z, "up", {
		transition: {
			end: { x, y, z },
			animation: "walk",
			path: pathWithEndPause([
				{
					xPx: dirPxs.down.xPx,
					yPx: dirPxs.down.yPx + downSrcTop - 8 - JUMP_LIFT_V_UP,
					z,
					duration: durV1,
				},
				{
					xPx,
					yPx: yPx + TOP_Y,
					z,
					duration: durV2,
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
					xPx: xPx,
					yPx: yPx + 8 - JUMP_LIFT_V_DOWN,
					z,
					duration: durV1,
				},
				{
					xPx: dirPxs.down.xPx,
					yPx: dirPxs.down.yPx + downDstTop,
					z,
					duration: durV1,
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
						xPx: dirPxs.up.xPx,
						yPx: dirPxs.up.yPx + 8 - JUMP_LIFT_V_DOWN,
						z,
						duration: durV1,
					},
					{
						xPx,
						yPx: yPx + TOP_Y,
						z,
						duration: durV2,
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
						xPx: xPx,
						yPx: yPx - 8 - JUMP_LIFT_V_UP,
						z,
						duration: durV1,
					},
					{
						xPx: dirPxs.up.xPx,
						yPx: dirPxs.up.yPx,
						z,
						duration: durV1,
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
			duration: pauseMs,
		},
	];
}
