import { createImageElement } from "../assets";
import type {
	OptionalAnimationID,
	ReuqiredAnimationID,
} from "../scenes/laptop/moves";

export type Animation = {
	/** Frame indices in the sprite sheet (column indexes) */
	frames: readonly number[];
	/** Seconds each frame is shown */
	frameDuration: number;
};

type Person = {
	spriteSheet: HTMLImageElement;
	animations: Record<ReuqiredAnimationID, Animation> &
		Partial<Record<OptionalAnimationID, Animation>>;
};

export const people = {
	player: {
		spriteSheet: createImageElement("/people/player.png"),
		animations: {
			idle: { frames: [0], frameDuration: 0.3 },
			walk: { frames: [1, 2, 3, 4], frameDuration: 0.2 },
			run: { frames: [1, 2, 3, 4], frameDuration: 0.1 },
		},
	},
} satisfies Record<string, Person>;
