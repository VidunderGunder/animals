import { createImageElement } from "../assets/image";
import {
	type CharacterAnimationID,
	renderFrameLayer,
} from "../characters/characters";
import {
	ASPECT_RATIO_X,
	ASPECT_RATIO_Y,
	DEBUG_OVERLAY,
	DEFAULT_MOVEMENT,
	GAME_HEIGHT,
	GAME_WIDTH,
	movementSpeeds,
	SCALE,
	TILE_SIZE,
} from "../config";
import { clear, ctx } from "../gfx/canvas";
import {
	activeActions,
	allActions,
	type Direction,
	directions,
	movementIntent,
	setMovementIntent,
} from "../input/input";
import { player, playerAnimations } from "../state";
import { laptopState, openLaptop } from "./laptop/laptop";

export function returnToOverworld() {
	allActions
		.filter((e) => !directions.some((d) => d === e))
		.forEach((e) => {
			activeActions.delete(e);
		});

	laptopState.show = false;

	player.paused = false;
	player.disabled = false;
}

function dirToTileVector(direction: Direction): { dx: number; dy: number } {
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

function getDesiredDirectionFromInput(): Direction | null {
	// Priority order if multiple are pressed at once.
	if (activeActions.has("up")) return "up";
	if (activeActions.has("down")) return "down";
	if (activeActions.has("left")) return "left";
	if (activeActions.has("right")) return "right";
	return null;
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

/** Get interpolated player world position in pixels */
function getPlayerPosition() {
	const t = player.moveProgress;
	const interpTileX =
		player.moveFromX + (player.moveToX - player.moveFromX) * t;
	const interpTileY =
		player.moveFromY + (player.moveToY - player.moveFromY) * t;

	return {
		x: interpTileX * TILE_SIZE,
		y: interpTileY * TILE_SIZE,
	};
}

function getVisibleTileRange(playerX: number, playerY: number) {
	const cameraX = playerX - GAME_WIDTH / 2 + TILE_SIZE / 2;
	const cameraY = playerY - GAME_HEIGHT / 2 + TILE_SIZE / 2;

	const minTileX = Math.floor(cameraX / TILE_SIZE) - 1;
	const minTileY = Math.floor(cameraY / TILE_SIZE) - 1;
	const maxTileX = Math.ceil((cameraX + GAME_WIDTH) / TILE_SIZE) + 1;
	const maxTileY = Math.ceil((cameraY + GAME_HEIGHT) / TILE_SIZE) + 1;

	return {
		minTileX,
		minTileY,
		maxTileX,
		maxTileY,
	};
}

const sublayers = ["ground", "back", "front"] as const;

const worldImageLayers: {
	z: number;
	ground?: HTMLImageElement;
	back?: HTMLImageElement;
	front?: HTMLImageElement;
}[] = [
	{
		z: 0,
		ground: createImageElement("/world/start/scenery.png"),
	},
	{
		z: 0,
		ground: createImageElement("/world/start/obstacle-course/0-ground.png"),
		back: createImageElement("/world/start/obstacle-course/0-back.png"),
		front: createImageElement("/world/start/obstacle-course/0-front.png"),
	},
	{
		z: 1,
		ground: createImageElement("/world/start/obstacle-course/1-ground.png"),
		back: createImageElement("/world/start/obstacle-course/1-back.png"),
		front: createImageElement("/world/start/obstacle-course/1-front.png"),
	},
];

let tilesYCount = 0;
let tilesXCount = 0;

function setTilesCountsIfNotSet() {
	if (!tilesYCount || !tilesXCount) {
		const firstImage =
			worldImageLayers[0]?.ground ||
			worldImageLayers[0]?.back ||
			worldImageLayers[0]?.front;
		if (!firstImage || !firstImage.complete || firstImage.naturalWidth === 0)
			return;
		tilesXCount = firstImage.naturalWidth / TILE_SIZE;
		tilesYCount = firstImage.naturalHeight / TILE_SIZE;
	}
}

function isWorldImagesReady() {
	return worldImageLayers.every((layer) => {
		const groundReady = layer.ground
			? layer.ground.complete && layer.ground.naturalWidth > 0
			: true;
		const backReady = layer.back
			? layer.back.complete && layer.back.naturalWidth > 0
			: true;
		const frontReady = layer.front
			? layer.front.complete && layer.front.naturalWidth > 0
			: true;
		return groundReady && backReady && frontReady;
	});
}

/** Update player and world state */
function updatePlayer(dt: number) {
	if (player.paused) return;

	const isReady = isWorldImagesReady();
	if (!isReady) return;

	setTilesCountsIfNotSet();

	if (!player.disabled && activeActions.has("start")) openLaptop();

	const isMovingFaster = getIsMovingFaster();

	// 1. Input intent for this frame
	const desired = player.disabled ? null : getDesiredDirectionFromInput();
	setMovementIntent(desired);

	// 2. Speed based on run/walk
	player.speed = movementSpeeds[isMovingFaster ? "run" : "walk"];

	// 3. Movement start
	if (!player.movingDirection) {
		if (desired) {
			player.facingDirection = desired;
			player.movingDirection = desired;

			const { dx, dy } = dirToTileVector(desired);

			const isNewDirection =
				player.moveToX !== player.tileX + dx ||
				player.moveToY !== player.tileY + dy;

			const targetTileX = isNewDirection ? player.tileX + dx : player.moveFromX;
			const targetTileY = isNewDirection ? player.tileY + dy : player.moveFromY;

			if (targetTileX !== player.tileX || targetTileY !== player.tileY) {
				// Start moving
				player.movingDirection = desired;

				const outOfBoundsX = targetTileX < 0 || targetTileX >= tilesXCount;
				const outOfBoundsY = targetTileY < 0 || targetTileY >= tilesYCount;
				const isOutOfBounds = outOfBoundsX || outOfBoundsY;
				const isCollisionTile = false; // Placeholder for collision detection

				if (isOutOfBounds || isCollisionTile) return;

				player.moveFromX = player.tileX;
				player.moveFromY = player.tileY;
				player.moveToX = targetTileX;
				player.moveToY = targetTileY;
				player.moveProgress = 0;
			}
		}
	}

	// 4. Movement tween
	if (player.movingDirection) {
		const distancePx = TILE_SIZE;
		const moveDuration = distancePx / player.speed; // seconds for one tile
		player.moveProgress += dt / moveDuration;

		if (player.moveProgress >= 1) {
			player.moveProgress = 1;
			player.tileX = player.moveToX;
			player.tileY = player.moveToY;
			player.movingDirection = null;
		}
	}

	// 5. Anim AFTER we've updated movement
	updatePlayerAnimation(dt);
}

function update(dt: number) {
	updatePlayer(dt);
}

function draw(dt: number) {
	const isReady = isWorldImagesReady();
	if (!isReady) return;

	setTilesCountsIfNotSet();
	clear();

	const { x: playerX, y: playerY } = getPlayerPosition();

	const cameraX = playerX - GAME_WIDTH / 2 + TILE_SIZE / 2;
	const cameraY = playerY - GAME_HEIGHT / 2 + TILE_SIZE / 2;

	const { minTileX, minTileY, maxTileX, maxTileY } = getVisibleTileRange(
		playerX,
		playerY,
	);

	// Clamp visible tile range to world bounds
	const startX = Math.max(0, minTileX);
	const startY = Math.max(0, minTileY);
	const endX = Math.min(tilesXCount - 1, maxTileX);
	const endY = Math.min(tilesYCount - 1, maxTileY);

	// Draw each layer tile-by-tile
	for (const layer of worldImageLayers) {
		for (let ty = startY; ty <= endY; ty++) {
			sublayers.forEach((sublayer) => {
				const image = layer[sublayer];
				if (!image) return;

				const sy = ty * TILE_SIZE;

				for (let tx = startX; tx <= endX; tx++) {
					const shouldDrawPlayer =
						sublayer === "back" &&
						layer.z === player.z &&
						(playerY === endY
							? player.tileY
							: Math.max(player.moveToY, player.tileY) === ty) &&
						tx === endX;

					if (shouldDrawPlayer) {
						drawPlayer();
					}

					const sx = tx * TILE_SIZE;

					// World pixel position of this tile
					const worldPx = tx * TILE_SIZE;
					const worldPy = ty * TILE_SIZE;

					// Screen pixel position
					const dx = Math.round(worldPx - cameraX);
					const dy = Math.round(worldPy - cameraY);

					ctx.drawImage(
						image,
						sx,
						sy,
						TILE_SIZE,
						TILE_SIZE,
						dx,
						dy,
						TILE_SIZE,
						TILE_SIZE,
					);
				}
			});
		}
	}

	// Optional debug overlay (tile coords, direction, run state)
	if (DEBUG_OVERLAY) {
		ctx.save();
		ctx.fillStyle = "#ffffff";
		ctx.font = "8px Tiny5";
		ctx.globalAlpha = laptopState.show ? 0.25 : 1.0;
		ctx.textBaseline = "top";
		ctx.shadowColor = laptopState.show ? "#00000000" : "#0000000d";
		ctx.shadowOffsetX = 0;
		ctx.shadowOffsetY = 1;
		ctx.shadowBlur = 0;
		[
			`fps: ${Math.round(1000 / dt)}`,
			`res: ${GAME_WIDTH}x${GAME_HEIGHT} (${SCALE}x, ${ASPECT_RATIO_X}:${ASPECT_RATIO_Y})`,
			`tile: (${player.tileX}, ${player.tileY})`,
			`facing: ${player.facingDirection}`,
			`moving: ${player.movingDirection}`,
			`faster: ${getIsMovingFaster()}`,
		].forEach((line, index) => {
			ctx.fillText(line, 4, 2 + index * 8);
		});
		ctx.restore();
	}
}

function drawPlayer() {
	const { x: playerWorldX, y: playerWorldY } = getPlayerPosition();

	const cameraX = playerWorldX - GAME_WIDTH / 2 + TILE_SIZE / 2;
	const cameraY = playerWorldY - GAME_HEIGHT / 2 + TILE_SIZE / 2;

	// Draw player
	// Player collision tile top-left, in screen space
	const playerScreenX = Math.round(playerWorldX - cameraX);
	const playerScreenY = Math.round(playerWorldY - cameraY);

	// We want the player's FEET to sit at the bottom-center of the tile.
	// - Feet X = center of tile
	// - Feet Y = bottom of tile
	const feetScreenX = playerScreenX + TILE_SIZE / 2;
	const feetScreenY = playerScreenY + TILE_SIZE;

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

	const dw = player.width; // 16
	const dh = player.height; // 24

	if (!frameLayers[0]) return;

	ctx.fillStyle = "#00000013";
	// Draw shadow under player
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
}
