import { createImageElement } from "../../assets";
import { ctx } from "../../canvas";
import { GAME_HEIGHT, GAME_WIDTH } from "../../config";
import { activeActions } from "../../input";
import { player } from "../../state";
import { biodex } from "./biodex";
import { moves } from "./moves";

export function openLaptop() {
	activeActions.delete("start");
	player.disabled = true;
	laptopState.show = true;
}

const laptopModes = ["biodex", "moves", "nothing"] as const;
type LaptopMode = (typeof laptopModes)[number];

export type LaptopState = {
	show: boolean;
	mode: LaptopMode;
};

export const laptopState: LaptopState = {
	show: false,
	mode: "moves",
};

const laptopSprite = createImageElement("/laptop.png");
export const laptopWidth = laptopSprite.naturalWidth;
export const laptopHeight = laptopSprite.naturalHeight;

function nextLaptopMode() {
	const currentModeIndex = laptopModes.indexOf(laptopState.mode);
	const nextModeIndex = (currentModeIndex + 1) % laptopModes.length;
	const nextMode = laptopModes[nextModeIndex];
	if (nextMode === undefined) throw new Error("Invalid laptop mode");
	laptopState.mode = nextMode;
}

export function laptop(dt: number) {
	if (!laptopState.show) return;

	ctx.drawImage(
		laptopSprite,
		0,
		0,
		laptopWidth,
		laptopHeight,
		(GAME_WIDTH - laptopWidth) / 2,
		GAME_HEIGHT - laptopHeight,
		laptopWidth,
		laptopHeight,
	);

	if (activeActions.has("select")) {
		activeActions.delete("select");
		nextLaptopMode();
	}

	if (laptopState.mode === "biodex") biodex(dt);
	if (laptopState.mode === "moves") moves(dt);
}
