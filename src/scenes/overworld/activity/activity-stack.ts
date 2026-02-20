// src/scenes/overworld/activity/activity-stack.ts
import type { Activity } from "./activity";

const stack: Activity[] = [];

/**
 * Public readonly list of activities, for debugging purposes. Do not modify directly.
 */
export const _activities = stack as ReadonlyArray<Activity>;

export function getActiveActivity(): Activity | null {
	return stack[stack.length - 1] ?? null;
}

export function pushActivity(a: Activity) {
	stack.push(a);
	a.onEnter?.();
}

export function exitActivity(id: string) {
	const index = stack.findIndex((a) => a.id === id);
	if (index === -1) return;
	const [a] = stack.splice(index, 1);
	a?.onExit?.();
}

export function popActivity() {
	const a = stack.pop();
	if (!a) return;
	a.onExit?.();
}

export function clearActivities() {
	while (stack.length) popActivity();
}

export function updateActivity(dt: number) {
	const a = getActiveActivity();
	a?.beforeUpdate?.(dt);

	if (a?.isDone?.()) popActivity();
}

export function activityCameraTarget() {
	const a = getActiveActivity();
	return a?.getCameraTarget?.() ?? null;
}

export function isActivityRunning(id?: string) {
	if (!id) return stack.length > 0;
	return stack.some((a) => a.id === id);
}
