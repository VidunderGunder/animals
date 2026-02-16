// src/scenes/overworld/transition/tricks.ts
import { animationSheets, animations } from "../../../animations/animations";
import { emptyImage } from "../../../assets/image";
import { audio } from "../../../audio/audio-engine";
import { moveSpeeds, TILE_SIZE_PX } from "../../../config";
import { ease, mix } from "../../../functions/general";
import { type Direction, rotate } from "../../../input/input";
import { getCell, getEdge, worldBounds } from "../cells";
import { type Entity, entities } from "../entity";
import { getOccupant, occupy, vacate } from "../occupancy";
import { setCurrentSegment, type Transition } from "./transition";

function crashPath(args: {
	xPx: number;
	yPx: number;
	z: number;
	direction: Direction;
}): Transition["path"] {
	const { xPx, yPx, z, direction } = args;

	const { dx, dy } = dirToDxDy(direction);

	const isHorizontal = direction === "left" || direction === "right";

	const onFirstSegmentStart = (entity: Entity) => {
		entity.interactionLock = true;
		audio.playSfx("thud", { volume: 0.625 });
		entity.animationFrameIndex = 0;
		entity.animationTimer = 0;
		entity.direction = direction;
		entity.animationOverride = "jump";
	};

	// small pixel nudges for the "bonk" feel
	const bump1 = 4;
	const bump2 = 2;

	const dx1 = dx * bump1;
	const dx2 = dx * bump2;
	const dy1 = dy * bump1;
	const dy2 = dy * bump2;

	return [
		...(isHorizontal
			? ([
					{
						onSegmentStart: onFirstSegmentStart,
						xPx: xPx + dx1,
						yPx,
						z,
						duration: (e) => (e.moveMode === "walk" ? 40 : 30),
					},
					{
						xPx: xPx + dx2,
						yPx: yPx - 8,
						z,
						duration: (e) => (e.moveMode === "walk" ? 60 : 40),
					},
				] satisfies Transition["path"])
			: ([
					{
						onSegmentStart: onFirstSegmentStart,
						xPx,
						yPx: yPx + dy1,
						z,
						duration: (e) => (e.moveMode === "walk" ? 40 : 30),
					},
					{
						xPx,
						yPx: yPx + dy2 - 8,
						z,
						duration: (e) => (e.moveMode === "walk" ? 60 : 40),
					},
				] satisfies Transition["path"])),
		{
			xPx,
			yPx,
			z,
			duration: 100,
			onSegmentEnd() {
				audio.playSfx("thud", { volume: 0.075 });
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
				entity.interactionLock = false;
			},
		},
	];
}

function injectPlayOnceOnFirstSegmentStart(
	path: Transition["path"],
	play: (e: Entity) => void,
) {
	if (path.length === 0) return;

	let played = false;
	const first = path[0];
	if (!first) return;

	const prev = first.onSegmentStart;

	first.onSegmentStart = (e) => {
		if (!played) {
			played = true;
			play(e);
		}
		prev?.(e);
	};
}

function spinSFX() {
	audio.playSfx("jump", {
		volume: 0.075,
		playbackRate: 0.5,
	});
	audio.playSfx("swoosh", {
		volume: 0.15,
	});
}

export function spin(
	entity: Entity,
	direction?: Direction | null,
	rotation: "clockwise" | "counterclockwise" = "clockwise",
): Transition {
	const condition = (entity: Entity) => !entity.isMoving;

	const rounds = entity.moveMode === "run" ? 2 : 1;
	const distance = entity.moveMode === "run" ? 4 : 2;

	// build the path first (no side effects)
	const path = getSpinTransitionPath({
		entity,
		rotation,
		rounds,
		direction: direction ?? null,
		distance: direction ? distance : undefined,
	});

	// SFX only if/when the transition actually starts
	injectPlayOnceOnFirstSegmentStart(path, () => spinSFX());

	// Keep end purely as “intended end” (collisions may override mid-path)
	const end = direction
		? getCellInDirection({
				position: { x: entity.x, y: entity.y, z: entity.z },
				direction,
				distance,
			})
		: { x: entity.x, y: entity.y, z: entity.z };

	return { condition, path, end };
}

function triggerCrashForEntity(args: {
	entity: Entity;
	crashTile: { x: number; y: number; z: number };
	crashDir: Direction;
}) {
	const { entity, crashTile, crashDir } = args;

	if (entity.interactionLock) return;

	entity.interactionLock = true;

	const { xPx: crashXPx, yPx: crashYPx } = crashAnchorPx(entity, crashTile);

	if (entity.isMoving) {
		vacate({ id: entity.id });
		occupy({ ...crashTile, id: entity.id });
		entity.transitionEndTile = { ...crashTile };

		entity.xPxf = crashXPx;
		entity.yPxf = crashYPx;
		entity.zf = crashTile.z;
		entity.transitionPathSegmentDuration = 0;
		entity.transitionPathSegmentProgress = 0;

		const curSeg = entity.transitionPath[0];
		if (curSeg) {
			curSeg.xPx = crashXPx;
			curSeg.yPx = crashYPx;
			curSeg.z = crashTile.z;
			curSeg.duration = 0;
			curSeg.onSegmentStart = undefined;
			curSeg.onSegment = undefined;
		}

		entity.transitionPath.splice(
			1,
			entity.transitionPath.length,
			...crashPath({
				xPx: crashXPx,
				yPx: crashYPx,
				z: crashTile.z,
				direction: crashDir,
			}),
		);

		return;
	}

	entity.isMoving = true;
	entity.transitionEndTile = { ...crashTile };
	entity.animationOverride = null;

	entity.transitionPath = crashPath({
		xPx: crashXPx,
		yPx: crashYPx,
		z: crashTile.z,
		direction: crashDir,
	}).map((p) => ({ ...p }));

	setCurrentSegment(entity);
}

function checkTileStepAllowed(args: {
	entity: Entity;
	from: { x: number; y: number; z: number };
	to: { x: number; y: number; z: number };
	dir: Direction;
}): { ok: true } | { ok: false; collided?: Entity } {
	const { entity, from, to, dir } = args;

	if (to.x < 0 || to.y < 0 || to.x >= worldBounds.x || to.y >= worldBounds.y) {
		return { ok: false };
	}

	const edge = getEdge(from.x, from.y, from.z, dir);
	if (edge?.blocked) return { ok: false };
	if (edge?.transition) return { ok: false };

	if (getCell(to.x, to.y, to.z)?.blocked) return { ok: false };

	const occId = getOccupant(to.x, to.y, to.z);
	if (occId && occId !== entity.id) {
		return { ok: false, collided: entities.get(occId) };
	}

	return { ok: true };
}

function pxToTile(px: number) {
	return Math.floor((px + TILE_SIZE_PX / 2) / TILE_SIZE_PX);
}

function getSpinTransitionPath({
	entity,
	rotation,
	rounds,
	direction,
	distance,
}: {
	entity: Entity;
	rotation: "clockwise" | "counterclockwise";
	rounds: number;
	direction?: Direction | null;
	distance?: number;
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

	const slideDir = direction ?? null;
	const hasSlide = !!slideDir && (distance ?? 0) > 0;

	const distancePx = hasSlide ? (distance ?? 0) * TILE_SIZE_PX : 0;
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

	const { dx, dy } = slideDir ? dirToDxDy(slideDir) : { dx: 0, dy: 0 };

	const totalDxPx = hasSlide ? dx * TILE_SIZE_PX * (distance ?? 0) : 0;
	const totalDyPx = hasSlide ? dy * TILE_SIZE_PX * (distance ?? 0) : 0;

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
				if (slideDir) {
					const from = {
						x: pxToTile(e.xPx),
						y: pxToTile(e.yPx),
						z: e.z,
					};
					const to = {
						x: pxToTile(xPx),
						y: pxToTile(yPx),
						z: e.z,
					};

					if (from.x !== to.x || from.y !== to.y) {
						const res = checkTileStepAllowed({
							entity: e,
							from,
							to,
							dir: slideDir,
						});

						if (!res.ok) {
							crashBothOnCollision({
								collider: e,
								collided: res.collided,
								slideDir,
							});
							return;
						}
					}
				}

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

function dirToDxDy(direction: Direction): { dx: number; dy: number } {
	switch (direction) {
		case "up":
			return { dx: 0, dy: -1 };
		case "down":
			return { dx: 0, dy: 1 };
		case "left":
			return { dx: -1, dy: 0 };
		case "right":
			return { dx: 1, dy: 0 };
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

function oppositeDir(direction: Direction): Direction {
	switch (direction) {
		case "up":
			return "down";
		case "down":
			return "up";
		case "left":
			return "right";
		case "right":
			return "left";
	}
}

function crashBothOnCollision(args: {
	collider: Entity;
	collided?: Entity;
	slideDir: Direction;
}) {
	const { collider, collided, slideDir } = args;

	const colliderTile = {
		x: pxToTile(collider.xPx),
		y: pxToTile(collider.yPx),
		z: collider.z,
	};

	triggerCrashForEntity({
		entity: collider,
		crashTile: colliderTile,
		crashDir: slideDir,
	});

	if (!collided) return;
	if (collided.interactionLock) return;

	const collidedTile = {
		x: pxToTile(collided.xPx),
		y: pxToTile(collided.yPx),
		z: collided.z,
	};

	triggerCrashForEntity({
		entity: collided,
		crashTile: collidedTile,
		crashDir: oppositeDir(slideDir),
	});
}

function crashAnchorPx(
	entity: Entity,
	crashTile: { x: number; y: number; z: number },
) {
	const curTile = {
		x: pxToTile(entity.xPx),
		y: pxToTile(entity.yPx),
		z: entity.z,
	};

	const sameTile =
		curTile.x === crashTile.x &&
		curTile.y === crashTile.y &&
		curTile.z === crashTile.z;

	const endCell = sameTile
		? getCell(curTile.x, curTile.y, curTile.z)
		: getCell(crashTile.x, crashTile.y, crashTile.z);
	const offset = endCell?.offset ?? { xPx: 0, yPx: 0 };

	return {
		xPx: sameTile
			? pxToTile(entity.xPx) * TILE_SIZE_PX + offset.xPx
			: crashTile.x * TILE_SIZE_PX + offset.xPx,
		yPx: sameTile
			? pxToTile(entity.yPx) * TILE_SIZE_PX + offset.yPx
			: crashTile.y * TILE_SIZE_PX + offset.yPx,
	};
}
