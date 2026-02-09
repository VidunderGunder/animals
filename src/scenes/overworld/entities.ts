// src/scenes/overworld/entities.ts
import type {
	AnimationEntityKey,
	AnimationID,
} from "../../animations/animations";
import {
	ANIMAL_SPRITE_HEIGHT_PX,
	ANIMAL_SPRITE_WIDTH_PX,
	CHARACTER_SPRITE_HEIGHT_PX,
	CHARACTER_SPRITE_WIDTH_PX,
	type MoveMode,
	TILE_SIZE_PX,
} from "../../config";
import type { Direction } from "../../input/input";
import type { StringWithSuggestions } from "../../types";
import type { Brain, BrainState } from "./ai/brain";
import type { Transition } from "./transition/transition";

export const entities = new Map<string, Entity>();
export type Entities = typeof entities;

/**
 * Type safe getter
 */
export function entitiesGet<ID extends string>(id: ID): Entity<ID> | undefined {
	return entities.get(id) as Entity<ID> | undefined;
}

/**
 * Type safe setter
 */
export function entitiesSet<ID extends string>(
	id: ID,
	entity: Entity<ID>,
): void {
	entities.set(id, entity);
}

export const entityVariants = ["character", "animal"] as const;
export type EntityVariant = (typeof entityVariants)[number];

export const playerIds = ["player"] as const;
export type PlayerID = (typeof playerIds)[number];
export function isPlayerID(id: string): id is PlayerID {
	return playerIds.some((pid) => pid === id);
}
export function isPlayer(entity: Entity): entity is Entity<PlayerID> {
	return isPlayerID(entity.id);
}

export type Entity<ID extends string = StringWithSuggestions<"player">> = {
	id: ID;
	sheet: AnimationEntityKey;

	variant: EntityVariant;
	radius: number;
	renderPriority: number;

	/* Tile position */
	x: number;
	/* Tile position */
	y: number;
	/* Tile position */
	z: number;

	direction: Direction;
	idleTurnLockMs?: number;

	width: number;
	height: number;

	speed: number;

	/** Render position */
	xPx: number;
	/** Render position */
	yPx: number;

	/** Remaining transition path segments (world pixels) */
	transitionPath: Transition["path"];

	autoRun?: boolean;
	moveMode?: MoveMode;
	isMoving: boolean;

	/** Segment interpolation (world pixels) */
	xPxi: number;
	yPxi: number;
	zi: number;
	xPxf: number;
	yPxf: number;
	zf: number;

	transitionPathSegmentProgress: number;
	/** Fixed duration for current segment (ms), undefined -> use entity speed */
	transitionPathSegmentDuration?: number;

	transitionEndTile: Transition["end"] | null;
	transitionAnimation: Transition["animation"] | null;

	animationCurrent: AnimationID;
	animationFrameIndex: number;
	animationTimer: number;

	onActivate?: (props: { activator: Entity; activated: Entity }) => void;

	/* --- AI fields --- */
	/**
	 * Optional stable brain identifier.
	 * Only set this when you want a brain at all.
	 * If absent/null -> no brain will be instantiated.
	 */
	brainId: string | null;

	/** Runtime brain (behaviour + script runner) */
	brain: Brain | null;
	brainState: BrainState | null;

	/** Temporary desired direction set by brain for a single tick */
	brainDesiredDirection: Direction | null;
	/** Prevent activation spam while an interaction is running */
	interactionLock: boolean;
};

export function getEntityCharacterDefaults<ID extends string>({
	id,
	x,
	y,
}: {
	id: ID;
	x: number;
	y: number;
}): Entity<ID> {
	return {
		renderPriority: 0,
		variant: "character",
		radius: 6,
		id,
		sheet: "player",
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
		transitionPath: [],
		isMoving: false,
		xPxi: 0,
		yPxi: 0,
		zi: 0,
		xPxf: 0,
		yPxf: 0,
		zf: 0,
		transitionPathSegmentProgress: 0,
		transitionEndTile: null,
		transitionAnimation: null,
		brainId: null,
		brain: null,
		moveMode: "walk",
		brainDesiredDirection: null,
		interactionLock: false,
		brainState: null,
	};
}

export function getEntityAnimalDefaults({
	id,
	x,
	y,
}: {
	id: string;
	x: number;
	y: number;
}): Entity {
	return {
		...getEntityCharacterDefaults({ id, x, y }),
		variant: "animal",
		sheet: "fox",
		width: ANIMAL_SPRITE_WIDTH_PX,
		height: ANIMAL_SPRITE_HEIGHT_PX,
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
