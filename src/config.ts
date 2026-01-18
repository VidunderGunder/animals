import { canvas } from "./gfx/canvas";

const supportedConfigurations = [
	{ x: 16, y: 9 },
	{ x: 4, y: 3 },
	{ x: 5, y: 4 },
	// { x: 3, y: 2 },
	// { x: 10, y: 9 },
	// { x: 1, y: 1 },
] as const satisfies { x: number; y: number }[];

function getClosestAspectRatio(width: number, height: number) {
	const targetRatio = width / height;
	let closestConfig: { x: number; y: number } = supportedConfigurations[0];
	let closestDiff = Math.abs(
		targetRatio - supportedConfigurations[0].x / supportedConfigurations[0].y,
	);

	for (const config of supportedConfigurations) {
		const configRatio = config.x / config.y;
		const diff = Math.abs(targetRatio - configRatio);
		if (diff < closestDiff) {
			closestDiff = diff;
			closestConfig = config;
		}
	}

	return closestConfig;
}

let screenWidth = window.innerWidth;
let screenHeight = window.innerHeight;

export let { x: ASPECT_RATIO_X, y: ASPECT_RATIO_Y } = getClosestAspectRatio(
	screenWidth,
	screenHeight,
);

export const BASE_HEIGHT = 216;
export const SCALE = 1;

export let ASPECT_RATIO = 1;
export let BASE_WIDTH = BASE_HEIGHT * ASPECT_RATIO;
export let GAME_WIDTH = BASE_WIDTH * SCALE;
export let GAME_HEIGHT = BASE_HEIGHT * SCALE;

const canvasCss = document.getElementById("canvas-css") as HTMLStyleElement;

export function initScreen() {
	screenWidth = window.innerWidth;
	screenHeight = window.innerHeight;
	({ x: ASPECT_RATIO_X, y: ASPECT_RATIO_Y } = getClosestAspectRatio(
		screenWidth,
		screenHeight,
	));
	ASPECT_RATIO = ASPECT_RATIO_X / ASPECT_RATIO_Y;
	BASE_WIDTH = BASE_HEIGHT * ASPECT_RATIO;

	GAME_WIDTH = BASE_WIDTH * SCALE;
	GAME_HEIGHT = BASE_HEIGHT * SCALE;
	canvasCss.textContent = `
	#canvas {
		width: min(100dvw, 100dvh * (${ASPECT_RATIO_X} / ${ASPECT_RATIO_Y}));
		height: min(100dvh, 100dvw * (${ASPECT_RATIO_Y} / ${ASPECT_RATIO_X}));
	}
	`;
	isValidDimensions();

	canvas.width = GAME_WIDTH;
	canvas.height = GAME_HEIGHT;
}

export const TILE_SIZE = 16;
export const FPS_LIMIT = Infinity;

export const CHARACTER_SPRITE_WIDTH = 16;
export const CHARACTER_SPRITE_HEIGHT = 24;

export type MovementType = "walk" | "run";
export const DEFAULT_MOVEMENT: MovementType = "walk";

export const movementSpeeds = {
	walk: 0.07,
	run: 0.13,
} as const satisfies Record<MovementType, number>;

export const DEBUG_OVERLAY = false;

function isValidDimensions() {
	if (Number.isInteger(GAME_WIDTH) && Number.isInteger(GAME_HEIGHT)) {
		return true;
	} else {
		throw new Error(
			`GAME_WIDTH and GAME_HEIGHT must be integers. Current values: GAME_WIDTH=${GAME_WIDTH}, GAME_HEIGHT=${GAME_HEIGHT}`,
		);
	}
}

isValidDimensions();
