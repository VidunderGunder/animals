import { ctx } from "./canvas";
import { TILE_SIZE } from "./config";

export type TileSet = "grass";

export const tileSets = {
	grass: document.getElementById("tileset-grass") as HTMLImageElement,
} as const satisfies Record<TileSet, HTMLImageElement>;

export const tileMaps = {
	grass: {
		tilesPerRow: 10,
		tilesPerColumn: 10,
		colisionIndices: [5, 19],
		inFrontOfPlayerIndices: [9],
	},
};

export function drawTile({
	tileset,
	tileIndex,
	x,
	y,
}: {
	tileset: TileSet;
	tileIndex: number;
	x: number;
	y: number;
}) {
	const tiles = tileSets[tileset];
	const { tilesPerRow } = tileMaps[tileset];

	const sx = (tileIndex % tilesPerRow) * TILE_SIZE;
	const sy = Math.floor(tileIndex / tilesPerRow) * TILE_SIZE;

	ctx.drawImage(
		tiles,
		sx,
		sy,
		TILE_SIZE,
		TILE_SIZE,
		x,
		y,
		TILE_SIZE,
		TILE_SIZE,
	);
}
