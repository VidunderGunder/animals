// src/scenes/overworld/activity/activity.ts
import type { Action, Direction } from "../../../input/input";
import type { Vec2Px } from "../../../types";

export type InputDecision =
	| { kind: "pass" } // let normal overworld handle it
	| { kind: "consume" } // swallow it (disable controls)
	| {
			kind: "override";
			movementIntent: Direction | null;
			actions: ReadonlySet<Action>;
	  }; // full remap

export type Activity = {
	id: string;

	/** E.g., for “modal” overlays */
	priority?: number;

	onEnter?: () => void;
	onExit?: () => void;

	beforeUpdate?: (dt: number) => void;

	getCameraTarget?: () => Vec2Px | null;

	isDone?: () => boolean;
};
