import {
	CHARACTER_SPRITE_HEIGHT_PX,
	CHARACTER_SPRITE_WIDTH_PX,
	DEFAULT_MOVEMENT,
	movementSpeeds,
	TILE_SIZE_PX,
} from "./config";
import { type Entity, entities } from "./scenes/overworld/entities";

export type GameState = {
	disabled: boolean;
	paused: boolean;
};

export const gameState: GameState = {
	disabled: false,
	paused: false,
};

export const startTileX = 30;
export const startTileY = 37;
export const startLayerZ = 0;

const playerDefault = {
	renderVariant: "character",
	x: startTileX,
	y: startTileY,
	z: startLayerZ,
	direction: "up",
	height: CHARACTER_SPRITE_HEIGHT_PX,
	width: CHARACTER_SPRITE_WIDTH_PX,
	speed: movementSpeeds[DEFAULT_MOVEMENT],
	isMoving: false,

	xPx: startTileX * TILE_SIZE_PX,
	yPx: startTileY * TILE_SIZE_PX,

	path: [],
	xPxi: 0,
	yPxi: 0,
	zi: 0,
	xPxf: 0,
	yPxf: 0,
	zf: 0,
	pathSegmentProgress: 1,

	movingToTile: null,
	movingToAnimation: null,

	animationCurrent: "idle",
	animationFrameIndex: 0,
	animationTimer: 0,
} as const satisfies Entity;

export const player: Entity = {
	...playerDefault,
};

entities.set("player", player);

export function resetPlayer(): void {
	Object.assign(player, playerDefault);
}

export type Animation = {
	frames: readonly number[];
	frameDuration: number;
};
