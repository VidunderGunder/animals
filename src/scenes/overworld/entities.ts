import type { Player } from "../../state";

export type Entities = Map<string, Entity>;
export const entities: Entities = new Map<string, Entity>();

export type Entity = Player;
