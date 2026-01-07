import type {
	AnimalAnimationKey,
	AnimalID,
	SecretAnimalKey,
} from "./characters/animals";
import {
	type CharacterAnimationID,
	characters,
	idleDurationDefault,
	runDurationDefault,
	walkDurationDefault,
} from "./characters/characters";
import {
	CHARACTER_SPRITE_HEIGHT,
	CHARACTER_SPRITE_WIDTH,
	DEFAULT_MOVEMENT,
	movementSpeeds,
} from "./config";
import type { Direction } from "./input/input";

export type Player = {
	/** Current tile coordinates */
	tileX: number;
	tileY: number;

	/** Current z position */
	z: number;

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
	moveFromZ: number;
	moveToZ: number;
	/** 0 → start tile, 1 → target tile */
	moveProgress: number;

	/** Current animation state */
	animationCurrent: CharacterAnimationID;
	animationFrameIndex: number;
	animationTimer: number;

	/** Whether player interaction is disabled */
	disabled: boolean;
	paused: boolean;
};

export const startTileX = 12;
export const startTileY = 37;
export const startLayerZ = 0;

export const player: Player = {
	tileX: startTileX,
	tileY: startTileY,
	z: startLayerZ,
	facingDirection: "down",
	height: CHARACTER_SPRITE_HEIGHT,
	width: CHARACTER_SPRITE_WIDTH,
	speed: movementSpeeds[DEFAULT_MOVEMENT],
	movingDirection: null,
	moveFromX: startTileX,
	moveFromY: startTileY,
	moveFromZ: startLayerZ,
	moveToX: startTileX,
	moveToY: startTileY,
	moveToZ: startLayerZ,
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

export const playerAnimations = characters.player.animations;

const animalFrames = [0, 1, 2, 1, 0, 1, 2, 3] as const;

export const animalAnimations = {
	idle: { frames: animalFrames, frameDuration: idleDurationDefault },

	walk: {
		frames: animalFrames,
		frameDuration: walkDurationDefault,
	},

	run: {
		frames: animalFrames,
		frameDuration: runDurationDefault,
	},
} as const satisfies Record<AnimalAnimationKey, Animation>;

export function getAnimalAnimation(
	animalId: AnimalID | SecretAnimalKey,
	animation: AnimalAnimationKey,
): Animation {
	if (animalId === "missing") {
		return {
			frames: [0, 1],
			frameDuration: 0.5,
		};
	}
	return animalAnimations[animation];
}
