import { playSfx } from "../../../audio/audio-api";
import type { Direction } from "../../../input/input";
import { cellToPx } from "../cells";
import type { Transition } from "./transition";

export function getJumpDownTransition({
	x,
	y,
	z,
	dir,
	drop,
}: {
	x: number;
	y: number;
	z: number;
	dir: Direction;
	/**
	 * How many z-levels to drop down during the jump and adjust y accordingly
	 *
	 * Defaults to 1
	 */
	drop?: number;
}) {
	drop ??= 1;

	let end: Transition["end"] | undefined;
	let path: Transition["path"] | undefined;

	const durUp = 100;
	const durDown = 200;

	if (dir === "left") {
		path = [
			{
				...cellToPx(x - 0.85, y - 0.25),
				z,
				duration: durUp,
				onSegmentStart,
			},
			{
				...cellToPx(x - 1, y + 1),
				z: z - drop,
				duration: durDown,
			},
		];
		end = {
			x: x - 1,
			y: y + 1,
			z: z - drop,
		};
	}
	if (dir === "down") {
		path = [
			{
				...cellToPx(x, y - 0.25),
				z,
				duration: durUp,
				onSegmentStart,
			},
			{
				...cellToPx(x, y + 2),
				z,
				duration: durDown,
			},
		];
		end = {
			x,
			y: y + 1 + drop,
			z: z - drop,
		};
	}
	if (dir === "right") {
		path = [
			{
				...cellToPx(x + 0.85, y - 0.25),
				z,
				duration: durUp,
				onSegmentStart,
			},
			{
				...cellToPx(x + 1, y + drop),
				z: z - drop,
				duration: durDown,
			},
		];
		end = {
			x: x + 1,
			y: y + 1,
			z: z - drop,
		};
	}
	if (dir === "up") {
		path = [
			{
				...cellToPx(x, y - 0.75),
				z,
				duration: durUp,
				onSegmentStart,
			},
			{
				...cellToPx(x, y - 1 + drop),
				z: z - drop,
				duration: durDown,
			},
		];
		end = {
			x,
			y,
			z: z - drop,
		};
	}

	if (!path || !end) {
		throw new Error(
			`Could not create jump transition for dir=${dir} at ${x},${y},${z}`,
		);
	}

	return {
		end,
		path,
		condition(entity) {
			return entity.animationCurrent === "run";
		},
		animation: "jump",
	} satisfies Transition;
}

function onSegmentStart() {
	playSfx("jump", { volume: 0.33, detuneCents: -100 });
}
