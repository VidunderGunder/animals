import { createImageElement } from "./assets";
import { capitalizeTyped } from "./types";

export const stageIds = [
  "baby",
  "adult",
  "cool",
] as const satisfies readonly string[];
export type AnimalStageId = (typeof stageIds)[number];

export type AnimalStage = {
  name: string;
  sprite: HTMLImageElement;
  width: number;
  height: number;
};

export type Animal = {
  stages: Record<AnimalStageId, AnimalStage>;
};

export const secretAnimalIds = ["missing"] as const satisfies readonly string[];
export type SecretAnimalID = (typeof secretAnimalIds)[number];
export const animalIds = [
  "platypus",
  "bee",
  "robovac",
  "penguin",
  "raccoon",
  "duck",
  "swan",
  "cat",
  "dog",
] as const satisfies readonly string[];
export type AnimalID = (typeof animalIds)[number];

const isOverlap = animalIds.some((id: string) =>
  secretAnimalIds.some((secretId) => secretId === id)
);
if (isOverlap) {
  throw new Error("AnimalIDs and SecretAnimalIDs must be mutually exclusive");
}

function createAnimalProps({ id }: { id: AnimalID | SecretAnimalID }): Animal {
  return {
    stages: {
      baby: {
        name: `Baby ${capitalizeTyped(id)}`,
        sprite: createImageElement(`/animals/${id}-baby.png`),
        width: 16,
        height: 16,
      },
      adult: {
        name: capitalizeTyped(id),
        sprite: createImageElement(`/animals/${id}.png`),
        width: 16,
        height: 16,
      },
      cool: {
        name: `Cool ${capitalizeTyped(id)}`,
        sprite: createImageElement(`/animals/${id}-cool.png`),
        width: 16,
        height: 16,
      },
    },
  };
}

const temp: Partial<Record<AnimalID | SecretAnimalID, Animal>> = {};

for (const id of animalIds) {
  temp[id] = createAnimalProps({ id });
}

for (const id of secretAnimalIds) {
  temp[id] = createAnimalProps({ id });
}

export const animals = Object.freeze(
  temp as Record<AnimalID | SecretAnimalID, Animal>
);
