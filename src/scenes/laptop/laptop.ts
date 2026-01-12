import { createImageElement } from "../../assets/image";
import { GAME_HEIGHT, GAME_WIDTH } from "../../config";
import { ctx } from "../../gfx/canvas";
import { activeActions } from "../../input/input";
import { player } from "../../state";
import { returnToOverworld } from "../overworld";
import { moves } from "./moves";

export function openLaptop() {
	activeActions.delete("start");
	player.disabled = true;
	laptopState.show = true;
}

const laptopModes = ["moves"] as const;
type LaptopMode = (typeof laptopModes)[number];

export type LaptopState = {
	show: boolean;
	mode: LaptopMode;
};

export const laptopState: LaptopState = {
	show: false,
	mode: "moves",
};

// export const laptopWidth = laptopSprite.naturalWidth; // Must be done after laptopSprite.complete is true
export let laptopWidth = 0; // Using static width for now
// export const laptopHeight = laptopSprite.naturalHeight; // Must be done after laptopSprite.complete is true
export let laptopHeight = 0; // Using static height for now
const laptopSprite = createImageElement("/laptop.png");
laptopSprite.onload = () => {
	laptopWidth = laptopSprite.naturalWidth;
	laptopHeight = laptopSprite.naturalHeight;
};

function nextLaptopMode() {
	const currentModeIndex = laptopModes.indexOf(laptopState.mode);
	const nextModeIndex = (currentModeIndex + 1) % laptopModes.length;
	const nextMode = laptopModes[nextModeIndex];
	if (nextMode === undefined) throw new Error("Invalid laptop mode");
	laptopState.mode = nextMode;
}

export function laptop(dt: number) {
	if (!laptopState.show) return;

	if (laptopSprite.complete)
		ctx.drawImage(
			laptopSprite,
			0,
			0,
			laptopWidth,
			laptopHeight,
			(GAME_WIDTH - laptopWidth) / 2,
			(GAME_HEIGHT - laptopHeight) / 2,
			laptopWidth,
			laptopHeight,
		);

	if (activeActions.has("select")) {
		activeActions.delete("select");
		nextLaptopMode();
	}

	if (activeActions.has("start") || activeActions.has("b")) {
		returnToOverworld();
	}

	if (laptopState.mode === "moves") moves(dt);
}
