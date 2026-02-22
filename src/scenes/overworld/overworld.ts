// src/scenes/overworld/overworld.ts
import {
	type Animation,
	type AnimationIDStable,
	animations,
	isStableAnimationID,
	renderFrameLayer,
} from "../../animation/animation";
import { updateAmbience } from "../../audio/ambience";
import { updateMusic } from "../../audio/music";
import {
	ASPECT_RATIO,
	DEBUG_OVERLAY,
	GAME_HEIGHT_PX,
	GAME_WIDTH_PX,
	moveSpeeds,
	SCALE,
	TAP_TO_TURN_MS,
	TILE_SIZE_PX,
} from "../../config";
import { gameState, player } from "../../game-state";
import { clear, ctx } from "../../gfx/canvas";
import {
	activeActions,
	activeActionsOnDown,
	type Direction,
	movementIntent,
} from "../../input/input";
import { requestAutosave } from "../../storage";
import { menuState, openMenu } from "../menu/menu";
import {
	activityStack,
	isActivityRunning,
	updateActivity,
} from "./activity/activity";
import { overworldFollowerCollision } from "./ai/command-follow";
import { tryPlanMove } from "./ai/pathfinding";
import { camera, updateCamera } from "./camera";
import {
	getCell,
	getEdge,
	setTilesCountsAndSetWorldBounds,
	worldBounds,
	worldImageLayers,
} from "./cells";
import { renderDialogs } from "./dialog";
import { type Entity, entities, isPlayerID } from "./entity";
import { initializeArea as initializeStartArea } from "./generator/start";
import { getOccupant, occupy, vacate } from "./occupancy";
import {
	setCurrentSegment,
	snapToSegmentEnd,
	type Transition,
} from "./transition/transition";
import { spin } from "./transition/tricks";

initializeStartArea();

export function returnToOverworld() {
	menuState.show = false;
	gameState.paused = false;
	gameState.disabled = false;
}

const MAX_TRAIL = 4;
function pushTrailStep(entity: Entity) {
	entity.trail.push({ x: entity.x, y: entity.y, z: entity.z });
	if (entity.trail.length > MAX_TRAIL) {
		entity.trail.splice(0, entity.trail.length - MAX_TRAIL);
	}
}

function applyTapToTurnGate(opts: {
	entity: Entity;
	direction?: Direction | null;
}): Direction | null {
	const nowMs = gameState.ms;

	if (gameState.disabled) return null;

	const entity = opts.entity;
	const direction = isPlayerID(entity.id)
		? movementIntent
		: (opts.direction ?? null);

	// Only relevant before we start moving
	if (entity.isMoving) {
		entity.idleTurnLockMs = undefined;
		return direction;
	}

	// No input -> clear lock
	if (!direction) {
		entity.idleTurnLockMs = undefined;
		return null;
	}

	const lockUntil = entity.idleTurnLockMs;

	// New direction press while idle:
	// - If it changes facing, turn immediately and arm the lock.
	if (activeActionsOnDown.has(direction) && entity.direction !== direction) {
		entity.direction = direction;
		entity.idleTurnLockMs = nowMs + TAP_TO_TURN_MS;
		return null; // gate movement for TAP_TO_TURN_MS
	}

	// If we are currently locked, keep gating movement.
	// Also allow "turning again" during the lock if the user changes direction,
	// and reset the lock (feels crisp and avoids weird “buffering”).
	if (lockUntil !== undefined && nowMs < lockUntil) {
		if (entity.direction !== direction) {
			entity.direction = direction;
			entity.idleTurnLockMs = nowMs + TAP_TO_TURN_MS;
		}
		return null;
	}

	// Lock expired (or never armed) -> allow movement
	entity.idleTurnLockMs = undefined;
	return direction;
}

function getPlayerMoveMode(): Entity["moveMode"] {
	const bPressed = activeActions.has("b");
	const isRun = player.autoRun ? !bPressed : bPressed;
	return isRun ? "run" : "walk";
}

function getDesiredAnimation(entity: Entity): Animation {
	const anims = animations[entity.sheet];
	if (entity.animationOverride && typeof entity.animationOverride === "string")
		return anims[entity.animationOverride];
	if (entity.animationOverride && typeof entity.animationOverride !== "string")
		return entity.animationOverride;

	const isTryingToMove =
		entity.isMoving ||
		(isPlayerID(entity.id)
			? !!(movementIntent ?? entity.brainDesiredDirection)
			: !!entity.brainDesiredDirection);
	if (menuState.show && isPlayerID(entity.id)) return anims.idle;
	if (isTryingToMove) return entity.moveMode === "run" ? anims.run : anims.walk;
	return anims.idle;
}

function updateEntityAnimation(
	dt: number,
	entity: Entity,
	animationOrId: Animation | AnimationIDStable,
) {
	const animation =
		typeof animationOrId === "string"
			? animations[entity.sheet][animationOrId]
			: animationOrId;
	const animationId =
		typeof animationOrId === "string" ? animationOrId : animation.id;

	if (!animation) {
		throw new Error(
			`Character ${entity.sheet} is missing animation ${animationOrId}`,
		);
	}

	if (
		entity.animationCurrentId !== animationId &&
		isStableAnimationID(animationId)
	) {
		entity.animationCurrentId = animationId;
		entity.animationFrameIndex = 0;
		entity.animationTimer = 0;
		return;
	}

	if (!animation) {
		throw new Error(
			`Character ${entity.sheet} is missing animation ${animation}`,
		);
	}

	entity.animationTimer += dt;

	if (entity.animationTimer >= animation.frameDuration) {
		entity.animationTimer -= animation.frameDuration;

		const nextIndex = entity.animationFrameIndex + 1;
		if (nextIndex >= animation.frames.length) {
			if (animation.loop) entity.animationFrameIndex = 0;
			if (entity.variant === "effect" && !animation.loop) {
				entities.delete(entity.id);
			}
		} else {
			entity.animationFrameIndex = nextIndex;
		}
	}
}

function getVisibleTileRange() {
	const minTileX = Math.floor(camera.xPx / TILE_SIZE_PX) - 1;
	const maxTileX = Math.ceil((camera.xPx + GAME_WIDTH_PX) / TILE_SIZE_PX) + 1;

	const minTileY = Math.floor(camera.yPx / TILE_SIZE_PX) - 1;
	const maxTileY = Math.ceil((camera.yPx + GAME_HEIGHT_PX) / TILE_SIZE_PX) + 1;
	return {
		minTileX,
		minTileY,
		maxTileX,
		maxTileY,
	};
}

function isWorldImagesReady() {
	return worldImageLayers.every((layer) => {
		const backReady = layer.back
			? layer.back.every((img) => img.complete && img.naturalWidth > 0)
			: true;
		const frontReady = layer.front
			? layer.front.every((img) => img.complete && img.naturalWidth > 0)
			: true;
		return backReady && frontReady;
	});
}

/** Update player and world state */
function updatePlayer(dt: number) {
	const entity = player;

	if (gameState.paused) return;

	if (
		!gameState.disabled &&
		!menuState.show &&
		activeActionsOnDown.has("start")
	) {
		openMenu();
	}

	if (activeActionsOnDown.has("x")) {
		entity.autoRun = !entity.autoRun;
	}

	entity.moveMode = getPlayerMoveMode();

	// Speed based on run/walk
	entity.speed = moveSpeeds[entity.moveMode ?? "walk"];

	// Interaction: activate target in front of player
	if (!gameState.disabled && activeActions.has("a") && !entity.isMoving) {
		const activationCell = {
			x: entity.x,
			y: entity.y,
			z: entity.z,
		};

		if (entity.direction === "right") activationCell.x += 1;
		if (entity.direction === "down") activationCell.y += 1;
		if (entity.direction === "left") activationCell.x -= 1;
		if (entity.direction === "up") activationCell.y -= 1;

		// 1) Prefer entity currently OCCUPYING the tile
		const occId = getOccupant(
			activationCell.x,
			activationCell.y,
			activationCell.z,
		);
		if (occId) {
			const target = entities.get(occId);
			if (!target?.interactionLock) {
				target?.onActivate?.({ activator: entity, activated: target });
			}
		} else {
			// 2) Otherwise, fallback to cell/edge interactions
			getCell(
				activationCell.x,
				activationCell.y,
				activationCell.z,
			)?.onActivate?.({
				activator: entity,
			});

			getEdge(
				entity.x,
				entity.y,
				entity.z,
				entity.direction,
			)?.interact?.onActivate({
				activator: entity,
			});
		}

		activeActions.delete("a");
	}

	const desiredDirection = applyTapToTurnGate({ entity });
	const desiredAnimation =
		movementIntent && !desiredDirection
			? entity.moveMode === "run"
				? "walk"
				: "idle"
			: getDesiredAnimation(entity);

	let trick: Transition | undefined;

	if (!entity.isMoving && activeActions.has("r")) {
		trick = spin(entity, desiredDirection);
	}
	if (!entity.isMoving && activeActions.has("l")) {
		trick = spin(entity, desiredDirection, "counterclockwise");
	}

	updateEntityAndPlayer({
		dt,
		entity,
		desiredDirection,
		desiredAnimation,
		trick,
	});
}

/** Update NPC */
function updateEntity(dt: number, entity: Entity) {
	if (gameState.paused) return;

	if (entity.brain) {
		entity.brain.runner.tick(entity, dt);

		if (entity.brain.runner.isIdle() && entity.brain.routine) {
			entity.brain.routine(entity, dt);
		}
	}

	updateEntityAndPlayer({
		dt,
		entity,
		desiredDirection: entity.brainDesiredDirection ?? null,
		desiredAnimation: getDesiredAnimation(entity),
	});

	entity.brainDesiredDirection = null;
}

function updateEntityAndPlayer({
	dt,
	entity,
	desiredDirection,
	desiredAnimation,
	trick,
}: {
	dt: number;
	entity: Entity;
	desiredDirection: Direction | null;
	desiredAnimation?: Animation | AnimationIDStable;
	trick?: Transition;
}) {
	// Speed based on run/walk
	entity.speed = moveSpeeds[entity.moveMode ?? "walk"];

	// Movement start
	if (!entity.isMoving) {
		// Ensure idle entities keep occupying their standing tile
		if (entity.solid) occupy(entity);

		if (desiredDirection) {
			entity.direction = desiredDirection;
		}

		const planned =
			trick ??
			(desiredDirection ? tryPlanMove(desiredDirection, entity) : undefined);

		if (planned) {
			// Reserve destination BEFORE starting the move
			const ok = entity.solid
				? occupy({ ...planned.end, id: entity.id })
				: true;
			let allowAnyway = false;
			if (!ok && !trick) {
				allowAnyway = overworldFollowerCollision({ target: entity, planned });
			}

			if (ok || allowAnyway || trick) {
				pushTrailStep(entity);
				entity.isMoving = true;

				entity.transitionEndTile = planned.end;
				entity.animationOverride = planned.animation ?? null;

				entity.transitionPath = planned.path.map((p) => ({ ...p }));

				const first = entity.transitionPath[0];
				if (first) {
					const prev = first.onSegmentEnd;
					first.onSegmentEnd = (e) => {
						// Vacate start tile once the first segment ends
						if (e.solid) vacate(e);
						prev?.(e);
					};
				}

				setCurrentSegment(entity);
			}
		}
	}

	// Movement tween (pixel-based segments)
	if (entity.isMoving) {
		const dx = entity.xPxf - entity.xPxi;
		const dy = entity.yPxf - entity.yPxi;

		const distancePx = dx === 0 && dy === 0 ? 0 : Math.hypot(dx, dy);

		const currentPathSegment = entity.transitionPath[0];
		if (!entity.transitionPathSegmentProgress && currentPathSegment) {
			currentPathSegment.onSegmentStart?.(entity);
		}

		const moveDuration =
			entity.transitionPathSegmentDuration ?? distancePx / entity.speed;

		entity.transitionPathSegmentProgress +=
			moveDuration === 0 ? 1 : dt / moveDuration;

		currentPathSegment?.onSegment?.(entity);

		if (entity.transitionPathSegmentProgress >= 1 && currentPathSegment) {
			currentPathSegment.onSegmentEnd?.(entity);
		}

		if (entity.transitionPathSegmentProgress >= 1) {
			entity.transitionPathSegmentProgress = 1;
			snapToSegmentEnd(entity);

			entity.transitionPath.shift();

			const hasMore = setCurrentSegment(entity);
			if (!hasMore) {
				if (!entity.transitionEndTile) {
					throw new Error(
						"Invariant: movement finished but pendingEnd is null",
					);
				}

				entity.x = entity.transitionEndTile.x;
				entity.y = entity.transitionEndTile.y;
				entity.z = entity.transitionEndTile.z;

				entity.isMoving = false;
				entity.transitionEndTile = null;
				entity.animationOverride = null;

				// Destination was reserved earlier; this is idempotent.
				if (entity.solid) occupy(entity);

				if (entity.id === "player" && !isActivityRunning()) {
					requestAutosave("player-settled");
				}
			}
		} else {
			const t = entity.transitionPathSegmentProgress;
			entity.xPx = Math.round(entity.xPxi + dx * t);
			entity.yPx = Math.round(entity.yPxi + dy * t);
		}
	}

	desiredAnimation ??= entity.animationCurrentId;

	// Anim AFTER movement update
	updateEntityAnimation(dt, entity, desiredAnimation);
}

function update(dt: number) {
	const isReady = isWorldImagesReady();
	if (!isReady) return;

	setTilesCountsAndSetWorldBounds();

	if (gameState.paused) return;
	gameState.ms += dt;

	for (const [id, entity] of entities.entries()) {
		if (id === "player") continue;
		void updateEntity(dt, entity);
	}

	updateActivity(dt);
	updatePlayer(dt);
	updateCamera();
	updateAmbience(dt);
	updateMusic(dt);
}

function draw(dt: number) {
	const isReady = isWorldImagesReady();
	if (!isReady) return;

	clear();

	const { minTileX, minTileY, maxTileX, maxTileY } = getVisibleTileRange();

	const startX = Math.max(0, minTileX);
	const startY = Math.max(0, minTileY);
	const endX = Math.min(worldBounds?.x - 1, maxTileX);
	const endY = Math.min(worldBounds?.y - 1, maxTileY);

	const drawList = Array.from(entities.values())
		.map((entity) => {
			const renderZ = getEntitiesRenderZ(entity);
			const row = Math.floor((entity.yPx + TILE_SIZE_PX - 1) / TILE_SIZE_PX);
			return { entity, renderZ, row };
		})
		.sort((a, b) => {
			if (a.renderZ !== b.renderZ) return a.renderZ - b.renderZ;
			if (a.entity.renderPriority !== b.entity.renderPriority) {
				return a.entity.renderPriority - b.entity.renderPriority;
			}
			if (a.row !== b.row) return a.row - b.row;
			if (a.entity.yPx !== b.entity.yPx) return a.entity.yPx - b.entity.yPx;
			if (a.entity.xPx !== b.entity.xPx) return a.entity.xPx - b.entity.xPx;
			return a.entity.id.localeCompare(b.entity.id);
		});

	for (const layer of worldImageLayers) {
		const sx = startX * TILE_SIZE_PX;
		const dx = Math.round(sx - camera.xPx);
		const w = (endX - startX + 1) * TILE_SIZE_PX;

		// Resolve images ONCE per layer per sublayer (not per row)
		const nowSec = Math.floor(gameState.ms / 1000);

		const backImages = layer.back;
		const backImage =
			backImages && backImages.length > 0
				? backImages[nowSec % backImages.length]
				: undefined;

		const frontImages = layer.front;
		const frontImage =
			frontImages && frontImages.length > 0
				? frontImages[nowSec % frontImages.length]
				: undefined;

		// 1) Draw ALL rows of the "back" sublayer first
		if (backImage) {
			for (let ty = startY; ty <= endY; ty++) {
				const sy = ty * TILE_SIZE_PX;
				const dy = Math.round(sy - camera.yPx);

				ctx.drawImage(
					backImage,
					sx,
					sy,
					w,
					TILE_SIZE_PX,
					dx,
					dy,
					w,
					TILE_SIZE_PX,
				);
			}
		}

		// 2) Then draw entities + "front" (row by row)
		for (let ty = startY; ty <= endY; ty++) {
			// Entities in this row, for this z-layer
			for (const it of drawList) {
				if (layer.z !== it.renderZ) continue;
				if (ty !== it.row) continue;
				drawEntity(it.entity);
			}

			// Front tiles for this row
			if (frontImage) {
				const sy = ty * TILE_SIZE_PX;
				const dy = Math.round(sy - camera.yPx);

				ctx.drawImage(
					frontImage,
					sx,
					sy,
					w,
					TILE_SIZE_PX,
					dx,
					dy,
					w,
					TILE_SIZE_PX,
				);
			}
		}
	}

	for (let i = activityStack.length - 1; i >= 0; i--) {
		const a = activityStack[i];
		a?.onDraw?.();
	}

	if (DEBUG_OVERLAY) {
		ctx.save();
		ctx.fillStyle = "#ffffff";
		ctx.font = "8px Tiny5";
		ctx.globalAlpha = menuState.show ? 0.25 : 1.0;
		ctx.textBaseline = "top";
		ctx.shadowColor = menuState.show ? "#00000000" : "#0000000d";
		ctx.shadowOffsetX = 0;
		ctx.shadowOffsetY = 1;
		ctx.shadowBlur = 0;
		[
			`fps: ${Math.round(1000 / dt)}`,
			`res: ${GAME_WIDTH_PX}x${GAME_HEIGHT_PX} (${SCALE}x, ${ASPECT_RATIO.toFixed(
				2,
			)}:${1})`,
			`tile: ${player.x}, ${player.y}, ${player.z} -> ${player.transitionEndTile?.x ?? "x"}, ${player.transitionEndTile?.y ?? "y"}, ${player.transitionEndTile?.z ?? "z"}`,
			`px: ${player.xPx}, ${player.yPx} -> ${player.xPxf}, ${player.yPxf}`,
			`dir: ${player.direction}`,
			`moving: ${player.isMoving}`,
			`move mode: ${player.moveMode}`,
			`animation: ${player.animationCurrentId}${player.animationOverride ? ` (${typeof player.animationOverride === "string" ? player.animationOverride : player.animationOverride.id})` : ""}`,
			`row: ${drawList.find((d) => d.entity.id === "player")?.row}`,
			`activities: ${activityStack.map((a) => a.id).join(", ")}`,
		].forEach((line, index) => {
			ctx.fillText(line, 4, 2 + index * 8);
		});
		ctx.restore();
	}
}

function getEntitiesRenderZ(entity: Entity): number {
	if (!entity.isMoving) return entity.z;

	const fromZ = entity.zi;
	const toZ = entity.zf;
	if (fromZ === toZ) return entity.z;

	return entity.transitionPathSegmentProgress < 0.5 ? fromZ : toZ;
}

function drawEntity(entity: Entity) {
	const entityScreenX = Math.round(entity.xPx - camera.xPx);
	const entityScreenY = Math.round(entity.yPx - camera.yPx);

	const animalOffsetY = entity.variant === "animal" ? 1 : 0;

	const feetScreenX = entityScreenX + TILE_SIZE_PX / 2;
	const feetScreenY = entityScreenY + TILE_SIZE_PX - 2 + animalOffsetY;
	ctx.save();
	ctx.translate(feetScreenX, feetScreenY);

	const animName = entity.animationCurrentId;
	const entityAnimations = animations[entity.sheet];
	const anim =
		typeof entity.animationOverride === "string"
			? (entityAnimations[entity.animationOverride] ??
				entityAnimations[animName])
			: (entity.animationOverride ?? entityAnimations[animName]);

	if (!anim) {
		throw new Error(
			`Character ${entity.sheet} is missing animation ${animName}`,
		);
	}

	const frameLayer = anim.frames[entity.animationFrameIndex]?.[0];
	if (frameLayer === undefined) {
		throw new Error(
			`Invalid animation frame index for ${animName}, index ${entity.animationFrameIndex} but frames are ${anim.frames.length} long`,
		);
	}

	const dw = entity.width;
	const dh = entity.height;

	if (!frameLayer) return;

	ctx.fillStyle = "#00000013";
	ctx.beginPath();
	const center = 0;
	const bottom = -4 - animalOffsetY;
	const rx = entity.radius;
	const ry = entity.radius / 2;
	ctx.ellipse(center, bottom, rx, ry, 0, 0, Math.PI * 2);
	ctx.fill();

	renderFrameLayer({
		...frameLayer,
		direction: entity.direction,
		x: -dw / 2,
		y: -dh,
		w: entity.width,
		h: entity.height,
	});

	ctx.restore();
}

export function overworld(dt: number) {
	update(dt);
	draw(dt);
	renderDialogs();
}
