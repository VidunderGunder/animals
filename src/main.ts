import "./.css/reset.css";

import { initializeAudio } from "./audio/audio";
import { FPS_LIMIT, initScreen } from "./config";
import { initFullscreenSupport } from "./gfx/fullscreen";
import { activeActions, initKeyboard, input } from "./input/input";
import { initVirtualGamepad } from "./input/touch";
import { menu } from "./scenes/menu/menu";
import { overworld } from "./scenes/overworld/overworld";
import {
	player,
	setPlayerState,
} from "./state";
import { initializeStorage } from "./storage";

initScreen();
document.defaultView?.addEventListener("resize", initScreen);

initKeyboard();

initVirtualGamepad();

document.addEventListener("visibilitychange", () => {
	if (!document.hidden) return;
	initializeAudio();
});

let previousFrameTimestamp = 0;
let isRenderPaused = false;
let rafId: number | null = null;

document.addEventListener("visibilitychange", () => {
	if (document.hidden) {
		isRenderPaused = true;
		activeActions.clear();
	} else {
		// Reset timing when returning so dt doesn't explode
		isRenderPaused = false;
		previousFrameTimestamp = 0;
	}
});

initFullscreenSupport();

function loop(timestamp: number) {
	if (isRenderPaused) return;

	if (!previousFrameTimestamp) previousFrameTimestamp = timestamp;
	const dt = timestamp - previousFrameTimestamp;

	if (dt < 1000 / FPS_LIMIT) {
		rafId = requestAnimationFrame(loop);
		return;
	}

	previousFrameTimestamp = timestamp;

	input();
	overworld(dt);
	menu(dt);

	rafId = requestAnimationFrame(loop);
}

function startGame() {
	if (rafId !== null) return;
	previousFrameTimestamp = 0;
	rafId = requestAnimationFrame(loop);
}
// Initialize storage and autoload saved state on game start
initializeStorage(player)
	.then((partialPlayer) => {
		setPlayerState(partialPlayer);
		startGame();
	})
	.catch((err: unknown) => {
		console.error("Failed to initialize storage:", err);
		startGame();
	})
