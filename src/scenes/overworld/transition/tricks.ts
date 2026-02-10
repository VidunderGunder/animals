import { animationSheets } from "../../../animations/animations";
import { moveSpeeds } from "../../../config";
import { easeOutCubic } from "../../../functions/general";
import { type Direction, rotate } from "../../../input/input";
import type { Entity } from "../entity";
import type { Transition } from "./transition";

export function spin(
	entity: Entity,
	direction?: Direction | null,
	rotation: "clockwise" | "counterclockwise" = "clockwise",
): Transition {
	const condition = (entity: Entity) => !entity.isMoving;

	if (direction) {
		const end = getCellInDirection(
			{ x: entity.x, y: entity.y, z: entity.z },
			direction,
			entity.moveMode === "run" ? 2 : 1,
		);

		return {
			condition,
			path: getSpinTransitionPath({
				entity,
				rotation,
				rounds: entity.moveMode === "run" ? 2 : 1,
				direction,
			}),
			end,
		};
	}

	return {
		condition,
		path: getSpinTransitionPath({
			entity,
			rotation,
			rounds: entity.moveMode === "run" ? 2 : 1,
		}),
		end: { x: entity.x, y: entity.y, z: entity.z },
	};
}

function getSpinTransitionPath({
	entity,
	rotation,
	rounds,
	speed,
	direction,
}: {
	entity: Entity;
	rotation: "clockwise" | "counterclockwise";
	rounds: number;
	speed?: number;
	direction?: Direction | null;
}): Transition["path"] {
	// Guardrails
	const safeRounds = Math.max(0, Math.floor(rounds));
	const s = Math.max(0.05, speed ?? 1); // avoid divide-by-zero / negative

	const position = {
		x: entity.x,
		y: entity.y,
		z: entity.z,
		xPx: entity.xPx,
		yPx: entity.yPx,
	};

	const sheet = animationSheets[entity.sheet];

	const animationBase = {
		id: "spin-in-place",
		loop: false,
		frameDuration: Infinity,
	} as const;

	// You rotate once per segment. 4 segments per round = 4 direction changes.
	const steps = safeRounds * 4;
	if (steps === 0) return [];

	// Base timings chosen to match your hardcoded feel (at speed=1):
	// roughly 50, 70, 100, 150 for one "round" (4 steps).
	const minMs = 35 / s;
	const maxMs = 115 / s;

	const frameIndex = rotation === "clockwise" ? 4 : 6;

	const path: Transition["path"] = [];
	for (let i = 0; i < steps; i++) {
		const t = steps === 1 ? 1 : i / (steps - 1); // 0..1
		const eased = easeOutCubic(t);
		const duration = minMs + (maxMs - minMs) * eased;

		path.push({
			...position,
			duration,
			onSegmentStart(e) {
				e.direction = rotate(e.direction, rotation);
				e.animationOverride = {
					...animationBase,
					frames: [[{ index: frameIndex, sheet }]],
				};
			},
		});
	}

	return path;
}

function getCellInDirection(
	pos: { x: number; y: number; z: number },
	direction: Direction,
	distance: number = 1,
) {
	if (distance === 0) return pos;
	switch (direction) {
		case "up":
			return { x: pos.x, y: pos.y - distance, z: pos.z };
		case "down":
			return { x: pos.x, y: pos.y + distance, z: pos.z };
		case "left":
			return { x: pos.x - distance, y: pos.y, z: pos.z };
		case "right":
			return { x: pos.x + distance, y: pos.y, z: pos.z };
	}
}
