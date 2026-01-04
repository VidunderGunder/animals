export const canvas: HTMLCanvasElement = document.getElementById(
	"canvas",
) as HTMLCanvasElement;
if (!(canvas instanceof HTMLCanvasElement))
	throw new Error("Canvas element not found");

export const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
if (!ctx) throw new Error("2D context not available");

export function clear() {
	ctx.clearRect(0, 0, canvas.width, canvas.height);
}
