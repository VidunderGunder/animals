import {
  DEFAULT_MOVEMENT,
  movementSpeeds,
  PLAYER_SPRITE_HEIGHT,
  PLAYER_SPRITE_WIDTH,
} from "./config";
import type { Direction } from "./input";

export type Player = {
  /** Current tile coordinates */
  tileX: number;
  tileY: number;

  /** Facing direction */
  direction: Direction;

  /** Size of sprite in pixels (square) */
  width: number;
  height: number;

  /** Movement speed (pixels per second) */
  speed: number;

  /** Whether we're currently tweening between tiles */
  isMoving: boolean;

  /** Movement interpolation state (tile coordinates) */
  moveFromX: number;
  moveFromY: number;
  moveToX: number;
  moveToY: number;
  /** 0 → start tile, 1 → target tile */
  moveProgress: number;

  /** Current animation state */
  animationCurrent: PlayerAnimationName;
  animationFrameIndex: number;
  animationTimer: number;
};

export const startTileX = 8;
export const startTileY = 8;

export const player: Player = {
  tileX: startTileX,
  tileY: startTileY,
  direction: "down",
  height: PLAYER_SPRITE_HEIGHT,
  width: PLAYER_SPRITE_WIDTH,
  speed: movementSpeeds[DEFAULT_MOVEMENT],
  isMoving: false,
  moveFromX: startTileX,
  moveFromY: startTileY,
  moveToX: startTileX,
  moveToY: startTileY,
  moveProgress: 1,
  animationCurrent: "idle_down",
  animationFrameIndex: 0,
  animationTimer: 0,
};

export const DIRECTION_ROW: Record<Direction, number> = {
  down: 0,
  left: 1,
  right: 2,
  up: 3,
};

export type Animation = {
  /** Frame indices in the sprite sheet (column indexes) */
  frames: number[];
  /** Seconds each frame is shown */
  frameDuration: number;
  /** Loop back to start when finished */
  loop: boolean;
};

export type PlayerAnimationName =
  | "idle_down"
  | "idle_up"
  | "idle_left"
  | "idle_right"
  | "walk_down"
  | "walk_up"
  | "walk_left"
  | "walk_right"
  | "run_down"
  | "run_up"
  | "run_left"
  | "run_right";

export const playerAnimations = {
  // Idle: single frame for each direction (column 0)
  idle_down: { frames: [0], frameDuration: 0.3, loop: true },
  idle_up: { frames: [0], frameDuration: 0.3, loop: true },
  idle_left: { frames: [0], frameDuration: 0.3, loop: true },
  idle_right: { frames: [0], frameDuration: 0.3, loop: true },

  // Walking: 1 full cycle ≈ 1 tile
  walk_down: { frames: [1, 2, 3, 2], frameDuration: 0.13, loop: true },
  walk_up: { frames: [1, 2, 3, 2], frameDuration: 0.13, loop: true },
  walk_left: { frames: [1, 2, 3, 2], frameDuration: 0.13, loop: true },
  walk_right: { frames: [1, 2, 3, 2], frameDuration: 0.13, loop: true },

  // Running: snappier — about twice as fast
  run_down: { frames: [1, 2, 3, 2], frameDuration: 0.08, loop: true },
  run_up: { frames: [1, 2, 3, 2], frameDuration: 0.08, loop: true },
  run_left: { frames: [1, 2, 3, 2], frameDuration: 0.08, loop: true },
  run_right: { frames: [1, 2, 3, 2], frameDuration: 0.08, loop: true },
} as const satisfies Record<PlayerAnimationName, Animation>;
