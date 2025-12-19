import { haptic } from "./haptic";
import { type Action, activeActions, type Direction, isMove } from "./input";

const DEBUG_TOUCH_CONTROLLER: boolean = true;

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

	const pointerUpEvents = [
		"pointerup",
		"pointercancel",
		"pointerleave",
	] as const satisfies (keyof HTMLElementEventMap)[];
	pointerUpEvents.forEach((eventKey) => {
		b.addEventListener(eventKey, up);
	});

	const touchEvents = [
		"touchstart",
		"touchend",
		"touchcancel",
		"touchmove",
	] as const satisfies (keyof HTMLElementEventMap)[];
	touchEvents.forEach((eventKey) => {
		b.addEventListener(
			eventKey,
			(e) => {
				e.returnValue = false;
				e.preventDefault();
			},
			{ passive: false },
		);
	});

	controller.appendChild(b);

	return b;
}

function setMoveAction(next: Direction | null) {
	// Clear existing move actions, then set the next one.
	for (const a of Array.from(activeActions)) {
		if (isMove(a)) activeActions.delete(a);
	}
	if (next) activeActions.add(next);
}

function pickDirectionFromVector(
	dx: number,
	dy: number,
	{
		deadzonePx,
		diagonalBias = 1.15,
	}: { deadzonePx: number; diagonalBias?: number },
): Direction | null {
	const ax = Math.abs(dx);
	const ay = Math.abs(dy);

	// deadzone
	if (ax < deadzonePx && ay < deadzonePx) return null;

	// "dominant axis" with a little bias so diagonals don't flicker
	if (ax > ay * diagonalBias) return dx > 0 ? "right" : "left";
	if (ay > ax * diagonalBias) return dy > 0 ? "down" : "up";

	// If close to diagonal, choose whichever is bigger (stable enough once hysteresis is applied)
	return ax >= ay ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
}

type AnalogPadBinding = {
	lastDir: Direction | null;
	startX: number;
	startY: number;
	active: boolean;
};

const analogPads = new Map<number, AnalogPadBinding>();

function makeAnalogDpadArea(): HTMLButtonElement {
	const pad = document.createElement("button");
	pad.type = "button";

	const defaultStyle =
		"position:absolute; border:none; background:transparent; touch-action:none;";
	pad.style.cssText = [
		defaultStyle,
		DEBUG_TOUCH_CONTROLLER
			? "background: rgba(0, 180, 255, 0.18); outline: 1px solid rgba(0, 180, 255, 0.35);"
			: "",
	].join(" ");

	// Place it over your dpad region (tweak as needed)
	// This covers the entire d-pad cluster, not just each arrow.
	pad.style.cssText +=
		"left: 3.75%; top: 21.5%; width: 42%; height: 50%; border-radius: 100%;";

	pad.addEventListener("pointerdown", (e) => {
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		e.preventDefault();

		analogPads.set(e.pointerId, {
			lastDir: null,
			startX: e.clientX,
			startY: e.clientY,
			active: true,
		});

		// start with no direction until they move out of deadzone
		setMoveAction(null);
	});

	pad.addEventListener("pointermove", (e) => {
		const state = analogPads.get(e.pointerId);
		if (!state?.active) return;

		e.preventDefault();

		const dx = e.clientX - state.startX;
		const dy = e.clientY - state.startY;

		// Scale deadzone to pad size so it feels consistent across phones
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		const deadzonePx = Math.max(10, Math.min(rect.width, rect.height) * 0.07);

		// Hysteresis: once a direction is chosen, require a bit more change to switch
		const diagonalBias = state.lastDir ? 1.28 : 1.12;

		const dir = pickDirectionFromVector(dx, dy, { deadzonePx, diagonalBias });

		if (dir !== state.lastDir) {
			state.lastDir = dir;
			setMoveAction(dir);
			if (dir) haptic();
		}
	});

	const up = (e: PointerEvent) => {
		e.preventDefault();
		analogPads.delete(e.pointerId);

		// Only clear movement; don't touch other buttons
		setMoveAction(null);
	};

	const pointerUpEvents = [
		"pointerup",
		"pointercancel",
		"pointerleave",
	] as const satisfies (keyof HTMLElementEventMap)[];
	pointerUpEvents.forEach((key) => {
		pad.addEventListener(key, up);
	});

	const touchEvents = [
		"touchstart",
		"touchend",
		"touchcancel",
		"touchmove",
	] as const satisfies (keyof HTMLElementEventMap)[];
	touchEvents.forEach((key) => {
		pad.addEventListener(
			key,
			(e) => {
				e.returnValue = false;
				e.preventDefault();
			},
			{ passive: false },
		);
	});

	controller.appendChild(pad);
	return pad;
}

export function initVirtualGamepad() {
	// Only for coarse pointers (phones/tablets)
	const isCoarse =
		typeof window !== "undefined" &&
		window.matchMedia("(pointer: coarse)").matches;

	if (!isCoarse) return;

	// Dpad
	// const left = makeButton("left");
	// left.style.cssText += "left: 3.75%; top: 38.1%; border-radius: 15%;";
	// const right = makeButton("right");
	// right.style.cssText += " left: 30.75%; top: 38.1%; border-radius: 15%;";
	// const up = makeButton("up");
	// up.style.cssText += " left: 17.1%; top: 22.5%; border-radius: 15%;";
	// const down = makeButton("down");
	// down.style.cssText += " left: 17.1%; top: 54%; border-radius: 15%;";
	makeAnalogDpadArea();

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
		" left: 13.75%; top: 4%; height: 13.75%; width: 15%; aspect-ratio: auto; border-radius: 12.5%;";
	const zr = makeButton("zr");
	zr.style.cssText +=
		" right: 13.75%; top: 4%; height: 13.75%; width: 15%; aspect-ratio: auto; border-radius: 12.5%;";

	// If OS interrupts, clean up stuck actions
	window.addEventListener("blur", releaseAll);
	document.addEventListener("visibilitychange", () => {
		if (document.hidden) releaseAll();
	});
}
