import { hapticAudio, hapticHack } from "./haptic";
import { type Action, activeTouchActions, type Direction } from "./input";

const DEBUG_TOUCH_CONTROLLER: boolean = import.meta.env.DEV && false;

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

const groups = ["dpad", "abxy"] as const;
type Group = (typeof groups)[number];

const groupActions = {
	dpad: {
		left: "left",
		right: "right",
		up: "up",
		down: "down",
	},
	abxy: {
		left: "y",
		right: "a",
		up: "x",
		down: "b",
	},
} as const satisfies Record<Group, Record<Direction, Action>>;

function isGroup(str: unknown): str is Group {
	if (typeof str !== "string") return false;
	return groups.some((g) => g === str);
}

type PointerBinding = {
	action: Action;
	group?: Group;
};

const pointers = new Map<number, PointerBinding>();

function press(
	pointerId: number,
	action: Action,
	group?: PointerBinding["group"],
) {
	pointers.set(pointerId, { action, group });
	activeTouchActions.add(action);
	hapticAudio();
}

function release(pointerId: number) {
	const binding = pointers.get(pointerId);
	if (!binding) return;
	pointers.delete(pointerId);
	activeTouchActions.delete(binding.action);
}

function releaseAll() {
	for (const [pid] of pointers) release(pid);
}

function switchAction(pointerId: number, newAction: Action) {
	const binding = pointers.get(pointerId);
	if (!binding) return;
	if (binding.action === newAction) return;

	activeTouchActions.delete(binding.action);
	binding.action = newAction;
	activeTouchActions.add(newAction);
	hapticAudio();
}

// biome-ignore lint/style/noNonNullAssertion: <intentional>
const controller = document.getElementById("controller-portrait")!;
if (!controller) throw new Error("Controller element not found");

const groupAreas = new Map<NonNullable<PointerBinding["group"]>, HTMLElement>();

function pointInEl(el: HTMLElement, x: number, y: number): boolean {
	const r = el.getBoundingClientRect();
	return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
}

function getActionFromPoint(
	area: HTMLElement,
	actions: {
		left: Action;
		right: Action;
		up: Action;
		down: Action;
	},
	x: number,
	y: number,
): Action | null {
	const r = area.getBoundingClientRect();
	const cx = r.left + r.width / 2;
	const cy = r.top + r.height / 2;

	const dx = x - cx;
	const dy = y - cy;

	const nx = dx / (r.width / 2);
	const ny = dy / (r.height / 2);
	const mag = Math.hypot(nx, ny);
	if (mag < 0.18) return null;

	if (Math.abs(nx) > Math.abs(ny)) return nx < 0 ? actions.left : actions.right;
	return ny < 0 ? actions.up : actions.down;
}

function tryStartGroupFromPoint(
	group: Group,
	pointerId: number,
	x: number,
	y: number,
): boolean {
	if (pointers.has(pointerId)) return false;

	const area = groupAreas.get(group);
	if (!area) return false;
	if (!pointInEl(area, x, y)) return false;

	const action = getActionFromPoint(area, groupActions[group], x, y);
	if (!action) return true;

	press(pointerId, action, group);
	return true;
}

function updateGroupFromPoint(
	group: Group,
	pointerId: number,
	x: number,
	y: number,
) {
	const binding = pointers.get(pointerId);
	if (!binding || binding.group !== group) return;

	const area = groupAreas.get(group);
	if (!area) return;

	if (!pointInEl(area, x, y)) {
		release(pointerId);
		return;
	}

	const action = getActionFromPoint(area, groupActions[group], x, y);
	if (action) switchAction(pointerId, action);
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

	(
		["onclick", "touchstart", "touchend", "touchcancel", "touchmove"] as const
	).forEach((eventName) => {
		b.addEventListener(
			eventName,
			(e) => {
				e.returnValue = false;
				hapticHack();
				e.preventDefault();
			},
			{ passive: false },
		);
	});

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

	const abxyArea = document.createElement("div");
	abxyArea.style.cssText = [
		"position: absolute;",
		"right: 1.5%;",
		"top: 21%;",
		"width: 45.5%;",
		"height: 52%;",
		"pointer-events: auto;",
		"touch-action: none;",
		"border-radius: 40%;",
		DEBUG_TOUCH_CONTROLLER ? "background: rgba(0, 255, 0, 0.10);" : "",
	].join(" ");
	controller.appendChild(abxyArea);
	groupAreas.set("abxy", abxyArea);

	const areas = {
		dpad: dpadArea,
		abxy: abxyArea,
	} as const satisfies Record<Group, HTMLElement>;

	Object.entries(areas).forEach(([group, area]) => {
		if (!isGroup(group)) return;

		area.addEventListener("pointerdown", (e) => {
			(area as HTMLElement).setPointerCapture(e.pointerId);
			e.preventDefault();
			tryStartGroupFromPoint(group, e.pointerId, e.clientX, e.clientY);
		});

		area.addEventListener("pointermove", (e) => {
			e.preventDefault();

			updateGroupFromPoint(group, e.pointerId, e.clientX, e.clientY);

			if (!pointers.has(e.pointerId)) {
				const el = document.elementFromPoint(e.clientX, e.clientY);
				const onButton = !!el?.closest?.("button[data-action]");
				if (!onButton)
					tryStartGroupFromPoint(group, e.pointerId, e.clientX, e.clientY);
			}
		});

		(["pointerup", "pointercancel"] as const).forEach((name) => {
			area.addEventListener(name, (e) => {
				e.preventDefault();
				release(e.pointerId);
			});
		});

		controller.addEventListener("pointermove", (e) => {
			if (pointers.has(e.pointerId)) return;

			const el = document.elementFromPoint(e.clientX, e.clientY);
			const onButton = !!el?.closest?.("button[data-action]");
			if (onButton) return;

			if (tryStartGroupFromPoint(group, e.pointerId, e.clientX, e.clientY)) {
				area.setPointerCapture(e.pointerId);
				e.preventDefault();
			}
		});
	});

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

// iOS Magnifying Glass prevention hack
function makeDoubleTapHandler<E extends Event>(
	func: ((e: E) => void) | null,
	timeoutMs: number | null,
) {
	let timer: ReturnType<typeof setTimeout> | null = null;
	let pressed = false;

	function clear() {
		timeoutMs = null;
		pressed = false;
		if (timer) {
			clearTimeout(timer);
			timer = null;
		}
	}

	return function handler(this: HTMLElement, e: E) {
		if (timer) clearTimeout(timer);

		if (pressed) {
			func?.call(this, e);
			clear();
		} else {
			pressed = true;
			timer = setTimeout(clear, timeoutMs ?? 500);
		}
	};
}

document.body.addEventListener(
	"touchstart",
	makeDoubleTapHandler<TouchEvent>((e) => e.preventDefault(), 500),
	{ passive: false },
);
