export const SCALE = 1;
export const GAME_WIDTH = 240 * SCALE; // 120 x 3
export const GAME_HEIGHT = 160 * SCALE; // 80 x 3
export const TILE_SIZE = 16; // pixels width/height of a tile
export const FPS_LIMIT = 200;

export const PLAYER_SPRITE_WIDTH = 16;
export const PLAYER_SPRITE_HEIGHT = 24;

export type MovementType = "walk" | "run";
export const DEFAULT_MOVEMENT: MovementType = "run";

export const movementSpeeds = {
  walk: 100,
  run: 160,
} as const satisfies Record<MovementType, number>;

export const DEBUG_TILES = false;
export const DEBUG_OVERLAY = false;
