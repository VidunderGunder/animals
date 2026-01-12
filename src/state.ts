import { type CharacterAnimationID, characters } from "./characters/characters";
import {
	CHARACTER_SPRITE_HEIGHT,
	CHARACTER_SPRITE_WIDTH,
	DEFAULT_MOVEMENT,
	movementSpeeds,
	TILE_SIZE,
} from "./config";
import type { Direction } from "./input/input";
import type { Transition } from "./scenes/overworld/data";

export type Player = {
	x: number;
	y: number;
	z: number;

	facingDirection: Direction;
	movingDirection: Direction | null;

	width: number;
	height: number;

	speed: number;

	/** Render position: collision tile top-left in world pixels (integer) */
	worldX: number;
	worldY: number;

	/** Remaining waypoints (world pixels) */
	movePath: { x: number; y: number; z: number }[];

	/** Segment interpolation (world pixels) */
	moveSegFromX: number;
	moveSegFromY: number;
	moveSegFromZ: number;
	moveSegToX: number;
	moveSegToY: number;
	moveSegToZ: number;
	moveSegProgress: number;

	pendingEnd: Transition["end"] | null;
	pendingAnim: Transition["animation"] | null;

	animationCurrent: CharacterAnimationID;
	animationFrameIndex: number;
	animationTimer: number;

	disabled: boolean;
	paused: boolean;
};

export const startTileX = 12;
export const startTileY = 37;
export const startLayerZ = 0;

export const player: Player = {
	x: startTileX,
	y: startTileY,
	z: startLayerZ,
	facingDirection: "down",
	height: CHARACTER_SPRITE_HEIGHT,
	width: CHARACTER_SPRITE_WIDTH,
	speed: movementSpeeds[DEFAULT_MOVEMENT],
	movingDirection: null,

	worldX: startTileX * TILE_SIZE,
	worldY: startTileY * TILE_SIZE,

	movePath: [],
	moveSegFromX: startTileX * TILE_SIZE,
	moveSegFromY: startTileY * TILE_SIZE,
	moveSegFromZ: startLayerZ,
	moveSegToX: startTileX * TILE_SIZE,
	moveSegToY: startTileY * TILE_SIZE,
	moveSegToZ: startLayerZ,
	moveSegProgress: 1,

	pendingEnd: null,
	pendingAnim: null,

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

export type Animation = {
	frames: readonly number[];
	frameDuration: number;
};

export const playerAnimations = characters.player.animations;
