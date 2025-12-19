import { ctx } from "../../canvas";
import {
	animationIds,
	type CharacterAnimationID,
	type CharacterKey,
	characterKeys,
	characters,
	renderFrameLayers,
} from "../../characters/characters";
import {
	CHARACTER_SPRITE_HEIGHT,
	CHARACTER_SPRITE_WIDTH,
	GAME_HEIGHT,
	GAME_WIDTH,
	TILE_SIZE,
} from "../../config";
import { activeActions, type Direction, directions } from "../../input/input";
import { returnToOverworld } from "../overworld";
import { laptopHeight, laptopWidth } from "./laptop";

export type EntitiesState = {
	personId: CharacterKey;

	/** Facing direction */
	direction: Direction;

	/** Current animation state */
	animationCurrent: CharacterAnimationID;
	animationFrameIndex: number;
	animationTimer: number;
};

export const directionToRow: Record<Direction, number> = {
	down: 0,
	left: 1,
	up: 2,
	right: 3,
} as const;

export type MovesState = {
	index: number;
	entities: EntitiesState[];
};

export const movesState: MovesState = {
	index: 0,
	entities: [],
};

export function initializeMovesState() {
	characterKeys.forEach((key) => {
		animationIds.forEach((animationId) => {
			directions.forEach((direction) => {
				movesState.entities.push({
					personId: key,
					direction,
					animationCurrent: animationId,
					animationFrameIndex: 0,
					animationTimer: 0,
				});
			});
		});
	});
}

function update(dt: number) {
	if (activeActions.has("start") || activeActions.has("b")) {
		returnToOverworld();
		return;
	}
	movesState.entities.forEach((entity) => {
		const character = characters[entity.personId];
		let animation = character.animations[entity.animationCurrent];

		if (!animation) {
			console.warn(
				`Character ${entity.personId} is missing animation ${entity.animationCurrent}, defaulting to walk`,
			);
			animation = character.animations.walk;
		}

		entity.animationTimer += dt;
		if (entity.animationTimer >= animation.frameDuration) {
			entity.animationTimer -= animation.frameDuration;
			const nextIndex = entity.animationFrameIndex + 1;
			if (nextIndex >= animation.frames.length) {
				entity.animationFrameIndex = 0;
			} else {
				entity.animationFrameIndex = nextIndex;
			}
		}
	});
}

const cols = 3;
const perCol = 4;
const marginXOfSpriteWidth = 1;
const marginY = 4;

export function draw() {
	movesState.entities.forEach((entity, i) => {
		const character = characters[entity.personId];
		const animation =
			character.animations[
				entity.animationCurrent as keyof typeof character.animations
			];

		const frameLayers = animation.frames[entity.animationFrameIndex];
		if (frameLayers === undefined) {
			throw new Error(
				`Invalid animation frame index for ${entity.animationCurrent}, index ${entity.animationFrameIndex} but frames are ${animation.frames.length} long`,
			);
		}

		const directionIndex = directionToRow[entity.direction];

		const laptopOffsetX = (GAME_WIDTH - laptopWidth) / 2 + TILE_SIZE;
		const laptopOffsetY = (GAME_HEIGHT - laptopHeight) / 2 + TILE_SIZE * 0.5;

		const col = Math.floor(i / perCol);
		const row = Math.floor(i / (cols * perCol));

		const moveXOffset =
			((perCol + marginXOfSpriteWidth) * CHARACTER_SPRITE_WIDTH * col) %
			((perCol + marginXOfSpriteWidth) * cols * CHARACTER_SPRITE_WIDTH);
		const moveYOffset = 13 + row * CHARACTER_SPRITE_HEIGHT;

		const textHeight = 8;
		const textYOffset = textHeight + row;

		const x =
			moveXOffset +
			CHARACTER_SPRITE_WIDTH +
			directionIndex * CHARACTER_SPRITE_WIDTH +
			laptopOffsetX;
		const y = moveYOffset + laptopOffsetY + textYOffset * row + marginY * row;

		ctx.save();
		ctx.fillStyle = "#deeaeb";
		ctx.font = `${textHeight}px Tiny5`;
		ctx.textBaseline = "top";
		ctx.shadowColor = "rgba(0,0,0,0.05)";
		ctx.shadowOffsetX = 0;
		ctx.shadowOffsetY = 1;

		if (i % 4 === 0) {
			ctx.fillText(`${entity.personId} ${entity.animationCurrent}`, x + 2, y);
		}
		ctx.restore();

		renderFrameLayers({
			frameLayers,
			direction: entity.direction,
			x,
			y: y + textYOffset,
		});
	});
}

export function moves(dt: number) {
	if (movesState.entities.length === 0) initializeMovesState();
	update(dt);
	draw();
}
