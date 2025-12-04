export const stageIds = [
	"baby",
	"adult",
	"cool",
] as const satisfies readonly string[];
export type AnimalStageId = (typeof stageIds)[number];

export type AnimalStage = {
	name: string;
	spriteId: string;
	width: number;
	height: number;
};

export type Animal = {
	stages: Record<AnimalStageId, AnimalStage | undefined>;
};

export const animalIds = [
	"robovac",
	"bee",
	"penguin",
] as const satisfies readonly string[];
export type AnimalID = (typeof animalIds)[number];

export const animals = {
	robovac: {
		stages: {
			baby: undefined,
			// baby: { name: "Tiny Robovac", spriteId: "robovac-baby-sprite" },
			adult: {
				name: "Robovac",
				spriteId: "robovac-sprite",
				width: 16,
				height: 16,
			},
			cool: undefined,
			// cool: { name: "Robovac (with knife)", spriteId: "robovac-cool-sprite" },
		},
	},
	bee: {
		stages: {
			// baby: { name: "Baby Bee", spriteId: "bee-baby-sprite" },
			baby: undefined,
			adult: { name: "Bee", spriteId: "bee-sprite", width: 16, height: 16 },
			// cool: { name: "Cool Bee", spriteId: "bee-cool-sprite" },
			cool: undefined,
		},
	},
	penguin: {
		stages: {
			baby: {
				name: "Baby Penguin",
				spriteId: "penguin-baby-sprite",
				width: 16,
				height: 16,
			},
			// adult: { name: "Penguin", spriteId: "penguin-sprite" },
			// cool: { name: "Cool Penguin", spriteId: "penguin-cool-sprite" },
			adult: undefined,
			cool: undefined,
		},
	},
} as const satisfies Record<AnimalID, Animal>;

export function allSpritesExist() {
	const missing: string[] = [];
	for (const animal of Object.values(animals)) {
		for (const stage of Object.values(animal.stages)) {
			if (!stage) continue;
			if (!document.getElementById(stage.spriteId)) {
				missing.push(stage.spriteId);
			}
		}
	}

	if (missing.length > 0) {
		throw new Error(`Missing sprites: ${missing.join(", ")}`);
	}

	return true;
}
