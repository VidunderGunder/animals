import { gamepadButtonToAction, getGamepadUI } from "./gamepad";
import { initKeyboard, reverseKeyMap } from "./keyboard";

export function initInput() {
	initKeyboard();
}

export const inputUIs = [
	"keyboard",
	"nintendo", // Nintendo Switch like (our touch controls are based on this)
	"playstation", // PlayStation like
	"xbox", // XBox like
] as const;
export type InputUI = (typeof inputUIs)[number];
let inputUI: InputUI = "keyboard";

export function getInputUI(): InputUI {
	return inputUI;
}

export const directions = ["down", "left", "up", "right"] as const;
export type Direction = (typeof directions)[number];

export const allActions = [
	...directions,
	"a",
	"b",
	"x",
	"y",
	"start",
	"select",
	"l",
	"r",
	"zl",
	"zr",
] as const;
export type Action = (typeof allActions)[number];

export const activeActions = new Set<Action>();

export const pressedKeys = new Set<string>();
export const activeGamepadActions = new Set<Action>();
export const activeTouchActions = new Set<Action>();

export let movementIntent: Direction | null = null;

export function isMove(action: Action | undefined): action is Direction {
	if (typeof action !== "string") return false;
	return directions.some((a) => a === action);
}

export function input() {
	activeActions.clear();

	const gamepad = navigator.getGamepads()[0];

	if (gamepad) {
		gamepad.buttons.forEach((button, index) => {
			const action = gamepadButtonToAction(index);

			if (!action) return;

			if (button.pressed) {
				activeGamepadActions.add(action);
			} else {
				activeGamepadActions.delete(action);
			}
		});

		for (const action of activeGamepadActions) {
			activeActions.add(action);
		}

		if (activeGamepadActions.size > 0) inputUI = getGamepadUI(gamepad.id);
	} else if (activeGamepadActions.size > 0) {
		activeGamepadActions.clear();
	}

	if (pressedKeys.size > 0) inputUI = "keyboard";
	for (const key of pressedKeys) {
		const action = reverseKeyMap[key];
		if (action) {
			activeActions.add(action);
		}
	}

	if (activeTouchActions.size > 0) inputUI = "nintendo";
	for (const action of activeTouchActions) {
		activeActions.add(action);
	}

	// Prioritize the last pressed direction for movement intent
	const activeMoves = Array.from(activeActions).filter(isMove);
	if (activeMoves.length > 0) {
		const temp = activeMoves[activeMoves.length - 1];
		if (isMove(temp)) movementIntent = temp;
	} else {
		movementIntent = null;
	}
}
