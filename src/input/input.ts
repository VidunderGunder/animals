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

export const directionToIndex: Record<Direction, number> = {
	down: 0,
	left: 1,
	up: 2,
	right: 3,
} as const;
export const indexToDirection: Record<number, Direction> = {
	0: "down",
	1: "left",
	2: "up",
	3: "right",
} as const;
export function rotate(
	direction: Direction,
	rotation: "clockwise" | "counterclockwise",
	times = 1,
): Direction {
	const index = directionToIndex[direction];
	const rotationAmount = rotation === "clockwise" ? times : -times;
	const newIndex = (index + rotationAmount + 4) % 4;
	return indexToDirection[newIndex] ?? direction;
}

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
const nextActiveActions = new Set<Action>();

export const activeActionsOnDown = new Set<Action>();
export const activeActionsOnUp = new Set<Action>();

export const pressedKeys = new Set<string>();
export const activeGamepadActions = new Set<Action>();
export const activeTouchActions = new Set<Action>();

export let movementIntent: Direction | null = null;

export function isMove(action: Action | undefined): action is Direction {
	if (typeof action !== "string") return false;
	return directions.some((a) => a === action);
}

export function inputCleanUp() {
	activeActionsOnDown.clear();
	activeActionsOnUp.clear();
}

export function input() {
	nextActiveActions.clear();

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
			nextActiveActions.add(action);
		}

		if (activeGamepadActions.size > 0) inputUI = getGamepadUI(gamepad.id);
	} else if (activeGamepadActions.size > 0) {
		activeGamepadActions.clear();
	}

	if (pressedKeys.size > 0) inputUI = "keyboard";
	for (const key of pressedKeys) {
		const action = reverseKeyMap[key];
		if (action) {
			nextActiveActions.add(action);
		}
	}

	if (activeTouchActions.size > 0) inputUI = "nintendo";
	for (const action of activeTouchActions) {
		nextActiveActions.add(action);
	}

	// Prioritize the last pressed direction for movement intent
	const activeMoves = Array.from(nextActiveActions).filter(isMove);
	if (activeMoves.length > 0) {
		const temp = activeMoves[activeMoves.length - 1];
		if (isMove(temp)) movementIntent = temp;
	} else {
		movementIntent = null;
	}

	for (const action of activeActions) {
		if (!nextActiveActions.has(action)) {
			activeActions.delete(action);
			activeActionsOnUp.add(action);
		}
	}

	for (const action of nextActiveActions) {
		if (!activeActions.has(action)) {
			activeActions.add(action);
			activeActionsOnDown.add(action);
		}
	}

	activeActions.clear();
	for (const action of nextActiveActions) {
		activeActions.add(action);
	}
}
