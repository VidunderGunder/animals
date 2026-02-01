export const sfxPaths = {
	jump: "/audio/sounds/jump.mp3",
	// add more here...
} as const;

export const ambiencePaths = {
	forest: "/audio/ambience/forest.mp3",
	beach: "/audio/ambience/beach.mp3",
	// add more here...
} as const;

export const musicPaths = {
	// titleScreen: "/audio/music/title.mp3",
	// overworld: "/audio/music/overworld.mp3",
} as const;

export type SfxId = keyof typeof sfxPaths;
export type AmbienceId = keyof typeof ambiencePaths;
export type MusicId = keyof typeof musicPaths;
