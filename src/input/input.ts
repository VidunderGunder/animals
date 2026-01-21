export const directions = ["down", "left", "up", "right"] as const;
export type Direction = (typeof directions)[number];

export const internalButtons = [
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
export type InternalButton = (typeof internalButtons)[number];

export const pressedKeys = new Set<string>();

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
] as const satisfies InternalButton[];
export type Action = (typeof allActions)[number];
export const activeActions = new Set<Action>();

export let movementIntent: Direction | null = null;

export function isMove(action: Action | undefined): action is Direction {
	if (typeof action !== "string") return false;
	return directions.some((a) => a === action);
}

export const keyMap: Record<Action, string[]> = {
	up: ["ArrowUp"],
	down: ["ArrowDown"],
	left: ["ArrowLeft"],
	right: ["ArrowRight"],
	// Space
	a: [" "],
	b: ["Shift"],
	x: [],
	y: [],
	start: ["Enter"],
	select: ["Tab"],
	l: [],
	r: [],
	zl: [],
	zr: [],
};

export const reverseKeyMap: Record<string, Action> = {};
for (const [action, keys] of Object.entries(keyMap)) {
	for (const key of keys) {
		reverseKeyMap[key] = action as Action;
	}
}

export const allKeyBindings = Object.values(keyMap).flat();

export function initKeyboard() {
	window.addEventListener("keydown", (e) => {
		const key = e.key;

		if (!allKeyBindings.includes(key)) return;
		e.preventDefault();

		pressedKeys.add(key);
	});

	window.addEventListener("keyup", (e) => {
		const key = e.key;

		if (!allKeyBindings.includes(key)) return;
		pressedKeys.delete(key);
	});
}

export const pressedGamepadButtons = new Set<string>();

const gamepadButtonActionMap = {
	0: "a",
	1: "b",
	2: "x",
	3: "y",
	4: "l",
	5: "r",
	6: "zl",
	7: "zr",
	8: "select",
	9: "start",
	10: null, // Left Stick Press
	11: null, // Right Stick Press
	12: "up",
	13: "down",
	14: "left",
	15: "right",
} as const satisfies Record<number, Action | null>;

function isGamepadButtonIndex(
	index: unknown,
): index is keyof typeof gamepadButtonActionMap {
	if (typeof index !== "number") return false;
	return index in gamepadButtonActionMap;
}

function gamepadButtonToAction(index?: number): Action | null {
	if (!isGamepadButtonIndex(index)) return null;
	return gamepadButtonActionMap[index];
}

const controllerActions = new Set<Action>();

export function input() {
	const gamepads = navigator.getGamepads();
	const gamepad = gamepads[0];

	if (gamepad) {
		gamepad.buttons.forEach((button, index) => {
			const action = gamepadButtonToAction(index);

			if (!action) return;

			if (action) {
				if (button.pressed) {
					controllerActions.add(action);
				} else {
					controllerActions.delete(action);
				}
			}
		});
	}

	activeActions.clear();

	for (const key of pressedKeys) {
		const action = reverseKeyMap[key];
		if (action) {
			activeActions.add(action);
		}
	}

	for (const action of controllerActions) {
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
