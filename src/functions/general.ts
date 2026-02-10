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

export function easeOutCubic(t: number) {
	return 1 - (1 - t) ** 3;
}
