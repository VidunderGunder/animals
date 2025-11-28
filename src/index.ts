import.meta.hot.accept();

// https://patorjk.com/software/taag/#p=display&f=ANSI-Compact&t=Canvas&x=none&v=4&h=4&w=80&we=false

/*
 ▄▄·        ▐ ▄ ·▄▄▄▪   ▄▄ • 
▐█ ▌▪▪     •█▌▐█▐▄▄·██ ▐█ ▀ ▪
██ ▄▄ ▄█▀▄ ▐█▐▐▌██▪ ▐█·▄█ ▀█▄
▐███▌▐█▌.▐▌██▐█▌██▌.▐█▌▐█▄▪▐█
·▀▀▀  ▀█▄▀▪▀▀ █▪▀▀▀ ▀▀▀·▀▀▀▀ 
-- Config -------------------------
*/

const SCALE = 1;
const GAME_WIDTH = 240 * SCALE; // 120 x 3
const GAME_HEIGHT = 160 * SCALE; // 80 x 3
const TILE_SIZE = 16; // pixels width/height of a tile
const FPS_LIMIT = 200;

type MovementType = "walk" | "run";
const DEFAULT_MOVEMENT: MovementType = "run";

const MovementSpeeds = {
  walk: 100,
  run: 220,
} as const satisfies Record<MovementType, number>;

const WORLD_WIDTH_TILES = 100;
const WORLD_HEIGHT_TILES = 100;

/*
 ▄▄·  ▄▄▄·  ▐ ▄  ▌ ▐· ▄▄▄· .▄▄ · 
▐█ ▌▪▐█ ▀█ •█▌▐█▪█·█▌▐█ ▀█ ▐█ ▀. 
██ ▄▄▄█▀▀█ ▐█▐▐▌▐█▐█•▄█▀▀█ ▄▀▀▀█▄
▐███▌▐█ ▪▐▌██▐█▌ ███ ▐█ ▪▐▌▐█▄▪▐█
·▀▀▀  ▀  ▀ ▀▀ █▪. ▀   ▀  ▀  ▀▀▀▀ 
-- Canvas -----------------------
*/

const canvas = document.getElementById("canvas");
if (!(canvas instanceof HTMLCanvasElement))
  throw new Error("Canvas element not found");

const ctx = canvas.getContext("2d");
if (!ctx) throw new Error("2D context not available");

canvas.width = GAME_WIDTH;
canvas.height = GAME_HEIGHT;

/*
▪   ▐ ▄  ▄▄▄·▄• ▄▌▄▄▄▄▄
██ •█▌▐█▐█ ▄██▪██▌•██  
▐█·▐█▐▐▌ ██▀·█▌▐█▌ ▐█.▪
▐█▌██▐█▌▐█▪·•▐█▄█▌ ▐█▌·
▀▀▀▀▀ █▪.▀    ▀▀▀  ▀▀▀ 
-- Input --------------
*/

const pressedKeys = new Set<string>();

const moveActions = ["up", "down", "left", "right"] as const;
type MoveAction = "up" | "down" | "left" | "right";

function isMove(action: Action | undefined): action is MoveAction {
  if (typeof action !== "string") return false;
  return moveActions.some((a) => a === action);
}

const allActions = [...moveActions, "primary", "secondary"] as const;
type Action = (typeof allActions)[number];
const activeActions = new Set<Action>();

let movementIntent: Direction | null = null;

const keyMap: Record<Action, string[]> = {
  up: ["ArrowUp", "w"],
  down: ["ArrowDown", "s"],
  left: ["ArrowLeft", "a"],
  right: ["ArrowRight", "d"],
  primary: [" "],
  secondary: ["Shift"],
};
const reverseKeyMap: Record<string, Action> = {};
for (const [action, keys] of Object.entries(keyMap)) {
  for (const key of keys) {
    reverseKeyMap[key] = action as Action;
  }
}
const allKeyBindings = Object.values(keyMap).flat();

function initKeyboard() {
  window.addEventListener("keydown", (e) => {
    const key = e.key;

    if (!allKeyBindings.includes(key)) return;

    e.preventDefault();

    pressedKeys.add(key);
    const action = reverseKeyMap[key];
    if (!action) return;

    const actionIsMove = isMove(action);
    if (actionIsMove) {
      const activeMoves = Array.from(activeActions).filter(isMove);
      for (const move of activeMoves) {
        activeActions.delete(move);
      }
    }

    activeActions.add(action);
  });

  window.addEventListener("keyup", (event) => {
    pressedKeys.delete(event.key);
    const action = reverseKeyMap[event.key];

    if (!action) return;

    if (isMove(action)) {
      const stillPressedMoves = Array.from(pressedKeys).filter((key) =>
        allKeyBindings.includes(key)
      );
      let newMoveAction: Action | null = null;
      for (const key of stillPressedMoves) {
        const possibleAction = reverseKeyMap[key];
        if (isMove(possibleAction)) {
          newMoveAction = possibleAction;
          break;
        }
      }
      if (newMoveAction) {
        activeActions.add(newMoveAction);
      }
    }

    activeActions.delete(action);
  });
}

initKeyboard();

/*
.▄▄ · ▄▄▄▄▄ ▄▄▄· ▄▄▄▄▄▄▄▄ .
▐█ ▀. •██  ▐█ ▀█ •██  ▀▄.▀·
▄▀▀▀█▄ ▐█.▪▄█▀▀█  ▐█.▪▐▀▀▪▄
▐█▄▪▐█ ▐█▌·▐█ ▪▐▌ ▐█▌·▐█▄▄▌
 ▀▀▀▀  ▀▀▀  ▀  ▀  ▀▀▀  ▀▀▀ 
-- State ------------------
*/

type Direction = "up" | "down" | "left" | "right";

type Player = {
  /** Current tile coordinates */
  tileX: number;
  tileY: number;

  /** Facing direction */
  direction: Direction;

  /** Size of sprite in pixels (square) */
  size: number;

  /** Movement speed (pixels per second) */
  speed: number;

  /** Whether we're currently tweening between tiles */
  isMoving: boolean;

  /** Movement interpolation state (tile coordinates) */
  moveFromX: number;
  moveFromY: number;
  moveToX: number;
  moveToY: number;
  /** 0 → start tile, 1 → target tile */
  moveProgress: number;

  /** Current animation state */
  animationCurrent: PlayerAnimationName;
  animationFrameIndex: number;
  animationTimer: number;
};

const startTileX = Math.floor(WORLD_WIDTH_TILES / 2);
const startTileY = Math.floor(WORLD_HEIGHT_TILES / 2);

const player: Player = {
  tileX: startTileX,
  tileY: startTileY,
  direction: "down",
  size: TILE_SIZE,
  speed: MovementSpeeds[DEFAULT_MOVEMENT],
  isMoving: false,
  moveFromX: startTileX,
  moveFromY: startTileY,
  moveToX: startTileX,
  moveToY: startTileY,
  moveProgress: 1,
  animationCurrent: "idle_down",
  animationFrameIndex: 0,
  animationTimer: 0,
};

const DIRECTION_ROW: Record<Direction, number> = {
  down: 0,
  left: 1,
  right: 2,
  up: 3,
};

type Animation = {
  /** Frame indices in the sprite sheet (column indexes) */
  frames: number[];
  /** Seconds each frame is shown */
  frameDuration: number;
  /** Loop back to start when finished */
  loop: boolean;
};

type PlayerAnimationName =
  | "idle_down"
  | "idle_up"
  | "idle_left"
  | "idle_right"
  | "walk_down"
  | "walk_up"
  | "walk_left"
  | "walk_right"
  | "run_down"
  | "run_up"
  | "run_left"
  | "run_right";

const playerAnimations = {
  // Idle: single frame for each direction (column 0)
  idle_down: { frames: [0], frameDuration: 0.3, loop: true },
  idle_up: { frames: [0], frameDuration: 0.3, loop: true },
  idle_left: { frames: [0], frameDuration: 0.3, loop: true },
  idle_right: { frames: [0], frameDuration: 0.3, loop: true },

  // Walking: 1 full cycle ≈ 1 tile
  walk_down: { frames: [1, 2, 3, 2], frameDuration: 0.13, loop: true },
  walk_up: { frames: [1, 2, 3, 2], frameDuration: 0.13, loop: true },
  walk_left: { frames: [1, 2, 3, 2], frameDuration: 0.13, loop: true },
  walk_right: { frames: [1, 2, 3, 2], frameDuration: 0.13, loop: true },

  // Running: snappier — about twice as fast
  run_down: { frames: [1, 2, 3, 2], frameDuration: 0.08, loop: true },
  run_up: { frames: [1, 2, 3, 2], frameDuration: 0.08, loop: true },
  run_left: { frames: [1, 2, 3, 2], frameDuration: 0.08, loop: true },
  run_right: { frames: [1, 2, 3, 2], frameDuration: 0.08, loop: true },
} as const satisfies Record<PlayerAnimationName, Animation>;

/*
 ▄▄ •  ▄▄▄· • ▌ ▄ ·. ▄▄▄ .
▐█ ▀ ▪▐█ ▀█ ·██ ▐███▪▀▄.▀·
▄█ ▀█▄▄█▀▀█ ▐█ ▌▐▌▐█·▐▀▀▪▄
▐█▄▪▐█▐█ ▪▐▌██ ██▌▐█▌▐█▄▄▌
·▀▀▀▀  ▀  ▀ ▀▀  █▪▀▀▀ ▀▀▀ 
-- Game ------------------
*/

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
function update(dt: number) {
  // 1. Input intent for this frame
  const desired = getDesiredDirectionFromInput();
  movementIntent = desired;

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
function draw() {
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
        ctx.fillStyle = "#7ec53c";
      } else {
        ctx.fillStyle = "#bdf66a";
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
  const playerScreenX = Math.round(playerWorldX - cameraX);
  const playerScreenY = Math.round(playerWorldY - cameraY);
  const centerX = playerScreenX + player.size / 2;
  const centerY = playerScreenY + player.size / 2;

  ctx.save();
  ctx.translate(centerX, centerY);

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

    const sx = frameColumn * TILE_SIZE;
    const sy = row * TILE_SIZE;
    const sw = TILE_SIZE;
    const sh = TILE_SIZE;

    const dw = player.size;
    const dh = player.size;

    ctx.drawImage(playerSpriteSheet, sx, sy, sw, sh, -dw / 2, -dh / 2, dw, dh);
  } else {
    // Fallback: white square while sheet is loading / missing
    ctx.fillStyle = "#ffffff";
    const size = player.size;
    ctx.fillRect(-size / 2, -size / 2, size, size);
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
 ▄▄▄· .▄▄ · .▄▄ · ▄▄▄ .▄▄▄▄▄.▄▄ · 
▐█ ▀█ ▐█ ▀. ▐█ ▀. ▀▄.▀·•██  ▐█ ▀. 
▄█▀▀█ ▄▀▀▀█▄▄▀▀▀█▄▐▀▀▪▄ ▐█.▪▄▀▀▀█▄
▐█ ▪▐▌▐█▄▪▐█▐█▄▪▐█▐█▄▄▌ ▐█▌·▐█▄▪▐█
 ▀  ▀  ▀▀▀▀  ▀▀▀▀  ▀▀▀  ▀▀▀  ▀▀▀▀ 
-- Assets ------------------------
*/

const playerSpriteSheet = document.getElementById(
  "player-sprite"
) as HTMLImageElement;

/*
▄▄▌               ▄▄▄·
██•  ▪     ▪     ▐█ ▄█
██▪   ▄█▀▄  ▄█▀▄  ██▀·
▐█▌▐▌▐█▌.▐▌▐█▌.▐▌▐█▪·•
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

requestAnimationFrame(loop);
