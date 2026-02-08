import { createImageElement } from "../../assets/image";
import { GAME_HEIGHT_PX, GAME_WIDTH_PX } from "../../config";
import { ctx } from "../../gfx/canvas";
import { activeActions, activeActionsOnDown } from "../../input/input";
import { gameState } from "../../state";
import { returnToOverworld } from "../overworld/overworld";
import { moves } from "./moves";

export function openMenu() {
	gameState.disabled = true;
	menuState.show = true;
}

const menuModes = ["moves"] as const;
type MenuMode = (typeof menuModes)[number];

export type MenuState = {
	show: boolean;
	mode: MenuMode;
};

export const menuState: MenuState = {
	show: false,
	mode: "moves",
};

export let menuWidth = 0; // Using static width for now
export let menuHeight = 0; // Using static height for now
const sprite = createImageElement("/ui/menu.png");
sprite.onload = () => {
	menuWidth = sprite.naturalWidth;
	menuHeight = sprite.naturalHeight;
};

function nextMode() {
	const currentModeIndex = menuModes.indexOf(menuState.mode);
	const nextModeIndex = (currentModeIndex + 1) % menuModes.length;
	const nextMode = menuModes[nextModeIndex];
	if (nextMode === undefined) throw new Error("Invalid menu mode");
	menuState.mode = nextMode;
}

export function menu(dt: number) {
	if (!menuState.show) return;

	if (sprite.complete)
		ctx.drawImage(
			sprite,
			0,
			0,
			menuWidth,
			menuHeight,
			(GAME_WIDTH_PX - menuWidth) / 2,
			(GAME_HEIGHT_PX - menuHeight) / 2,
			menuWidth,
			menuHeight,
		);

	if (activeActionsOnDown.has("start")) {
		returnToOverworld();
	}

	if (activeActionsOnDown.has("select")) {
		activeActionsOnDown.delete("select");
		nextMode();
	}

	if (activeActions.has("b")) {
		returnToOverworld();
	}

	if (menuState.mode === "moves") moves(dt);
}
