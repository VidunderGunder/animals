import { playerSpriteSheet } from "./assets";
import { ctx } from "./canvas";
import {
  DEFAULT_MOVEMENT,
  FPS_LIMIT,
  GAME_HEIGHT,
  GAME_WIDTH,
  MovementSpeeds,
  PLAYER_SPRITE_HEIGHT,
  PLAYER_SPRITE_WIDTH,
  TILE_SIZE,
  WORLD_HEIGHT_TILES,
  WORLD_WIDTH_TILES,
} from "./config";
import {
  activeActions,
  movementIntent,
  setMovementIntent,
  type Direction,
} from "./input";
import {
  player,
  type PlayerAnimationName,
  playerAnimations,
  DIRECTION_ROW,
} from "./state";

// Simple placeholder world: 100x100 checkerboard
const world: number[][] = Array.from({ length: WORLD_HEIGHT_TILES }, (_, y) =>
  Array.from({ length: WORLD_WIDTH_TILES }, (_, x) => (x + y) % 2)
);

function dirToVector(direction: Direction): { dx: number; dy: number } {
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

function clampTile(x: number, max: number) {
  return Math.min(Math.max(x, 0), max - 1);
}

function getDesiredDirectionFromInput(): Direction | null {
  // Priority order if multiple are pressed at once.
  if (activeActions.has("up")) return "up";
  if (activeActions.has("down")) return "down";
  if (activeActions.has("left")) return "left";
  if (activeActions.has("right")) return "right";
  return null;
}

function isRunning(): boolean {
  const secondaryPressed = activeActions.has("secondary");
  return DEFAULT_MOVEMENT === "run" ? !secondaryPressed : secondaryPressed;
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

function getDesiredPlayerAnimation(): PlayerAnimationName {
  const running = isRunning();
  const hasIntent = movementIntent !== null;

  if (hasIntent) {
    const dir = movementIntent as Direction;

    if (running) {
      // "run_down" | "run_left" | ...
      return `run_${dir}` as PlayerAnimationName;
    } else {
      // "walk_down" | "walk_left" | ...
      return `walk_${dir}` as PlayerAnimationName;
    }
  }

  // No directional input → idle in the last facing direction
  switch (player.direction) {
    case "down":
      return "idle_down";
    case "up":
      return "idle_up";
    case "left":
      return "idle_left";
    case "right":
      return "idle_right";
  }
}

function updatePlayerAnimation(dt: number) {
  const desired = getDesiredPlayerAnimation();

  if (player.animationCurrent !== desired) {
    player.animationCurrent = desired;
    player.animationFrameIndex = 0;
    player.animationTimer = 0;
    return;
  }

  const anim = playerAnimations[desired];
  player.animationTimer += dt;

  if (player.animationTimer >= anim.frameDuration) {
    player.animationTimer -= anim.frameDuration;

    const nextIndex = player.animationFrameIndex + 1;
    if (nextIndex >= anim.frames.length) {
      if (anim.loop) {
        player.animationFrameIndex = 0;
      } else {
        player.animationFrameIndex = anim.frames.length - 1;
      }
    } else {
      player.animationFrameIndex = nextIndex;
    }
  }
}

/** Update player and world state */
export function update(dt: number) {
  // 1. Input intent for this frame
  const desired = getDesiredDirectionFromInput();
  setMovementIntent(desired);

  // 2. Speed based on run/walk
  player.speed = MovementSpeeds[isRunning() ? "run" : "walk"];

  // 3. Movement start
  if (!player.isMoving) {
    if (desired) {
      player.direction = desired;

      const { dx, dy } = dirToVector(desired);
      const targetTileX = clampTile(player.tileX + dx, WORLD_WIDTH_TILES);
      const targetTileY = clampTile(player.tileY + dy, WORLD_HEIGHT_TILES);

      if (targetTileX !== player.tileX || targetTileY !== player.tileY) {
        player.isMoving = true;
        player.moveFromX = player.tileX;
        player.moveFromY = player.tileY;
        player.moveToX = targetTileX;
        player.moveToY = targetTileY;
        player.moveProgress = 0;
      }
    }
  }

  // 4. Movement tween
  if (player.isMoving) {
    const distancePx = TILE_SIZE;
    const moveDuration = distancePx / player.speed; // seconds for one tile
    player.moveProgress += dt / moveDuration;

    if (player.moveProgress >= 1) {
      player.moveProgress = 1;
      player.tileX = player.moveToX;
      player.tileY = player.moveToY;
      player.isMoving = false;
    }
  }

  // 5. Anim AFTER we've updated movement
  updatePlayerAnimation(dt);
}

/** Draw world, player, and any debug overlays */
export function draw() {
  if (!ctx) return;

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

  // Draw tiles
  for (let ty = minTileY; ty <= maxTileY; ty++) {
    if (ty < 0 || ty >= WORLD_HEIGHT_TILES) continue;

    for (let tx = minTileX; tx <= maxTileX; tx++) {
      if (tx < 0 || tx >= WORLD_WIDTH_TILES) continue;

      const tile = world[ty]?.[tx];

      const worldX = tx * TILE_SIZE;
      const worldY = ty * TILE_SIZE;
      const screenX = Math.round(worldX - cameraX);
      const screenY = Math.round(worldY - cameraY);

      // Placeholder "sprites": checkerboard grass
      if (tile === 0) {
        ctx.fillStyle = "#7bc586";
      } else {
        ctx.fillStyle = "#7bc586";
      }
      ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);

      // Light grid outline for debugging tile boundaries
      // ctx.strokeStyle = "#00000043";
      // ctx.lineWidth = 0.2;
      // ctx.strokeRect(
      //   screenX + 0.5,
      //   screenY + 0.5,
      //   TILE_SIZE - 1,
      //   TILE_SIZE - 1
      // );
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

  if (playerSpriteSheet) {
    const animName = player.animationCurrent;
    const anim = playerAnimations[animName];

    const frameColumn = anim.frames[player.animationFrameIndex];
    if (frameColumn === undefined) {
      throw new Error(
        `Invalid animation frame index for ${animName}, index ${player.animationFrameIndex} but frames are ${anim.frames.length} long`
      );
    }

    const row = DIRECTION_ROW[player.direction];

    // Source rect in the sprite sheet: 16x24 frames
    const sx = frameColumn * PLAYER_SPRITE_WIDTH;
    const sy = row * PLAYER_SPRITE_HEIGHT;
    const sw = PLAYER_SPRITE_WIDTH;
    const sh = PLAYER_SPRITE_HEIGHT;

    // Destination size: keep 1:1 pixel ratio (no scaling for now)
    const dw = player.width; // 16
    const dh = player.height; // 24

    // Draw so that (0,0) = feet position:
    // - X: center horizontally  → -dw / 2
    // - Y: feet at bottom       → -dh
    ctx.drawImage(playerSpriteSheet, sx, sy, sw, sh, -dw / 2, -dh, dw, dh);
  } else {
    // Fallback: rectangle standing on the tile with the same feet anchor
    ctx.fillStyle = "#ffffff";
    const dw = player.width;
    const dh = player.height;
    ctx.fillRect(-dw / 2, -dh, dw, dh);
  }

  ctx.restore();

  // Optional debug overlay (tile coords, direction, run state)
  ctx.fillStyle = "#ffffff";
  ctx.font = "8px monospace";
  ctx.textBaseline = "top";
  [
    `tile=(${player.tileX}, ${player.tileY})`,
    `dir=${player.direction}`,
    `moving=${player.isMoving}`,
    `running=${isRunning()}`,
  ].forEach((line, index) => ctx.fillText(line, 4, 4 + index * 10));
}

/*
▄▄▌               ▄▄▄·
██•  ▪     ▪     ▐█ ▄█
██▪   ▄█▀▄  ▄█▀▄  ██▀·
▐█▌▐▌▐█▌.▐▌▐█▌.▐▌▐█▪·•i
.▀▀▀  ▀█▄▀▪ ▀█▄▀▪.▀   
-- Loop --------------
*/

let previousFrameTimestamp = 0;

function loop(timestamp: number) {
  if (!previousFrameTimestamp) previousFrameTimestamp = timestamp;

  const elapsed = timestamp - previousFrameTimestamp;

  // Frame limiter: only update/draw if enough time has passed
  if (elapsed < 1000 / FPS_LIMIT) {
    requestAnimationFrame(loop);
    return;
  }

  const dt = elapsed / 1000; // seconds
  previousFrameTimestamp = timestamp;

  update(dt);
  draw();

  requestAnimationFrame(loop);
}

export function startGame() {
  previousFrameTimestamp = 0;
  requestAnimationFrame(loop);
}
