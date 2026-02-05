// src/scenes/overworld/entities.ts
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
import type { StringWithSuggestions } from "../../types";
import type { Brain } from "./ai/brain";
import type { Transition } from "./transition/transition";

export const entities = new Map<string, Entity>();
export type Entities = typeof entities;

export type Entity = {
	id: StringWithSuggestions<"player">;
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

	/* --- AI fields --- */
	/** Optional brain (behaviour + script runner) */
	brain?: Brain | null;
	/** Current movement mode (affects available transitions) */
	moveMode?: "walk" | "run";
	/** Temporary desired direction set by brain for a single tick */
	intentDir?: Direction | null;
	/** Prevent activation spam while an interaction is running */
	interactionLock: boolean;
};
export function getEntityCharacterDefaults({
	id,
	x,
	y,
}: {
	id: string;
	x: number;
	y: number;
}): Entity {
	return {
		id,
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
		brain: null,
		moveMode: "walk",
		intentDir: null,
		interactionLock: false,
	};
}

export function getEntityFacingTile(entity: Entity): {
	x: number;
	y: number;
	z: number;
} {
	switch (entity.direction) {
		case "up":
			return { x: entity.x, y: entity.y - 1, z: entity.z };
		case "down":
			return { x: entity.x, y: entity.y + 1, z: entity.z };
		case "left":
			return { x: entity.x - 1, y: entity.y, z: entity.z };
		case "right":
			return { x: entity.x + 1, y: entity.y, z: entity.z };
	}
}
