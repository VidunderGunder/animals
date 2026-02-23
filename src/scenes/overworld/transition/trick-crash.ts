import { animations } from "../../../animation/animation";
import { impact } from "../../../animation/effect";
import { emptyImage } from "../../../assets/image";
import { audio } from "../../../audio/audio-engine";
import { TILE_SIZE_PX } from "../../../config";
import {
	directionToDxDy,
	oppositeDirection,
	pxToTile,
	pxToTileValue,
} from "../../../functions/general";
import type { Direction } from "../../../input/input";
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

export function triggerCrashForEntity(args: {
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

export function checkTileStepAllowed(args: {
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

export function crashBothOnCollision(args: {
	collider: Entity;
	collided?: Entity;
	slideDir: Direction;
}) {
	const { collider, collided, slideDir } = args;

	const colliderTile = pxToTile(collider);

	triggerCrashForEntity({
		entity: collider,
		crashTile: colliderTile,
		crashDir: slideDir,
	});

	if (!collided) return;
	if (collided.interactionLock) return;

	const collidedTile = pxToTile(collided);

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
	const curTile = pxToTile(entity);

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
			? pxToTileValue(entity.xPx) * TILE_SIZE_PX + offset.xPx
			: crashTile.x * TILE_SIZE_PX + offset.xPx,
		yPx: sameTile
			? pxToTileValue(entity.yPx) * TILE_SIZE_PX + offset.yPx
			: crashTile.y * TILE_SIZE_PX + offset.yPx,
	};
}
