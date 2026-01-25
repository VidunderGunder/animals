import {
	CHARACTER_SPRITE_HEIGHT_PX,
	CHARACTER_SPRITE_WIDTH_PX,
	DEFAULT_MOVEMENT,
	movementSpeeds,
	TILE_SIZE_PX,
} from "./config";
import type { Direction } from "./input/input";
import type { AnimationID, RenderVariant } from "./render/entities";
import type { Transition } from "./scenes/overworld/data";

export type Player = {
	renderVariant: RenderVariant;
	/* Tile position */
	x: number;
	/* Tile position */
	y: number;
	/* Tile position */
	z: number;

	facingDirection: Direction;
	// Is set when a transition happens. Null when it is done
	movingDirection: Direction | null;

	width: number;
	height: number;

	speed: number;

	/** Render position */
	xPx: number;
	/** Render position */
	yPx: number;

	/** Remaining waypoints (world pixels) */
	path: Transition["path"];

	/** Segment interpolation (world pixels) */
	xPxi: number;
	yPxi: number;
	zi: number;
	xPxf: number;
	yPxf: number;
	zf: number;
	currentPathSegment?: Transition["path"][number];
	pathSegmentProgress: number;
	/** Fixed duration for current segment (ms), undefined = use player speed */
	pathSegmentDuration?: number;

	movingToTile: Transition["end"] | null;
	movingToAnimation: Transition["animation"] | null;

	animationCurrent: AnimationID;
	animationFrameIndex: number;
	animationTimer: number;

	disabled: boolean;
	paused: boolean;
};

// TODO: Move to overworld/entities.ts
export type Entity = Player;

export const startTileX = 30;
export const startTileY = 37;
export const startLayerZ = 0;

export const entities = new Map<string, Entity>();

const playerDefault = {
	renderVariant: "player",
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
	disabled: false,
	paused: false,
} as const satisfies Player;

export const player: Player = {
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
