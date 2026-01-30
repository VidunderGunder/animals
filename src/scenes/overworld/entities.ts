import type {
	AnimationID,
	AnimationVariant,
} from "../../animations/animations";
import {
	CHARACTER_SPRITE_HEIGHT_PX,
	CHARACTER_SPRITE_WIDTH_PX,
	TILE_SIZE_PX,
} from "../../config";
import type { Direction } from "../../input/input";
import type { Transition } from "./transition/transition";

export const entities = new Map<string, Entity>();
export type Entities = typeof entities;

export type Entity = {
	renderVariant: AnimationVariant;

	/* Tile position */
	x: number;
	/* Tile position */
	y: number;
	/* Tile position */
	z: number;

	direction: Direction;

	width: number;
	height: number;

	speed: number;

	/** Render position */
	xPx: number;
	/** Render position */
	yPx: number;

	/** Remaining transition path segments (world pixels) */
	path: Transition["path"];

	isMoving: boolean;

	/** Segment interpolation (world pixels) */
	xPxi: number;
	yPxi: number;
	zi: number;
	xPxf: number;
	yPxf: number;
	zf: number;

	pathSegmentProgress: number;
	/** Fixed duration for current segment (ms), undefined -> use entity speed */
	pathSegmentDuration?: number;

	movingToTile: Transition["end"] | null;
	movingToAnimation: Transition["animation"] | null;

	animationCurrent: AnimationID;
	animationFrameIndex: number;
	animationTimer: number;

	onActivate?: (props: { activator: Entity; activated: Entity }) => void;
};

export function getEntityCharacterDefaults({
	x,
	y,
}: {
	x: number;
	y: number;
}): Entity {
	return {
		renderVariant: "character",
		x: x,
		y: y,
		xPx: x * TILE_SIZE_PX,
		yPx: y * TILE_SIZE_PX,
		z: 0,
		direction: "down",
		width: CHARACTER_SPRITE_WIDTH_PX,
		height: CHARACTER_SPRITE_HEIGHT_PX,
		speed: 0,
		animationCurrent: "idle",
		animationFrameIndex: 0,
		animationTimer: 0,
		path: [],
		isMoving: false,
		xPxi: 0,
		yPxi: 0,
		zi: 0,
		xPxf: 0,
		yPxf: 0,
		zf: 0,
		pathSegmentProgress: 0,
		movingToTile: null,
		movingToAnimation: null,
	};
}
