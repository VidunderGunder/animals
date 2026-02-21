import { distanceChebyshev } from "../../../functions/general";
import { player } from "../../../game-state";
import { cmd } from "../ai/commands";
import { entities } from "../entity";
import type { Activity } from "./activity";
import { exitActivity, isActivityRunning, pushActivity } from "./activity";

export const activities = {
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
					() => {
						npc.interactionLock = false;
						npc.moveMode = "walk";
					},
					cmd.goToTile({ x: 32, y: 52 + i, z: 0 }),
					cmd.face("left"),
					{
						onUpdate() {
							const playerOutOfRange =
								distanceChebyshev(player, { x: 30, y: 49 }) > 10;

							if (playerOutOfRange) exitActivity("startObstacleCourse");
							if (!isActivityRunning("startObstacleCourse")) {
								return true;
							}

							return false;
						},
					},
				]);
			}
		},
		onExit() {
			const npcIds = ["fox-1", "npc-1"];
			for (const id of npcIds) {
				const npc = entities.get(id);
				if (!npc) continue;
				npc.interactionLock = false;
				npc.brain?.runner.clear();
			}
		},
	},
} as const satisfies Record<string, Activity>;

export type ActivityID = keyof typeof activities;

export function toggleActivity(id: ActivityID) {
	if (isActivityRunning(id)) {
		exitActivity(id);
		return;
	}

	pushActivity(activities[id]);
}
