export const ASPECT_RATIO_X = 4;
export const ASPECT_RATIO_Y = 3;
export const ASPECT_RATIO = ASPECT_RATIO_X / ASPECT_RATIO_Y;

// Pixel perfect sizes for 16:9 and corresponding crops:
// 16:9 1920x1080, 4:3 1440x1080, 5:4 1536x1080, 3:2 1280x1080
// 16:9 960x540, 4:3 720x540, 5:4 768x540, 3:2 640x540
// 16:9 640x360, 4:3 480x360, 5:4 512x360, 3:2 426.6666666666667x360
// 16:9 480x270, 4:3 360x270, 5:4 384x270, 3:2 320x270
// 16:9 384x216, 4:3 288x216, 5:4 307.2x216, 3:2 256x216
// 16:9 320x180, 4:3 240x180, 5:4 256x180, 3:2 213.33333333333334x180
// 16:9 240x135, 4:3 180x135, 5:4 192x135, 3:2 160x135

export const BASE_HEIGHT = 216;
export const BASE_WIDTH = BASE_HEIGHT * ASPECT_RATIO;
export const SCALE = 1;

const canvasCss = document.getElementById("canvas-css") as HTMLStyleElement;
canvasCss.textContent = `
	#canvas {
		width: min(100dvw, 100dvh * (${ASPECT_RATIO_X} / ${ASPECT_RATIO_Y}));
		height: min(100dvh, 100dvw * (${ASPECT_RATIO_Y} / ${ASPECT_RATIO_X}));
	}
`;

export const GAME_WIDTH = BASE_WIDTH * SCALE;
export const GAME_HEIGHT = BASE_HEIGHT * SCALE;
export const TILE_SIZE = 16;
export const FPS_LIMIT = Infinity;

export const CHARACTER_SPRITE_WIDTH = 16;
export const CHARACTER_SPRITE_HEIGHT = 24;

export type MovementType = "walk" | "run";
export const DEFAULT_MOVEMENT: MovementType = "walk";

export const movementSpeeds = {
	walk: 0.1,
	run: 0.16,
} as const satisfies Record<MovementType, number>;

export const DEBUG_TILES = false;
export const DEBUG_OVERLAY = true;

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
