import { audio } from "./audio-engine";
import { type SfxId, sfxPaths } from "./audio-paths";

export function initializeAudio(): void {
	audio.init();
	audio.bindAutoUnlock();
}

export async function unlockAudio(): Promise<void> {
	await audio.unlock();
}

export async function playSfx(
	id: SfxId,
	opts: { volume?: number; playbackRate?: number; detuneCents?: number } = {},
) {
	const url = sfxPaths[id];
	return audio.playBuffer(url, { bus: "sfx", ...opts });
}

export async function playVoice(
	url: string,
	opts: { volume?: number; playbackRate?: number; detuneCents?: number } = {},
) {
	return audio.playBuffer(url, { bus: "voice", ...opts });
}
