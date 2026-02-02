import {
	type AnimationID,
	animations,
	renderFrameLayer,
} from "../../animations/animations";
import { createImageElement } from "../../assets/image";
import { updateAmbience } from "../../audio/ambience";
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
import { getCell, getEdge, setCell } from "./cells";
import { initializeArea as initializeStartArea } from "./data/start";
import { renderDialogs } from "./dialog";
import { type Entity, entities } from "./entities";
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

function getIsPlayerMovingFaster(): boolean {
	const isMoving = getPlayerIsMoving();
	if (!isMoving) return false;
	const bPressed = activeActions.has("b");
	return DEFAULT_MOVEMENT === "run" ? !bPressed : bPressed;
}

function getPlayerAnimation(): AnimationID {
	const entity = player;

	// If a transition is forcing an animation, keep it
	if (entity.movingToAnimation === "jump") return "jump";
	if (entity.movingToAnimation === "hop") return "hop";

	const isMovingFaster = getIsPlayerMovingFaster();
	if (isMovingFaster) return "run";

	const isMoving = getPlayerIsMoving();
	if (isMoving) return "walk";

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

	const entityAnimations = animations[entity.renderVariant];
	const anim = entityAnimations[animation];
	if (!anim) {
		throw new Error(
			`Character ${entity.renderVariant} is missing animation ${animation}`,
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

const worldImageLayers: {
	z: number;
	back?: HTMLImageElement[];
	front?: HTMLImageElement[];
}[] = [
	{
		z: 0,
		back: [
			createImageElement("/world/start/scenery-frame-1.png"),
			createImageElement("/world/start/scenery-frame-2.png"),
		],
	},
	{
		z: 0,
		back: [
			createImageElement("/world/start/obstacle-course/0-back-frame-1.png"),
			createImageElement("/world/start/obstacle-course/0-back-frame-2.png"),
		],
		front: [
			createImageElement("/world/start/obstacle-course/0-front-frame-1-2.png"),
		],
	},
	{
		z: 1,
		back: [
			createImageElement("/world/start/obstacle-course/1-back-frame-1-2.png"),
		],

		front: [
			createImageElement("/world/start/obstacle-course/1-front-frame-1-2.png"),
		],
	},
] as const;

let tilesYCount = 0;
let tilesXCount = 0;

function setTilesCountsIfNotSet() {
	if (!tilesYCount || !tilesXCount) {
		const firstImage =
			worldImageLayers[0]?.back?.[0] || worldImageLayers[0]?.front?.[0];
		if (!firstImage || !firstImage.complete || firstImage.naturalWidth === 0)
			return;
		tilesXCount = firstImage.naturalWidth / TILE_SIZE_PX;
		tilesYCount = firstImage.naturalHeight / TILE_SIZE_PX;
	}
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

	if (edge?.transition) {
		const transitions = Array.isArray(edge.transition)
			? edge.transition
			: [edge.transition];
		for (const transition of transitions) {
			if (transition.condition === undefined) return transition;
			if (transition.condition(entity)) return transition;
		}
		return null;
	}

	const { dx, dy } = dirToDxDy(desired);
	const nx = entity.x + dx;
	const ny = entity.y + dy;
	const nz = entity.z;

	if (nx < 0 || ny < 0 || nx >= tilesXCount || ny >= tilesYCount) return null;

	const destination = getCell(nx, ny, nz);

	if (destination?.blocked) return null;

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

	const faster = getIsPlayerMovingFaster();

	const desired = gameState.disabled ? null : movementIntent;

	// 2) Speed based on run/walk
	entity.speed = movementSpeeds[faster ? "run" : "walk"];

	// 2.5) Interaction: activate on current tile (placeholder)
	// Replace "a" with your actual action name if different.
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

		getCell(activationCell.x, activationCell.y, activationCell.z)?.onActivate?.(
			{
				activator: entity,
			},
		);

		getEdge(
			entity.x,
			entity.y,
			entity.z,
			entity.direction,
		)?.interact?.onActivate({
			activator: entity,
		});

		activeActions.delete("a");
	}

	updateEntityAndPlayer({
		dt,
		entity,
		desiredDirection: desired,
		faster,
		desiredAnimation: getPlayerAnimation(),
	});
}
/** Update player and world state */
function updateEntity(dt: number, entity: Entity) {
	if (gameState.paused) return;

	updateEntityAndPlayer({
		dt,
		entity,
		desiredDirection: null,
		faster: false,
	});
}

function updateEntityAndPlayer({
	dt,
	entity,
	desiredDirection,
	faster,
	desiredAnimation,
}: {
	dt: number;
	entity: Entity;
	desiredDirection: Direction | null;
	faster: boolean;
	desiredAnimation?: AnimationID;
}) {
	// 2) Speed based on run/walk
	entity.speed = movementSpeeds[faster ? "run" : "walk"];

	// 3) Movement start
	if (!entity.isMoving) {
		if (desiredDirection) {
			entity.direction = desiredDirection;

			const planned = tryPlanMove(desiredDirection, entity);
			if (planned) {
				entity.isMoving = true;

				entity.movingToTile = planned.end;
				entity.movingToAnimation = planned.animation ?? null;

				entity.path = planned.path.map((p) => ({
					...p,
				}));

				setCurrentSegment(entity);
			}
		}
	}

	// 4) Movement tween (pixel-based segments)
	if (entity.isMoving) {
		const dx = entity.xPxf - entity.xPxi;
		const dy = entity.yPxf - entity.yPxi;

		const distancePx = dx === 0 && dy === 0 ? 0 : Math.hypot(dx, dy);

		const currentPathSegment = entity.path[0];
		// On segment start
		if (!entity.pathSegmentProgress && currentPathSegment) {
			currentPathSegment.onSegmentStart?.(entity);
		}

		const moveDuration =
			entity.pathSegmentDuration ?? distancePx / entity.speed;

		entity.pathSegmentProgress += moveDuration === 0 ? 1 : dt / moveDuration;

		// On segment update
		currentPathSegment?.onSegment?.(entity);

		if (entity.pathSegmentProgress >= 1 && currentPathSegment) {
			setCell(entity.x, entity.y, entity.z, {
				...getCell(entity.x, entity.y, entity.z),
				blocked: false,
			});
			currentPathSegment.onSegmentEnd?.(entity);
		}

		if (entity.pathSegmentProgress >= 1) {
			entity.pathSegmentProgress = 1;
			snapToSegmentEnd(entity);

			entity.path.shift();

			const hasMore = setCurrentSegment(entity);
			if (!hasMore) {
				// Movement fully finished: snap logical state
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
			}
		} else {
			const t = entity.pathSegmentProgress;
			entity.xPx = Math.round(entity.xPxi + dx * t);
			entity.yPx = Math.round(entity.yPxi + dy * t);
		}
	}

	desiredAnimation ??= entity.animationCurrent;

	// 5) Anim AFTER we've updated movement
	updateEntityAnimation(dt, entity, desiredAnimation);

	const cell = getCell(entity.x, entity.y, entity.z);
	if (!entity.isMoving && !cell?.blocked) {
		setCell(entity.x, entity.y, entity.z, {
			...cell,
			blocked: true,
			onActivate({ activator }) {
				return entity.onActivate?.({ activator, activated: entity });
			},
		});
	}
}

function update(dt: number) {
	const isReady = isWorldImagesReady();
	if (!isReady) return;

	setTilesCountsIfNotSet();

	for (const [id, entity] of entities.entries()) {
		if (id === "player") continue;
		updateEntity(dt, entity);
	}

	updatePlayer(dt);
	updateCamera();
	updateAmbience(dt);
}

function draw(dt: number) {
	const isReady = isWorldImagesReady();
	if (!isReady) return;

	setTilesCountsIfNotSet();
	clear();

	const { minTileX, minTileY, maxTileX, maxTileY } = getVisibleTileRange();

	const startX = Math.max(0, minTileX);
	const startY = Math.max(0, minTileY);
	const endX = Math.min(tilesXCount - 1, maxTileX);
	const endY = Math.min(tilesYCount - 1, maxTileY);

	// TODO: Optimize by only calculating this once per frame
	const entitiesRenderZ: [number, Entity][] = Array.from(entities.values()).map(
		(entity) => [getEntitiesRenderZ(entity), entity],
	);

	// Row used for depth sorting: approximate “feet row”

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

				entitiesRenderZ.forEach(([renderZ, entity]) => {
					const entityRow = Math.floor(
						(entity.yPx + TILE_SIZE_PX - 1) / TILE_SIZE_PX,
					);
					const shouldDrawEntity =
						sublayer === "front" && layer.z === renderZ && ty === entityRow;

					if (shouldDrawEntity) {
						drawEntity(entity);
					}
				});

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
			`faster: ${getIsPlayerMovingFaster()}`,
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

	const feetScreenX = entityScreenX + TILE_SIZE_PX / 2;
	const feetScreenY = entityScreenY + TILE_SIZE_PX - 2;
	ctx.save();
	ctx.translate(feetScreenX, feetScreenY);

	const animName = entity.animationCurrent;
	const entityAnimations = animations[entity.renderVariant];
	const anim = entityAnimations[animName];

	if (!anim) {
		throw new Error(
			`Character ${entity.renderVariant} is missing animation ${animName}`,
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
	const bottom = -4;
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
