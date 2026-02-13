export const sfxPaths = {
	jump: "/audio/sounds/jump.mp3",
	thud: "/audio/sounds/thud.mp3",
	crash: "/audio/sounds/crash.mp3",
	swoosh: "/audio/sounds/swoosh.mp3",
} as const;

export const ambiencePaths = {
	forest: "/audio/ambience/forest.mp3",
	beach: "/audio/ambience/beach.mp3",
} as const;

export const musicPaths = {
	placeholder: "/audio/music/placeholder.mp3",
} as const;

export type SfxId = keyof typeof sfxPaths;
export type AmbienceId = keyof typeof ambiencePaths;

export function isAmbienceId(id: string): id is AmbienceId {
	return id in ambiencePaths;
}

export type MusicId = keyof typeof musicPaths;

export function isMusicId(id: string): id is MusicId {
	return id in musicPaths;
}
