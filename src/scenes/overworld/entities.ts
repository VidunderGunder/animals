import type { Direction } from "../../input/input";
import type { AnimationID, RenderVariant } from "../../render/entities";
import type { Transition } from "./data";

export const entities = new Map<string, Entity>();

export type Entity = {
	renderVariant: RenderVariant;

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

	/** Segment interpolation (world pixels) */
	xPxi: number;
	yPxi: number;
	zi: number;
	xPxf: number;
	yPxf: number;
	zf: number;

	currentPathSegment?: Transition["path"][number];
	pathSegmentProgress: number;
	/** Fixed duration for current segment (ms), undefined -> use entity speed */
	pathSegmentDuration?: number;

	movingToTile: Transition["end"] | null;
	movingToAnimation: Transition["animation"] | null;

	animationCurrent: AnimationID;
	animationFrameIndex: number;
	animationTimer: number;

	disabled: boolean;
	paused: boolean;
};
