import { FPS_LIMIT } from "./config";
import { laptop, openLaptop } from "./scenes/laptop/laptop";
import { overworld } from "./scenes/overworld";

let previousFrameTimestamp = 0;
let isRenderPaused = false;
let rafId: number | null = null;

document.addEventListener("visibilitychange", () => {
	if (document.hidden) {
		isRenderPaused = true;
	} else {
		// Reset timing when returning so dt doesn't explode
		isRenderPaused = false;
		previousFrameTimestamp = 0;
		rafId = requestAnimationFrame(loop);
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

	overworld(dt);
	laptop(dt);

	rafId = requestAnimationFrame(loop);
}

export function startGame() {
	if (rafId !== null) return;
	previousFrameTimestamp = 0;
	rafId = requestAnimationFrame(loop);
	openLaptop();
}
