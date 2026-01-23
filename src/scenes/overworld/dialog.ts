import { speak } from "../../audio/speak";
import { clamp } from "../../functions/general";
import { ctx } from "../../gfx/canvas";
import { player } from "../../state";
import { camera } from "./camera";

type Vec2 = { xPx: number; yPx: number };

type RSVPTok =
	| { kind: "word"; text: string; ms: number; emphasis: number }
	| { kind: "pause"; ms: number };

type RSVPContent = string | readonly RSVPTok[];

type RSVPOptions = {
	/** Default ms for a normal word (before punctuation/emphasis modifiers) */
	baseWordMs?: number;
	/** Random jitter added/subtracted to word ms (human feel) */
	jitterMs?: number;
	/** Extra ms per word for the first word in the bubble */
	firstTokenExtraMs?: number;

	/** Pause ms for inline separators: |, ||, ||| */
	pauseShortMs?: number;
	pauseMedMs?: number;
	pauseLongMs?: number;

	/** Extra hold at punctuation. (applied on the word token it belongs to) */
	punctHoldMs?: Partial<Record<"." | "," | "!" | "?" | ":" | ";", number>>;

	/** Emphasis multiplier when using *word* */
	emphasisMult?: number;

	/** ms before bubble disappears after finishing */
	lingerMs?: number;

	/** max width for wrapping (px). set null to disable wrap */
	maxWidthPx?: number | null;

	/** pixels above the anchor */
	offsetYPx?: number;

	/** fade in/out */
	fadeMs?: number;

	/** bubble padding */
	paddingX?: number;
	paddingY?: number;
};

type BubbleState = {
	id: string;

	// identity + invalidation
	contentKey: number;
	tokens: RSVPTok[];
	getPosition: () => Vec2;

	// timing
	tMs: number;
	lastTouchedAtMs: number;
	finishedAtMs: number | null;

	// token cursor
	tokenIndex: number;
	tokenRemainingMs: number;

	lastWordText?: string | null;
	lastWordEmphasis?: number;

	// presentation
	pos: Vec2;
	opts: Required<RSVPOptions>;
};

const DEFAULT_OPTS: Required<RSVPOptions> = {
	baseWordMs: 170,
	jitterMs: 25,
	firstTokenExtraMs: 250,

	pauseShortMs: 150,
	pauseMedMs: 300,
	pauseLongMs: 400,

	punctHoldMs: {
		".": 300,
		",": 150,
		"!": 300,
		"?": 300,
		":": 300,
		";": 200,
	},

	emphasisMult: 1.35,

	lingerMs: 500,
	maxWidthPx: 150,
	offsetYPx: -11,
	fadeMs: 90,

	paddingX: 5,
	paddingY: 3,
};

const bubbles = new Map<string, BubbleState>();

// Internal clock (no dt passed around)
let lastNowMs = typeof performance !== "undefined" ? performance.now() : 0;

function getNowMs() {
	return typeof performance !== "undefined" ? performance.now() : Date.now();
}

/**
 * Spawn/update a dialog bubble.
 *
 * Call this from anywhere (world build, interact callbacks, cutscenes).
 * Rendering + advancement is handled by `renderDialogs()` once per frame.
 */
export function rsvp(
	id: string,
	content: RSVPContent,
	getPosition: () => Vec2 = () => ({
		xPx: player.xPx - camera.xPx + player.width / 2,
		yPx: player.yPx - camera.yPx,
	}),
	options: RSVPOptions = {},
) {
	const now = getNowMs();
	const opts: Required<RSVPOptions> = { ...DEFAULT_OPTS, ...options };
	const key = computeContentKey(content);

	let bubble = bubbles.get(id);

	// create or reset if content changed
	if (!bubble || bubble.contentKey !== key) {
		const tokens = compileTokens(content, opts);
		const pos = getPosition();

		bubble = {
			id,
			contentKey: key,
			tokens,
			getPosition,

			tMs: 0,
			lastTouchedAtMs: now,
			finishedAtMs: null,

			tokenIndex: 0,
			tokenRemainingMs: tokens[0]?.ms ?? 0,

			lastWordText: null,
			lastWordEmphasis: 1,

			pos,
			opts,
		};

		bubbles.set(id, bubble);

		// Speak first visible word immediately
		const first = bubble.tokens[0];
		if (first?.kind === "word") {
			speak(first.text);
		}

		// Optional: speak immediately on first word if you want “instant” feel.
		// Current behavior speaks when the token advances to the next word.
		return;
	}

	// Update existing bubble “freshness” and presentation
	bubble.lastTouchedAtMs = now;
	bubble.getPosition = getPosition;
	bubble.opts = opts;

	// If you want “calling rsvp again” to restart the bubble, uncomment:
	// bubble.tMs = 0;
	// bubble.finishedAtMs = null;
	// bubble.tokenIndex = 0;
	// bubble.tokenRemainingMs = bubble.tokens[0]?.ms ?? 0;
	// bubble.lastWordText = null;
	// bubble.lastWordEmphasis = 1;
}

/**
 * Call once per frame (e.g. at the end of `overworld()` draw),
 * after you’ve rendered the world.
 *
 * This advances internal time using `performance.now()` and renders all bubbles.
 */
export function renderDialogs() {
	const now = getNowMs();
	const dtMs = clamp(now - lastNowMs, 0, 100); // clamp big tab-switch spikes
	lastNowMs = now;

	// GC: remove bubbles not touched recently OR completed + lingered
	for (const [id, b] of bubbles) {
		// if caller never touches again, still keep it alive for a bit
		// (lets one-shot bubbles live naturally)
		if (b.finishedAtMs === null) {
			// keep until it finishes on its own
			continue;
		}

		// finished: remove after linger + fade buffer
		const doneFor = b.tMs - b.finishedAtMs;
		if (doneFor > b.opts.lingerMs + b.opts.fadeMs + 250) {
			bubbles.delete(id);
		}
	}

	// Advance + render
	for (const b of bubbles.values()) {
		// update position live (camera/player moves)
		b.pos = b.getPosition();

		advanceBubble(b, dtMs);
		renderBubble(b);
	}
}

// ---------------------------
// Timing / advancement
// ---------------------------

function advanceBubble(b: BubbleState, dtMs: number) {
	if (dtMs <= 0) return;

	b.tMs += dtMs;

	if (b.tokens.length === 0) {
		b.finishedAtMs = b.finishedAtMs ?? b.tMs;
		return;
	}

	// if already finished, do nothing (render handles linger/fade)
	if (b.finishedAtMs !== null) return;

	let remaining = dtMs;

	while (remaining > 0 && b.finishedAtMs === null) {
		if (b.tokenRemainingMs <= 0) {
			if (!advanceToken(b)) break;
			continue;
		}

		const step = Math.min(remaining, b.tokenRemainingMs);
		b.tokenRemainingMs -= step;
		remaining -= step;

		if (b.tokenRemainingMs <= 0) {
			if (!advanceToken(b)) break;
		}
	}
}

function advanceToken(b: BubbleState): boolean {
	b.tokenIndex++;

	if (b.tokenIndex >= b.tokens.length) {
		b.finishedAtMs = b.tMs;
		return false;
	}

	const token = b.tokens[b.tokenIndex];
	if (!token) return false;
	b.tokenRemainingMs = token.ms;

	if (token.kind === "word") {
		speak(token.text);
	}

	return true;
}

// ---------------------------
// Rendering
// ---------------------------

function getAlpha(b: BubbleState) {
	const fade = b.opts.fadeMs;
	if (fade <= 0) return 1;

	// fade in at start
	const aIn = clamp(b.tMs / fade, 0, 1);

	// fade out after finished
	if (b.finishedAtMs === null) return aIn;

	const tOut = b.tMs - (b.finishedAtMs + b.opts.lingerMs - fade);
	const aOut = 1 - clamp(tOut / fade, 0, 1);

	return Math.min(aIn, aOut);
}

function renderBubble(b: BubbleState) {
	const alpha = getAlpha(b);
	if (alpha <= 0) return;

	// finished: keep showing last word
	if (b.finishedAtMs !== null) {
		if (!b.lastWordText) return;
		const x = Math.round(b.pos.xPx);
		const y = Math.round(b.pos.yPx + b.opts.offsetYPx);
		drawTextWithBubble(
			b.lastWordText,
			{ xPx: x, yPx: y },
			b.opts,
			alpha,
			b.lastWordEmphasis ?? 1,
		);
		return;
	}

	const tok = b.tokens[b.tokenIndex];
	if (!tok) return;

	// pause token: keep showing last word
	if (tok.kind === "pause") {
		const x = Math.round(b.pos.xPx);
		const y = Math.round(b.pos.yPx + b.opts.offsetYPx);

		drawTextWithBubble(
			b.lastWordText ?? "...", // empty bubble if nothing yet
			{ xPx: x, yPx: y },
			b.opts,
			alpha,
			b.lastWordEmphasis ?? 1,
		);

		return;
	}

	// word token: render + remember
	b.lastWordText = tok.text;
	b.lastWordEmphasis = tok.emphasis;

	const x = Math.round(b.pos.xPx);
	const y = Math.round(b.pos.yPx + b.opts.offsetYPx);

	drawTextWithBubble(tok.text, { xPx: x, yPx: y }, b.opts, alpha, tok.emphasis);
}

function drawTextWithBubble(
	text: string,
	{ xPx, yPx }: Vec2,
	opts: Required<RSVPOptions>,
	alpha: number,
	emphasis: number = 1,
) {
	// Pixel snap the anchor first (everything derives from this)
	const px = Math.round(xPx);
	const py = Math.round(yPx);

	ctx.save();
	ctx.font = "8px Tiny5";
	ctx.textBaseline = "top";
	ctx.textRendering = "geometricPrecision";

	const lines = opts.maxWidthPx ? wrapText(text, opts.maxWidthPx) : [text];
	const lineH = 8;

	const paddingX = opts.paddingX | 0;
	const paddingY = opts.paddingY | 0;

	let maxW = 0;
	for (const line of lines) {
		const w = ctx.measureText(line).width;
		if (w > maxW) maxW = w;
	}

	const emphPad = Math.max(0, Math.round((emphasis - 1) * 2));

	const bubbleW = Math.ceil(maxW + (paddingX + emphPad) * 2) - 1;
	const bubbleH = Math.ceil(lines.length * lineH + (paddingY + emphPad) * 2);

	// Bubble top-left snapped to pixels
	const bx = Math.round(px - bubbleW / 2);
	const by = Math.round(py - bubbleH);

	ctx.globalAlpha = alpha;

	// ---- Bubble (pixel-friendly "rounded" rect using fillRect only) ----
	ctx.fillStyle = "#fff";

	// Outer shape with 1px chamfered corners (no AA)
	// Top & bottom (inset by 1)
	ctx.fillRect(bx + 1, by, bubbleW - 2, 1);
	ctx.fillRect(bx + 1, by + bubbleH - 1, bubbleW - 2, 1);
	// Left & right (inset by 1)
	ctx.fillRect(bx, by + 1, 1, bubbleH - 2);
	ctx.fillRect(bx + bubbleW - 1, by + 1, 1, bubbleH - 2);
	// Body
	ctx.fillRect(bx + 1, by + 1, bubbleW - 2, bubbleH - 2);

	// ---- Text ----
	ctx.fillStyle = "#3a3a3a";
	const tx = bx + paddingX + emphPad;
	const ty = by + paddingY + 1 + emphPad;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (!line) continue;
		ctx.fillText(line, tx, ty + i * lineH);
	}

	// ---- Caret (raster triangle, no path AA) ----
	ctx.fillStyle = "#fff";
	const caretHalfW = 1;
	const caretH = 2;

	// A simple pixel triangle pointing down:
	// y+0: width 6+1, y+1: width 4+1, y+2: width 2+1
	for (let i = 0; i < caretH; i++) {
		const rowHalf = caretHalfW - i; // 3,2,1
		const rowW = rowHalf * 2 + 1;
		ctx.fillRect(px - rowHalf, py + i, rowW, 1);
	}

	ctx.restore();
}

function wrapText(text: string, maxWidthPx: number): string[] {
	const words = text.trim().split(/\s+/g);
	if (words.length === 0) return [text];

	const lines: string[] = [];
	let line = "";

	for (const w of words) {
		const next = line ? `${line} ${w}` : w;
		if (ctx.measureText(next).width <= maxWidthPx) {
			line = next;
			continue;
		}
		if (line) lines.push(line);
		line = w;
	}
	if (line) lines.push(line);

	return lines.length ? lines : [text];
}

// -----------------------
// Token compilation
// -----------------------

function compileTokens(
	content: RSVPContent,
	opts: Required<RSVPOptions>,
): RSVPTok[] {
	if (typeof content !== "string") return content.slice() as RSVPTok[];

	const raw = content.trim();
	if (!raw) return [];

	const out: RSVPTok[] = [];

	if (opts.firstTokenExtraMs > 0) {
		out.push({ kind: "pause", ms: opts.firstTokenExtraMs });
	}

	const parts = tokenizeMarkup(raw, opts);

	for (const p of parts) {
		if (p.kind === "pause") {
			out.push({ kind: "pause", ms: p.ms });
			continue;
		}

		const base = opts.baseWordMs + randJitter(opts.jitterMs);

		const punct = trailingPunct(p.text);
		const punctHold = punct ? (opts.punctHoldMs[punct] ?? 0) : 0;

		const emphasis = p.emphasis ? opts.emphasisMult : 1;
		const ms = Math.max(40, Math.round((base + punctHold) * emphasis));

		out.push({ kind: "word", text: p.text, ms, emphasis });
	}

	return out;
}

function tokenizeMarkup(text: string, opts: Required<RSVPOptions>) {
	const chunks = text.replace(/\s+/g, " ").split(" ");

	const out: (
		| { kind: "word"; text: string; emphasis: boolean }
		| { kind: "pause"; ms: number }
	)[] = [];

	for (const c of chunks) {
		if (!c) continue;

		if (c === "|") {
			out.push({ kind: "pause", ms: opts.pauseShortMs });
			continue;
		}
		if (c === "||") {
			out.push({ kind: "pause", ms: opts.pauseMedMs });
			continue;
		}
		if (c === "|||") {
			out.push({ kind: "pause", ms: opts.pauseLongMs });
			continue;
		}

		if (c === "..." || c === "…") {
			out.push({ kind: "pause", ms: opts.pauseLongMs });
			continue;
		}

		if (c.endsWith("...")) {
			const w = c.slice(0, -3);
			if (w) out.push(parseEmphasisWord(w));
			out.push({ kind: "pause", ms: opts.pauseLongMs });
			continue;
		}

		out.push(parseEmphasisWord(c));
	}

	return out;
}

function parseEmphasisWord(raw: string) {
	const isEmph = raw.length >= 2 && raw.startsWith("*") && raw.endsWith("*");
	const text = isEmph ? raw.slice(1, -1) : raw;
	return { kind: "word" as const, text, emphasis: isEmph };
}

function trailingPunct(word: string): "." | "," | "!" | "?" | ":" | ";" | null {
	const last = word[word.length - 1];
	if (
		last === "." ||
		last === "," ||
		last === "!" ||
		last === "?" ||
		last === ":" ||
		last === ";"
	) {
		return last;
	}
	return null;
}

// -----------------------
// Utilities
// -----------------------

function randJitter(jitterMs: number) {
	if (jitterMs <= 0) return 0;
	return Math.round((Math.random() * 2 - 1) * jitterMs);
}

function roundRectFill(x: number, y: number, w: number, h: number, r: number) {
	const rr = Math.max(0, Math.min(r, Math.floor(Math.min(w, h) / 2)));
	ctx.beginPath();
	ctx.moveTo(x + rr, y);
	ctx.arcTo(x + w, y, x + w, y + h, rr);
	ctx.arcTo(x + w, y + h, x, y + h, rr);
	ctx.arcTo(x, y + h, x, y, rr);
	ctx.arcTo(x, y, x + w, y, rr);
	ctx.closePath();
	ctx.fill();
}

function computeContentKey(content: RSVPContent) {
	if (typeof content === "string") return hashText(content);
	let h = 5381;
	for (const t of content) {
		if (t.kind === "pause") {
			h = (h * 33) ^ 1;
			h = (h * 33) ^ (t.ms | 0);
		} else {
			h = (h * 33) ^ 2;
			h = (h * 33) ^ hashText(t.text);
			h = (h * 33) ^ (t.ms | 0);
			h = (h * 33) ^ Math.floor((t.emphasis ?? 1) * 1000);
		}
	}
	return h >>> 0;
}

function hashText(s: string) {
	let h = 5381;
	for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i);
	return h >>> 0;
}
