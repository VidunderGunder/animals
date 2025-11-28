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
const WALK_SPEED = 80; // pixels per second
const RUN_SPEED = 140; // pixels per second
const FPS_LIMIT = 60;
const DEFAULT_MOVEMENT: "walk" | "run" = "walk";

/*
 ▄▄▄▄  ▄▄▄  ▄▄  ▄▄ ▄▄ ▄▄  ▄▄▄   ▄▄▄▄ 
██▀▀▀ ██▀██ ███▄██ ██▄██ ██▀██ ███▄▄ 
▀████ ██▀██ ██ ▀██  ▀█▀  ██▀██ ▄▄██▀ 
*/

const canvas = document.getElementById("canvas");
if (!(canvas instanceof HTMLCanvasElement))
  throw new Error("Canvas element not found");

const ctx = canvas.getContext("2d")!;
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

type Player = {
  x: number;
  y: number;
  direction: "down" | "up" | "left" | "right";
  size: number;
  speed: number; // pixels per second
};

const player: Player = {
  // Player will in most cases be centered (world moving around them)
  x: GAME_WIDTH / 2 - TILE_SIZE / 2,
  y: GAME_HEIGHT / 2 - TILE_SIZE / 2,
  direction: "down",
  size: TILE_SIZE,
  speed: 0,
};

/*
 ▄▄▄▄  ▄▄▄  ▄▄   ▄▄ ▄▄▄▄▄ 
██ ▄▄ ██▀██ ██▀▄▀██ ██▄▄  
▀███▀ ██▀██ ██   ██ ██▄▄▄ 
*/

let t0 = 0;

function update(
  /** Delta time in seconds */
  dt: number
) {
  // TODO
}

function draw() {
  // TODO
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
