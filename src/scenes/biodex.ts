// import.meta.hot.accept();

import { animalIds, animals, stageIds } from "../animals";
import { ctx } from "../canvas";
import { GAME_HEIGHT, GAME_WIDTH, TILE_SIZE } from "../config";
import { activeActions, type Direction, directions } from "../input";
import {
	type AnimationName,
	animalAnimations,
	animalDirectionRow,
	player,
} from "../state";
import { returnToOverworld } from "./overworld";

export function openBioDex() {
	activeActions.delete("start");
	player.disabled = true;
	biodexState.show = true;
}

export type BioDexState = {
	show: boolean;
	index: number;

	/** Facing direction */
	direction: Direction;

	/** Current animation state */
	animationCurrent: AnimationName;
	animationFrameIndex: number;
	animationTimer: number;
};

export const biodexState: BioDexState = {
	show: false,
	index: 0,

	direction: "down",

	animationCurrent: "idle_down",
	animationFrameIndex: 0,
	animationTimer: 0,
};

function updateAnimation(dt: number) {
	const anim = animalAnimations[biodexState.animationCurrent];
	biodexState.animationTimer += dt;

	if (biodexState.animationTimer >= anim.frameDuration) {
		biodexState.animationTimer -= anim.frameDuration;

		const nextIndex = biodexState.animationFrameIndex + 1;
		if (nextIndex >= anim.frames.length) {
			if (anim.loop) {
				biodexState.animationFrameIndex = 0;
			} else {
				biodexState.animationFrameIndex = anim.frames.length - 1;
			}
		} else {
			biodexState.animationFrameIndex = nextIndex;
		}
	}
}

function update(dt: number) {
	if (activeActions.has("start")) {
		returnToOverworld();
		return;
	}
	updateAnimation(dt);
}

function draw() {
	ctx.drawImage(
		document.getElementById("laptop") as HTMLImageElement,
		0,
		0,
		GAME_WIDTH,
		GAME_HEIGHT,
		0,
		0,
		GAME_WIDTH,
		GAME_HEIGHT,
	);
	animalIds
		.slice(biodexState.index, biodexState.index + 8)
		.forEach((id, animalIndex) => {
			const animal = animals[id];
			stageIds.forEach((stageId, stageIndex) => {
				const stage = animal.stages[stageId] ?? animals.missing.stages[stageId];

				let animalSprite = document.getElementById(
					stage.spriteId,
				) as HTMLImageElement | null;

				const isMissing = animal.stages[stageId] === undefined || !animalSprite;

				if (!animalSprite) {
					animalSprite = document.getElementById(
						animals.missing.stages[stageId].spriteId,
					) as HTMLImageElement;
				}

				for (
					let directionIndex = 0;
					directionIndex < directions.length;
					directionIndex++
				) {
					const direction = directions[directionIndex];

					if (!direction) continue;

					const animName = `idle_${direction}` as const;
					const anim = animalAnimations[animName];

					const row = animalDirectionRow[direction];

					const frameColumn = anim.frames[biodexState.animationFrameIndex];
					if (frameColumn === undefined) {
						throw new Error(
							`Invalid animation frame index for ${animName}, index ${biodexState.animationFrameIndex} but frames are ${anim.frames.length} long`,
						);
					}

					// Source rect in the sprite sheet: 16x16 frames
					const sx = frameColumn * stage.width;
					const sy = row * stage.height;
					const sw = stage.width;
					const sh = stage.height;

					// Destination size: keep 1:1 pixel ratio (no scaling for now)
					const dw = stage.width; // 16
					const dh = stage.height; // 16

					const y = 1 * TILE_SIZE + animalIndex * TILE_SIZE;
					const x =
						(stageIndex * TILE_SIZE) / 2 +
						1 * TILE_SIZE +
						stageIndex * TILE_SIZE * directions.length +
						directionIndex * TILE_SIZE;

					ctx.save();
					ctx.globalAlpha = isMissing ? 0.25 : 1.0;
					// Draw so that (0,0) = feet position:
					if (direction === "right") {
						// Mirror right-facing sprites
						ctx.scale(-1, 1);
						ctx.drawImage(
							animalSprite,
							sx,
							sy,
							sw,
							sh,
							-x - dw, // Adjust x position for mirroring
							y,
							dw,
							dh,
						);
					} else {
						ctx.drawImage(animalSprite, sx, sy, sw, sh, x, y, dw, dh);
					}
					ctx.restore();
				}
			});
		});
}

export function biodex(dt: number) {
	if (!biodexState.show) return;
	update(dt);
	draw();
}
