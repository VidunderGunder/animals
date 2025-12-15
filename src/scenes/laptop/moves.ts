import { ctx } from "../../canvas";
import {
	type CharacterKey,
	characterKeys,
	characters,
} from "../../characters/characters";
import {
	CHARACTER_SPRITE_HEIGHT,
	CHARACTER_SPRITE_WIDTH,
	GAME_HEIGHT,
	GAME_WIDTH,
	TILE_SIZE,
} from "../../config";
import { activeActions, type Direction, directions } from "../../input";
import { returnToOverworld } from "../overworld";
import { laptopHeight, laptopWidth } from "./laptop";

const requiredAnimationIds = ["idle", "walk"] as const;
const optionalAnimationIds = [
	"run",
	"rideIdle",
	"rideSlow",
	"rideFast",
] as const;
const animationIds = [
	...requiredAnimationIds,
	...optionalAnimationIds,
] as const;

export type ReuqiredCharacterAnimationID =
	(typeof requiredAnimationIds)[number];
export type OptionalCharacterAnimationID =
	(typeof optionalAnimationIds)[number];
export type CharacterAnimationID = (typeof animationIds)[number];

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
	right: 2,
	up: 3,
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
	characterKeys.forEach((personId) => {
		const person = characters[personId];
		animationIds.forEach((animationId) => {
			const animation = person.animations[animationId];
			if (!animation && optionalAnimationIds.some((id) => animationId === id))
				return;
			if (!animation) {
				throw new Error(
					`Person ${personId} is missing required animation ${animationId}`,
				);
			}
			directions.forEach((direction) => {
				movesState.entities.push({
					personId,
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
	if (activeActions.has("start")) {
		returnToOverworld();
		return;
	}
	movesState.entities.forEach((entity) => {
		const person = characters[entity.personId];
		const anim = person.animations[entity.animationCurrent];
		entity.animationTimer += dt;
		if (entity.animationTimer >= anim.frameDuration) {
			entity.animationTimer -= anim.frameDuration;
			const nextIndex = entity.animationFrameIndex + 1;
			if (nextIndex >= anim.frames.length) {
				entity.animationFrameIndex = 0;
			} else {
				entity.animationFrameIndex = nextIndex;
			}
		}
	});
}

const cols = 3;
const perCol = 4;
const marginXOfSpriteWidth = 0.5;
const marginY = 4;

export function draw() {
	movesState.entities.forEach((entity, i) => {
		const person = characters[entity.personId];
		const animation =
			entity.animationCurrent in person.animations
				? person.animations[
						entity.animationCurrent as keyof typeof person.animations
					]
				: person.animations.walk;

		const frame = animation.frames[entity.animationFrameIndex];
		if (frame === undefined) {
			throw new Error(
				`Invalid animation frame index for ${entity.animationCurrent}, index ${entity.animationFrameIndex} but frames are ${animation.frames.length} long`,
			);
		}

		const directionIndex = directionToRow[entity.direction];

		const sx = frame * CHARACTER_SPRITE_WIDTH;
		const sy = directionIndex * CHARACTER_SPRITE_HEIGHT;

		const w = CHARACTER_SPRITE_WIDTH;
		const h = CHARACTER_SPRITE_HEIGHT;

		const laptopOffsetX = (GAME_WIDTH - laptopWidth) / 2;
		const laptopOffsetY = GAME_HEIGHT - laptopHeight;

		const col = Math.floor(i / perCol);
		const row = Math.floor(i / (cols * perCol));

		const moveXOffset =
			((perCol + marginXOfSpriteWidth) * CHARACTER_SPRITE_WIDTH * col) %
			((perCol + marginXOfSpriteWidth) * cols * CHARACTER_SPRITE_WIDTH);
		const moveYOffset = TILE_SIZE + row * CHARACTER_SPRITE_HEIGHT;

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
		// ctx.shadowBlur = 1;

		if (i % 4 === 0) {
			ctx.fillText(entity.animationCurrent, x + 2, y);
		}
		ctx.restore();

		ctx.drawImage(person.spriteSheet, sx, sy, w, h, x, y + textYOffset, w, h);
	});
}

export function moves(dt: number) {
	if (movesState.entities.length === 0) initializeMovesState();
	update(dt);
	draw();
}
