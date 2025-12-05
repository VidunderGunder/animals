// import.meta.hot.accept();

export const pressedKeys = new Set<string>();

export const directions = ["up", "down", "left", "right"] as const;
export type Direction = (typeof directions)[number];

export function isMove(action: Action | undefined): action is Direction {
	if (typeof action !== "string") return false;
	return directions.some((a) => a === action);
}

export const allActions = [
	...directions,
	"primary",
	"secondary",
	"start",
] as const;
export type Action = (typeof allActions)[number];
export const activeActions = new Set<Action>();

export let movementIntent: Direction | null = null;
export function setMovementIntent(intent: Direction | null) {
	movementIntent = intent;
}

export const keyMap: Record<Action, string[]> = {
	up: ["ArrowUp"],
	down: ["ArrowDown"],
	left: ["ArrowLeft"],
	right: ["ArrowRight"],
	primary: [" "],
	secondary: ["Shift"],
	start: ["Enter", "Escape"],
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
		const action = reverseKeyMap[key];
		if (!action) return;

		const actionIsMove = isMove(action);
		if (actionIsMove) {
			const activeMoves = Array.from(activeActions).filter(isMove);
			for (const move of activeMoves) {
				activeActions.delete(move);
			}
		}

		activeActions.add(action);
	});

	window.addEventListener("keyup", (event) => {
		pressedKeys.delete(event.key);
		const action = reverseKeyMap[event.key];

		if (!action) return;

		if (isMove(action)) {
			const stillPressedMoves = Array.from(pressedKeys).filter((key) =>
				allKeyBindings.includes(key),
			);
			let newMoveAction: Action | null = null;
			for (const key of stillPressedMoves) {
				const possibleAction = reverseKeyMap[key];
				if (isMove(possibleAction)) {
					newMoveAction = possibleAction;
					break;
				}
			}
			if (newMoveAction) {
				activeActions.add(newMoveAction);
			}
		}

		activeActions.delete(action);
	});
}
