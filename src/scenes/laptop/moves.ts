import { activeActions, type Direction } from "../../input";
import { returnToOverworld } from "../overworld";

const requiredAnimations = ["idle", "walk"] as const;
const optionalAnimations = ["run"] as const;

export type ReuqiredAnimationID = (typeof requiredAnimations)[number];
export type OptionalAnimationID = (typeof optionalAnimations)[number];
export type AnimationID = ReuqiredAnimationID | OptionalAnimationID;

export type BioDexState = {
	index: number;

	/** Facing direction */
	direction: Direction;

	/** Current animation state */
	animationCurrent: AnimationID;
	animationFrameIndex: number;
	animationTimer: number;
};

export const movesState: BioDexState = {
	index: 0,

	direction: "down",

	animationCurrent: "idle",
	animationFrameIndex: 0,
	animationTimer: 0,
};

function update(_dt: number) {
	if (activeActions.has("start")) {
		returnToOverworld();
		return;
	}
}

export function draw() {
	//
}

export function moves(dt: number) {
	update(dt);
	draw();
}
