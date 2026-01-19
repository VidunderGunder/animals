import { initScreen } from "../config";
import { canvas } from "./canvas";

type AnyDocument = Document & {
	webkitFullscreenElement?: Element | null;
	webkitExitFullscreen?: () => Promise<void> | void;
};

type AnyElement = HTMLElement & {
	webkitRequestFullscreen?: (opts?: unknown) => Promise<void> | void;
};

function getFullscreenElement(): Element | null {
	const d = document as AnyDocument;
	return document.fullscreenElement ?? d.webkitFullscreenElement ?? null;
}

function isFullscreen(): boolean {
	return getFullscreenElement() !== null;
}

function requestFullscreenBody(): Promise<void> {
	const el = document.body as AnyElement;

	if (document.body.requestFullscreen) {
		return document.body.requestFullscreen({ navigationUI: "hide" });
	}

	if (el.webkitRequestFullscreen) {
		const r = el.webkitRequestFullscreen();
		return r instanceof Promise ? r : Promise.resolve();
	}

	return Promise.reject(new Error("Fullscreen API not supported"));
}

function exitFullscreen(): Promise<void> {
	const d = document as AnyDocument;

	if (document.exitFullscreen) return document.exitFullscreen();

	if (d.webkitExitFullscreen) {
		const r = d.webkitExitFullscreen();
		return r instanceof Promise ? r : Promise.resolve();
	}

	return Promise.reject(new Error("Fullscreen API not supported"));
}

// ---------------------------
// Focus overlay
// ---------------------------

let overlayEl: HTMLDivElement | null = null;
let overlayVisible = false;

// We show overlay only if we detect focus loss during/after fullscreen transition.
let pendingFocusCheck = false;
let focusLostDuringFs = false;

function ensureOverlay(): HTMLDivElement {
	if (overlayEl) return overlayEl;

	const el = document.createElement("div");
	el.id = "focus-overlay";
	el.style.cssText = [
		"position: fixed",
		"inset: 0",
		"display: none",
		"align-items: center",
		"justify-content: center",
		"background: rgba(0,0,0,0.70)",
		"z-index: 2147483647",
		"color: white",
		"font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
		"text-align: center",
		"padding: 24px",
		"cursor: pointer",
		"user-select: none",
	].join(";");

	el.innerHTML = `
		<div style="max-width: 300px; display: flex; flex-direction: column; gap: 12px;">
			<div style="font-size: 24px; font-weight: 800;">
				Click to regain focus
			</div>
			<div> 
        Your browser temporarily dropped focus when entering fullscreen.
      </div>
			<div> 
				Click anywhere to continue.
      </div>
			<div style="opacity: 0.75; font-size: 13px;">
				Tip: Press <b>Esc</b> or <b>F</b> to exit fullscreen.
			</div>
		</div>
	`;

	// Click/tap should naturally restore focus to the page in Safari/Chrome.
	// We ALSO try to focus the canvas to make keyboard input immediate.
	const tryRecover = () => {
		// best-effort focus
		canvas.tabIndex = -1;
		canvas.focus?.({ preventScroll: true });
		document.body.tabIndex = -1;
		document.body.focus?.({ preventScroll: true });

		// If focus actually comes back, the global focus listeners will hide overlay.
		// If it doesn't, overlay stays up and user can click again.
	};

	el.addEventListener("pointerdown", (e) => {
		e.preventDefault();
		tryRecover();
	});

	document.body.appendChild(el);
	overlayEl = el;
	return el;
}

function showOverlay() {
	const el = ensureOverlay();
	if (overlayVisible) return;
	overlayVisible = true;
	el.style.display = "flex";
}

function hideOverlay() {
	if (!overlayEl || !overlayVisible) return;
	overlayVisible = false;
	overlayEl.style.display = "none";
}

/** True when the window & document are focused enough that keyboard should work. */
function hasUsableFocus(): boolean {
	// Safari can be weird, so we check both.
	// `document.hasFocus()` is the main signal; activeElement is a bonus check.
	if (document.hidden) return false;
	if (!document.hasFocus()) return false;

	// If focus is on a real element or at least in the document, we’re good.
	// (In some cases activeElement becomes <body> or <html>, which is fine.)
	return true;
}

function scheduleFocusVerificationWindow() {
	pendingFocusCheck = true;
	focusLostDuringFs = false;

	// We check focus multiple times because different browsers blur at different phases.
	const delays = [0, 25, 75, 150, 300];

	for (const d of delays) {
		setTimeout(() => {
			if (!pendingFocusCheck) return;

			// If we ever observe unusable focus during this window, flag it.
			if (!hasUsableFocus()) {
				focusLostDuringFs = true;
			}

			// At the end of the window, decide whether to show overlay.
			if (d === delays[delays.length - 1]) {
				pendingFocusCheck = false;

				// Show ONLY if we lost focus at least once and it hasn't recovered.
				if (focusLostDuringFs && !hasUsableFocus()) {
					showOverlay();
				} else {
					hideOverlay();
				}
			}
		}, d);
	}
}

function onFocusMaybeRecovered() {
	// If focus is back, hide overlay immediately.
	if (hasUsableFocus()) hideOverlay();
}

// ---------------------------
// Public API
// ---------------------------

export function initFullscreenSupport() {
	ensureOverlay();

	// Keep sizes correct
	window.addEventListener("resize", initScreen);

	// Global focus recovery signals
	window.addEventListener("focus", onFocusMaybeRecovered);
	window.addEventListener("blur", () => {
		// If we're already in fullscreen and not in a "verification window",
		// we can still show overlay if we lose focus while fullscreen.
		// But ONLY if focus doesn't come back quickly.
		if (!isFullscreen()) return;

		// Don’t instantly show; some fullscreen transitions blur briefly.
		setTimeout(() => {
			if (!isFullscreen()) return;
			if (!hasUsableFocus()) showOverlay();
		}, 150);
	});

	document.addEventListener("visibilitychange", onFocusMaybeRecovered);

	// The important one: F toggles fullscreen.
	window.addEventListener("keydown", (e) => {
		if (e.metaKey || e.ctrlKey || e.altKey) return;
		if (e.key.toLowerCase() !== "f") return;

		e.preventDefault();

		if (isFullscreen()) {
			void exitFullscreen().catch(() => {});
			hideOverlay();
			return;
		}

		// Start a focus verification window around the fullscreen transition.
		scheduleFocusVerificationWindow();

		// Request fullscreen. Don’t await in case the browser wants gesture timing.
		void requestFullscreenBody()
			.then(() => {
				// fullscreenchange fires too, but some browsers blur without clean ordering.
				scheduleFocusVerificationWindow();
			})
			.catch(() => {
				// If fullscreen fails, don't show focus overlay.
				pendingFocusCheck = false;
				focusLostDuringFs = false;
				hideOverlay();
			});
	});

	// Also listen to fullscreenchange to re-check focus
	document.addEventListener("fullscreenchange", () => {
		if (!isFullscreen()) {
			hideOverlay();
			return;
		}
		scheduleFocusVerificationWindow();
	});

	document.addEventListener("webkitfullscreenchange", () => {
		if (!isFullscreen()) {
			hideOverlay();
			return;
		}
		scheduleFocusVerificationWindow();
	});
}
