import { GAME_HEIGHT_PX, GAME_WIDTH_PX, TILE_SIZE_PX } from "../../config";
import { clamp, lerp } from "../../functions/general";
import { player } from "../../state";
import { getCell } from "./data";

export type Vec2Px = {
	xPx: number;
	yPx: number;
};

export const camera: Vec2Px = {
	xPx: 0,
	yPx: 0,
};

function getCellOffset(x: number, y: number, z: number) {
	const cell = getCell(x, y, z);
	return {
		xPx: cell?.camera?.xPx ?? 0,
		yPx: cell?.camera?.yPx ?? 0,
	};
}

/**
 * Continuous offset field: bilinear interpolation between the 4 surrounding tiles
 * based on player's *pixel* position.
 *
 * This makes the camera offset change smoothly *in sync with the player movement*,
 * with no physics lag needed.
 */
function getInterpolatedOffsetFromPlayerPx() {
	const z = player.z;

	const px = player.xPx / TILE_SIZE_PX;
	const py = player.yPx / TILE_SIZE_PX;

	const x0 = Math.floor(px);
	const y0 = Math.floor(py);
	const x1 = x0 + 1;
	const y1 = y0 + 1;

	const fx = clamp(px - x0, 0, 1);
	const fy = clamp(py - y0, 0, 1);

	const o00 = getCellOffset(x0, y0, z);
	const o10 = getCellOffset(x1, y0, z);
	const o01 = getCellOffset(x0, y1, z);
	const o11 = getCellOffset(x1, y1, z);

	const ox0 = lerp(o00.xPx, o10.xPx, fx);
	const ox1 = lerp(o01.xPx, o11.xPx, fx);
	const oy0 = lerp(o00.yPx, o10.yPx, fx);
	const oy1 = lerp(o01.yPx, o11.yPx, fx);

	return {
		xPx: lerp(ox0, ox1, fy),
		yPx: lerp(oy0, oy1, fy),
	};
}

export function getCameraTarget(): Vec2Px {
	const baseX = player.xPx - GAME_WIDTH_PX / 2 + TILE_SIZE_PX / 2;
	const baseY = player.yPx - GAME_HEIGHT_PX / 2 + TILE_SIZE_PX / 2;

	const offset = getInterpolatedOffsetFromPlayerPx();

	return {
		xPx: baseX + offset.xPx,
		yPx: baseY + offset.yPx,
	};
}

export function updateCamera(dt: number) {
	// For zero lag and perfect lockstep:
	const target = getCameraTarget();
	camera.xPx = Math.round(target.xPx);
	camera.yPx = Math.round(target.yPx);

	// If you later want a tiny bit of smoothing on the base-follow (not the offset),
	// we can reintroduce spring ONLY on baseX/baseY and keep offset immediate.
	void dt;
}
