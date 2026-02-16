import type { AnimationIDStable } from "../../../animation/animation";
import { getCell } from "../cells";
import type { Entity } from "../entity";
import { getOccupant } from "../occupancy";

export type TransitionPathSegment = {
	xPx: ((entity: Entity) => number) | number;
	yPx: ((entity: Entity) => number) | number;
	z: ((entity: Entity) => number) | number;
	duration?: ((entity: Entity) => number) | number;
	onSegment?: (entity: Entity) => void;
	onSegmentEnd?: (entity: Entity) => void;
	onSegmentStart?: (entity: Entity) => void;
};

export type Transition = {
	condition?: (entity: Entity) => boolean;

	/* optional: overrides current animation during the transition */
	animation?: AnimationIDStable;

	/** Path in pixel space (tile-top-left in world pixels), INCLUDING destination. */
	path: TransitionPathSegment[];

	/* Final snapped logical state once path completes */
	end: { x: number; y: number; z: number };
};

export function getPathValue<T>(
	value: T | ((entity: Entity) => T),
	entity: Entity,
): T {
	if (typeof value === "function") {
		return (value as (entity: Entity) => T)(entity);
	}
	return value;
}

export function getPathValues(
	segment: Transition["path"][number],
	entity: Entity,
) {
	return {
		xPx: getPathValue(segment.xPx, entity),
		yPx: getPathValue(segment.yPx, entity),
		z: getPathValue(segment.z, entity),
		duration: segment.duration
			? getPathValue(segment.duration, entity)
			: undefined,
		onSegment: segment.onSegment,
		onSegmentEnd: segment.onSegmentEnd,
		onSegmentStart: segment.onSegmentStart,
	};
}

export function startSegment(
	entity: Entity,
	toXPx: number,
	toYPx: number,
	toZ: number,
	duration?: number,
) {
	entity.xPxi = entity.xPx;
	entity.yPxi = entity.yPx;
	entity.zi = entity.z;

	entity.xPxf = toXPx;
	entity.yPxf = toYPx;
	entity.zf = toZ;

	entity.transitionPathSegmentProgress = 0;
	entity.transitionPathSegmentDuration = duration;
}

export function setCurrentSegment(entity: Entity): boolean {
	const next = entity.transitionPath[0];
	if (!next) return false;

	const seg = getPathValues(next, entity);
	startSegment(entity, seg.xPx, seg.yPx, seg.z, seg.duration);

	return true;
}

export function snapToSegmentEnd(entity: Entity) {
	entity.xPx = entity.xPxf;
	entity.yPx = entity.yPxf;
	entity.z = entity.zf;
}

export function isTransitionEndBlocked(end: Transition["end"]): boolean {
	const occupant = getOccupant(end.x, end.y, end.z);
	if (occupant) return true;

	const cell = getCell(end.x, end.y, end.z);
	if (cell?.blocked) return true;

	return false;
}
