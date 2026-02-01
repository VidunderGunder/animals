/**
 * Utility functions for device detection
 */

import { audio } from "../audio/audio-engine";

/**
 * Detects if the current device is running iOS
 * @returns {boolean} true if the device is running iOS, false otherwise
 */
export const detectiOS = (): boolean => {
	if (typeof navigator === "undefined") {
		return false;
	}

	const toMatch = [/iPhone/i, /iPad/i, /iPod/i];

	return toMatch.some((toMatchItem) => {
		return RegExp(toMatchItem).exec(navigator.userAgent);
	});
};

/**
 * Detects if the current device is running Android
 * @returns {boolean} true if the device is running Android, false otherwise
 */
export const detectAndroid = (): boolean => {
	if (typeof navigator === "undefined") {
		return false;
	}
	const toMatch = [/Android/i, /webOS/i, /BlackBerry/i, /Windows Phone/i];

	return toMatch.some((toMatchItem) => {
		return RegExp(toMatchItem).exec(navigator.userAgent);
	});
};

/**
 * Detects if the current device is a mobile device (iOS or Android)
 * @returns {boolean} true if the device is a mobile device, false otherwise
 */
export const detectMobile = (): boolean => {
	return detectiOS() || detectAndroid();
};

const HAPTIC_DURATION = 5;

let initialized = false;
let isIOS = false;

// Keep references so we can click without querying every time
let labelEl: HTMLLabelElement | null = null;

// Optional: if you ever need to remove it (hot reload / teardown)
export function destroyHaptics(): void {
	const input = document.getElementById("haptic-switch");
	const label = document.getElementById("haptic-switch-label");

	if (label?.parentNode) label.parentNode.removeChild(label);
	if (input?.parentNode) input.parentNode.removeChild(input);

	initialized = false;
	labelEl = null;
}

function ensureHapticsSetup(): void {
	if (initialized) return;
	initialized = true;

	isIOS = detectiOS();

	// If elements already exist (e.g. hot reload), reuse them
	let input = document.getElementById(
		"haptic-switch",
	) as HTMLInputElement | null;
	let label = document.getElementById(
		"haptic-switch-label",
	) as HTMLLabelElement | null;

	if (!input) {
		input = document.createElement("input");
		input.type = "checkbox";
		input.id = "haptic-switch";
		input.setAttribute("switch", "");
		input.style.display = "none";
		document.body.appendChild(input);
	}

	if (!label) {
		label = document.createElement("label");
		label.id = "haptic-switch-label";
		label.htmlFor = input.id;
		label.style.display = "none";
		document.body.appendChild(label);
	}

	labelEl = label;
}

/**
 * For iOS: Only works if triggered by an onclick or touch end event handler.
 *
 * Trigger a tiny haptic “tick”.
 * - Non-iOS: uses Vibration API if available
 * - iOS: clicks a hidden label bound to an input[switch]
 */
export function hapticHack(duration: number = HAPTIC_DURATION): void {
	// If called super early (before <body> exists), do nothing.
	if (typeof document === "undefined" || !document.body) return;

	ensureHapticsSetup();

	// Prefer vibrate on non-iOS if supported
	if (!isIOS && typeof navigator !== "undefined" && "vibrate" in navigator) {
		// Some browsers ignore very small values; caller can pass bigger
		(
			navigator as Navigator & {
				vibrate?: (pattern: number | number[]) => boolean;
			}
		).vibrate?.(duration);
		return;
	}

	// iOS fallback
	labelEl?.click();
}

/**
 * Audio based haptic feedback trigger for devices that do not support the Vibration API.
 *
 * Notes:
 * - iOS/Safari requires this to be called from a user gesture (pointerdown/touchstart/etc),
 *   otherwise `audioCtx.resume()` may be blocked.
 * - Keep it *very* short and quiet so it feels like a “tap” rather than a sound effect.
 */

let lastTapMs = 0;

export function hapticAudio(): void {
	// If the device supports real vibration, use that instead.
	if ("vibrate" in navigator) {
		navigator.vibrate?.(5);
		return;
	}

	const nowMs = performance.now();
	// allow faster retriggers for snappy taps
	if (nowMs - lastTapMs < 12) return;
	lastTapMs = nowMs;

	const { ctx, bus } = audio.get();

	// Best effort: resume if suspended (iOS usually needs a gesture)
	if (ctx.state === "suspended") {
		void ctx.resume().catch(() => {});
		if (ctx.state === "suspended") return;
	}

	const t0 = ctx.currentTime;

	// Shorter = clickier
	const dur = 0.009;

	// Higher pitch reads "snappier"
	const osc = ctx.createOscillator();
	osc.type = "square"; // sharper transient than triangle/sine
	osc.frequency.setValueAtTime(300, t0);
	osc.frequency.exponentialRampToValueAtTime(160, t0 + dur);

	// Faster attack + faster decay = "tick"
	const gain = ctx.createGain();
	gain.gain.setValueAtTime(0.0001, t0);
	gain.gain.linearRampToValueAtTime(0.045, t0 + 0.0015); // ~1.5ms attack
	gain.gain.exponentialRampToValueAtTime(0.00005, t0 + dur);

	// Let more highs through (but still tame the harshest edge)
	const filter = ctx.createBiquadFilter();
	filter.type = "lowpass";
	filter.frequency.setValueAtTime(1800, t0);
	filter.Q.setValueAtTime(0.8, t0);

	// Optional: tiny high-pass to remove thump and keep it "click" not "tap"
	const hp = ctx.createBiquadFilter();
	hp.type = "highpass";
	hp.frequency.setValueAtTime(1800, t0);
	hp.Q.setValueAtTime(0.7, t0);

	osc.connect(gain);
	gain.connect(hp);
	hp.connect(filter);
	filter.connect(bus.haptics);

	osc.start(t0);
	osc.stop(t0 + dur + 0.004);

	osc.onended = () => {
		try {
			osc.disconnect();
			gain.disconnect();
			hp.disconnect();
			filter.disconnect();
		} catch {
			// ignore
		}
	};
}
