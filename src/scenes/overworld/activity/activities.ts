import { gameState, player } from "../../../game-state";
import type { Direction } from "../../../input/input";
import { cmd } from "../ai/commands";
import { bubble } from "../dialog";
import { entities } from "../entity";
import type { Activity } from "./activity";
import {
	exitActivity,
	isActivityRunning,
	pushActivity,
} from "./activity-stack";

let elapsed = 0;
let hasStarted = false;
let previousDirection: Direction | null = null;

export const activities = {
	welcomeBack: {
		id: "welcomeBack",
		onEnter() {
			/* maybe face npc, start bubble */
			gameState.disabled = true;
		},
		beforeUpdate(dt) {
			elapsed += dt;

			if (elapsed < 500) return;

			if (!hasStarted) {
				previousDirection = player.direction;
				if (player.direction !== "down") player.direction = "down";
				bubble("start_cutscene", "Welcome back!");
				hasStarted = true;
			}
		},
		isDone() {
			return elapsed > 2000;
		},
		onExit() {
			elapsed = 0;
			gameState.disabled = false;
			if (previousDirection) player.direction = previousDirection;
		},
	},
	startObstacleCourse: {
		id: "startObstacleCourse",
		onEnter() {
			const npcIds = ["fox-1", "npc-1"];
			for (let i = 0; i < npcIds.length; i++) {
				const id = npcIds[i];
				if (!id) continue;
				const npc = entities.get(id);

				if (!npc) {
					console.warn(
						`Could not find NPC with id ${id} for startObstacleCourse activity.`,
					);
					continue;
				}

				npc.brain?.runner.interrupt([
					cmd.waitUntilStopped(),
					cmd.goToTile({ x: 32, y: 52 + i, z: 0 }),
					cmd.face("left"),
					() => {
						npc.interactionLock = false;
					},
					{
						onTick() {
							if (!isActivityRunning("startObstacleCourse")) {
								return true;
							}

							return false;
						},
					},
				]);
			}
		},
	},
} as const satisfies Record<string, Activity>;

type ActivityID = keyof typeof activities;

export function toggleActivity(id: ActivityID) {
	console.log("AA");

	if (isActivityRunning(id)) {
		exitActivity(id);
		return;
	}

	pushActivity(activities[id]);
}
