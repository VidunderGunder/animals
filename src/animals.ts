import { createImageElement } from "./assets";

export const stageIds = [
  "baby",
  "adult",
  "cool",
] as const satisfies readonly string[];
export type AnimalStageId = (typeof stageIds)[number];

export type AnimalStage = {
  name: string;
  sprite: HTMLImageElement | undefined;
  width: number;
  height: number;
};

export type Animal = {
  stages: Record<AnimalStageId, AnimalStage | undefined>;
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

export const animals = {
  missing: {
    stages: {
      baby: {
        name: "Missing (baby)",
        sprite: createImageElement("/animals/missing.png"),
        width: 16,
        height: 16,
      },
      adult: {
        name: "Missing",
        sprite: createImageElement("/animals/missing.png"),
        width: 16,
        height: 16,
      },
      cool: {
        name: "Missing (cool)",
        sprite: createImageElement("/animals/missing.png"),
        width: 16,
        height: 16,
      },
    },
  },
  robovac: {
    stages: {
      baby: {
        name: "Tiny Robovac",
        sprite: createImageElement("/animals/robovac-baby.png"),
        width: 16,
        height: 16,
      },
      adult: {
        name: "Robovac",
        sprite: createImageElement("/animals/robovac.png"),
        width: 16,
        height: 16,
      },
      cool: {
        name: "Robovac (with knife)",
        sprite: createImageElement("/animals/robovac-cool.png"),
        width: 16,
        height: 16,
      },
    },
  },
  bee: {
    stages: {
      baby: {
        name: "Baby Bee",
        sprite: createImageElement("/animals/bee-baby.png"),
        width: 16,
        height: 16,
      },
      adult: {
        name: "Bee",
        sprite: createImageElement("/animals/bee.png"),
        width: 16,
        height: 16,
      },
      cool: {
        name: "Queen",
        sprite: createImageElement("/animals/bee-cool.png"),
        width: 16,
        height: 16,
      },
    },
  },
  penguin: {
    stages: {
      baby: {
        name: "Baby Penguin",
        sprite: createImageElement("/animals/penguin-baby.png"),
        width: 16,
        height: 16,
      },
      adult: {
        name: "Penguin",
        sprite: createImageElement("/animals/penguin.png"),
        width: 16,
        height: 16,
      },
      cool: {
        name: "Cool Penguin",
        sprite: createImageElement("/animals/penguin-cool.png"),
        width: 16,
        height: 16,
      },
    },
  },
  cat: {
    stages: {
      baby: {
        name: "Kitten",
        sprite: createImageElement("/animals/cat-baby.png"),
        width: 16,
        height: 16,
      },
      adult: {
        name: "Cat",
        sprite: createImageElement("/animals/cat.png"),
        width: 16,
        height: 16,
      },
      cool: {
        name: "Cool Cat",
        sprite: createImageElement("/animals/cat-cool.png"),
        width: 16,
        height: 16,
      },
    },
  },
  dog: {
    stages: {
      baby: {
        name: "Puppy",
        sprite: createImageElement("/animals/dog-baby.png"),
        width: 16,
        height: 16,
      },
      adult: {
        name: "Dog",
        sprite: createImageElement("/animals/dog.png"),
        width: 16,
        height: 16,
      },
      cool: {
        name: "Dawg",
        sprite: createImageElement("/animals/dog-cool.png"),
        width: 16,
        height: 16,
      },
    },
  },
  raccoon: {
    stages: {
      baby: {
        name: "Baby Raccoon",
        sprite: createImageElement("/animals/raccoon-baby.png"),
        width: 16,
        height: 16,
      },
      adult: {
        name: "Raccoon",
        sprite: createImageElement("/animals/raccoon.png"),
        width: 16,
        height: 16,
      },
      cool: {
        name: "Cool Raccoon",
        sprite: createImageElement("/animals/raccoon-cool.png"),
        width: 16,
        height: 16,
      },
    },
  },
  duck: {
    stages: {
      baby: {
        name: "Duckling",
        sprite: createImageElement("/animals/duck-baby.png"),
        width: 16,
        height: 16,
      },
      adult: {
        name: "Duck",
        sprite: createImageElement("/animals/duck.png"),
        width: 16,
        height: 16,
      },
      cool: {
        name: "Cool Duck",
        sprite: createImageElement("/animals/duck-cool.png"),
        width: 16,
        height: 16,
      },
    },
  },
  swan: {
    stages: {
      baby: {
        name: "Cygnet",
        sprite: createImageElement("/animals/swan-baby.png"),
        width: 16,
        height: 16,
      },
      adult: {
        name: "Swan",
        sprite: createImageElement("/animals/swan.png"),
        width: 16,
        height: 16,
      },
      cool: {
        name: "Black Swan",
        sprite: createImageElement("/animals/swan-cool.png"),
        width: 16,
        height: 16,
      },
    },
  },
  platypus: {
    stages: {
      baby: {
        name: "Baby Platypus",
        sprite: createImageElement("/animals/platypus-baby.png"),
        width: 16,
        height: 16,
      },
      adult: {
        name: "Platypus",
        sprite: createImageElement("/animals/platypus.png"),
        width: 16,
        height: 16,
      },
      cool: {
        name: "Cool Platypus",
        sprite: createImageElement("/animals/platypus-cool.png"),
        width: 16,
        height: 16,
      },
    },
  },
} as const satisfies Record<AnimalID | SecretAnimalID, Animal>;
