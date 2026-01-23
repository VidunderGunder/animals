import { type Action, pressedKeys } from "./input";

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
