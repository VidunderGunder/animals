import { haptic } from "./haptic";
import { type Action, activeActions, type Direction } from "./input";

const DEBUG_TOUCH_CONTROLLER: boolean = import.meta.env.DEV && true;

let lastTouchEnd = 0;

// iOS double-tap prevention hack
document.addEventListener(
	"touchend",
	(e) => {
		const now = Date.now();
		if (now - lastTouchEnd <= 300) {
			e.preventDefault(); // best-effort: blocks double-tap behaviors in some iOS versions
		}
		lastTouchEnd = now;
	},
	{ passive: false },
);

type PointerBinding = {
	action: Action;
	group?: "dpad";
};

const pointers = new Map<number, PointerBinding>();

function press(
	pointerId: number,
	action: Action,
	group?: PointerBinding["group"],
) {
	pointers.set(pointerId, { action, group });
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

function switchAction(pointerId: number, newAction: Action) {
	const binding = pointers.get(pointerId);
	if (!binding) return;
	if (binding.action === newAction) return;

	activeActions.delete(binding.action);
	binding.action = newAction;
	activeActions.add(newAction);
	haptic();
}

// biome-ignore lint/style/noNonNullAssertion: <intentional>
const controller = document.getElementById("controller-portrait")!;
if (!controller) throw new Error("Controller element not found");

const groupAreas = new Map<NonNullable<PointerBinding["group"]>, HTMLElement>();

function pointInEl(el: HTMLElement, x: number, y: number): boolean {
	const r = el.getBoundingClientRect();
	return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
}

function getDpadDirFromPoint(
	area: HTMLElement,
	x: number,
	y: number,
): Direction | null {
	const r = area.getBoundingClientRect();
	const cx = r.left + r.width / 2;
	const cy = r.top + r.height / 2;

	const dx = x - cx;
	const dy = y - cy;

	const nx = dx / (r.width / 2);
	const ny = dy / (r.height / 2);
	const mag = Math.hypot(nx, ny);
	if (mag < 0.18) return null;

	if (Math.abs(nx) > Math.abs(ny)) return nx < 0 ? "left" : "right";
	return ny < 0 ? "up" : "down";
}

function tryStartDpadFromPoint(
	pointerId: number,
	x: number,
	y: number,
): boolean {
	if (pointers.has(pointerId)) return false;

	const area = groupAreas.get("dpad");
	if (!area) return false;
	if (!pointInEl(area, x, y)) return false;

	const dir = getDpadDirFromPoint(area, x, y);
	if (!dir) return true;

	press(pointerId, dir, "dpad");
	return true;
}

function updateDpadFromPoint(pointerId: number, x: number, y: number) {
	const binding = pointers.get(pointerId);
	if (!binding || binding.group !== "dpad") return;

	const area = groupAreas.get("dpad");
	if (!area) return;

	if (!pointInEl(area, x, y)) {
		release(pointerId);
		return;
	}

	const dir = getDpadDirFromPoint(area, x, y);
	if (dir) switchAction(pointerId, dir);
}

function makeButton(
	action: Action,
	opts: { group?: PointerBinding["group"] } = {},
): HTMLButtonElement {
	const b = document.createElement("button");
	b.type = "button";

	b.dataset.action = action;
	if (opts.group) b.dataset.group = opts.group;

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
		press(e.pointerId, action, opts.group);
	});

	b.addEventListener("pointermove", (e) => {
		const binding = pointers.get(e.pointerId);
		if (!binding?.group) return;
		e.preventDefault();

		const el = document.elementFromPoint(e.clientX, e.clientY);
		const target = el?.closest?.(
			`button[data-group="${binding.group}"][data-action]`,
		) as HTMLButtonElement | null;

		if (target) {
			const next = target.dataset.action as Action | undefined;
			if (next) switchAction(e.pointerId, next);
			return;
		}

		const area = groupAreas.get(binding.group);
		if (area && pointInEl(area, e.clientX, e.clientY)) return;

		release(e.pointerId);
	});

	const up = (e: PointerEvent) => {
		e.preventDefault();
		release(e.pointerId);
	};

	(["pointerup", "pointercancel", "pointerleave"] as const).forEach(
		(eventName) => {
			b.addEventListener(eventName, up);
		},
	);

	(["touchstart", "touchend", "touchcancel", "touchmove"] as const).forEach(
		(eventName) => {
			b.addEventListener(
				eventName,
				(e) => {
					e.returnValue = false;
					e.preventDefault();
				},
				{ passive: false },
			);
		},
	);

	controller.appendChild(b);
	return b;
}

export function initVirtualGamepad() {
	const isCoarse =
		typeof window !== "undefined" &&
		window.matchMedia("(pointer: coarse)").matches;

	if (!isCoarse) return;

	const dpadArea = document.createElement("div");
	dpadArea.style.cssText = [
		"position: absolute;",
		"left: 2%;",
		"top: 21%;",
		"width: 45.5%;",
		"height: 52%;",
		"pointer-events: auto;",
		"touch-action: none;",
		"border-radius: 40%;",
		DEBUG_TOUCH_CONTROLLER ? "background: rgba(0, 255, 0, 0.10);" : "",
	].join(" ");
	controller.appendChild(dpadArea);
	groupAreas.set("dpad", dpadArea);

	dpadArea.addEventListener("pointerdown", (e) => {
		(dpadArea as HTMLElement).setPointerCapture(e.pointerId);
		e.preventDefault();
		tryStartDpadFromPoint(e.pointerId, e.clientX, e.clientY);
	});

	dpadArea.addEventListener("pointermove", (e) => {
		e.preventDefault();

		updateDpadFromPoint(e.pointerId, e.clientX, e.clientY);

		if (!pointers.has(e.pointerId)) {
			const el = document.elementFromPoint(e.clientX, e.clientY);
			const onButton = !!el?.closest?.("button[data-action]");
			if (!onButton) tryStartDpadFromPoint(e.pointerId, e.clientX, e.clientY);
		}
	});

	(["pointerup", "pointercancel"] as const).forEach((name) => {
		dpadArea.addEventListener(name, (e) => {
			e.preventDefault();
			release(e.pointerId);
		});
	});

	controller.addEventListener("pointermove", (e) => {
		if (pointers.has(e.pointerId)) return;

		const el = document.elementFromPoint(e.clientX, e.clientY);
		const onButton = !!el?.closest?.("button[data-action]");
		if (onButton) return;

		if (tryStartDpadFromPoint(e.pointerId, e.clientX, e.clientY)) {
			dpadArea.setPointerCapture(e.pointerId);
			e.preventDefault();
		}
	});

	const a = makeButton("a");
	a.style.cssText += " right: 3%; top: 38%;";
	const b = makeButton("b");
	b.style.cssText += " right: 17%; top: 54%;";
	const x = makeButton("x");
	x.style.cssText += " right: 17%; top: 22%;";
	const y = makeButton("y");
	y.style.cssText += " right: 31%; top: 38%;";

	const start = makeButton("start");
	start.style.cssText +=
		" right: 34.5%; top: 6%; width: 12%; aspect-ratio: 1 / 1.5; border-radius: 1em;";
	const select = makeButton("select");
	select.style.cssText +=
		" left: 34.5%; top: 6%; width: 12%; aspect-ratio: 1 / 1.5; border-radius: 1em;";

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

	window.addEventListener("blur", releaseAll);
	document.addEventListener("visibilitychange", () => {
		if (document.hidden) releaseAll();
	});
}
