import { createImageElement } from "../assets";
import { capitalizeTyped } from "../types";

export type AnimalAnimationKey = "walk" | "run" | "idle";

export const stageKeys = [
	"baby",
	"adult",
	"cool",
] as const satisfies readonly string[];
export type AnimalStageKey = (typeof stageKeys)[number];

export type AnimalStage = {
	name: string;
	sprite: HTMLImageElement;
	width: number;
	height: number;
};

export type Animal = {
	stages: Record<AnimalStageKey, AnimalStage>;
};

export const secretAnimalIds = ["missing"] as const satisfies readonly string[];
export type SecretAnimalKey = (typeof secretAnimalIds)[number];
export const animalKeys = [
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
export type AnimalID = (typeof animalKeys)[number];

const isOverlap = animalKeys.some((id: string) =>
	secretAnimalIds.some((secretId) => secretId === id),
);
if (isOverlap) {
	throw new Error("AnimalIDs and SecretAnimalIDs must be mutually exclusive");
}

function createAnimalProps({
	id,
	stageOverrides,
}: {
	id: AnimalID | SecretAnimalKey;
	stageOverrides?: Partial<AnimalStage>;
}): Animal {
	return {
		stages: {
			baby: {
				name: `Baby ${capitalizeTyped(id)}`,
				sprite:
					stageOverrides?.sprite ??
					createImageElement(`/animals/${id}-baby.png`),
				width: 16,
				height: 16,
				...stageOverrides,
			},
			adult: {
				name: capitalizeTyped(id),
				sprite:
					stageOverrides?.sprite ?? createImageElement(`/animals/${id}.png`),
				width: 16,
				height: 16,
				...stageOverrides,
			},
			cool: {
				name: `Cool ${capitalizeTyped(id)}`,
				sprite:
					stageOverrides?.sprite ??
					createImageElement(`/animals/${id}-cool.png`),
				width: 16,
				height: 16,
				...stageOverrides,
			},
		},
	};
}

const temp: Partial<Record<AnimalID | SecretAnimalKey, Animal>> = {};

for (const id of animalKeys) {
	temp[id] = createAnimalProps({ id });
}

temp.missing = createAnimalProps({
	id: "missing",
	stageOverrides: {
		sprite: createImageElement(`/animals/missing.png`),
	},
});

export const animals = Object.freeze(
	temp as Record<AnimalID | SecretAnimalKey, Animal>,
);
