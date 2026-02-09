// src/scenes/overworld/ai/brain.ts
import type { Entity } from "../entities";
import type { Command } from "./commands";

/**
 * A tiny deterministic command-runner. You can push() sequences
 * and call tick(dt) each frame. It maintains internal state and
 * returns whether still running.
 */
export class CommandRunner {
	private queue: Command[] = [];

	constructor(commands?: Command[] | Command) {
		if (commands) {
			if (Array.isArray(commands)) this.queue.push(...commands);
			else this.queue.push(commands);
		}
	}

	push(cmd: Command | (() => void)) {
		if (typeof cmd === "function") {
			this.queue.push({
				onTick: () => {
					cmd();
					return true;
				},
			});
			return;
		}
		this.queue.push(cmd);
	}

	/** Push a command to the FRONT (preempt current plan). */
	interrupt(cmd: Command | (() => void) | (Command | (() => void))[]) {
		if (Array.isArray(cmd)) {
			// preserve order: first in array runs first
			for (let i = cmd.length - 1; i >= 0; i--) {
				const c = cmd[i];
				if (typeof c === "function") {
					this.queue.unshift({
						onTick: () => {
							c();
							return true;
						},
					});
					continue;
				}
				if (c) this.queue.unshift(c);
			}
			return;
		}
		if (typeof cmd === "function") {
			this.queue.unshift({
				onTick: () => {
					cmd();
					return true;
				},
			});
			return;
		}
		this.queue.unshift(cmd);
	}

	clear() {
		this.queue.length = 0;
	}

	isIdle() {
		return this.queue.length === 0;
	}

	/** Run one tick. Returns true if still running (has commands), false if idle. */
	tick(entity: Entity, dt: number): boolean {
		while (this.queue.length) {
			const cmd = this.queue[0];
			const res = cmd?.onTick({ entity, dt });
			if (!res) return true;
			this.queue.shift();
		}
		return false;
	}
}

/** Lightweight Brain wrapper: holds a CommandRunner and optional routine callback. */
export type Brain = {
	runner: CommandRunner;
	/** Optional background routine that may enqueue commands when idle */
	routine?: (entity: Entity, dt: number) => void;
};

export type BrainState = Record<string, number | string | boolean>;
