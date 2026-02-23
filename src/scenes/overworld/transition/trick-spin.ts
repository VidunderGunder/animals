import { animationSheets } from "../../../animation/animation";
import { impact } from "../../../animation/effect";
import { audio } from "../../../audio/audio-engine";
import { moveSpeeds, TILE_SIZE_PX } from "../../../config";
import {
	directionToDxDy,
	ease,
	equalVec,
	getCellInDirection,
	jitter,
	mix,
	pxToTile,
} from "../../../functions/general";
import { type Direction, rotate } from "../../../input/input";
import { type Entity, pushTrailStep } from "../entity";
import { occupy, vacate } from "../occupancy";
import { injectOnSegmentStart, type Transition } from "./transition";
import { checkTileStepAllowed, crashBothOnCollision } from "./trick-crash";

function spinStartSFX() {
	audio.playSfx("jump", {
		volume: jitter(0.01),
		playbackRate: jitter(0.5),
	});
	audio.playSfx("swoosh", {
		volume: jitter(0.125),
		playbackRate: jitter(1.5),
	});
	audio.playSfx("swoosh", {
		volume: jitter(0.0675),
		playbackRate: jitter(0.5),
	});
}

function spinDelaySFX() {
	audio.playSfx("swoosh", {
		volume: jitter(0.06),
		playbackRate: jitter(1.25),
	});
}

export function spin(
	entity: Entity,
	direction?: Direction | null,
	rotation: "clockwise" | "counterclockwise" = "clockwise",
): Transition {
	const condition = (entity: Entity) => !entity.isMoving;

	const rounds = entity.moveMode === "run" ? 2 : 1;
	const distance = entity.moveMode === "run" ? 4 : 2;

	// build the path first (no side effects)
	const path = getSpinTransitionPath({
		entity,
		rotation,
		rounds,
		direction: direction ?? null,
		distance: direction ? distance : undefined,
	});

	// SFX only if/when the transition actually starts
	injectOnSegmentStart(path, () => spinStartSFX());

	// Keep end purely as “intended end” (collisions may override mid-path)
	const end = direction
		? getCellInDirection({
				position: { x: entity.x, y: entity.y, z: entity.z },
				direction,
				distance,
			})
		: { x: entity.x, y: entity.y, z: entity.z };

	return { condition, path, end };
}
function getSpinTransitionPath({
	entity,
	rotation,
	rounds,
	direction,
	distance,
}: {
	entity: Entity;
	rotation: "clockwise" | "counterclockwise";
	rounds: number;
	direction?: Direction | null;
	distance?: number;
}): Transition["path"] {
	const safeRounds = Math.max(0, Math.floor(rounds));
	const steps = safeRounds * 4;
	if (steps === 0) return [];

	const sheet = animationSheets[entity.sheet];

	const animationBase = {
		id: "spin-in-place",
		loop: false,
		frameDuration: Infinity,
	} as const;

	const frameIndex = rotation === "clockwise" ? 4 : 6;

	const start = {
		x: entity.x,
		y: entity.y,
		z: entity.z,
		xPx: entity.xPx,
		yPx: entity.yPx,
	};

	const slideDir = direction ?? null;
	const hasSlide = !!slideDir && (distance ?? 0) > 0;

	const distancePx = hasSlide ? (distance ?? 0) * TILE_SIZE_PX : 0;
	const baselineMoveMs = hasSlide
		? distancePx / Math.max(0.0001, entity.speed)
		: 0;
	const totalSlideSpinMs = hasSlide ? baselineMoveMs * 0.92 : 0;

	const rawMin = 70;
	const rawMax = 120;

	const rawDurations: number[] = [];
	for (let i = 0; i < steps; i++) {
		const t = steps === 1 ? 1 : i / (steps - 1);
		const eased = ease.outCubic(t);
		rawDurations.push(rawMin + (rawMax - rawMin) * eased);
	}

	let scale = 1;
	if (hasSlide) {
		const sum = rawDurations.reduce((a, b) => a + b, 0);
		const target = Math.max(60, totalSlideSpinMs);
		scale = sum > 0 ? target / sum : 1;
	} else {
		const speedFactor = Math.max(
			0.6,
			Math.min(1.2, entity.speed / moveSpeeds.walk),
		);
		scale = 1 / speedFactor;
	}

	const { dx, dy } = slideDir ? directionToDxDy(slideDir) : { dx: 0, dy: 0 };

	const totalDxPx = hasSlide ? dx * TILE_SIZE_PX * (distance ?? 0) : 0;
	const totalDyPx = hasSlide ? dy * TILE_SIZE_PX * (distance ?? 0) : 0;

	const path: Transition["path"] = [];

	for (let i = 0; i < steps; i++) {
		const isStartOfNewRound = i % 4 === 0;

		const linear = (i + 1) / steps;
		const curve = ease.inOutSine(linear);

		const alpha = 0.5;
		const posEase = mix(linear, curve, alpha);

		const xPx = hasSlide ? start.xPx + totalDxPx * posEase : start.xPx;
		const yPx = hasSlide ? start.yPx + totalDyPx * posEase : start.yPx;

		const rawDuration = rawDurations[i] ?? 0;

		path.push({
			z: start.z,
			xPx,
			yPx,
			duration: rawDuration * scale,
			onSegmentStart(e) {
				const assumedTile = pxToTile(e);

				vacate({ id: e.id });
				occupy({
					x: assumedTile.x,
					y: assumedTile.y,
					z: assumedTile.z,
					id: e.id,
				});
				if (!equalVec(assumedTile, entity.trail[entity.trail.length - 1])) {
					pushTrailStep(e, assumedTile);
				}

				if (isStartOfNewRound) spinDelaySFX();
				if (i === 0 && hasSlide)
					impact({
						xPx: start.xPx,
						yPx: start.yPx,
						z: start.z,
					});
				if (slideDir) {
					const from = assumedTile;
					const to = pxToTile({
						xPx,
						yPx,
						z: e.z,
					});
					if (from.x !== to.x || from.y !== to.y) {
						const res = checkTileStepAllowed({
							entity: e,
							from,
							to,
							dir: slideDir,
						});

						if (!res.ok) {
							crashBothOnCollision({
								collider: e,
								collided: res.collided,
								slideDir,
							});
							return;
						}
					}
				}

				e.animationFrameIndex = 0;
				e.animationTimer = 0;
				e.direction = rotate(e.direction, rotation);
				e.animationOverride = {
					...animationBase,
					frames: [[{ index: frameIndex, sheet }]],
				};
			},
		});
	}

	if (hasSlide) {
		const endXPx = start.xPx + totalDxPx;
		const endYPx = start.yPx + totalDyPx;
		const last = path[path.length - 1];
		if (last) {
			last.xPx = endXPx;
			last.yPx = endYPx;
		}
	}

	return path;
}
