import {
	CHARACTER_SPRITE_HEIGHT_PX,
	CHARACTER_SPRITE_WIDTH_PX,
	GAME_HEIGHT_PX,
	GAME_WIDTH_PX,
	TILE_SIZE_PX,
} from "../../config";
import { ctx } from "../../gfx/canvas";
import { type Direction, directions } from "../../input/input";
import {
	animationIds,
	type CharacterAnimationID,
	entityRenders,
	type RenderVariant,
	renderFrameLayers,
	renderVariantKeys,
} from "../../render/entities";
import { menuHeight, menuWidth } from "./menu";

export type EntitiesState = {
	personId: RenderVariant;

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
	renderVariantKeys.forEach((key) => {
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
	movesState.entities.forEach((entity) => {
		const entityRender = entityRenders[entity.personId];
		let animation = entityRender.animations[entity.animationCurrent];

		if (!animation) {
			console.warn(
				`Character ${entity.personId} is missing animation ${entity.animationCurrent}, defaulting to walk`,
			);
			animation = entityRender.animations.walk;
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
		const entityRender = entityRenders[entity.personId];
		const animation =
			entityRender.animations[
				entity.animationCurrent as keyof typeof entityRender.animations
			];

		const frameLayers = animation.frames[entity.animationFrameIndex];
		if (frameLayers === undefined) {
			throw new Error(
				`Invalid animation frame index for ${entity.animationCurrent}, index ${entity.animationFrameIndex} but frames are ${animation.frames.length} long`,
			);
		}

		const directionIndex = directionToRow[entity.direction];

		const menuOffsetX = (GAME_WIDTH_PX - menuWidth) / 2 + TILE_SIZE_PX;
		const menuOffsetY = (GAME_HEIGHT_PX - menuHeight) / 2 + TILE_SIZE_PX * 0.5;

		const col = Math.floor(i / perCol);
		const row = Math.floor(i / (cols * perCol));

		const moveXOffset =
			((perCol + marginXOfSpriteWidth) * CHARACTER_SPRITE_WIDTH_PX * col) %
			((perCol + marginXOfSpriteWidth) * cols * CHARACTER_SPRITE_WIDTH_PX);
		const moveYOffset = 13 + row * CHARACTER_SPRITE_HEIGHT_PX;

		const textHeight = 8;
		const textYOffset = textHeight + row;

		const x =
			moveXOffset +
			CHARACTER_SPRITE_WIDTH_PX +
			directionIndex * CHARACTER_SPRITE_WIDTH_PX +
			menuOffsetX;
		const y = moveYOffset + menuOffsetY + textYOffset * row + marginY * row;

		ctx.save();
		ctx.fillStyle = "#deeaeb";
		ctx.font = `${textHeight}px Tiny5`;
		ctx.textBaseline = "top";
		ctx.shadowColor = "#0000000d";
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
