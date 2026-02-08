import { createImageElement } from "../assets/image";
import {
	ANIMAL_SPRITE_HEIGHT_PX,
	ANIMAL_SPRITE_WIDTH_PX,
	CHARACTER_SPRITE_HEIGHT_PX,
	CHARACTER_SPRITE_WIDTH_PX,
} from "../config";
import { ctx } from "../gfx/canvas";
import type { Direction } from "../input/input";
import { directionToRow } from "../scenes/menu/moves";

type OnRenderProps = {
	/** Destination x on the canvas */
	x: number;
	/** Destination y on the canvas */
	y: number;
	/** Width of the frame */
	w: number;
	/** Height of the frame */
	h: number;
	direction: Direction;
};

type FrameLayer = {
	/** The sprite sheet image element */
	sheet: HTMLImageElement;
	/** Width of the frame */
	w?: number;
	/** Height of the frame */
	h?: number;
	/** Column index of the frame in the sprite sheet */
	index: number;

	/**
	 * Rotates 90 degrees clockwise for each increment, by offsetting the row used for direction.
	 */
	directionOffset?: 1 | 2 | 3;

	onBeforeRender?: (props: OnRenderProps) => void;
	onAfterRender?: (props: OnRenderProps) => void;
};

export function renderFrameLayer({
	sheet,
	index,
	direction,
	directionOffset,
	w,
	h,
	x,
	y,
	onBeforeRender,
	onAfterRender,
}: {
	/** Facing direction -> row in sprite sheet */
	direction?: Direction;
	/** Direction offset for rotation */
	directionOffset?: 1 | 2 | 3;
	/** Destination x on the canvas */
	x: number;
	/** Destination y on the canvas */
	y: number;
} & FrameLayer) {
	direction ??= "down";
	w ??= CHARACTER_SPRITE_WIDTH_PX;
	h ??= CHARACTER_SPRITE_HEIGHT_PX;

	// Force directionOffset to be within 0-3
	const directionIndex =
		(directionToRow[direction] + (directionOffset ?? 0)) % 4;

	ctx.save();
	onBeforeRender?.({ x, y, h, w, direction });
	ctx.drawImage(sheet, index * w, directionIndex * h, w, h, x, y, w, h);
	onAfterRender?.({ x, y, h, w, direction });
	ctx.restore();
}

export function renderFrameLayers({
	frameLayers,
	direction,
	x,
	y,
}: {
	/** Facing direction -> row in sprite sheet */
	direction?: Direction;
	/** Destination x on the canvas */
	x: number;
	/** Destination y on the canvas */
	y: number;
	frameLayers: readonly FrameLayer[];
}) {
	for (const frameLayer of frameLayers) {
		renderFrameLayer({
			...frameLayer,
			direction,
			x,
			y,
		});
	}
}

export type Animation = {
	/** Frame indices in the sprite sheet (column indexes) */
	frames: readonly (readonly FrameLayer[])[];
	/** Seconds each frame is shown */
	frameDuration: number;
	loop: boolean;
};

type Animations = Record<AnimationID, Animation>;
type AnimalAnimations = Record<AnimalAnimationID, Animation>;

export const animationIds = [
	"idle",
	"walk",
	"jump",
	"run",
	"rideIdle",
	"rideSlow",
	"rideFast",
	"kickflip",
	"spin",
] as const;

export type AnimationID = (typeof animationIds)[number];

export const animalAnimationIds = ["walk"] as const satisfies AnimationID[];

export type AnimalAnimationID = (typeof animalAnimationIds)[number];

export const idleDurationDefault = 500;
export const walkDurationDefault = 130;
export const runDurationDefault = 80;
export const rideSlowDurationDefault = 500;
export const rideFastDurationDefault = 700;
export const jumpDurationDefault = 140;

const playerSpriteSheet = createImageElement("/characters/player.png");
const skateboardSpriteSheet = createImageElement("/characters/skateboard.png");

function layerFactory(
	sheet: HTMLImageElement,
	options: {
		w: number;
		h: number;
	} = {
		w: CHARACTER_SPRITE_WIDTH_PX,
		h: CHARACTER_SPRITE_HEIGHT_PX,
	},
) {
	return function layer(frameLayer: Partial<FrameLayer>): FrameLayer {
		return {
			...options,
			...frameLayer,
			sheet: frameLayer.sheet ?? sheet,
			index: frameLayer.index ?? 0,
		};
	};
}

function getCharacterJumpFrames(sheet: HTMLImageElement = playerSpriteSheet) {
	const layer = layerFactory(sheet);
	return [
		[
			layer({
				index: 1,
			}),
		],
		[
			layer({
				index: 1,
			}),
		],
		[
			layer({
				index: 2,
			}),
		],
		[
			layer({
				index: 4,
			}),
		],
		[
			layer({
				index: 1,
			}),
		],
	] as const;
}

function getDefaultCharacterAnimations({
	characterSpriteSheet = playerSpriteSheet,
}: {
	characterSpriteSheet?: HTMLImageElement;
}) {
	const layer = layerFactory(characterSpriteSheet);
	const jumpFrames = getCharacterJumpFrames(characterSpriteSheet);

	return {
		idle: {
			frames: [[layer({ index: 2 })]],
			frameDuration: idleDurationDefault,
			loop: true,
		},
		walk: {
			frames: [
				[layer({ index: 1 })],
				[layer({ index: 2 })],
				[layer({ index: 3 })],
				[layer({ index: 2 })],
			],
			frameDuration: walkDurationDefault,
			loop: true,
		},
		run: {
			frames: [
				[layer({ index: 4 })],
				[layer({ index: 5 })],
				[layer({ index: 6 })],
				[layer({ index: 5 })],
			],
			frameDuration: runDurationDefault,
			loop: true,
		},
		rideIdle: {
			frames: [
				[
					layer({
						sheet: skateboardSpriteSheet,
						index: 0,
					}),
					layer({ index: 7 }),
				],
			],
			frameDuration: idleDurationDefault,
			loop: true,
		},
		rideSlow: {
			frames: [
				[
					layer({
						sheet: skateboardSpriteSheet,
						index: 1,
					}),
					layer({ index: 8 }),
				],
				[
					layer({
						sheet: skateboardSpriteSheet,
						index: 1,
					}),
					layer({ index: 9 }),
				],
				[
					layer({
						sheet: skateboardSpriteSheet,
						index: 1,
					}),
					layer({ index: 10 }),
				],
				[
					layer({
						sheet: skateboardSpriteSheet,
						index: 1,
					}),
					layer({ index: 9 }),
				],
			],
			frameDuration: rideSlowDurationDefault,
			loop: true,
		},
		rideFast: {
			frames: [
				[
					layer({ sheet: skateboardSpriteSheet, index: 1 }),
					layer({ index: 10 }),
				],
				[
					layer({ sheet: skateboardSpriteSheet, index: 1 }),
					layer({ index: 8 }),
				],
				[
					layer({ sheet: skateboardSpriteSheet, index: 1 }),
					layer({ index: 9 }),
				],
				[
					layer({ sheet: skateboardSpriteSheet, index: 1 }),
					layer({ index: 8 }),
				],
			],
			frameDuration: rideFastDurationDefault,
			loop: true,
		},
		kickflip: {
			frames: [
				[
					layer({
						sheet: skateboardSpriteSheet,
						index: 2,
					}),
					jumpFrames[0][0],
				],
				[
					layer({
						sheet: skateboardSpriteSheet,
						index: 3,
					}),
					jumpFrames[1][0],
				],
				[
					layer({
						sheet: skateboardSpriteSheet,
						index: 4,
					}),
					jumpFrames[2][0],
				],
				[
					layer({
						sheet: skateboardSpriteSheet,
						index: 5,
					}),
					jumpFrames[3][0],
				],
				[
					layer({
						sheet: skateboardSpriteSheet,
						index: 1,
					}),
					jumpFrames[4][0],
				],
			],
			frameDuration: jumpDurationDefault,
			loop: false,
		},
		jump: {
			frames: jumpFrames,
			frameDuration: jumpDurationDefault,
			loop: false,
		},
		spin: {
			frames: [
				[layer({ index: 2 })],
				// [layer({ index: 3 })], // Charge the spin
				// [layer({ index: 3 })],
				[layer({ index: 2, directionOffset: 1 })],
				[layer({ index: 2, directionOffset: 2 })],
				[layer({ index: 2, directionOffset: 3 })],
			],
			frameDuration: 100,
			loop: true,
		},
	} satisfies Animations;
}

function getDefaultAnimalAnimations({
	spriteSheet,
}: {
	spriteSheet: HTMLImageElement;
}) {
	const layer = layerFactory(spriteSheet, {
		w: ANIMAL_SPRITE_WIDTH_PX,
		h: ANIMAL_SPRITE_HEIGHT_PX,
	});

	const walkAnimation = {
		frames: [[layer({ index: 1 })], [layer({ index: 2 })]],
		frameDuration: walkDurationDefault,
		loop: true,
	} as const satisfies Animation;

	return {
		walk: walkAnimation,
		idle: { ...walkAnimation, frameDuration: idleDurationDefault },
		jump: walkAnimation,
		kickflip: walkAnimation,
		rideFast: walkAnimation,
		rideIdle: walkAnimation,
		rideSlow: walkAnimation,
		run: { ...walkAnimation, frameDuration: runDurationDefault },
		spin: walkAnimation,
	} satisfies Animations;
}

const sheets = {
	player: playerSpriteSheet,
	"npc-1": createImageElement("/characters/npc-1.png"),
	fox: createImageElement("/animals/fox.png"),
	kitsune: createImageElement("/animals/kitsune.png"),
	turtle: createImageElement("/animals/turtle.png"),
	tarasque: createImageElement("/animals/tarasque.png"),
};

export const animations = {
	player: {
		...getDefaultCharacterAnimations({
			characterSpriteSheet: playerSpriteSheet,
		}),
	},
	"npc-1": {
		...getDefaultCharacterAnimations({
			characterSpriteSheet: sheets["npc-1"],
		}),
	},
	fox: {
		...getDefaultAnimalAnimations({
			spriteSheet: sheets.fox,
		}),
	},
	kitsune: {
		...getDefaultAnimalAnimations({
			spriteSheet: sheets.kitsune,
		}),
	},
	turtle: {
		...getDefaultAnimalAnimations({
			spriteSheet: sheets.turtle,
		}),
	},
	tarasque: {
		...getDefaultAnimalAnimations({
			spriteSheet: sheets.tarasque,
		}),
	},
} as const satisfies Record<string, Animations | AnimalAnimations>;

export type AnimationEntityKey = keyof typeof animations;
export const animationEntityKeys = Object.freeze(
	Object.keys(animations),
) as readonly AnimationEntityKey[];

// Crash early if dangerous empty frames are detected
animationEntityKeys.forEach((key) => {
	Object.entries(animations[key]).forEach(([animationId, animation]) => {
		if (animation.frames.length === 0) {
			throw new Error(
				`Character "${key}" has animation "${animationId}" with no frames defined.`,
			);
		}
	});
});
