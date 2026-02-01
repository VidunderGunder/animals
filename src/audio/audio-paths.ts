export const sfxPaths = {
	jump: "/audio/sounds/jump.mp3",
	thud: "/audio/sounds/thud.mp3",
} as const;

export const ambiencePaths = {
	forest: "/audio/ambience/forest.mp3",
	beach: "/audio/ambience/beach.mp3",
} as const;

export const musicPaths = {
	// ...
} as const;

export type SfxId = keyof typeof sfxPaths;
export type AmbienceId = keyof typeof ambiencePaths;
export type MusicId = keyof typeof musicPaths;
