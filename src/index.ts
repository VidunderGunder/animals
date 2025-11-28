import.meta.hot.accept();

// https://patorjk.com/software/taag/#p=display&f=ANSI-Compact&t=Canvas&x=none&v=4&h=4&w=80&we=false

/*
 ▄▄▄▄  ▄▄▄  ▄▄  ▄▄  ▄▄▄▄ ▄▄▄▄▄▄ ▄▄▄  ▄▄  ▄▄ ▄▄▄▄▄▄ ▄▄▄▄ 
██▀▀▀ ██▀██ ███▄██ ███▄▄   ██  ██▀██ ███▄██   ██  ███▄▄ 
▀████ ▀███▀ ██ ▀██ ▄▄██▀   ██  ██▀██ ██ ▀██   ██  ▄▄██▀ 
*/

const GAME_WIDTH = 360;
const GAME_HEIGHT = 240;
const TILE_SIZE = 16; // pixels width/height of a tile
const WALK_SPEED = 80; // pixels per second (one tile = 16px, so 5 tiles/sec)
const FPS_LIMIT = 60;
const DEFAULT_MOVEMENT: "walk" | "run" = "walk";

const WORLD_WIDTH_TILES = 100;
const WORLD_HEIGHT_TILES = 100;

/*
 ▄▄▄▄  ▄▄▄  ▄▄  ▄▄ ▄▄ ▄▄  ▄▄▄   ▄▄▄▄ 
██▀▀▀ ██▀██ ███▄██ ██▄██ ██▀██ ███▄▄ 
▀████ ██▀██ ██ ▀██  ▀█▀  ██▀██ ▄▄██▀ 
*/

const canvas = document.getElementById("canvas");
if (!(canvas instanceof HTMLCanvasElement))
  throw new Error("Canvas element not found");

const ctx = canvas.getContext("2d");
if (!ctx) throw new Error("2D context not available");

canvas.width = GAME_WIDTH;
canvas.height = GAME_HEIGHT;

/*
▄▄ ▄▄  ▄▄ ▄▄▄▄  ▄▄ ▄▄ ▄▄▄▄▄▄ 
██ ███▄██ ██▄█▀ ██ ██   ██   
██ ██ ▀██ ██    ▀███▀   ██   
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
 ▄▄▄▄ ▄▄▄▄▄▄ ▄▄▄ ▄▄▄▄▄▄ ▄▄▄▄▄ 
███▄▄   ██  ██▀██  ██   ██▄▄  
▄▄██▀   ██  ██▀██  ██   ██▄▄▄                 
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
};

const player: Player = (() => {
  const startTileX = Math.floor(WORLD_WIDTH_TILES / 2);
  const startTileY = Math.floor(WORLD_HEIGHT_TILES / 2);

  return {
    tileX: startTileX,
    tileY: startTileY,
    direction: "down",
    size: TILE_SIZE,
    speed: DEFAULT_MOVEMENT === "walk" ? WALK_SPEED : WALK_SPEED, // run not used yet
    isMoving: false,
    moveFromX: startTileX,
    moveFromY: startTileY,
    moveToX: startTileX,
    moveToY: startTileY,
    moveProgress: 1,
  };
})();

/*
 ▄▄▄▄  ▄▄▄  ▄▄   ▄▄ ▄▄▄▄▄ 
██ ▄▄ ██▀██ ██▀▄▀██ ██▄▄  
▀███▀ ██▀██ ██   ██ ██▄▄▄ 
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

/** Update player and world state */
function update(dt: number) {
  // If not currently moving, see if we should start a tile move
  if (!player.isMoving) {
    const desired = getDesiredDirectionFromInput();

    if (desired) {
      player.direction = desired;

      const { dx, dy } = dirToVector(desired);
      const targetTileX = clampTile(player.tileX + dx, WORLD_WIDTH_TILES);
      const targetTileY = clampTile(player.tileY + dy, WORLD_HEIGHT_TILES);

      // If the target tile is different (i.e., we're not at the edge), start moving
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

  // If moving, advance tween
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
}

/** Draw world, player, and any debug overlays */
function draw() {
  if (!ctx) return;

  const { x: playerWorldX, y: playerWorldY } = getPlayerWorldPosition();

  // Camera keeps player centered
  const cameraX = playerWorldX - GAME_WIDTH / 2 + player.size / 2;
  const cameraY = playerWorldY - GAME_HEIGHT / 2 + player.size / 2;

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
      ctx.strokeStyle = "#00000043";
      ctx.lineWidth = 1;
      ctx.strokeRect(
        screenX + 0.5,
        screenY + 0.5,
        TILE_SIZE - 1,
        TILE_SIZE - 1
      );
    }
  }

  // Draw player as white square
  const playerScreenX = Math.round(playerWorldX - cameraX);
  const playerScreenY = Math.round(playerWorldY - cameraY);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(playerScreenX, playerScreenY, player.size, player.size);

  // Optional debug overlay (tile coords, direction)
  ctx.fillStyle = "#ffffff";
  ctx.font = "8px monospace";
  ctx.textBaseline = "top";
  ctx.fillText(
    `tile=(${player.tileX}, ${player.tileY}) dir=${player.direction} moving=${player.isMoving}`,
    4,
    4
  );
}

let previousFrameTimestamp = 0;

function loop(timestamp: number) {
  if (!previousFrameTimestamp) {
    previousFrameTimestamp = timestamp;
  }

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
