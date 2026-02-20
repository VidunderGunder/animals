const availableImages = Object.keys(
	import.meta.glob(["/*.png", "/**/*.png"], {
		import: "default",
		eager: true,
	}),
).map((path) => path.replace("/public", ""));

export function createImageElement(src: string): HTMLImageElement {
	const normalizedSrc = `/images${src.startsWith("/") ? src : `/${src}`}`;
	const img = new Image();
	if (!availableImages.includes(normalizedSrc)) {
		console.warn(
			[
				`Image not found: ${normalizedSrc}`,

				"Available images are:",
				...availableImages,
			].join("\n"),
		);
	}
	img.src = normalizedSrc;
	return img;
}

export function createEmptyImageElement(): HTMLImageElement {
	const img = new Image();
	img.src = "/images/empty.png";
	return img;
}

export const emptyImage = createEmptyImageElement();
