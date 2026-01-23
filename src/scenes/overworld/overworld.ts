import { createImageElement } from "../../assets/image";
import {
	type CharacterAnimationID,
	renderFrameLayer,
} from "../../characters/characters";
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
import {  getPlayerSaveData, player, playerAnimations } from "../../state";
import { savePlayerState } from "../../storage";
import { menuState, openMenu } from "../menu/menu";
import { camera, updateCamera } from "./camera";
import { getCell, getEdge, type Transition } from "./data";
import { initializeArea as initializeStartArea } from "./data/start";
import { renderDialogs } from "./dialog";

initializeStartArea();

export function returnToOverworld() {
	allActions
		.filter((e) => !directions.some((d) => d === e))
		.forEach((e) => {
			activeActions.delete(e);
		});

	menuState.show = false;

	player.paused = false;
	player.disabled = false;
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

function getIsMoving(): boolean {
	return !!player.movingDirection || !!movementIntent;
}

function getIsMovingFaster(): boolean {
	const isMoving = getIsMoving();
	if (!isMoving) return false;
	const bPressed = activeActions.has("b");
	return DEFAULT_MOVEMENT === "run" ? !bPressed : bPressed;
}

function getPlayerAnimation(): CharacterAnimationID {
	// If a transition is forcing an animation, keep it
	if (player.movingToAnimation === "jump") return "jump";
	if (player.movingToAnimation === "hop") return "hop";

	const isMovingFaster = getIsMovingFaster();
	if (isMovingFaster) return "run";

	const isMoving = getIsMoving();
	if (isMoving) return "walk";

	return "idle";
}

function updatePlayerAnimation(dt: number) {
	const desiredAnimation = getPlayerAnimation();

	if (player.animationCurrent !== desiredAnimation) {
		player.animationCurrent = desiredAnimation;
		player.animationFrameIndex = 0;
		player.animationTimer = 0;
		return;
	}

	const anim = playerAnimations[desiredAnimation];
	if (!anim) {
		throw new Error(
			`Character player is missing animation ${desiredAnimation}`,
		);
	}

	player.animationTimer += dt;

	if (player.animationTimer >= anim.frameDuration) {
		player.animationTimer -= anim.frameDuration;

		const nextIndex = player.animationFrameIndex + 1;
		if (nextIndex >= anim.frames.length) {
			player.animationFrameIndex = 0;
		} else {
			player.animationFrameIndex = nextIndex;
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
	back?: HTMLImageElement;
	front?: HTMLImageElement;
}[] = [
	{
		z: 0,
		back: createImageElement("/world/start/scenery.png"),
	},
	{
		z: 0,
		back: createImageElement("/world/start/obstacle-course/0-back.png"),
		front: createImageElement("/world/start/obstacle-course/0-front.png"),
	},
	{
		z: 1,
		back: createImageElement("/world/start/obstacle-course/1-back.png"),
		front: createImageElement("/world/start/obstacle-course/1-front.png"),
	},
] as const;

let tilesYCount = 0;
let tilesXCount = 0;

function setTilesCountsIfNotSet() {
	if (!tilesYCount || !tilesXCount) {
		const firstImage = worldImageLayers[0]?.back || worldImageLayers[0]?.front;
		if (!firstImage || !firstImage.complete || firstImage.naturalWidth === 0)
			return;
		tilesXCount = firstImage.naturalWidth / TILE_SIZE_PX;
		tilesYCount = firstImage.naturalHeight / TILE_SIZE_PX;
	}
}

function isWorldImagesReady() {
	return worldImageLayers.every((layer) => {
		const backReady = layer.back
			? layer.back.complete && layer.back.naturalWidth > 0
			: true;
		const frontReady = layer.front
			? layer.front.complete && layer.front.naturalWidth > 0
			: true;
		return backReady && frontReady;
	});
}

// --- path mover helpers ---
function startSegment(
	toX: number,
	toY: number,
	toZ: number,
	duration?: number,
) {
	player.xPxi = player.xPx;
	player.yPxi = player.yPx;
	player.zi = player.z;

	player.xPxf = toX;
	player.yPxf = toY;
	player.zf = toZ;

	player.pathSegmentProgress = 0;
	player.pathSegmentDuration = duration;
}

function popNextWaypoint(): boolean {
	const next = player.path.shift();
	if (!next) return false;
	startSegment(next.x, next.y, next.z, next.duration);
	return true;
}

function snapToSegmentEnd() {
	player.xPx = player.xPxf;
	player.yPx = player.yPxf;
	player.z = player.zf;
}

function tryPlanMove(desired: Direction): Transition | null {
	const edge = getEdge(player.x, player.y, player.z, desired);
	if (edge?.blocked) return null;

	if (edge?.transition) {
		const transitions = Array.isArray(edge.transition)
			? edge.transition
			: [edge.transition];
		for (const transition of transitions) {
			if (transition.condition === undefined) return transition;
			if (transition.condition()) return transition;
		}
		return null;
	}

	const { dx, dy } = dirToDxDy(desired);
	const nx = player.x + dx;
	const ny = player.y + dy;
	const nz = player.z;

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
	if (player.paused) return;

	if (!player.disabled && activeActions.has("start")) openMenu();

	const faster = getIsMovingFaster();

	const desired = player.disabled ? null : movementIntent;

	// 2) Speed based on run/walk
	player.speed = movementSpeeds[faster ? "run" : "walk"];

	// 2.5) Interaction: activate on current tile (placeholder)
	// Replace "a" with your actual action name if different.
	if (!player.disabled && activeActions.has("a") && !player.movingDirection) {
		const activationCell = {
			x: player.x,
			y: player.y,
			z: player.z,
		};

		if (player.facingDirection === "right") activationCell.x += 1;
		if (player.facingDirection === "down") activationCell.y += 1;
		if (player.facingDirection === "left") activationCell.x -= 1;
		if (player.facingDirection === "up") activationCell.y -= 1;

		getCell(
			activationCell.x,
			activationCell.y,
			activationCell.z,
		)?.interact?.onActivate();

		getEdge(
			player.x,
			player.y,
			player.z,
			player.facingDirection,
		)?.interact?.onActivate();

		activeActions.delete("a");
	}

	// 3) Movement start
	if (!player.movingDirection) {
		if (desired) {
			player.facingDirection = desired;

			const planned = tryPlanMove(desired);
			if (planned) {
				player.movingDirection = desired;

				player.movingToTile = planned.end;
				player.movingToAnimation = planned.animation ?? null;

				player.path = planned.path.map((p) => ({
					x: p.xPx,
					y: p.yPx,
					z: p.z,
					ms: p.duration,
				}));

				popNextWaypoint();
			}
		}
	}

	// 4) Movement tween (pixel-based segments)
	if (player.movingDirection) {
		const dx = player.xPxf - player.xPxi;
		const dy = player.yPxf - player.yPxi;

		const distancePx = dx === 0 && dy === 0 ? 0 : Math.hypot(dx, dy);

		const moveDuration =
			player.pathSegmentDuration ?? distancePx / player.speed;

		player.pathSegmentProgress += moveDuration === 0 ? 1 : dt / moveDuration;

		if (player.pathSegmentProgress >= 1) {
			player.pathSegmentProgress = 1;
			snapToSegmentEnd();

			const hasMore = popNextWaypoint();
			if (!hasMore) {
				// Movement fully finished: snap logical state
				if (!player.movingToTile) {
					throw new Error(
						"Invariant: movement finished but pendingEnd is null",
					);
				}

				player.x = player.movingToTile.x;
				player.y = player.movingToTile.y;
				player.z = player.movingToTile.z;

				player.movingDirection = null;
				player.movingToTile = null;
				player.movingToAnimation = null;

				// Autosave on step end
				savePlayerState(getPlayerSaveData());
			}
		} else {
			const t = player.pathSegmentProgress;
			player.xPx = Math.round(player.xPxi + dx * t);
			player.yPx = Math.round(player.yPxi + dy * t);
		}
	}

	// 5) Anim AFTER we've updated movement
	updatePlayerAnimation(dt);
}

function update(dt: number) {
	const isReady = isWorldImagesReady();
	if (!isReady) return;

	setTilesCountsIfNotSet();

	updatePlayer(dt);
	updateCamera(dt);
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

	const playerRenderZ = getPlayerRenderZ();

	// Row used for depth sorting: approximate “feet row”
	const playerRow = Math.floor((player.yPx + TILE_SIZE_PX - 1) / TILE_SIZE_PX);

	for (const layer of worldImageLayers) {
		for (let ty = startY; ty <= endY; ty++) {
			const sy = ty * TILE_SIZE_PX;
			const dy = Math.round(sy - camera.yPx);

			const sx = startX * TILE_SIZE_PX;
			const dx = Math.round(sx - camera.xPx);

			const w = (endX - startX + 1) * TILE_SIZE_PX;

			for (const sublayer of sublayers) {
				const image = layer[sublayer];
				if (!image) continue;

				const shouldDrawPlayer =
					sublayer === "front" && layer.z === playerRenderZ && ty === playerRow;

				if (shouldDrawPlayer) {
					drawPlayer();
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
			`facing: ${player.facingDirection}`,
			`moving: ${player.movingDirection}`,
			`faster: ${getIsMovingFaster()}`,
			`transition animation: ${player.movingToAnimation ?? "-"}`,
		].forEach((line, index) => {
			ctx.fillText(line, 4, 2 + index * 8);
		});
		ctx.restore();
	}
}

function getPlayerRenderZ(): number {
	if (!player.movingDirection) return player.z;

	const fromZ = player.zi;
	const toZ = player.zf;
	if (fromZ === toZ) return player.z;

	return player.pathSegmentProgress < 0.5 ? fromZ : toZ;
}

function drawPlayer() {
	const playerScreenX = Math.round(player.xPx - camera.xPx);
	const playerScreenY = Math.round(player.yPx - camera.yPx);

	const feetScreenX = playerScreenX + TILE_SIZE_PX / 2;
	const feetScreenY = playerScreenY + TILE_SIZE_PX - 2;

	ctx.save();
	ctx.translate(feetScreenX, feetScreenY);

	const animName = player.animationCurrent;
	const anim = playerAnimations[animName];

	if (!anim) {
		throw new Error(`Character player is missing animation ${animName}`);
	}

	const frameLayers = anim.frames[player.animationFrameIndex];
	if (frameLayers === undefined) {
		throw new Error(
			`Invalid animation frame index for ${animName}, index ${player.animationFrameIndex} but frames are ${anim.frames.length} long`,
		);
	}

	const dw = player.width;
	const dh = player.height;

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
		direction: player.facingDirection,
		x: -dw / 2,
		y: -dh,
	});

	ctx.restore();
}

export function overworld(dt: number) {
	update(dt);
	draw(dt);
	renderDialogs();
}
