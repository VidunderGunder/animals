import {
	type Entity,
	entities,
	getEntityCharacterDefaults,
} from "./scenes/overworld/entities";

export type GameState = {
	disabled: boolean;
	paused: boolean;
};

export const gameState: GameState = {
	disabled: false,
	paused: false,
};

export const startTileX = 30;
export const startTileY = 37;
export const startLayerZ = 0;

const playerDefault = {
	...getEntityCharacterDefaults({
		id: "player",
		x: startTileX,
		y: startTileY,
	}),
	x: startTileX,
	y: startTileY,
	z: startLayerZ,
	direction: "up",
} as const satisfies Entity;

export const player: Entity = {
	...playerDefault,
};

entities.set("player", player);

export function resetPlayer(): void {
	Object.assign(player, playerDefault);
}

export type Animation = {
	frames: readonly number[];
	frameDuration: number;
};
