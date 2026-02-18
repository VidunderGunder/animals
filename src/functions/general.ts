import { TILE_SIZE_PX } from "../config";
import type { Direction } from "../input/input";

export function clamp(x: number, min: number, max: number) {
	return Math.max(min, Math.min(max, x));
}

/**
 * Linear interpolation between a and b by t (0 ≤ t ≤ 1).
 *
 * ---
 *
 * "To Lerp means to move from point `A` to point `B` by an amount `t`,  \
 * where `t` is greater than or equal to zero and less than or equal to one.  \
 * `t` is the portion of the distance between the two points you want to lerp.  \
 *
 * So for example, say I have point `A` at 0,0 and `B` at 5,10, with a `t` of 0.7.  \
 * The result would be 0.35, 0.7 which is 70% of the distance along the linear path from A to B."  \
 *
 * — TwoPaintBubbles, Reddit
 *
 * ---
 *
 * [Video explanation](https://www.youtube.com/watch?v=jvPPXbo87ds&t=140s)
 */
export function lerp(a: number, b: number, t: number) {
	return a + (b - a) * t;
}

/**
 * Reference: https://easings.net/
 *
 * ![image](https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR4Esswdf4HWu-UBGiUCzArG5d_bPE5xf1OvQ&s)
 */
export const ease = {
	linear: (t: number) => t,
	inQuad: (t: number) => t * t,
	outQuad: (t: number) => 1 - (1 - t) ** 2,
	inOutQuad: (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
	inCubic: (t: number) => t ** 3,
	outCubic: (t: number) => 1 - (1 - t) ** 3,
	inOutCubic: (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2),
	inQuart: (t: number) => t ** 4,
	outQuart: (t: number) => 1 - (1 - t) ** 4,
	inOutQuart: (t: number) => (t < 0.5 ? 8 * t ** 4 : 1 - (-2 * t + 2) ** 4 / 2),
	inQuint: (t: number) => t ** 5,
	outQuint: (t: number) => 1 - (1 - t) ** 5,
	inOutQuint: (t: number) =>
		t < 0.5 ? 16 * t ** 5 : 1 - (-2 * t + 2) ** 5 / 2,
	inSine: (t: number) => 1 - Math.cos((t * Math.PI) / 2),
	outSine: (t: number) => Math.sin((t * Math.PI) / 2),
	inOutSine: (t: number) => -(Math.cos(Math.PI * t) - 1) / 2,
	inExpo: (t: number) => (t === 0 ? 0 : 2 ** (10 * t - 10)),
	outExpo: (t: number) => (t === 1 ? 1 : 1 - 2 ** (-10 * t)),
	inOutExpo: (t: number) =>
		t === 0
			? 0
			: t === 1
				? 1
				: t < 0.5
					? 2 ** (20 * t - 10) / 2
					: (2 - 2 ** (-20 * t + 10)) / 2,
	inBack: (t: number) => {
		const c1 = 1.70158;
		const c3 = c1 + 1;
		return c3 * t ** 3 - c1 * t ** 2;
	},
	outBack: (t: number) => {
		const c1 = 1.70158;
		const c3 = c1 + 1;
		return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
	},
	inOutBack: (t: number) => {
		const c1 = 1.70158;
		const c2 = c1 * 1.525;
		return t < 0.5
			? ((2 * t) ** 2 * ((c2 + 1) * 2 * t - c2)) / 2
			: ((2 * t - 2) ** 2 * ((c2 + 1) * (2 * t - 2) + c2) + 2) / 2;
	},
} as const satisfies Record<string, (t: number) => number>;

export function mix(a: number, b: number, alpha: number) {
	return a + (b - a) * alpha;
}

export function pxToTile(px: number) {
	return Math.floor((px + TILE_SIZE_PX / 2) / TILE_SIZE_PX);
}

export function directionToDxDy(direction: Direction): {
	dx: number;
	dy: number;
} {
	switch (direction) {
		case "up":
			return { dx: 0, dy: -1 };
		case "down":
			return { dx: 0, dy: 1 };
		case "left":
			return { dx: -1, dy: 0 };
		case "right":
			return { dx: 1, dy: 0 };
	}
}

export function getCellInDirection({
	direction,
	position,
	distance: d = 1,
}: {
	direction: Direction;
	position?: { x: number; y: number; z: number };
	distance?: number;
}) {
	position ??= { x: 0, y: 0, z: 0 };
	const { x, y, z } = position;
	d ??= 1;

	if (d === 0) return position;
	switch (direction) {
		case "up":
			return { x, y: y - d, z };
		case "down":
			return { x, y: y + d, z };
		case "left":
			return { x: x - d, y, z };
		case "right":
			return { x: x + d, y, z };
	}
}

export function oppositeDirection(direction: Direction): Direction {
	switch (direction) {
		case "up":
			return "down";
		case "down":
			return "up";
		case "left":
			return "right";
		case "right":
			return "left";
	}
}

/**
 * Applies a +/- percentage jitter to a number.
 *
 * For example, `jitter(100, 10)` will return a number between 90 and 110.
 *
 * Defaults to 25% jitter (`percent = 25`).
 */
export function jitter(num: number, percent: number = 25) {
	return num + (Math.random() * 2 - 1) * ((num * percent) / 100);
}
