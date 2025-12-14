import type { AnimalID, SecretAnimalID } from "./animals";
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

  facingDirection: Direction;
  movingDirection: Direction | null;

  /** Size of sprite in pixels (square) */
  width: number;
  height: number;

  /** Movement speed (pixels per second) */
  speed: number;

  /** Movement interpolation state (tile coordinates) */
  moveFromX: number;
  moveFromY: number;
  moveToX: number;
  moveToY: number;
  /** 0 → start tile, 1 → target tile */
  moveProgress: number;

  /** Current animation state */
  animationCurrent: AnimationName;
  animationFrameIndex: number;
  animationTimer: number;

  /** Whether player interaction is disabled */
  disabled: boolean;
  paused: boolean;
};

export const startTileX = 8;
export const startTileY = 8;

export const player: Player = {
  tileX: startTileX,
  tileY: startTileY,
  facingDirection: "down",
  height: PLAYER_SPRITE_HEIGHT,
  width: PLAYER_SPRITE_WIDTH,
  speed: movementSpeeds[DEFAULT_MOVEMENT],
  movingDirection: null,
  moveFromX: startTileX,
  moveFromY: startTileY,
  moveToX: startTileX,
  moveToY: startTileY,
  moveProgress: 1,
  animationCurrent: "idle_down",
  animationFrameIndex: 0,
  animationTimer: 0,
  disabled: false,
  paused: false,
};

export const playerDirectionRow: Record<Direction, number> = {
  down: 0,
  left: 1,
  right: 2,
  up: 3,
} as const;

export const animalDirectionRow: Record<Direction, number> = {
  down: 0,
  left: 1,
  right: 1, // Mirror left for right
  up: 2,
} as const;

export type Animation = {
  /** Frame indices in the sprite sheet (column indexes) */
  frames: readonly number[];
  /** Seconds each frame is shown */
  frameDuration: number;
  /** Loop back to start when finished */
  loop: boolean;
};

export type AnimationName =
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

const idleDuration = 0.3;
const walkDuration = 0.13;
const runDuration = 0.08;

export const playerAnimations = {
  idle_down: { frames: [0], frameDuration: idleDuration, loop: true },
  idle_up: { frames: [0], frameDuration: idleDuration, loop: true },
  idle_left: { frames: [0], frameDuration: idleDuration, loop: true },
  idle_right: { frames: [0], frameDuration: idleDuration, loop: true },

  walk_down: { frames: [1, 2, 3, 2], frameDuration: walkDuration, loop: true },
  walk_up: { frames: [1, 2, 3, 2], frameDuration: walkDuration, loop: true },
  walk_left: { frames: [1, 2, 3, 2], frameDuration: walkDuration, loop: true },
  walk_right: { frames: [1, 2, 3, 2], frameDuration: walkDuration, loop: true },

  run_down: { frames: [1, 2, 3, 2], frameDuration: runDuration, loop: true },
  run_up: { frames: [1, 2, 3, 2], frameDuration: runDuration, loop: true },
  run_left: { frames: [1, 2, 3, 2], frameDuration: runDuration, loop: true },
  run_right: { frames: [1, 2, 3, 2], frameDuration: runDuration, loop: true },
} as const satisfies Record<AnimationName, Animation>;

const missingFrames = [0, 1] as const;
const animalFrames = [0, 1, 2, 1, 0, 1, 2, 3] as const;

export const animalAnimations = {
  idle_down: {
    frames: animalFrames,
    frameDuration: 0.3,
    loop: true,
  },
  idle_up: { frames: animalFrames, frameDuration: idleDuration, loop: true },
  idle_left: {
    frames: animalFrames,
    frameDuration: idleDuration,
    loop: true,
  },
  idle_right: {
    frames: animalFrames,
    frameDuration: idleDuration,
    loop: true,
  },

  walk_down: {
    frames: animalFrames,
    frameDuration: walkDuration,
    loop: true,
  },
  walk_up: {
    frames: animalFrames,
    frameDuration: walkDuration,
    loop: true,
  },
  walk_left: {
    frames: animalFrames,
    frameDuration: walkDuration,
    loop: true,
  },
  walk_right: {
    frames: animalFrames,
    frameDuration: walkDuration,
    loop: true,
  },

  run_down: {
    frames: animalFrames,
    frameDuration: runDuration,
    loop: true,
  },
  run_up: {
    frames: animalFrames,
    frameDuration: runDuration,
    loop: true,
  },
  run_left: {
    frames: animalFrames,
    frameDuration: runDuration,
    loop: true,
  },
  run_right: {
    frames: animalFrames,
    frameDuration: runDuration,
    loop: true,
  },
} as const satisfies Record<AnimationName, Animation>;

export function getAnimalAnimation(
  animalId: AnimalID | SecretAnimalID,
  animation: AnimationName
): Animation {
  if (animalId === "missing") {
    return {
      frames: missingFrames,
      frameDuration: 0.5,
      loop: true,
    };
  }
  return animalAnimations[animation];
}
