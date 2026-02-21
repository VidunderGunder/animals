import { createImageElement } from "../assets/image";
import { pxToTile } from "../functions/general";
import { entities, getEntityItemDefaults } from "../scenes/overworld/entity";
import { layerFactory } from "./animation";

export const effects = {
	impact: {
		sheet: createImageElement("/animations/impact.png"),
		w: 20,
		h: 20,
		frames: 5,
	},
	"butterfly-white": {
		sheet: createImageElement("/animations/butterfly-white.png"),
		w: 16,
		h: 16,
		frames: 17,
	},
	"butterfly-pink": {
		sheet: createImageElement("/animations/butterfly-pink.png"),
		w: 16,
		h: 16,
		frames: 17,
	},
	"butterfly-blue": {
		sheet: createImageElement("/animations/butterfly-blue.png"),
		w: 16,
		h: 16,
		frames: 11,
	},
};

export function butterfly(
	position: { x: number; y: number; z: number },
	color: "white" | "pink" | "blue" = "white",
): void {
	const sheet = effects[`butterfly-${color}`].sheet;
	const frames = effects[`butterfly-${color}`].frames;

	if (!sheet.complete) {
		sheet.onload = () => setTimeout(() => butterfly(position, color), 100);
		return;
	}

	const layer = layerFactory(sheet, {
		w: 16,
		h: 16,
	});

	const id = ["butterfly", position.x, position.y, position.z].join("-");
	if (entities.has(id)) return;

	entities.set(id, {
		...getEntityItemDefaults({
			id,
			x: position.x,
			y: position.y,
		}),
		z: position.z,
		variant: "effect",
		animationFrameIndex: Math.floor(Math.random() * frames),
		width: effects[`butterfly-${color}`].w,
		height: effects[`butterfly-${color}`].h,
		radius: 3,
		renderPriority: 10,
		animationOverride: {
			id,
			loop: true,
			frameDuration: Math.random() * 20 + 90,
			frames: Array.from({ length: frames }, (_, i) => [layer({ index: i })]),
		},
	});
}

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

	entities.set(id, {
		...getEntityItemDefaults({
			id,
			x: pxToTile(position.xPx),
			y: pxToTile(position.yPx),
		}),
		xPx: position.xPx,
		yPx: position.yPx,
		z: position.z,
		variant: "effect",
		solid: false,
		animationFrameIndex: 0,
		width: effects.impact.w,
		height: effects.impact.h,
		renderPriority: -1,
		radius: 0,
		animationOverride: {
			id,
			loop: false,
			frameDuration: 70,
			frames: Array.from({ length: frames }, (_, i) => [layer({ index: i })]),
		},
	});
}
