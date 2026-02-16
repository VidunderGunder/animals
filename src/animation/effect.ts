import { createImageElement } from "../assets/image";
import { pxToTile } from "../functions/general";
import { entities, getEntityItemDefaults } from "../scenes/overworld/entity";
import { type Animation, layerFactory } from "./animation";

export const effects = {
	impact: {
		sheet: createImageElement("/items/impact.png"),
		w: 16,
		h: 16,
		frames: 5,
	},
};

export function impact(position: {
	xPx: number;
	yPx: number;
	z: number;
}): void {
	const sheet = effects.impact.sheet;
	const frames = effects.impact.frames;

	if (!sheet.complete) {
		sheet.onload = () => impact(position);
		return;
	}

	const layer = layerFactory(sheet, {
		w: 16,
		h: 16,
	});

	const id = ["impact", position.xPx, position.yPx, position.z].join("-");
	if (entities.has(id)) return;

	const impactAnimation: Animation = {
		id,
		loop: false,
		frameDuration: 75,
		frames: Array.from({ length: frames }, (_, i) => [layer({ index: i })]),
	};

	entities.set(impactAnimation.id, {
		...getEntityItemDefaults({
			id,
			x: pxToTile(position.xPx),
			y: pxToTile(position.yPx),
		}),
		xPx: position.xPx,
		yPx: position.yPx,
		z: position.z,
		variant: "effect",
		animationFrameIndex: 0,
		width: effects.impact.w,
		height: effects.impact.h,
		id: impactAnimation.id,
		renderPriority: -1,
		radius: 0,
		state: {
			timer: 0,
		},
		animationOverride: impactAnimation,
	});
}
