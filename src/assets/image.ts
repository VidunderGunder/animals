const availableImages = Object.keys(
	import.meta.glob(["/*.png", "/**/*.png"], {
		import: "default",
		eager: true,
	}),
).map((path) => path.replace("/public", ""));

export function createImageElement(src: string): HTMLImageElement {
	const img = new Image();
	if (!availableImages.includes(src)) {
		console.warn(
			[
				`Image not found: ${src}`,

				"Available images are:",
				...availableImages,
			].join("\n"),
		);
	}
	img.src = src;
	return img;
}

export function createEmptyImageElement(): HTMLImageElement {
	const img = new Image();
	img.src = "/empty.png";
	return img;
}

export const emptyImage = createEmptyImageElement();
