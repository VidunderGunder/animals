// src/scenes/overworld/ai/brain-registry.ts

import type { Entity } from "../entities";
import { type Brain, CommandRunner } from "./brain";
import { cmd } from "./commands";

const routeLoop = (): Brain => ({
	runner: new CommandRunner(),
	routine(entity) {
		if (!entity.brain?.runner.isIdle()) return;

		const route = [
			{ x: 26, y: 44, z: 0, moveMode: "walk" },
			{ x: 26, y: 46, z: 0, moveMode: "walk" },
			{ x: 30, y: 46, z: 0, moveMode: "walk" },
			{ x: 35, y: 49, z: 1, moveMode: "walk" },
			{ x: 30, y: 49, z: 1, moveMode: "run" },
			{ x: 26, y: 50, z: 0, moveMode: "run" },
			{ x: 26, y: 55, z: 0, moveMode: "run" },
			{ x: 30, y: 55, z: 0, moveMode: "run" },
			{ x: 30, y: 44, z: 0, moveMode: "walk" },
		] as const;

		// Persistent cursor = "current target index"
		entity.brainState ??= {};
		const s = entity.brainState;
		let i = (typeof s.routeIndex === "number" ? s.routeIndex : 0) | 0;
		if (i < 0 || i >= route.length) i = 0;

		// If we're already at the current target (eg. saved right after arrival),
		// advance immediately so we don't re-run the same tile.
		const cur = route[i];
		if (!cur) {
			throw new Error(`Invalid brain route index ${i}`);
		}
		if (entity.x === cur.x && entity.y === cur.y && entity.z === cur.z) {
			i = (i + 1) % route.length;
			s.routeIndex = i;
		} else {
			s.routeIndex = i;
		}

		if (typeof s.routeIndex !== "number") {
			throw new Error(`Invalid brain state routeIndex ${s.routeIndex}`);
		}

		const target = route[s.routeIndex];
		if (!target) {
			throw new Error(`Invalid brain route index ${s.routeIndex}`);
		}
		// Enqueue ONE leg:
		// 1) ensure moveMode
		// 2) goToTile (this is the "current command" you don't want to skip)
		// 3) advance cursor AFTER arrival
		entity.brain.runner.push({
			onTick({ entity }) {
				if (entity.moveMode !== target.moveMode)
					entity.moveMode = target.moveMode;
				return true;
			},
		});

		entity.brain.runner.push(
			cmd.goToTile(target, { stopAdjacentIfTargetBlocked: true }),
		);

		entity.brain.runner.push({
			onTick() {
				entity.brainState ??= {};
				const s2 = entity.brainState;
				const i2 = (typeof s2.routeIndex === "number" ? s2.routeIndex : 0) | 0;
				s2.routeIndex = (i2 + 1) % route.length;
				return true;
			},
		});
	},
});

const wanderAround = (origin: { x: number; y: number }): Brain => ({
	runner: new CommandRunner(),
	routine(entity) {
		if (!entity.brain?.runner.isIdle()) return;

		const randomOffset = () => Math.floor(Math.random() * 3) - 1;
		const pause = Math.floor(Math.random() * 2000) + 1000;

		entity.brain.runner.push(cmd.wait(pause));

		entity.brain.runner.push(
			cmd.goToTile(
				{
					x: origin.x + randomOffset(),
					y: origin.y + randomOffset(),
					z: 0,
				},
				{ stopAdjacentIfTargetBlocked: true },
			),
		);
	},
});

/**
 * Registry keys are your shared/archetype ids.
 * Only assign entity.brainId when you actually want a brain.
 */
const brainFactories: Record<string, () => Brain> = {
	"brain:route-loop": routeLoop,
	"brain:wander:kitsune": () => wanderAround({ x: 33, y: 43 }),
	"brain:wander:turtle": () => wanderAround({ x: 27, y: 42 }),
} as const;

export function attachBrainFromId(entity: Entity) {
	const id = entity.brainId ?? null;
	if (!id) {
		entity.brain = null;
		return;
	}

	const factory = brainFactories[id];
	if (!factory) {
		entity.brain = null;
		return;
	}

	entity.brain = factory();
}

export function rehydrateBrains(entities: Map<string, Entity>) {
	for (const e of entities.values()) attachBrainFromId(e);
}
