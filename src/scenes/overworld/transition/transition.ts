import type { AnimationIDStable } from "../../../animations/animations";
import type { Entity } from "../entity";

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
