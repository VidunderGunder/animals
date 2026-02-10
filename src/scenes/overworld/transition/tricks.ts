// src/scenes/overworld/transition/tricks.ts
import { animationSheets } from "../../../animations/animations";
import { moveSpeeds, TILE_SIZE_PX } from "../../../config";
import { ease, mix } from "../../../functions/general";
import { type Direction, rotate } from "../../../input/input";
import { getCell, worldBounds } from "../cells";
import type { Entity } from "../entity";
import { getOccupant } from "../occupancy";
import type { Transition } from "./transition";

export function spin(
	entity: Entity,
	direction?: Direction | null,
	rotation: "clockwise" | "counterclockwise" = "clockwise",
): Transition {
	const condition = (entity: Entity) => !entity.isMoving;

	const rounds = entity.moveMode === "run" ? 2 : 1;

	// Slide distance matches your existing intent:
	// - walk: 1 tile
	// - run: 2 tiles
	const distanceTiles = entity.moveMode === "run" ? 4 : 2;

	// If a direction is provided, try slide+spin. If invalid, fall back to spin-in-place.
	if (direction) {
		const canSlide = canSlideInDirection(entity, direction, distanceTiles);

		if (canSlide) {
			const end = getCellInDirection(
				{ x: entity.x, y: entity.y, z: entity.z },
				direction,
				distanceTiles,
			);

			return {
				condition,
				path: getSpinTransitionPath({
					entity,
					rotation,
					rounds,
					direction,
					distanceTiles,
				}),
				end,
			};
		}
	}

	// Spin in place (your current “works exactly as we want” behavior)
	return {
		condition,
		path: getSpinTransitionPath({
			entity,
			rotation,
			rounds,
		}),
		end: { x: entity.x, y: entity.y, z: entity.z },
	};
}

function getSpinTransitionPath({
	entity,
	rotation,
	rounds,
	direction,
	distanceTiles,
}: {
	entity: Entity;
	rotation: "clockwise" | "counterclockwise";
	rounds: number;
	direction?: Direction | null;
	distanceTiles?: number;
}): Transition["path"] {
	// Guardrails
	const safeRounds = Math.max(0, Math.floor(rounds));

	// You rotate once per segment. 4 segments per round = 4 direction changes.
	const steps = safeRounds * 4;
	if (steps === 0) return [];

	const sheet = animationSheets[entity.sheet];

	const animationBase = {
		id: "spin-in-place",
		loop: false,
		frameDuration: Infinity,
	} as const;

	const frameIndex = rotation === "clockwise" ? 4 : 6;

	const start = {
		x: entity.x,
		y: entity.y,
		z: entity.z,
		xPx: entity.xPx,
		yPx: entity.yPx,
	};

	// ------------------------------------------------------------------
	// Timing: overall should be only slightly faster than normal movement
	// ------------------------------------------------------------------
	const hasSlide = !!direction && (distanceTiles ?? 0) > 0;

	// Baseline movement duration for the same displacement:
	// moveDuration = distancePx / entity.speed  (your overworld logic)
	const distancePx = hasSlide ? (distanceTiles ?? 0) * TILE_SIZE_PX : 0;
	const baselineMoveMs = hasSlide
		? distancePx / Math.max(0.0001, entity.speed)
		: 0;

	// We want "combined transition only slightly faster than movement otherwise".
	// This is the *total* spin+slide time when sliding.
	const totalSlideSpinMs = hasSlide ? baselineMoveMs * 0.92 : 0;

	// Per-step decel curve (start fast -> end slow):
	// Build raw step durations, then (if sliding) scale to totalSlideSpinMs.
	const rawMin = 70;
	const rawMax = 120;

	const rawDurations: number[] = [];
	for (let i = 0; i < steps; i++) {
		const t = steps === 1 ? 1 : i / (steps - 1); // 0..1
		const eased = ease.outCubic(t);
		rawDurations.push(rawMin + (rawMax - rawMin) * eased);
	}

	let scale = 1;
	if (hasSlide) {
		const sum = rawDurations.reduce((a, b) => a + b, 0);
		// If totalSlideSpinMs is tiny for some reason, keep it sane.
		const target = Math.max(60, totalSlideSpinMs);
		scale = sum > 0 ? target / sum : 1;
	} else {
		// Keep the old “feel” but loosely responsive to moveMode speed.
		// (Faster moveMode => a bit faster spin)
		const speedFactor = Math.max(
			0.6,
			Math.min(1.2, entity.speed / moveSpeeds.walk),
		);
		scale = 1 / speedFactor;
	}

	// ------------------------------------------------------------------
	// Slide path: ease position (fast early) + ease time (fast early)
	// ------------------------------------------------------------------
	const { dxTile, dyTile } = direction
		? dirToDxDy(direction)
		: { dxTile: 0, dyTile: 0 };

	const totalDxPx = hasSlide ? dxTile * TILE_SIZE_PX * (distanceTiles ?? 0) : 0;
	const totalDyPx = hasSlide ? dyTile * TILE_SIZE_PX * (distanceTiles ?? 0) : 0;

	const path: Transition["path"] = [];

	for (let i = 0; i < steps; i++) {
		const linear = (i + 1) / steps;
		const curve = ease.inOutSine(linear);

		// alpha = 0 => fully linear (most even slide speed)
		// alpha = 1 => full eased (fast start, slow end)
		const alpha = 0.5; // try 0.15–0.35
		const posEase = mix(linear, curve, alpha);

		const xPx = hasSlide ? start.xPx + totalDxPx * posEase : start.xPx;
		const yPx = hasSlide ? start.yPx + totalDyPx * posEase : start.yPx;

		const rawDuration = rawDurations[i] ?? 0;

		path.push({
			z: start.z,
			xPx,
			yPx,
			duration: rawDuration * scale,
			onSegmentStart(e) {
				e.animationFrameIndex = 0;
				e.animationTimer = 0;
				e.direction = rotate(e.direction, rotation);
				e.animationOverride = {
					...animationBase,
					frames: [[{ index: frameIndex, sheet }]],
				};
			},
		});
	}

	// Ensure the very last segment lands *exactly* on the target tile top-left
	// (prevents fractional drift from easing math).
	if (hasSlide) {
		const endXPx = start.xPx + totalDxPx;
		const endYPx = start.yPx + totalDyPx;
		const last = path[path.length - 1];
		if (last) {
			last.xPx = endXPx;
			last.yPx = endYPx;
		}
	}

	return path;
}

function dirToDxDy(direction: Direction): { dxTile: number; dyTile: number } {
	switch (direction) {
		case "up":
			return { dxTile: 0, dyTile: -1 };
		case "down":
			return { dxTile: 0, dyTile: 1 };
		case "left":
			return { dxTile: -1, dyTile: 0 };
		case "right":
			return { dxTile: 1, dyTile: 0 };
	}
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

function canSlideInDirection(
	entity: Entity,
	dir: Direction,
	distanceTiles: number,
): boolean {
	if (distanceTiles <= 0) return false;

	const { dxTile, dyTile } = dirToDxDy(dir);

	for (let step = 1; step <= distanceTiles; step++) {
		const x = entity.x + dxTile * step;
		const y = entity.y + dyTile * step;
		const z = entity.z;

		// bounds
		if (x < 0 || y < 0 || x >= worldBounds.x || y >= worldBounds.y)
			return false;

		// blocked cell
		if (getCell(x, y, z)?.blocked) return false;

		// occupied by other (block both intermediate + end)
		const occ = getOccupant(x, y, z);
		if (occ && occ !== entity.id) return false;
	}

	return true;
}
