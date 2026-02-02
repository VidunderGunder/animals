import "./css/reset.css";

import { audio } from "./audio/audio-engine";
import { FPS_LIMIT, initScreen } from "./config";
import { initFullscreenSupport } from "./gfx/fullscreen";
import { activeActions, initInput, input } from "./input/input";
import { initVirtualGamepad } from "./input/touch";
import { menu } from "./scenes/menu/menu";
import { initializeArea as initializeStartArea } from "./scenes/overworld/data/start";
import { overworld } from "./scenes/overworld/overworld";
import { loadEntitiesState } from "./storage";

initializeStartArea();
initScreen();
initInput();
initVirtualGamepad();
initFullscreenSupport();

document.addEventListener("visibilitychange", () => {
	if (!document.hidden) {
		audio.init();
	}
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

await loadEntitiesState();

startGame();
