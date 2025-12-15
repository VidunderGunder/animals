import { createImageElement } from "../assets";
import { ctx } from "../canvas";
import { CHARACTER_SPRITE_HEIGHT, CHARACTER_SPRITE_WIDTH } from "../config";
import type { Direction } from "../input";
import {
	directionToRow,
	type OptionalCharacterAnimationID,
	type ReuqiredCharacterAnimationID,
} from "../scenes/laptop/moves";

type FrameLayer = {
	/** The sprite sheet image element */
	sheet: HTMLImageElement;
	/** Width of the frame */
	w?: number;
	/** Height of the frame */
	h?: number;
	/** Column index of the frame in the sprite sheet */
	index: number;
	onBeforeRender?: (props: {
		x: number;
		y: number;
		h: number;
		w: number;
		direction: Direction;
	}) => void;
	onAfterRender?: (props: {
		x: number;
		y: number;
		h: number;
		w: number;
		direction: Direction;
	}) => void;
};

export function renderFrameLayer({
	sheet,
	index,
	direction,
	w,
	h,
	x,
	y,
	onBeforeRender,
	onAfterRender,
}: {
	/** Facing direction -> row in sprite sheet */
	direction?: Direction;
	/** Destination x on the canvas */
	x: number;
	/** Destination y on the canvas */
	y: number;
} & FrameLayer) {
	direction ??= "down";
	w ??= CHARACTER_SPRITE_WIDTH;
	h ??= CHARACTER_SPRITE_HEIGHT;

	const directionIndex = directionToRow[direction];

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

type Animations = Record<ReuqiredCharacterAnimationID, Animation> &
	Partial<Record<OptionalCharacterAnimationID, Animation>>;

export type Character = {
	animations: Animations;
};

export const idleDurationDefault = 350;
export const walkDurationDefault = 130;
export const runDurationDefault = 80;
export const rideSlowDurationDefault = 500;
export const rideFastDurationDefault = 700;
export const jumpDurationDefault = 140;

const playerSpriteSheet = createImageElement("/characters/player.png");
const skateboardSpriteSheet = createImageElement("/characters/skateboard.png");

function layerFactory(sheet: HTMLImageElement) {
	return function layer(frameLayer: Partial<FrameLayer>): FrameLayer {
		return {
			w: CHARACTER_SPRITE_WIDTH,
			h: CHARACTER_SPRITE_HEIGHT,
			...frameLayer,
			sheet: frameLayer.sheet ?? sheet,
			index: frameLayer.index ?? 0,
		};
	};
}

function getJumpFrames(sheet: HTMLImageElement = playerSpriteSheet) {
	const layer = layerFactory(sheet);
	return [
		[
			layer({
				index: 1,
				onBeforeRender({ x, y, h, w }) {
					// shadow under player
					ctx.fillStyle = "rgba(0, 0, 0, 0.1)";
					ctx.beginPath();
					ctx.ellipse(x + w / 2, y + h - 4, 4, 1.5, 0, 0, Math.PI * 2);
					ctx.fill();

					ctx.translate(0, -2 - 5);
				},
			}),
		],
		[
			layer({
				index: 1,
				onBeforeRender({ x, y, h, w }) {
					// shadow under player
					ctx.fillStyle = "rgba(0, 0, 0, 0.1)";
					ctx.beginPath();
					ctx.ellipse(x + w / 2, y + h - 4, 3, 1, 0, 0, Math.PI * 2);
					ctx.fill();

					ctx.translate(0, -2 - 9);
				},
			}),
		],
		[
			layer({
				index: 2,
				onBeforeRender({ x, y, h, w }) {
					// shadow under player
					ctx.fillStyle = "rgba(0, 0, 0, 0.1)";
					ctx.beginPath();
					ctx.ellipse(x + w / 2, y + h - 4, 2, 1, 0, 0, Math.PI * 2);
					ctx.fill();

					ctx.translate(0, -2 - 6);
				},
			}),
		],
		[
			layer({
				index: 4,
				onBeforeRender({ x, y, h, w }) {
					// shadow under player
					ctx.fillStyle = "rgba(0, 0, 0, 0.1)";
					ctx.beginPath();
					ctx.ellipse(x + w / 2, y + h - 4, 4, 1.5, 0, 0, Math.PI * 2);
					ctx.fill();

					ctx.translate(0, -2 - 2);
				},
			}),
		],
		[
			layer({
				index: 8,
				onBeforeRender({ x, y, h, w }) {
					// shadow under player
					ctx.fillStyle = "rgba(0, 0, 0, 0.025)";
					ctx.beginPath();
					ctx.ellipse(x + w / 2, y + h - 4, 5, 2, 0, 0, Math.PI * 2);
					ctx.fill();

					ctx.translate(0, 0);
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
			frames: [[layer({ index: 0 })]],
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
	};
}

export const characters = {
	player: {
		animations: {
			...getDefaultAnimations({
				characterSpriteSheet: playerSpriteSheet,
			}),
		},
	},
} as const satisfies Record<string, Character>;

export type CharacterKey = keyof typeof characters;
export const characterKeys = Object.keys(characters) as CharacterKey[];
