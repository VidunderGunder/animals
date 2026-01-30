import type { AnimationID } from "../../../animations/animations";
import type { Entity } from "../entities";

export type Transition = {
	condition?: (entity: Entity) => boolean;

	/* optional: force animation during the tr ansition */
	animation?: AnimationID;

	/** Path in pixel space (tile-top-left in world pixels), INCLUDING destination. */
	path: {
		xPx: number;
		yPx: number;
		z: number;
		duration?: ((entity: Entity) => number) | number;
		onSegment?: (entity: Entity) => void;
		onSegmentEnd?: (entity: Entity) => void;
		onSegmentStart?: (entity: Entity) => void;
	}[];

	/* Final snapped logical state once path completes */
	end: { x: number; y: number; z: number };
};
