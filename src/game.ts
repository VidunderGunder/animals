import { FPS_LIMIT } from "./config";
import { biodex } from "./scenes/biodex";
import { overworld } from "./scenes/overworld";

let previousFrameTimestamp = 0;

function loop(timestamp: number) {
	if (!previousFrameTimestamp) previousFrameTimestamp = timestamp;

	const elapsed = timestamp - previousFrameTimestamp;

	// Frame limiter: only update/draw if enough time has passed
	if (elapsed < 1000 / FPS_LIMIT) {
		requestAnimationFrame(loop);
		return;
	}

	const dt = elapsed / 1000; // seconds
	previousFrameTimestamp = timestamp;

	overworld(dt);
	biodex(dt);

	requestAnimationFrame(loop);
}

export function startGame() {
	previousFrameTimestamp = 0;
	requestAnimationFrame(loop);
}
