import { ctx } from "../canvas";
import {
	type CharacterAnimationID,
	renderFrameLayer,
} from "../characters/characters";
import {
	ASPECT_RATIO_X,
	ASPECT_RATIO_Y,
	DEBUG_OVERLAY,
	DEBUG_TILES,
	DEFAULT_MOVEMENT,
	GAME_HEIGHT,
	GAME_WIDTH,
	movementSpeeds,
	SCALE,
	TILE_SIZE,
} from "../config";
import {
	activeActions,
	allActions,
	type Direction,
	directions,
	movementIntent,
	setMovementIntent,
} from "../input/input";
import { player, playerAnimations } from "../state";
import { drawTile, tileMaps } from "../tiles";
import { world } from "../world";
import { laptopState, openLaptop } from "./laptop/laptop";

const WORLD_WIDTH_TILES = world[0]?.length ?? 0;
const WORLD_HEIGHT_TILES = world.length;

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

/** Get interpolated player world position in pixels */
function getPlayerWorldPosition() {
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

/** Update player and world state */
function updatePlayer(dt: number) {
	if (player.paused) return;

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

				const outOfBoundsX =
					targetTileX < 0 || targetTileX >= WORLD_WIDTH_TILES;
				const outOfBoundsY =
					targetTileY < 0 || targetTileY >= WORLD_HEIGHT_TILES;
				const isOutOfBounds =
					outOfBoundsX ||
					outOfBoundsY ||
					world[targetTileY]?.[targetTileX] === -1;
				const isCollisionTile = tileMaps.grass.colisionIndices.includes(
					world[targetTileY]?.[targetTileX] ?? -1,
				);

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

function draw(dt: number) {
	const { x: playerWorldX, y: playerWorldY } = getPlayerWorldPosition();

	// Camera keeps player centered
	const cameraX = playerWorldX - GAME_WIDTH / 2 + TILE_SIZE / 2;
	const cameraY = playerWorldY - GAME_HEIGHT / 2 + TILE_SIZE / 2;

	// Clear screen
	ctx.fillStyle = "#101010";
	ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

	// Compute visible tile range
	const minTileX = Math.floor(cameraX / TILE_SIZE) - 1;
	const minTileY = Math.floor(cameraY / TILE_SIZE) - 1;
	const maxTileX = Math.ceil((cameraX + GAME_WIDTH) / TILE_SIZE) + 1;
	const maxTileY = Math.ceil((cameraY + GAME_HEIGHT) / TILE_SIZE) + 1;

	const overlappingTiles: { x: number; y: number; tileIndex: number }[] = [];

	// Draw tiles
	for (let ty = minTileY; ty <= maxTileY; ty++) {
		if (ty < 0 || ty >= WORLD_HEIGHT_TILES) continue;

		for (let tx = minTileX; tx <= maxTileX; tx++) {
			if (tx < 0 || tx >= WORLD_WIDTH_TILES) continue;

			const tile = world[ty]?.[tx];
			if (tile === undefined) continue;

			const worldX = tx * TILE_SIZE;
			const worldY = ty * TILE_SIZE;
			const screenX = Math.round(worldX - cameraX);
			const screenY = Math.round(worldY - cameraY);

			if (tileMaps.grass.inFrontOfPlayerIndices.includes(tile)) {
				overlappingTiles.push({ x: screenX, y: screenY, tileIndex: tile });
				continue;
			}

			drawTile({
				tileset: "grass",
				tileIndex: tile,
				x: screenX,
				y: screenY,
			});

			// Light grid outline for debugging tile boundaries
			if (DEBUG_TILES) {
				ctx.strokeStyle = "rgba(255, 50, 153, 0.34)";
				ctx.lineWidth = 1.5;
				ctx.strokeRect(screenX, screenY, TILE_SIZE - 1, TILE_SIZE - 1);
			}
		}
	}

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

	renderFrameLayer({
		sheet: frameLayers[0].sheet,
		index: frameLayers[0].index,
		direction: player.facingDirection,
		x: -dw / 2,
		y: -dh,
	});

	// ctx.drawImage(
	// 	characters.player.spriteSheet,
	// 	sx,
	// 	sy,
	// 	sw,
	// 	sh,
	// 	-dw / 2,
	// 	-dh,
	// 	dw,
	// 	dh,
	// );

	ctx.restore();

	// Draw any tiles that should be in front of the player
	for (const tile of overlappingTiles) {
		drawTile({
			tileset: "grass",
			tileIndex: tile.tileIndex,
			x: tile.x,
			y: tile.y,
		});
	}

	// Optional debug overlay (tile coords, direction, run state)
	if (DEBUG_OVERLAY) {
		ctx.save();
		ctx.fillStyle = "#ffffff";
		ctx.font = "8px Tiny5";
		ctx.globalAlpha = laptopState.show ? 0.25 : 1.0;
		ctx.textBaseline = "top";
		ctx.shadowColor = laptopState.show ? "rgba(0,0,0,0)" : "rgba(0,0,0,0.05)";
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

export function overworld(dt: number) {
	updatePlayer(dt);
	draw(dt);
}
