// import { animalIds, animals, stageIds } from "../../animals";
import { activeActions, type Direction } from "../../input";
import type { AnimationName } from "../../state";
import { returnToOverworld } from "../overworld";

export type BioDexState = {
  index: number;

  /** Facing direction */
  direction: Direction;

  /** Current animation state */
  animationCurrent: AnimationName;
  animationFrameIndex: number;
  animationTimer: number;
};

export const movesState: BioDexState = {
  index: 0,

  direction: "down",

  animationCurrent: "idle_down",
  animationFrameIndex: 0,
  animationTimer: 0,
};

function update(_dt: number) {
  if (activeActions.has("start")) {
    returnToOverworld();
    return;
  }
}

export function draw() {
  //
}

export function moves(dt: number) {
  update(dt);
  draw();
}
