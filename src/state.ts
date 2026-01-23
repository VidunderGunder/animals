import { type CharacterAnimationID, characters } from "./characters/characters";
import {
	CHARACTER_SPRITE_HEIGHT_PX,
	CHARACTER_SPRITE_WIDTH_PX,
	DEFAULT_MOVEMENT,
	movementSpeeds,
	TILE_SIZE_PX,
} from "./config";
import type { Direction } from "./input/input";
import type { Transition } from "./scenes/overworld/data";

export type Player = {
	/* Tile position */
	x: number;
	/* Tile position */
	y: number;
	/* Tile position */
	z: number;

	facingDirection: Direction;
	movingDirection: Direction | null;

	width: number;
	height: number;

	speed: number;

	/** Render position */
	xPx: number;
	/** Render position */
	yPx: number;

	/** Remaining waypoints (world pixels) */
	path: { x: number; y: number; z: number; duration?: number }[];

	/** Segment interpolation (world pixels) */
	xPxi: number;
	yPxi: number;
	zi: number;
	xPxf: number;
	yPxf: number;
	zf: number;
	pathSegmentProgress: number;
	/** Fixed duration for current segment (ms), undefined = use player speed */
	pathSegmentDuration?: number;

	movingToTile: Transition["end"] | null;
	movingToAnimation: Transition["animation"] | null;

	animationCurrent: CharacterAnimationID;
	animationFrameIndex: number;
	animationTimer: number;

	disabled: boolean;
	paused: boolean;
};

export const startTileX = 12;
export const startTileY = 37;
export const startLayerZ = 0;

const playerDefault = {
	x: startTileX,
	y: startTileY,
	z: startLayerZ,
	facingDirection: "up",
	height: CHARACTER_SPRITE_HEIGHT_PX,
	width: CHARACTER_SPRITE_WIDTH_PX,
	speed: movementSpeeds[DEFAULT_MOVEMENT],
	movingDirection: null,

	xPx: startTileX * TILE_SIZE_PX,
	yPx: startTileY * TILE_SIZE_PX,

	path: [],
	xPxi: startTileX * TILE_SIZE_PX,
	yPxi: startTileY * TILE_SIZE_PX,
	zi: startLayerZ,
	xPxf: startTileX * TILE_SIZE_PX,
	yPxf: startTileY * TILE_SIZE_PX,
	zf: startLayerZ,
	pathSegmentProgress: 1,

	movingToTile: null,
	movingToAnimation: null,

	animationCurrent: "idle",
	animationFrameIndex: 0,
	animationTimer: 0,
	disabled: false,
	paused: false,
} as const satisfies Player;

export const player: Player = {
	...playerDefault,
};

export const playerDirectionRow: Record<Direction, number> = {
	down: 0,
	left: 1,
	right: 2,
	up: 3,
} as const;

export function setPlayerState(playerData: PlayerSaveData | null): void {
	if (!playerData) return;
	player.x = playerData.x;
	player.y = playerData.y;
	player.z = playerData.z;
	player.facingDirection = playerData.facingDirection;

	// Update pixel positions to match tile positions
	player.xPx = playerData.x * TILE_SIZE_PX;
	player.yPx = playerData.y * TILE_SIZE_PX;
	player.xPxi = player.xPx;
	player.yPxi = player.yPx;
	player.xPxf = player.xPx;
	player.yPxf = player.yPx;
	player.zi = playerData.z;
	player.zf = playerData.z;
}

export function getPlayerSaveData(): PlayerSaveData {
	return {
		x: player.x,
		y: player.y,
		z: player.z,
		facingDirection: player.facingDirection,
	};
}	

export type PlayerSaveData = {
	x: number;
	y: number;
	z: number;
	facingDirection: Direction;
};

export type Animation = {
	frames: readonly number[];
	frameDuration: number;
};

export const playerAnimations = characters.player.animations;

export function resetPlayer(): void {
	Object.assign(player, playerDefault);
}
