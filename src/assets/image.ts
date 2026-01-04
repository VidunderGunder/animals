const availableImages = Object.keys(
	import.meta.glob(["/*.png", "/**/*.png"], {
		import: "default",
		eager: true,
	}),
).map((path) => path.replace("/public", ""));

const missingPath = "/animals/missing.png";
if (!availableImages.includes(missingPath)) {
	console.warn(`Missing image (placeholder) not found: ${missingPath}`);
}
const missingImageElement = new Image();
missingImageElement.src = missingPath;

export function createImageElement(
	src: string,
	fallback: HTMLImageElement = missingImageElement,
): HTMLImageElement {
	const img = new Image();
	if (!availableImages.includes(src)) {
		console.warn(`Image not found: ${src} | Using fallback: ${fallback.src}`);
		return fallback;
	}
	img.src = src;
	return img;
}
