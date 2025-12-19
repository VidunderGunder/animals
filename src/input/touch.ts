// src/input/virtualGamepad.ts

import { haptic } from "./haptic";
import { type Action, activeActions } from "./input";

const DEBUG_TOUCH_CONTROLLER: boolean = false;

type PointerBinding = {
	action: Action;
};

const pointers = new Map<number, PointerBinding>();

function press(pointerId: number, action: Action) {
	pointers.set(pointerId, { action });
	activeActions.add(action);
	haptic();
}

function release(pointerId: number) {
	const binding = pointers.get(pointerId);
	if (!binding) return;
	pointers.delete(pointerId);
	activeActions.delete(binding.action);
}

function releaseAll() {
	for (const [pid] of pointers) release(pid);
}

// biome-ignore lint/style/noNonNullAssertion: <intentional>
const controller = document.getElementById("controller-portrait")!;
if (!controller) throw new Error("Controller element not found");

function makeButton(action: Action): HTMLButtonElement {
	const b = document.createElement("button");
	b.type = "button";
	const defaultStyle =
		"position: absolute; border: none; border-radius: 50%; width: 15%; aspect-ratio: 1 / 1;";
	b.style.cssText = [
		defaultStyle,
		DEBUG_TOUCH_CONTROLLER
			? "background: rgba(255, 0, 0, 0.2);"
			: "background: transparent;",
	].join(" ");

	// Prevent scrolling / text selection
	b.style.touchAction = "none";

	b.addEventListener("pointerdown", (e) => {
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		e.preventDefault();
		press(e.pointerId, action);
	});

	const up = (e: PointerEvent) => {
		e.preventDefault();
		release(e.pointerId);
	};

	b.addEventListener("pointerup", up);
	b.addEventListener("pointercancel", up);
	b.addEventListener("pointerleave", up);

	controller.appendChild(b);

	return b;
}

export function initVirtualGamepad() {
	// Only for coarse pointers (phones/tablets)
	const isCoarse =
		typeof window !== "undefined" &&
		window.matchMedia("(pointer: coarse)").matches;

	if (!isCoarse) return;

	// Dpad
	const left = makeButton("left");
	left.style.cssText += "left: 3.75%; top: 38.1%; border-radius: 15%;";
	const right = makeButton("right");
	right.style.cssText += " left: 30.75%; top: 38.1%; border-radius: 15%;";
	const up = makeButton("up");
	up.style.cssText += " left: 17.1%; top: 22.5%; border-radius: 15%;";
	const down = makeButton("down");
	down.style.cssText += " left: 17.1%; top: 54%; border-radius: 15%;";

	// Buttons
	const a = makeButton("a");
	a.style.cssText += " right: 3%; top: 38%;";
	const b = makeButton("b");
	b.style.cssText += " right: 17%; top: 54%;";
	const x = makeButton("x");
	x.style.cssText += " right: 17%; top: 22%;";
	const y = makeButton("y");
	y.style.cssText += " right: 31%; top: 38%;";

	const start = makeButton("start");
	start.style.cssText += " right: 34.75%; top: 72.25%; width: 10%;";
	const select = makeButton("select");
	select.style.cssText += " left: 34.75%; top: 72.25%; width: 10%;";

	const l = makeButton("l");
	l.style.cssText +=
		" left: 0%; top: 4%; height: 30%; width: 13.5%; aspect-ratio: auto; border-radius: 10%;";
	const r = makeButton("r");
	r.style.cssText +=
		" right: 0%; top: 4%; height: 30%; width: 13.5%; aspect-ratio: auto; border-radius: 10%;";
	const zl = makeButton("zl");
	zl.style.cssText +=
		" left: 13.5%; top: 4%; height: 13.75%; width: 15.5%; aspect-ratio: auto; border-radius: 12.5%;";
	const zr = makeButton("zr");
	zr.style.cssText +=
		" right: 13.5%; top: 4%; height: 13.75%; width: 15.5%; aspect-ratio: auto; border-radius: 12.5%;";

	// If OS interrupts, clean up stuck actions
	window.addEventListener("blur", releaseAll);
	document.addEventListener("visibilitychange", () => {
		if (document.hidden) releaseAll();
	});
}
