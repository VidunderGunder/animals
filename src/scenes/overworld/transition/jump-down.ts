import { impact } from "../../../animation/effect";
import { audio } from "../../../audio/audio-engine";
import type { Direction } from "../../../input/input";
import { cellToPx } from "../cells";
import type { Entity } from "../entity";
import { isTransitionEndBlocked, type Transition } from "./transition";

export function getJumpDownTransition({
	x,
	y,
	z,
	direction,
	distance,
	drop,
}: {
	x: number;
	y: number;
	z: number;
	direction: Direction;
	distance?: number;
	/**
	 * How many z-levels to drop down during the jump and adjust y accordingly
	 *
	 * Defaults to 1
	 */
	drop?: number;
}) {
	distance ??= 1;
	drop ??= 1;

	let end: Transition["end"] | undefined;
	let path: Transition["path"] | undefined;

	const durUp = 60 + distance * 40;
	const durDown = 110 + distance * 50;

	if (direction === "left") {
		path = [
			{
				...cellToPx(x - (0.4 + 0.3 * distance), y - distance * 0.3),
				z,
				duration: durUp,
				onSegmentStart: onJumpStart,
			},
			{
				...cellToPx(x - 1 * distance, y + 1),
				z: z - drop,
				duration: durDown,
				onSegmentEnd: (e) => onJumpEnd(e, drop),
			},
		];
		end = {
			x: x - 1 * distance,
			y: y + 1,
			z: z - drop,
		};
	}
	if (direction === "down") {
		path = [
			{
				...cellToPx(x, y - 0.25 * distance),
				z,
				duration: durUp,
				onSegmentStart: onJumpStart,
			},
			{
				...cellToPx(x, y + 2 * distance),
				z,
				duration: durDown,
				onSegmentEnd: (e) => onJumpEnd(e, drop),
			},
		];
		end = {
			x,
			y: y + 1 * distance + drop,
			z: z - drop,
		};
	}
	if (direction === "right") {
		path = [
			{
				...cellToPx(x + (0.4 + 0.3 * distance), y - distance * 0.3),
				z,
				duration: durUp,
				onSegmentStart: onJumpStart,
			},
			{
				...cellToPx(x + 1 * distance, y + drop),
				z: z - drop,
				duration: durDown,
				onSegmentEnd: (e) => onJumpEnd(e, drop),
			},
		];
		end = {
			x: x + 1 * distance,
			y: y + 1,
			z: z - drop,
		};
	}
	if (direction === "up") {
		path = [
			{
				...cellToPx(x, y - 0.75 * distance),
				z,
				duration: durUp,
				onSegmentStart: onJumpStart,
			},
			{
				...cellToPx(x, y - 1 * distance + drop),
				z: z - drop,
				duration: durDown,
				onSegmentEnd: (e) => onJumpEnd(e, drop),
			},
		];
		end = {
			x,
			y: y - 1 * distance,
			z: z - drop,
		};
	}

	if (!path || !end) {
		throw new Error(
			`Could not create jump transition for dir=${direction} at ${x},${y},${z}`,
		);
	}

	return {
		end,
		path,
		condition: (entity) => {
			if (isTransitionEndBlocked(end)) return false;
			return entity.moveMode === "run";
		},
		animation: "jump",
	} satisfies Transition;
}

function onJumpStart(entity: Entity) {
	entity.interactionLock = true;
	const volumeFactor = entity.id === "player" ? 0.5 : 0.1;
	audio.playSfx("jump", { volume: 0.33 * volumeFactor, detuneCents: -100 });
}

function onJumpEnd(entity: Entity, drop: number = 1) {
	entity.interactionLock = false;
	playThudSfx(entity);
	impact({
		xPx: entity.xPx,
		yPx: entity.yPx,
		z: entity.transitionEndTile?.z ?? drop,
	});
}

function playThudSfx(entity: Entity) {
	const volumeFactor = entity.id === "player" ? 1 : 0.1;
	audio.playSfx("thud", { volume: 0.25 * volumeFactor });
}
