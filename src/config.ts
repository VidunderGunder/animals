export const SCALE = 1.2;
export const ASPECT_RATIO_X = 4;
export const ASPECT_RATIO_Y = 3;
export const ASPECT_RATIO = ASPECT_RATIO_X / ASPECT_RATIO_Y; // Must match CSS in index.html
export const BASE_WIDTH = 240;
export const BASE_HEIGHT = BASE_WIDTH / ASPECT_RATIO;

export const GAME_WIDTH = BASE_WIDTH * SCALE;
export const GAME_HEIGHT = BASE_HEIGHT * SCALE;
export const TILE_SIZE = 16;
export const FPS_LIMIT = Infinity;

export const CHARACTER_SPRITE_WIDTH = 16;
export const CHARACTER_SPRITE_HEIGHT = 24;

export type MovementType = "walk" | "run";
export const DEFAULT_MOVEMENT: MovementType = "walk";

export const movementSpeeds = {
	walk: 0.1,
	run: 0.16,
} as const satisfies Record<MovementType, number>;

export const DEBUG_TILES = false;
export const DEBUG_OVERLAY = false;

function isValidDimensions() {
	if (Number.isInteger(GAME_WIDTH) && Number.isInteger(GAME_HEIGHT)) {
		return true;
	} else {
		throw new Error(
			`GAME_WIDTH and GAME_HEIGHT must be integers. Current values: GAME_WIDTH=${GAME_WIDTH}, GAME_HEIGHT=${GAME_HEIGHT}`,
		);
	}
}

isValidDimensions();
