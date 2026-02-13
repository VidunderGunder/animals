// src/scenes/overworld/transition/tricks.ts
import { animationSheets, animations } from "../../../animations/animations";
import { emptyImage } from "../../../assets/image";
import { audio } from "../../../audio/audio-engine";
import { moveSpeeds, TILE_SIZE_PX } from "../../../config";
import { ease, mix } from "../../../functions/general";
import { type Direction, rotate } from "../../../input/input";
import { getCell, getEdge, worldBounds } from "../cells";
import type { Entity } from "../entity";
import { getOccupant } from "../occupancy";
import type { Transition, TransitionPathSegment } from "./transition";

function crashPath(args: {
	xPx: number;
	yPx: number;
	z: number;
	direction: Direction;
}): Transition["path"] {
	const { xPx, yPx, z, direction } = args;

	const { x: dx, y: dy } = getCellInDirection({ direction });

	const isHorizontal = direction === "left" || direction === "right";

	const onFirstSegmentStart = (entity: Entity) => {
		audio.playSfx("thud", {
			volume: 0.625,
		});
		entity.animationFrameIndex = 0;
		entity.animationTimer = 0;
		entity.direction = direction;
		entity.animationOverride = isHorizontal ? "jump" : "jump";
		entity.direction = direction;
	};

	return [
		...((isHorizontal
			? [
					{
						onSegmentStart: onFirstSegmentStart,
						xPx: xPx + dx * 4,
						yPx,
						z,
						duration: (e) => (e.moveMode === "walk" ? 40 : 30),
					},
					{
						xPx: xPx + dx * 2,
						yPx: yPx - 8,
						z,
						duration: (e) => (e.moveMode === "walk" ? 60 : 40),
					},
				]
			: [
					{
						onSegmentStart: onFirstSegmentStart,
						xPx,
						yPx: yPx - Math.abs(dy * 4),
						z,
						duration: (e) => (e.moveMode === "walk" ? 40 : 30),
					},
					{
						xPx,
						yPx: yPx - Math.abs(dy * 6),
						z,
						duration: (e) => (e.moveMode === "walk" ? 60 : 40),
					},
				]) satisfies Transition["path"]),
		{
			xPx,
			yPx,
			z,
			duration: 100,
			onSegmentEnd() {
				audio.playSfx("thud", {
					volume: 0.075,
				});
			},
		},
		{
			xPx,
			yPx,
			z,
			duration: 3 * 2 * 80,
			onSegmentStart: (entity: Entity) => {
				entity.animationCurrentId = "idle";
				entity.animationFrameIndex = 0;
				entity.animationTimer = 0;
				entity.direction = direction;
				entity.animationOverride = {
					id: "crash",
					frameDuration: 80,
					loop: true,
					frames: [
						[
							{
								...animations[entity.sheet].idle.frames[0]?.[0],
								sheet: emptyImage,
							},
						],
						animations[entity.sheet].idle.frames[0],
					],
				};
			},
			onSegmentEnd: (entity: Entity) => {
				entity.animationTimer = 0;
				entity.animationFrameIndex = 0;
				entity.animationCurrentId = "idle";
				entity.animationOverride = null;
			},
		},
	];
}

function playSwoosh() {
	audio.playSfx("jump", {
		volume: 0.05,
	});
	audio.playSfx("swoosh", {
		volume: 0.4,
	});
}

export function spin(
	entity: Entity,
	direction?: Direction | null,
	rotation: "clockwise" | "counterclockwise" = "clockwise",
): Transition {
	const condition = (entity: Entity) => !entity.isMoving;

	const rounds = entity.moveMode === "run" ? 2 : 1;

	const distanceTiles = entity.moveMode === "run" ? 4 : 2;

	if (!direction) {
		playSwoosh();
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

	const crashAtTile = getCrashDistanceInDirection(
		entity,
		direction,
		distanceTiles,
	);

	if (crashAtTile === undefined || crashAtTile > 1) playSwoosh();

	const fullPath = getSpinTransitionPath({
		entity,
		rotation,
		rounds,
		direction,
		distanceTiles,
	});

	if (crashAtTile === undefined) {
		const end = getCellInDirection({
			position: { x: entity.x, y: entity.y, z: entity.z },
			direction,
			distance: distanceTiles,
		});

		return { condition, path: fullPath, end };
	}

	const lastOkTiles = Math.max(0, crashAtTile - 1);

	const end = getCellInDirection({
		position: { x: entity.x, y: entity.y, z: entity.z },
		direction,
		distance: lastOkTiles,
	});

	const { dxTile, dyTile } = dirToDxDy(direction);
	const crashXPx = entity.xPx + dxTile * TILE_SIZE_PX * lastOkTiles;
	const crashYPx = entity.yPx + dyTile * TILE_SIZE_PX * lastOkTiles;

	const crashedPath = truncatePathAtCrash({
		path: fullPath,
		direction,
		crashXPx,
		crashYPx,
	});

	crashedPath.push(
		...crashPath({
			xPx: crashXPx,
			yPx: crashYPx,
			z: entity.z,
			direction,
		}),
	);

	return {
		condition,
		path: crashedPath,
		end,
	};
}

function truncatePathAtCrash(args: {
	path: Transition["path"];
	direction: Direction;
	crashXPx: number;
	crashYPx: number;
}): Transition["path"] {
	const { path, direction, crashXPx, crashYPx } = args;

	if (path.length === 0) return [];

	const { dxTile, dyTile } = dirToDxDy(direction);

	const isPastCrash = (seg: TransitionPathSegment) => {
		if (typeof seg.xPx !== "number" || typeof seg.yPx !== "number") {
			throw new Error("Expected numeric xPx/yPx in transition path segment");
		}
		if (dxTile > 0) return seg.xPx >= crashXPx;
		if (dxTile < 0) return seg.xPx <= crashXPx;
		if (dyTile > 0) return seg.yPx >= crashYPx;
		if (dyTile < 0) return seg.yPx <= crashYPx;
		return true;
	};

	const out: Transition["path"] = [];

	for (let i = 0; i < path.length; i++) {
		const _seg = path[i];
		if (typeof _seg?.xPx !== "number" || typeof _seg?.yPx !== "number") {
			throw new Error("Expected numeric xPx/yPx in transition path segment");
		}
		const seg = { ..._seg };

		if (isPastCrash(seg)) {
			seg.xPx = crashXPx;
			seg.yPx = crashYPx;
			out.push(seg);
			break;
		}

		out.push(seg);
	}

	if (out.length > 0) {
		const last = out[out.length - 1];
		if (!last) {
			throw new Error("Expected at least one segment in truncated path");
		}
		last.xPx = crashXPx;
		last.yPx = crashYPx;
	}

	return out;
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
	const safeRounds = Math.max(0, Math.floor(rounds));
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

	const hasSlide = !!direction && (distanceTiles ?? 0) > 0;

	const distancePx = hasSlide ? (distanceTiles ?? 0) * TILE_SIZE_PX : 0;
	const baselineMoveMs = hasSlide
		? distancePx / Math.max(0.0001, entity.speed)
		: 0;

	const totalSlideSpinMs = hasSlide ? baselineMoveMs * 0.92 : 0;

	const rawMin = 70;
	const rawMax = 120;

	const rawDurations: number[] = [];
	for (let i = 0; i < steps; i++) {
		const t = steps === 1 ? 1 : i / (steps - 1);
		const eased = ease.outCubic(t);
		rawDurations.push(rawMin + (rawMax - rawMin) * eased);
	}

	let scale = 1;
	if (hasSlide) {
		const sum = rawDurations.reduce((a, b) => a + b, 0);
		const target = Math.max(60, totalSlideSpinMs);
		scale = sum > 0 ? target / sum : 1;
	} else {
		const speedFactor = Math.max(
			0.6,
			Math.min(1.2, entity.speed / moveSpeeds.walk),
		);
		scale = 1 / speedFactor;
	}

	const { dxTile, dyTile } = direction
		? dirToDxDy(direction)
		: { dxTile: 0, dyTile: 0 };

	const totalDxPx = hasSlide ? dxTile * TILE_SIZE_PX * (distanceTiles ?? 0) : 0;
	const totalDyPx = hasSlide ? dyTile * TILE_SIZE_PX * (distanceTiles ?? 0) : 0;

	const path: Transition["path"] = [];

	for (let i = 0; i < steps; i++) {
		const linear = (i + 1) / steps;
		const curve = ease.inOutSine(linear);

		const alpha = 0.5;
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

function getCellInDirection({
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

function getCrashDistanceInDirection(
	entity: Entity,
	direction: Direction,
	distance: number,
): number | undefined {
	if (distance <= 0) return undefined;

	const { x: dx, y: dy } = getCellInDirection({ direction });

	for (let tile = 0; tile <= distance; tile++) {
		const x = entity.x + dx * tile;
		const y = entity.y + dy * tile;
		const z = entity.z;

		if (x < 0 || y < 0 || x >= worldBounds.x || y >= worldBounds.y) {
			return tile;
		}

		if (getCell(x, y, z)?.blocked) {
			return tile;
		}

		const occ = getOccupant(x, y, z);
		if (occ && occ !== entity.id) {
			return tile;
		}

		if (tile === distance) break;
		const edge = getEdge(x, y, z, direction);
		if (edge?.blocked) {
			return tile + 1;
		}
		if (edge?.transition) {
			return tile + 1;
		}
	}

	return undefined;
}
