import { clamp, lerp } from "./functions/general";
import { canvas } from "./gfx/canvas";

const supportedAspectRatioRange = {
	min: 5 / 4,
	max: 16 / 9,
} as const;

const PHONE_PORTRAIT_MAX_WIDTH_PX = 520;
const LARGE_DEVICE_MIN_DIM_PX = 800;
const CSS_CANVAS_HEIGHT_SMALL = 380;
const CSS_CANVAS_HEIGHT_LARGE = 720;

let screenWidth = window.innerWidth;
let screenHeight = window.innerHeight;

export const BASE_HEIGHT_PX_MIN = 160;
export const BASE_HEIGHT_PX_MAX = 216;

export const SCALE = 1;

export let ASPECT_RATIO_TARGET = screenWidth / screenHeight;
export let ASPECT_RATIO = clamp(
	ASPECT_RATIO_TARGET,
	supportedAspectRatioRange.min,
	supportedAspectRatioRange.max,
);

export let BASE_HEIGHT_PX = BASE_HEIGHT_PX_MAX;
export let BASE_WIDTH_PX = Math.round(BASE_HEIGHT_PX * ASPECT_RATIO);
export let GAME_WIDTH_PX = Math.round(BASE_WIDTH_PX * SCALE);
export let GAME_HEIGHT_PX = Math.round(BASE_HEIGHT_PX * SCALE);

const canvasCss = document.getElementById("canvas-css") as HTMLStyleElement;

function pickBaseHeightPx(opts: {
	screenWidth: number;
	screenHeight: number;
	aspectRatio: number;
}) {
	const { screenWidth, screenHeight, aspectRatio } = opts;

	const isPortrait = screenHeight >= screenWidth;

	const isCoarsePointer = matchMedia?.("(pointer: coarse)")?.matches ?? false;

	const cssCanvasHeightPx = Math.min(screenHeight, screenWidth / aspectRatio);

	const minDim = Math.min(screenWidth, screenHeight);

	if (
		isCoarsePointer &&
		isPortrait &&
		screenWidth <= PHONE_PORTRAIT_MAX_WIDTH_PX
	) {
		return BASE_HEIGHT_PX_MIN;
	}

	if (minDim >= LARGE_DEVICE_MIN_DIM_PX) {
		return BASE_HEIGHT_PX_MAX;
	}

	const t = clamp(
		(cssCanvasHeightPx - CSS_CANVAS_HEIGHT_SMALL) /
			(CSS_CANVAS_HEIGHT_LARGE - CSS_CANVAS_HEIGHT_SMALL),
		0,
		1,
	);

	return Math.round(lerp(BASE_HEIGHT_PX_MIN, BASE_HEIGHT_PX_MAX, t));
}

export function initScreenDimensions() {
	screenWidth = window.innerWidth;
	screenHeight = window.innerHeight;

	ASPECT_RATIO_TARGET = screenWidth / screenHeight;
	ASPECT_RATIO = clamp(
		ASPECT_RATIO_TARGET,
		supportedAspectRatioRange.min,
		supportedAspectRatioRange.max,
	);

	BASE_HEIGHT_PX = pickBaseHeightPx({
		screenWidth,
		screenHeight,
		aspectRatio: ASPECT_RATIO,
	});

	BASE_WIDTH_PX = Math.round(BASE_HEIGHT_PX * ASPECT_RATIO);

	GAME_WIDTH_PX = Math.round(BASE_WIDTH_PX * SCALE);
	GAME_HEIGHT_PX = Math.round(BASE_HEIGHT_PX * SCALE);

	canvasCss.textContent = `
	#canvas {
		width: min(100dvw, calc(100dvh * ${ASPECT_RATIO}));
		height: min(100dvh, calc(100dvw / ${ASPECT_RATIO}));
	}
	`;

	canvas.width = GAME_WIDTH_PX;
	canvas.height = GAME_HEIGHT_PX;
}

export function initScreen() {
	initScreenDimensions();
	document.defaultView?.addEventListener("resize", initScreenDimensions);
}

export const TILE_SIZE_PX = 16;
export const FPS_LIMIT = Infinity;

export const CHARACTER_SPRITE_WIDTH_PX = 16;
export const CHARACTER_SPRITE_HEIGHT_PX = 24;

export const ANIMAL_SPRITE_WIDTH_PX = 32;
export const ANIMAL_SPRITE_HEIGHT_PX = 32;

export type MovementType = "walk" | "run";
export const DEFAULT_MOVEMENT: MovementType = "walk";

export const movementSpeeds = {
	walk: 0.06,
	run: 0.12,
} as const satisfies Record<MovementType, number>;

export const DEBUG_OVERLAY = import.meta.env.DEV;
