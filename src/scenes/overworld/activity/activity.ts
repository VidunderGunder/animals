// src/scenes/overworld/activity/activity.ts
import type { Action, Direction } from "../../../input/input";
import type { Vec2Px } from "../../../types";

export type InputDecision =
	| { kind: "pass" } // let normal overworld handle it
	| { kind: "consume" } // swallow it (disable controls)
	| {
			kind: "override";
			movementIntent: Direction | null;
			actions: ReadonlySet<Action>;
	  }; // full remap

export type Activity = {
	id: string;
	stackable?: boolean;

	onEnter?: () => void;
	onExit?: () => void;
	onUpdate?: (dt: number) => void;
	onDraw?: () => void;

	getCameraTarget?: () => Vec2Px | null;

	isDone?: () => boolean;
};

/**
 * DO NOT directly mutate this array. Use the methods located in the same file.
 */
export const activityStack: Activity[] = [];

export function getLatestActivity(): Activity | null {
	return activityStack[activityStack.length - 1] ?? null;
}

export function pushActivity(a: Activity) {
	if (!a.stackable && isActivityRunning()) {
		if (import.meta.env.DEV) {
			console.warn(
				`Attempted to start activity ${a.id} while another activity is active. This activity is not stackable, so the request was ignored.`,
			);
		}
		return;
	}
	activityStack.push(a);
	a.onEnter?.();
}

export function exitActivity(id: string) {
	const index = activityStack.findIndex((a) => a.id === id);
	if (index === -1) return;
	const [a] = activityStack.splice(index, 1);
	a?.onExit?.();
}

export function popActivity() {
	const a = activityStack.pop();
	if (!a) return;
	a.onExit?.();
}

export function clearActivities() {
	while (activityStack.length) popActivity();
}

export function updateActivity(dt: number) {
	const a = getLatestActivity();
	a?.onUpdate?.(dt);

	if (a?.isDone?.()) popActivity();
}

export function activityCameraTarget() {
	const a = getLatestActivity();
	return a?.getCameraTarget?.() ?? null;
}

export function isActivityRunning(id?: string) {
	if (!id) return activityStack.length > 0;
	return activityStack.some((a) => a.id === id);
}
