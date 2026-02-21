import {
	type Entity,
	entities,
	getEntityCharacterDefaults,
	type PlayerID,
} from "./scenes/overworld/entity";

export type GameState = {
	disabled: boolean;
	paused: boolean;
	ms: number;
};

export const gameState: GameState = {
	disabled: false,
	paused: false,
	ms: 0,
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
	autoRun: false,
} as const satisfies Entity<PlayerID>;

entities.set("player", { ...playerDefault });
export const player = entities.get("player") ?? {
	...playerDefault,
};

export function resetPlayer(): void {
	Object.assign(player, playerDefault);
}
