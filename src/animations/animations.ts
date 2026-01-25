import { createImageElement } from "../assets/image";
import {
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

export const animationIds = [
	"idle",
	"walk",
	"jump",
	"run",
	"rideIdle",
	"rideSlow",
	"rideFast",
	"kickflip",
	"hop",
	"spin",
] as const;

export type AnimationID = (typeof animationIds)[number];

export const idleDurationDefault = 350;
export const walkDurationDefault = 130;
export const runDurationDefault = 80;
export const rideSlowDurationDefault = 500;
export const rideFastDurationDefault = 700;
export const jumpDurationDefault = 140;
export const hopDurationDefault = 60;

const playerSpriteSheet = createImageElement("/characters/player.png");
const skateboardSpriteSheet = createImageElement("/characters/skateboard.png");

function layerFactory(sheet: HTMLImageElement) {
	return function layer(frameLayer: Partial<FrameLayer>): FrameLayer {
		return {
			w: CHARACTER_SPRITE_WIDTH_PX,
			h: CHARACTER_SPRITE_HEIGHT_PX,
			...frameLayer,
			sheet: frameLayer.sheet ?? sheet,
			index: frameLayer.index ?? 0,
		};
	};
}

function moveUpWithShadow(props: OnRenderProps, height: number) {
	const { x, y, h, w } = props;

	ctx.fillStyle =
		height < 4
			? `rgba(0, 0, 0, ${(0.125 / 4) * height})`
			: "rgba(0, 0, 0, 0.125)";
	ctx.beginPath();

	const center = x + w / 2;
	const bottom = y + h - 4;

	const rx = Math.max(w * 0.28 - height / 8, 0);
	const ry = 2 * (1 - height / 14);
	ctx.ellipse(center, bottom, rx, ry, 0, 0, Math.PI * 2);
	ctx.fill();

	ctx.translate(0, -height);
}

function getJumpFrames(sheet: HTMLImageElement = playerSpriteSheet) {
	const layer = layerFactory(sheet);
	return [
		[
			layer({
				index: 1,
				onBeforeRender(props) {
					moveUpWithShadow(props, 9);
				},
			}),
		],
		[
			layer({
				index: 1,
				onBeforeRender(props) {
					moveUpWithShadow(props, 10);
				},
			}),
		],
		[
			layer({
				index: 2,
				onBeforeRender(props) {
					moveUpWithShadow(props, 7);
				},
			}),
		],
		[
			layer({
				index: 4,
				onBeforeRender(props) {
					moveUpWithShadow(props, 3);
				},
			}),
		],
		[
			layer({
				index: 8,
				onBeforeRender(props) {
					moveUpWithShadow(props, 1);
				},
			}),
		],
	] as const;
}

function getDefaultAnimations({
	characterSpriteSheet = playerSpriteSheet,
}: {
	characterSpriteSheet?: HTMLImageElement;
}): Animations {
	const layer = layerFactory(characterSpriteSheet);
	const jumpFrames = getJumpFrames(characterSpriteSheet);

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
		hop: {
			frames: [6, 7, 5, 1].map((height) => {
				return [
					{
						sheet: characterSpriteSheet,
						index: 2,
						onBeforeRender(props) {
							moveUpWithShadow(props, height);
						},
					},
				];
			}),

			frameDuration: hopDurationDefault,
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
	};
}

export const animations = {
	character: {
		...getDefaultAnimations({
			characterSpriteSheet: playerSpriteSheet,
		}),
	},
} as const satisfies Record<string, Animations>;

export type AnimationVariant = keyof typeof animations;
export const animationVariantKeys = Object.keys(
	animations,
) as AnimationVariant[];

// Crash early if dangerous empty frames are detected
animationVariantKeys.forEach((key) => {
	Object.entries(animations[key]).forEach(([animationId, animation]) => {
		if (animation.frames.length === 0) {
			throw new Error(
				`Character "${key}" has animation "${animationId}" with no frames defined.`,
			);
		}
	});
});
