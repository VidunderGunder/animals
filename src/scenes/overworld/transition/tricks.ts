// src/scenes/overworld/transition/tricks.ts
import { animationSheets, animations } from "../../../animation/animation";
import { impact } from "../../../animation/effect";
import { emptyImage } from "../../../assets/image";
import { audio } from "../../../audio/audio-engine";
import { moveSpeeds, TILE_SIZE_PX } from "../../../config";
import {
	directionToDxDy,
	ease,
	getCellInDirection,
	jitter,
	mix,
	oppositeDirection,
	pxToTile,
} from "../../../functions/general";
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
	mute?: boolean;
}): Transition["path"] {
	const mute = args.mute ?? false;
	const { xPx, yPx, z, direction } = args;

	const { dx, dy } = directionToDxDy(direction);

	const isHorizontal = direction === "left" || direction === "right";

	const onFirstSegmentStart = (entity: Entity) => {
		entity.interactionLock = true;
		if (!mute) audio.playSfx("thud", { volume: 0.625 });
		entity.animationFrameIndex = 0;
		entity.animationTimer = 0;
		entity.direction = direction;
		entity.animationOverride = "jump";
	};

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
			onSegmentEnd(entity) {
				if (!mute) audio.playSfx("thud", { volume: 0.1 });
				impact({
					xPx,
					yPx,
					z: entity.z,
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

function spinStartSFX() {
	audio.playSfx("jump", {
		volume: jitter(0.01),
		playbackRate: jitter(0.5),
	});
	audio.playSfx("swoosh", {
		volume: jitter(0.125),
		playbackRate: jitter(1.5),
	});
	audio.playSfx("swoosh", {
		volume: jitter(0.0675),
		playbackRate: jitter(0.5),
	});
}

function spinDelaySFX() {
	audio.playSfx("swoosh", {
		volume: jitter(0.06),
		playbackRate: jitter(1.25),
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
	injectPlayOnceOnFirstSegmentStart(path, () => spinStartSFX());

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
	mute?: boolean;
}) {
	const mute = args.mute ?? false;
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
				mute,
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
		mute,
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

	const { dx, dy } = slideDir ? directionToDxDy(slideDir) : { dx: 0, dy: 0 };

	const totalDxPx = hasSlide ? dx * TILE_SIZE_PX * (distance ?? 0) : 0;
	const totalDyPx = hasSlide ? dy * TILE_SIZE_PX * (distance ?? 0) : 0;

	const path: Transition["path"] = [];

	for (let i = 0; i < steps; i++) {
		const isStartOfNewRound = i % 4 === 0;

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
				if (isStartOfNewRound) spinDelaySFX();
				if (i === 0 && hasSlide)
					impact({
						xPx: start.xPx,
						yPx: start.yPx,
						z: start.z,
					});
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
		crashDir: oppositeDirection(slideDir),
		mute: true,
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
