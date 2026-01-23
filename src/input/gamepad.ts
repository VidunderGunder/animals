import type { Action, InputUI } from "./input";

const playstationIdTags = [
	"playstation",
	"ps3",
	"ps4",
	"ps5",
	"dualshock",
	"dualsense",
	"sony interactive",
	"sony computer",
	"sony",
	"ds4",
	"ds5",
] as const;
const nintendoIdTags = [
	"nintendo",
	"switch",
	"joy-con",
	"joycon",
	"pro controller",
	"switch pro",
	"nx",
	"hac",
] as const;
const xboxIdTags = [
	"xbox",
	"x-input",
	"xinput",
	"xbox 360",
	"xbox360",
	"xbox one",
	"xboxone",
	"xbox series",
	"microsoft",
	"controller (xbox)",
	"wireless controller (xbox)",
] as const;

export function getGamepadUI(gamepadId: string): InputUI {
	const id = gamepadId.toLowerCase();

	if (nintendoIdTags.some((tag) => id.includes(tag))) return "nintendo";
	if (playstationIdTags.some((tag) => id.includes(tag))) return "playstation";
	if (xboxIdTags.some((tag) => id.includes(tag))) return "xbox";

	return "xbox"; // Default to Xbox style
}

/**
 * https://www.w3.org/TR/gamepad/standard_gamepad.svg
 */
const gamepadButtonActionMap = {
	0: "b",
	1: "a",
	2: "y",
	3: "x",
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

export function isGamepadButtonIndex(
	index: unknown,
): index is keyof typeof gamepadButtonActionMap {
	if (typeof index !== "number") return false;
	return index in gamepadButtonActionMap;
}

export function gamepadButtonToAction(index?: number): Action | null {
	if (!isGamepadButtonIndex(index)) return null;
	return gamepadButtonActionMap[index];
}
