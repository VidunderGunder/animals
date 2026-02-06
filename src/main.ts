// src/main.ts
import "./css/reset.css";

import { audio } from "./audio/audio-engine";
import { FPS_LIMIT, initScreen } from "./config";
import { initFullscreenSupport } from "./gfx/fullscreen";
import { activeActions, initInput, input } from "./input/input";
import { initVirtualGamepad } from "./input/touch";
import { menu } from "./scenes/menu/menu";
import { initializeArea as initializeStartArea } from "./scenes/overworld/data/start";
import { overworld } from "./scenes/overworld/overworld";

initializeStartArea();
initScreen();
initInput();
initVirtualGamepad();
initFullscreenSupport();

let previousFrameTimestamp = 0;
let rafId: number | null = null;

function loop(timestamp: number) {
	// If RAF was resumed after a pause, reset dt so it doesn't explode.
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

function stopGameLoop() {
	if (rafId !== null) {
		cancelAnimationFrame(rafId);
		rafId = null;
	}
	previousFrameTimestamp = 0;

	// Clear any “stuck input” state when backgrounding.
	activeActions.clear();
}

function startGameLoop() {
	// Always (re)start if not currently scheduled.
	if (rafId !== null) return;
	previousFrameTimestamp = 0;
	rafId = requestAnimationFrame(loop);
}

function onHidden() {
	stopGameLoop();
}

function onShown() {
	audio.init();
	startGameLoop();
}

document.addEventListener("visibilitychange", () => {
	if (document.hidden) onHidden();
	else onShown();
});

window.addEventListener("pagehide", () => {
	onHidden();
});

window.addEventListener("pageshow", () => {
	onShown();
});

// await loadEntitiesState();
startGameLoop();
