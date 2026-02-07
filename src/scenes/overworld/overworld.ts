// src/scenes/overworld/overworld.ts
import {
	type AnimationID,
	animations,
	renderFrameLayer,
} from "../../animations/animations";
import { updateAmbience } from "../../audio/ambience";
import { updateMusic } from "../../audio/music";
import {
	ASPECT_RATIO_X,
	ASPECT_RATIO_Y,
	DEBUG_OVERLAY,
	DEFAULT_MOVEMENT,
	GAME_HEIGHT_PX,
	GAME_WIDTH_PX,
	movementSpeeds,
	SCALE,
	TILE_SIZE_PX,
} from "../../config";
import { clear, ctx } from "../../gfx/canvas";
import {
	activeActions,
	allActions,
	type Direction,
	directions,
	movementIntent,
} from "../../input/input";
import { gameState, player } from "../../state";
import { saveEntitiesState } from "../../storage";
import { menuState, openMenu } from "../menu/menu";
import { camera, updateCamera } from "./camera";
import {
	getCell,
	getEdge,
	setTilesCountsAndSetWorldBounds,
	worldBounds,
	worldImageLayers,
} from "./cells";
import { initializeArea as initializeStartArea } from "./data/start";
import { renderDialogs } from "./dialog";
import { type Entity, entities } from "./entities";
import { getOccupant, occupy, vacate } from "./occupancy";
import { getPathValues, type Transition } from "./transition/transition";

initializeStartArea();

export function returnToOverworld() {
	allActions
		.filter((e) => !directions.some((d) => d === e))
		.forEach((e) => {
			activeActions.delete(e);
		});

	menuState.show = false;

	gameState.paused = false;
	gameState.disabled = false;
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

function getPlayerIsMoving(): boolean {
	const entity = player;
	return !!entity.isMoving || !!movementIntent;
}

function getIsPlayerMoveMode(): Entity["moveMode"] {
	const isMoving = getPlayerIsMoving();
	if (!isMoving) return undefined;
	const bPressed = activeActions.has("b");
	const isRun = DEFAULT_MOVEMENT === "run" ? !bPressed : bPressed;
	return isRun ? "run" : "walk";
}

function getPlayerAnimation(): AnimationID {
	const entity = player;

	if (entity.movingToAnimation) return entity.movingToAnimation;
	if (entity.moveMode === "run") return "run";
	if (entity.moveMode === "walk") return "walk";

	return "idle";
}

function getEntityAnimation(entity: Entity): AnimationID {
	if (entity.movingToAnimation) return entity.movingToAnimation;

	const isTryingToMove = entity.isMoving || !!entity.intentDir;
	if (isTryingToMove) {
		return entity.moveMode === "run" ? "run" : "walk";
	}

	return "idle";
}

function updateEntityAnimation(
	dt: number,
	entity: Entity,
	animation: AnimationID,
) {
	if (entity.animationCurrent !== animation) {
		entity.animationCurrent = animation;
		entity.animationFrameIndex = 0;
		entity.animationTimer = 0;
		return;
	}

	const entityAnimations = animations[entity.sheet];

	const anim = entityAnimations[animation];
	if (!anim) {
		throw new Error(
			`Character ${entity.sheet} is missing animation ${animation}`,
		);
	}

	entity.animationTimer += dt;

	if (entity.animationTimer >= anim.frameDuration) {
		entity.animationTimer -= anim.frameDuration;

		const nextIndex = entity.animationFrameIndex + 1;
		if (nextIndex >= anim.frames.length) {
			entity.animationFrameIndex = 0;
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

const sublayers = ["back", "front"] as const;

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

// --- path mover helpers ---
function startSegment(
	entity: Entity,
	toXPx: number,
	toYPx: number,
	toZ: number,
	duration?: number,
) {
	entity.xPxi = entity.xPx;
	entity.yPxi = entity.yPx;
	entity.zi = entity.z;

	entity.xPxf = toXPx;
	entity.yPxf = toYPx;
	entity.zf = toZ;

	entity.pathSegmentProgress = 0;
	entity.pathSegmentDuration = duration;
}

function setCurrentSegment(entity: Entity): boolean {
	const next = entity.path[0];

	if (!next) return false;

	const path = getPathValues(next, entity);
	startSegment(entity, path.xPx, path.yPx, path.z, path.duration);

	return true;
}

function snapToSegmentEnd(entity: Entity) {
	entity.xPx = entity.xPxf;
	entity.yPx = entity.yPxf;
	entity.z = entity.zf;
}

function tryPlanMove(desired: Direction, entity: Entity): Transition | null {
	const edge = getEdge(entity.x, entity.y, entity.z, desired);
	if (edge?.blocked) return null;

	// --- transitions ---
	if (edge?.transition) {
		const transitions = Array.isArray(edge.transition)
			? edge.transition
			: [edge.transition];

		for (const transition of transitions) {
			if (transition.condition && !transition.condition(entity)) continue;

			// Block if destination is occupied by someone else
			const end = transition.end;
			const occupant = getOccupant(end.x, end.y, end.z);
			if (occupant && occupant !== entity.id) return null;

			return transition;
		}

		return null;
	}

	// --- simple step ---
	const { dx, dy } = dirToDxDy(desired);
	const nx = entity.x + dx;
	const ny = entity.y + dy;
	const nz = entity.z;

	if (nx < 0 || ny < 0 || nx >= worldBounds.x || ny >= worldBounds.y)
		return null;

	const destination = getCell(nx, ny, nz);
	if (destination?.blocked) return null;

	// Block if destination is occupied by someone else
	const occupant = getOccupant(nx, ny, nz);
	if (occupant && occupant !== entity.id) return null;

	return {
		path: [{ xPx: nx * TILE_SIZE_PX, yPx: ny * TILE_SIZE_PX, z: nz }],
		end: { x: nx, y: ny, z: nz },
	};
}

/** Update player and world state */
function updatePlayer(dt: number) {
	const entity = player;

	if (gameState.paused) return;

	if (!gameState.disabled && activeActions.has("start")) openMenu();

	entity.moveMode = getIsPlayerMoveMode();

	const desired = gameState.disabled ? null : movementIntent;

	// Speed based on run/walk
	entity.speed = movementSpeeds[entity.moveMode ?? "walk"];

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
			target?.onActivate?.({ activator: entity, activated: target });
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

	updateEntityAndPlayer({
		dt,
		entity,
		desiredDirection: desired,
		desiredAnimation: getPlayerAnimation(),
	});
}

/** Update NPC */
async function updateEntity(dt: number, entity: Entity) {
	if (gameState.paused) return;

	if (entity.brain) {
		await entity.brain.runner.tick(entity, dt);

		if (entity.brain.runner.isIdle() && entity.brain.routine) {
			entity.brain.routine(entity, dt);
		}
	}

	updateEntityAndPlayer({
		dt,
		entity,
		desiredDirection: entity.intentDir ?? null,
		desiredAnimation: getEntityAnimation(entity),
	});

	entity.intentDir = null;
}

function updateEntityAndPlayer({
	dt,
	entity,
	desiredDirection,
	desiredAnimation,
}: {
	dt: number;
	entity: Entity;
	desiredDirection: Direction | null;
	desiredAnimation?: AnimationID;
}) {
	// Speed based on run/walk
	entity.speed = movementSpeeds[entity.moveMode ?? "walk"];

	// Movement start
	if (!entity.isMoving) {
		// Ensure idle entities keep occupying their standing tile
		occupy(entity);

		if (desiredDirection) {
			entity.direction = desiredDirection;

			const planned = tryPlanMove(desiredDirection, entity);

			if (planned) {
				// Reserve destination BEFORE starting the move
				const ok = occupy({ ...planned.end, id: entity.id });
				if (!ok) {
					// Someone else got there first; stay idle this tick
				} else {
					entity.isMoving = true;

					entity.movingToTile = planned.end;
					entity.movingToAnimation = planned.animation ?? null;

					entity.path = planned.path.map((p) => ({ ...p }));

					const first = entity.path[0];
					if (first) {
						const prev = first.onSegmentEnd;
						first.onSegmentEnd = (e) => {
							// Vacate start tile once the first segment ends
							vacate(e);
							prev?.(e);
						};
					}

					setCurrentSegment(entity);
				}
			}
		}
	}

	// Movement tween (pixel-based segments)
	if (entity.isMoving) {
		const dx = entity.xPxf - entity.xPxi;
		const dy = entity.yPxf - entity.yPxi;

		const distancePx = dx === 0 && dy === 0 ? 0 : Math.hypot(dx, dy);

		const currentPathSegment = entity.path[0];
		if (!entity.pathSegmentProgress && currentPathSegment) {
			currentPathSegment.onSegmentStart?.(entity);
		}

		const moveDuration =
			entity.pathSegmentDuration ?? distancePx / entity.speed;

		entity.pathSegmentProgress += moveDuration === 0 ? 1 : dt / moveDuration;

		currentPathSegment?.onSegment?.(entity);

		if (entity.pathSegmentProgress >= 1 && currentPathSegment) {
			currentPathSegment.onSegmentEnd?.(entity);
		}

		if (entity.pathSegmentProgress >= 1) {
			entity.pathSegmentProgress = 1;
			snapToSegmentEnd(entity);

			entity.path.shift();

			const hasMore = setCurrentSegment(entity);
			if (!hasMore) {
				if (!entity.movingToTile) {
					throw new Error(
						"Invariant: movement finished but pendingEnd is null",
					);
				}

				entity.x = entity.movingToTile.x;
				entity.y = entity.movingToTile.y;
				entity.z = entity.movingToTile.z;

				entity.isMoving = false;
				entity.movingToTile = null;
				entity.movingToAnimation = null;

				// Destination was reserved earlier; this is idempotent.
				occupy(entity);
			}
		} else {
			const t = entity.pathSegmentProgress;
			entity.xPx = Math.round(entity.xPxi + dx * t);
			entity.yPx = Math.round(entity.yPxi + dy * t);
		}
	}

	desiredAnimation ??= entity.animationCurrent;

	// Anim AFTER movement update
	updateEntityAnimation(dt, entity, desiredAnimation);
}

function update(dt: number) {
	const isReady = isWorldImagesReady();
	if (!isReady) return;

	setTilesCountsAndSetWorldBounds();

	for (const [id, entity] of entities.entries()) {
		if (id === "player") continue;
		void updateEntity(dt, entity);
	}

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
			// draw lower things last (on top)
			if (a.renderZ !== b.renderZ) return a.renderZ - b.renderZ;
			if (a.row !== b.row) return a.row - b.row;
			if (a.entity.yPx !== b.entity.yPx) return a.entity.yPx - b.entity.yPx;
			if (a.entity.xPx !== b.entity.xPx) return a.entity.xPx - b.entity.xPx;
			return a.entity.id.localeCompare(b.entity.id);
		});

	for (const layer of worldImageLayers) {
		for (let ty = startY; ty <= endY; ty++) {
			const sy = ty * TILE_SIZE_PX;
			const dy = Math.round(sy - camera.yPx);

			const sx = startX * TILE_SIZE_PX;
			const dx = Math.round(sx - camera.xPx);

			const w = (endX - startX + 1) * TILE_SIZE_PX;

			for (const sublayer of sublayers) {
				const images = layer[sublayer];

				const frameIndex =
					Math.floor(performance.now() / 1000) % (images?.length ?? 1);
				const image = images ? images[frameIndex] : undefined;

				if (!image) continue;

				for (const it of drawList) {
					if (sublayer !== "front") continue;
					if (layer.z !== it.renderZ) continue;
					if (ty !== it.row) continue;
					drawEntity(it.entity);
				}

				ctx.drawImage(image, sx, sy, w, TILE_SIZE_PX, dx, dy, w, TILE_SIZE_PX);
			}
		}
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
			`res: ${GAME_WIDTH_PX}x${GAME_HEIGHT_PX} (${SCALE}x, ${ASPECT_RATIO_X}:${ASPECT_RATIO_Y})`,
			`current tile: ${player.x}, ${player.y}, ${player.z}`,
			`move to tile: ${player.movingToTile?.x ?? "x"}, ${player.movingToTile?.y ?? "y"}, ${player.movingToTile?.z ?? "z"}`,
			`facing: ${player.direction}`,
			`moving: ${player.isMoving}`,
			`move mode: ${player.moveMode}`,
			`faster: ${getIsPlayerMoveMode()}`,
			`transition animation: ${player.movingToAnimation ?? "-"}`,
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

	return entity.pathSegmentProgress < 0.5 ? fromZ : toZ;
}

function drawEntity(entity: Entity) {
	const entityScreenX = Math.round(entity.xPx - camera.xPx);
	const entityScreenY = Math.round(entity.yPx - camera.yPx);

	const animalOffsetY = entity.variant === "animal" ? 1 : 0;

	const feetScreenX = entityScreenX + TILE_SIZE_PX / 2;
	const feetScreenY = entityScreenY + TILE_SIZE_PX - 2 + animalOffsetY;
	ctx.save();
	ctx.translate(feetScreenX, feetScreenY);

	const animName = entity.animationCurrent;
	const entityAnimations = animations[entity.sheet];
	const anim = entityAnimations[animName];

	if (!anim) {
		throw new Error(
			`Character ${entity.sheet} is missing animation ${animName}`,
		);
	}

	const frameLayers = anim.frames[entity.animationFrameIndex];
	if (frameLayers === undefined) {
		throw new Error(
			`Invalid animation frame index for ${animName}, index ${entity.animationFrameIndex} but frames are ${anim.frames.length} long`,
		);
	}

	const dw = entity.width;
	const dh = entity.height;

	if (!frameLayers[0]) return;

	ctx.fillStyle = "#00000013";
	ctx.beginPath();
	const center = 0;
	const bottom = -4 - animalOffsetY;
	const rx = 6;
	const ry = 3;
	ctx.ellipse(center, bottom, rx, ry, 0, 0, Math.PI * 2);
	ctx.fill();

	renderFrameLayer({
		sheet: frameLayers[0].sheet,
		index: frameLayers[0].index,
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

	// Autosave on step end
	saveEntitiesState();
}
