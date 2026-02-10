import { type Action, pressedKeys } from "./input";

export const keyMap: Record<Action, readonly string[]> = {
	up: ["ArrowUp", "KeyW"],
	down: ["ArrowDown", "KeyS"],
	left: ["ArrowLeft", "KeyA"],
	right: ["ArrowRight", "KeyD"],
	a: ["Space"],
	b: ["ShiftLeft", "ShiftRight"],
	x: ["KeyX"],
	y: ["KeyY"],
	start: ["Enter"],
	select: ["Tab"],
	l: ["KeyQ"],
	r: ["KeyE"],
	zl: [],
	zr: [],
} as const satisfies Record<Action, readonly KeyEventCode[]>;

export const reverseKeyMap: Record<string, Action> = {};
for (const [action, codes] of Object.entries(keyMap)) {
	for (const code of codes) reverseKeyMap[code] = action as Action;
}

const allBindingsSet = new Set(Object.values(keyMap).flat());

export function initKeyboard() {
	const clearPressed = () => {
		pressedKeys.clear();
	};

	window.addEventListener("blur", clearPressed);
	document.addEventListener("visibilitychange", () => {
		if (document.visibilityState !== "visible") clearPressed();
	});

	window.addEventListener("keydown", (e) => {
		const code = e.code;

		if (!allBindingsSet.has(code)) return;
		e.preventDefault();

		const action = reverseKeyMap[code];
		if (!action) return;

		for (const binding of keyMap[action]) {
			pressedKeys.delete(binding);
		}

		pressedKeys.add(code);
	});

	window.addEventListener("keyup", (e) => {
		const code = e.code;

		if (!allBindingsSet.has(code)) return;
		e.preventDefault();
		pressedKeys.delete(code);
	});
}

export const keyEventCodes = [
	// Letters
	"KeyA",
	"KeyB",
	"KeyC",
	"KeyD",
	"KeyE",
	"KeyF",
	"KeyG",
	"KeyH",
	"KeyI",
	"KeyJ",
	"KeyK",
	"KeyL",
	"KeyM",
	"KeyN",
	"KeyO",
	"KeyP",
	"KeyQ",
	"KeyR",
	"KeyS",
	"KeyT",
	"KeyU",
	"KeyV",
	"KeyW",
	"KeyX",
	"KeyY",
	"KeyZ",

	// Number row
	"Digit0",
	"Digit1",
	"Digit2",
	"Digit3",
	"Digit4",
	"Digit5",
	"Digit6",
	"Digit7",
	"Digit8",
	"Digit9",

	// Function keys
	"F1",
	"F2",
	"F3",
	"F4",
	"F5",
	"F6",
	"F7",
	"F8",
	"F9",
	"F10",
	"F11",
	"F12",

	// Modifiers
	"ShiftLeft",
	"ShiftRight",
	"ControlLeft",
	"ControlRight",
	"AltLeft",
	"AltRight",
	"MetaLeft",
	"MetaRight",
	"CapsLock",

	// Space & enter
	"Space",
	"Enter",
	"NumpadEnter",
	"Tab",
	"Escape",

	// Navigation
	"ArrowUp",
	"ArrowDown",
	"ArrowLeft",
	"ArrowRight",
	"Home",
	"End",
	"PageUp",
	"PageDown",
	"Insert",
	"Delete",

	// Editing
	"Backspace",

	// Punctuation / symbols
	"Minus",
	"Equal",
	"BracketLeft",
	"BracketRight",
	"Backslash",
	"Semicolon",
	"Quote",
	"Backquote",
	"Comma",
	"Period",
	"Slash",

	// Numpad digits
	"Numpad0",
	"Numpad1",
	"Numpad2",
	"Numpad3",
	"Numpad4",
	"Numpad5",
	"Numpad6",
	"Numpad7",
	"Numpad8",
	"Numpad9",

	// Numpad operators
	"NumpadAdd",
	"NumpadSubtract",
	"NumpadMultiply",
	"NumpadDivide",
	"NumpadDecimal",

	// Media keys
	"MediaPlayPause",
	"MediaStop",
	"MediaTrackNext",
	"MediaTrackPrevious",
	"AudioVolumeUp",
	"AudioVolumeDown",
	"AudioVolumeMute",

	// Misc
	"ContextMenu",
	"PrintScreen",
	"ScrollLock",
	"Pause",
] as const;

export type KeyEventCode = (typeof keyEventCodes)[number];
