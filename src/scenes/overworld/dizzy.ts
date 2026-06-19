// src/scenes/overworld/dizzy.ts
import { layerFactory } from "../../animation/animation";
import { effects } from "../../animation/effect";
import { audio } from "../../audio/audio-engine";
import { gameState } from "../../game-state";
import { ctx } from "../../gfx/canvas";
import { type Entity, entities, getEntityItemDefaults } from "./entity";
import { clearTrickLog, currentTrickRepeat } from "./trick-log";

/** Repeating the same trick this many times in a row makes you dizzy. */
const DIZZY_TRICK_REPEATS = 4;
const DIZZY_DURATION_MS = 3200;

const ORBIT_RADIUS_X_PX = 7;
const ORBIT_RADIUS_Y_PX = 2.5;
const ORBIT_MS_PER_ROUND = 1100;
const HEAD_OFFSET_PX = 13;

type Dizzy = {
	untilMs: number;
	butterflyId: string;
	angle: number;
	turnAccMs: number;
	/** Visual y-offset consumed by the butterfly's render hook */
	yOffsetPx: number;
};

const dizzyStates = new Map<string, Dizzy>();

export function isDizzy(entity: Entity): boolean {
	return dizzyStates.has(entity.id);
}

/**
 * Dizziness rule: reading the trick log, if the most recent run of the same
 * trick (same direction etc) is long enough, the entity gets dizzy.
 * Call right after a trick is logged.
 */
export function checkDizziness(entity: Entity): void {
	if (dizzyStates.has(entity.id)) return;

	const repeat = currentTrickRepeat(entity);

	if (repeat && repeat.count >= DIZZY_TRICK_REPEATS) {
		makeDizzy(entity);
		clearTrickLog(entity); // consumed — don't immediately re-trigger
	}
}

const butterflyColors = ["white", "pink", "blue"] as const;

export function makeDizzy(entity: Entity): void {
	if (dizzyStates.has(entity.id)) return;

	const color =
		butterflyColors[Math.floor(Math.random() * butterflyColors.length)] ??
		"white";
	const { sheet, frames, w, h } = effects[`butterfly-${color}`];

	const butterflyId = `dizzy-butterfly-${entity.id}`;

	const state: Dizzy = {
		untilMs: gameState.ms + DIZZY_DURATION_MS,
		butterflyId,
		angle: Math.PI / 2,
		turnAccMs: 0,
		yOffsetPx: HEAD_OFFSET_PX,
	};

	const layer = layerFactory(sheet, { w, h });

	entities.set(butterflyId, {
		...getEntityItemDefaults({ id: butterflyId, x: entity.x, y: entity.y }),
		z: entity.z,
		variant: "effect",
		solid: false,
		radius: 0,
		width: w,
		height: h,
		renderPriority: entity.renderPriority + 1,
		animationOverride: {
			id: butterflyId,
			loop: true,
			frameDuration: 60,
			frames: Array.from({ length: frames }, (_, i) => [
				layer({
					index: i,
					// Hover at head height without changing yPx (which would
					// change the row the butterfly is depth-sorted into).
					onBeforeRender: () => ctx.translate(0, -state.yOffsetPx),
				}),
			]),
		},
	});

	dizzyStates.set(entity.id, state);

	void audio.playSfx("dizzy", {
		volume: 0.2,
	});
}

export function updateDizzy(dt: number): void {
	for (const [hostId, state] of dizzyStates) {
		const host = entities.get(hostId);
		const butterfly = entities.get(state.butterflyId);

		if (!host || gameState.ms >= state.untilMs) {
			if (butterfly) entities.delete(state.butterflyId);
			dizzyStates.delete(hostId);
			continue;
		}

		if (!butterfly) continue;

		state.angle += (dt / ORBIT_MS_PER_ROUND) * Math.PI * 2;

		const dx = Math.cos(state.angle) * ORBIT_RADIUS_X_PX;
		const dy = Math.sin(state.angle) * ORBIT_RADIUS_Y_PX;

		butterfly.x = host.x;
		butterfly.y = host.y;
		butterfly.z = host.z;
		butterfly.xPx = Math.round(host.xPx + dx);
		// Same yPx as the host so both depth-sort into the same row; the
		// visual hover offset is applied by the render hook instead.
		butterfly.yPx = host.yPx;
		state.yOffsetPx = Math.round(HEAD_OFFSET_PX - dy);

		// In front of the face on the near side of the orbit, behind the
		// head on the far side.
		butterfly.renderPriority =
			Math.sin(state.angle) >= 0
				? host.renderPriority + 1
				: host.renderPriority - 1;
	}
}
