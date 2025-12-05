import.meta.hot.accept();

export const SCALE = 1;
export const GAME_WIDTH = 240 * SCALE;
export const GAME_HEIGHT = 160 * SCALE;
export const TILE_SIZE = 16;
export const FPS_LIMIT = 200;

export const PLAYER_SPRITE_WIDTH = 16;
export const PLAYER_SPRITE_HEIGHT = 24;

export type MovementType = "walk" | "run";
export const DEFAULT_MOVEMENT: MovementType = "walk";

export const movementSpeeds = {
	walk: 100,
	run: 160,
} as const satisfies Record<MovementType, number>;

export const DEBUG_TILES = false;
export const DEBUG_OVERLAY = true;
