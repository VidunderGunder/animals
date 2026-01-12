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
	GAME_HEIGHT,
	GAME_WIDTH,
	movementSpeeds,
	SCALE,
	TILE_SIZE,
} from "../../config";
import { clear, ctx } from "../../gfx/canvas";
import {
	activeActions,
	allActions,
	type Direction,
	directions,
	movementIntent,
	setMovementIntent,
} from "../../input/input";
import { player, playerAnimations } from "../../state";
import { menuState, openMenu } from "../menu/menu";
import { startWorldRules, type Transition } from "./data/start";

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

function getDesiredDirectionFromInput(): Direction | null {
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
	// If a transition is forcing an animation, keep it
	if (player.pendingAnim === "jump") return "jump";
	if (player.pendingAnim === "hop") return "hop";

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

function getPlayerPosition() {
	return { x: player.worldX, y: player.worldY };
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
		tilesXCount = firstImage.naturalWidth / TILE_SIZE;
		tilesYCount = firstImage.naturalHeight / TILE_SIZE;
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
function startSegment(toX: number, toY: number, toZ: number) {
	player.moveSegFromX = player.worldX;
	player.moveSegFromY = player.worldY;
	player.moveSegFromZ = player.z;

	player.moveSegToX = toX;
	player.moveSegToY = toY;
	player.moveSegToZ = toZ;

	player.moveSegProgress = 0;
}

function popNextWaypoint(): boolean {
	const next = player.movePath.shift();
	if (!next) return false;
	startSegment(next.x, next.y, next.z);
	return true;
}

function snapToSegmentEnd() {
	player.worldX = player.moveSegToX;
	player.worldY = player.moveSegToY;
	player.z = player.moveSegToZ;
}

function tryPlanMove(desired: Direction, faster: boolean): Transition | null {
	// Edge rule first
	const edge = startWorldRules.getEdgeRule(
		player.tileX,
		player.tileY,
		player.z,
		desired,
	);
	if (edge?.blocked) return null;

	if (edge?.transition) {
		if (edge.transition.requireFaster && !faster) return null;
		return edge.transition;
	}

	// Default walk + jump-stub logic
	const { dx, dy } = dirToDxDy(desired);
	const nx = player.tileX + dx;
	const ny = player.tileY + dy;
	const nz = player.z;

	if (nx < 0 || ny < 0 || nx >= tilesXCount || ny >= tilesYCount) return null;

	const destination = startWorldRules.getCellRule(nx, ny, nz);

	if (destination?.blocked) return null;

	return {
		path: [{ xPx: nx * TILE_SIZE, yPx: ny * TILE_SIZE, z: nz }],
		end: { tileX: nx, tileY: ny, z: nz },
	};
}

/** Update player and world state */
function updatePlayer(dt: number) {
	if (player.paused) return;

	const isReady = isWorldImagesReady();
	if (!isReady) return;

	setTilesCountsIfNotSet();

	if (!player.disabled && activeActions.has("start")) openMenu();

	const faster = getIsMovingFaster();

	// 1) Input intent for this frame
	const desired = player.disabled ? null : getDesiredDirectionFromInput();
	setMovementIntent(desired);

	// 2) Speed based on run/walk
	player.speed = movementSpeeds[faster ? "run" : "walk"];

	// 2.5) Interaction: activate on current tile (placeholder)
	// Replace "a" with your actual action name if different.
	if (!player.disabled && activeActions.has("a") && !player.movingDirection) {
		const activationCell = {
			x: player.tileX,
			y: player.tileY,
			z: player.z,
		};

		if (player.facingDirection === "right") activationCell.x += 1;
		if (player.facingDirection === "down") activationCell.y += 1;
		if (player.facingDirection === "left") activationCell.x -= 1;
		if (player.facingDirection === "up") activationCell.y -= 1;

		startWorldRules
			.getCellRule(activationCell.x, activationCell.y, activationCell.z)
			?.interact?.onActivate();

		activeActions.delete("a");
	}

	// 3) Movement start
	if (!player.movingDirection) {
		if (desired) {
			player.facingDirection = desired;

			const planned = tryPlanMove(desired, faster);
			if (planned) {
				player.movingDirection = desired;

				player.pendingEnd = planned.end;
				player.pendingAnim = planned.animation ?? null;

				player.movePath = planned.path.map((p) => ({
					x: p.xPx,
					y: p.yPx,
					z: p.z,
				}));

				popNextWaypoint();
			}
		}
	}

	// 4) Movement tween (pixel-based segments)
	if (player.movingDirection) {
		const dx = player.moveSegToX - player.moveSegFromX;
		const dy = player.moveSegToY - player.moveSegFromY;

		const distancePx = dx === 0 && dy === 0 ? 0 : Math.hypot(dx, dy);

		const moveDuration = distancePx === 0 ? 0 : distancePx / player.speed;
		player.moveSegProgress += moveDuration === 0 ? 1 : dt / moveDuration;

		if (player.moveSegProgress >= 1) {
			player.moveSegProgress = 1;
			snapToSegmentEnd();

			const hasMore = popNextWaypoint();
			if (!hasMore) {
				// Movement fully finished: snap logical state
				if (!player.pendingEnd) {
					throw new Error(
						"Invariant: movement finished but pendingEnd is null",
					);
				}

				player.tileX = player.pendingEnd.tileX;
				player.tileY = player.pendingEnd.tileY;
				player.z = player.pendingEnd.z;

				player.movingDirection = null;
				player.pendingEnd = null;
				player.pendingAnim = null;
			}
		} else {
			const t = player.moveSegProgress;
			player.worldX = Math.round(player.moveSegFromX + dx * t);
			player.worldY = Math.round(player.moveSegFromY + dy * t);
		}
	}

	// 5) Anim AFTER we've updated movement
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

	const startX = Math.max(0, minTileX);
	const startY = Math.max(0, minTileY);
	const endX = Math.min(tilesXCount - 1, maxTileX);
	const endY = Math.min(tilesYCount - 1, maxTileY);

	const playerRenderZ = getPlayerRenderZ();

	// Row used for depth sorting: approximate “feet row”
	const playerRow = Math.floor((player.worldY + TILE_SIZE - 1) / TILE_SIZE);

	for (const layer of worldImageLayers) {
		for (let ty = startY; ty <= endY; ty++) {
			const sy = ty * TILE_SIZE;
			const dy = Math.round(sy - cameraY);

			const sx = startX * TILE_SIZE;
			const dx = Math.round(sx - cameraX);

			const w = (endX - startX + 1) * TILE_SIZE;

			for (const sublayer of sublayers) {
				const image = layer[sublayer];
				if (!image) continue;

				const shouldDrawPlayer =
					sublayer === "front" && layer.z === playerRenderZ && ty === playerRow;

				if (shouldDrawPlayer) {
					drawPlayer();
				}

				ctx.drawImage(image, sx, sy, w, TILE_SIZE, dx, dy, w, TILE_SIZE);
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
			`res: ${GAME_WIDTH}x${GAME_HEIGHT} (${SCALE}x, ${ASPECT_RATIO_X}:${ASPECT_RATIO_Y})`,
			`tile: (${player.tileX}, ${player.tileY}, z=${player.z})`,
			`facing: ${player.facingDirection}`,
			`moving: ${player.movingDirection}`,
			`faster: ${getIsMovingFaster()}`,
			`animLock: ${player.pendingAnim ?? "-"}`,
		].forEach((line, index) => {
			ctx.fillText(line, 4, 2 + index * 8);
		});
		ctx.restore();
	}
}

function getPlayerRenderZ(): number {
	if (!player.movingDirection) return player.z;

	// If this segment changes z, pick which layer to draw on based on progress.
	const fromZ = player.moveSegFromZ;
	const toZ = player.moveSegToZ;
	if (fromZ === toZ) return player.z;

	return player.moveSegProgress < 0.5 ? fromZ : toZ;
}

function drawPlayer() {
	const { x: playerWorldX, y: playerWorldY } = getPlayerPosition();

	const cameraX = playerWorldX - GAME_WIDTH / 2 + TILE_SIZE / 2;
	const cameraY = playerWorldY - GAME_HEIGHT / 2 + TILE_SIZE / 2;

	const playerScreenX = Math.round(playerWorldX - cameraX);
	const playerScreenY = Math.round(playerWorldY - cameraY);

	const feetScreenX = playerScreenX + TILE_SIZE / 2;
	const feetScreenY = playerScreenY + TILE_SIZE - 2;

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
}
