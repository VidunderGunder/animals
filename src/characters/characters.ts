import { createImageElement } from "../assets";
import type {
	OptionalCharacterAnimationID,
	ReuqiredCharacterAnimationID,
} from "../scenes/laptop/moves";

export type Animation = {
	/** Frame indices in the sprite sheet (column indexes) */
	frames: readonly number[];
	/** Seconds each frame is shown */
	frameDuration: number;
	loop: boolean;
};

export type Character = {
	spriteSheet: HTMLImageElement;
	animations: Record<ReuqiredCharacterAnimationID, Animation> &
		Partial<Record<OptionalCharacterAnimationID, Animation>>;
};

export const idleDurationDefault = 1000;
export const walkDurationDefault = 130;
export const runDurationDefault = 80;
export const rideSlowDurationDefault = 500;
export const rideFastDurationDefault = 700;

export const characters = {
	player: {
		spriteSheet: createImageElement("/characters/player.png"),
		animations: {
			idle: { frames: [0], frameDuration: idleDurationDefault, loop: true },
			walk: {
				frames: [1, 2, 3, 2],
				frameDuration: walkDurationDefault,
				loop: true,
			},
			run: {
				frames: [4, 5, 6, 5],
				frameDuration: runDurationDefault,
				loop: true,
			},
			rideIdle: { frames: [7], frameDuration: idleDurationDefault, loop: true },
			rideSlow: {
				frames: [8, 9, 10, 9],
				frameDuration: rideSlowDurationDefault,
				loop: true,
			},
			rideFast: {
				frames: [10, 8, 9, 8],
				frameDuration: rideFastDurationDefault,
				loop: true,
			},
		},
	},
} as const satisfies Record<string, Character>;

export type CharacterKey = keyof typeof characters;
export const characterKeys = Object.keys(characters) as CharacterKey[];
