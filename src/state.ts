import type { AnimalID, SecretAnimalID } from "./characters/animals";
import {
	DEFAULT_MOVEMENT,
	movementSpeeds,
	PLAYER_SPRITE_HEIGHT,
	PLAYER_SPRITE_WIDTH,
} from "./config";
import type { Direction } from "./input";
import type { AnimationID } from "./scenes/laptop/moves";

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
	animationCurrent: AnimationID;
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
	animationCurrent: "idle",
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
};

const idleDuration = 300;
const walkDuration = 130;
const runDuration = 80;

export const playerAnimations = {
	idle: { frames: [0], frameDuration: idleDuration },
	walk: { frames: [1, 2, 3, 2], frameDuration: walkDuration },
	run: { frames: [1, 2, 3, 2], frameDuration: runDuration },
} as const satisfies Record<AnimationID, Animation>;

const animalFrames = [0, 1, 2, 1, 0, 1, 2, 3] as const;

export const animalAnimations = {
	idle: { frames: animalFrames, frameDuration: idleDuration },

	walk: {
		frames: animalFrames,
		frameDuration: walkDuration,
	},

	run: {
		frames: animalFrames,
		frameDuration: runDuration,
	},
} as const satisfies Record<AnimationID, Animation>;

export function getAnimalAnimation(
	animalId: AnimalID | SecretAnimalID,
	animation: AnimationID,
): Animation {
	if (animalId === "missing") {
		return {
			frames: [0, 1],
			frameDuration: 0.5,
		};
	}
	return animalAnimations[animation];
}
