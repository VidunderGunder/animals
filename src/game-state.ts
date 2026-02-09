import {
	type Entity,
	entities,
	getEntityCharacterDefaults,
	type PlayerID,
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
	renderPriority: 1,
	autoRun: true,
} as const satisfies Entity<PlayerID>;

entities.set("player", { ...playerDefault });
export const player = entities.get("player") ?? {
	...playerDefault,
};

export function resetPlayer(): void {
	Object.assign(player, playerDefault);
}
