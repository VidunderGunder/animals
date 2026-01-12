import { createImageElement } from "../../assets/image";
import { GAME_HEIGHT, GAME_WIDTH } from "../../config";
import { ctx } from "../../gfx/canvas";
import { activeActions } from "../../input/input";
import { player } from "../../state";
import { returnToOverworld } from "../overworld/overworld";
import { moves } from "./moves";

export function openMenu() {
	activeActions.delete("start");
	player.disabled = true;
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
			(GAME_WIDTH - menuWidth) / 2,
			(GAME_HEIGHT - menuHeight) / 2,
			menuWidth,
			menuHeight,
		);

	if (activeActions.has("select")) {
		activeActions.delete("select");
		nextMode();
	}

	if (activeActions.has("start") || activeActions.has("b")) {
		returnToOverworld();
	}

	if (menuState.mode === "moves") moves(dt);
}
