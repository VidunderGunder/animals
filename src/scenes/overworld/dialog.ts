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

	/** bubble corner radius */
	radiusPx?: number;
};

type BubbleState = {
	id: string;

	// identity + invalidation
	contentKey: number;
	tokens: RSVPTok[];

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

	pauseShortMs: 120,
	pauseMedMs: 220,
	pauseLongMs: 380,

	punctHoldMs: {
		".": 180,
		",": 90,
		"!": 140,
		"?": 160,
		":": 120,
		";": 110,
	},

	emphasisMult: 1.35,

	lingerMs: 500,
	maxWidthPx: 150,
	offsetYPx: -10,
	fadeMs: 90,

	paddingX: 4,
	paddingY: 2,
	radiusPx: 4,
};

const bubbles = new Map<string, BubbleState>();
let now = 0;

export function beginDialogFrame(dt: number) {
	now += dt;

	// GC: if caller stops invoking, remove after a grace window
	for (const [id, b] of bubbles) {
		if (now - b.lastTouchedAtMs > 2000) bubbles.delete(id);
	}
}

/**
 * Content guide:
 *
 * - Use *word* to emphasize a word.
 * - Use | for short pause, || for medium, ||| for long.
 * - Use ... for a long pause (like thinking).
 *
 * Example:
 * rsvp("npc-1-welcome", "Hello there! || Welcome to our village... *Enjoy* your stay!", () => ({ xPx: npc.xPx, yPx: npc.yPx - npc.height }));
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
	const pos = getPosition();
	const opts: Required<RSVPOptions> = { ...DEFAULT_OPTS, ...options };

	const key = computeContentKey(content);

	let bubble = bubbles.get(id);

	// create or reset if content changed
	if (!bubble || bubble.contentKey !== key) {
		const tokens = compileTokens(content, opts);

		bubble = {
			id,
			contentKey: key,
			tokens,

			tMs: 0,
			lastTouchedAtMs: now,
			finishedAtMs: null,

			tokenIndex: 0,
			tokenRemainingMs: tokens[0]?.ms ?? 0,

			pos,
			opts,
		};
		bubbles.set(id, bubble);
	} else {
		bubble.lastTouchedAtMs = now;
		bubble.pos = pos;
		bubble.opts = opts;
	}

	// render current token
	renderBubble(bubble);
}

export function endDialogFrame(dtMs: number) {
	for (const b of bubbles.values()) {
		advanceBubble(b, dtMs);
	}
}

function advanceBubble(b: BubbleState, dtMs: number) {
	if (dtMs <= 0) return;

	b.tMs += dtMs;

	if (b.tokens.length === 0) {
		b.finishedAtMs = b.finishedAtMs ?? b.tMs;
		return;
	}

	// if already finished, handle linger/expiry
	if (b.finishedAtMs !== null) {
		const doneFor = b.tMs - b.finishedAtMs;
		if (doneFor > b.opts.lingerMs) bubbles.delete(b.id);
		return;
	}

	let remaining = dtMs;

	while (remaining > 0 && b.finishedAtMs === null) {
		// If current token has no time, advance
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

	// If finished: keep showing last word during linger/fade-out
	// (alpha already handles fading out)
	if (b.finishedAtMs !== null) {
		if (!b.lastWordText) return;
		const x = Math.round(b.pos.xPx);
		const y = Math.round(b.pos.yPx + b.opts.offsetYPx);
		drawTextWithBubble(
			b.lastWordText,
			{ xPx: x, yPx: y },
			b.opts,
			alpha,
			b.lastWordEmphasis,
		);
		return;
	}

	const tok = b.tokens[b.tokenIndex];
	if (!tok) return;

	// Pause tokens: keep showing the last word instead of disappearing
	if (tok.kind === "pause") {
		if (!b.lastWordText) return; // nothing shown yet
		const x = Math.round(b.pos.xPx);
		const y = Math.round(b.pos.yPx + b.opts.offsetYPx);
		drawTextWithBubble(
			b.lastWordText,
			{ xPx: x, yPx: y },
			b.opts,
			alpha,
			b.lastWordEmphasis,
		);
		return;
	}

	// Word token: render it and remember it
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
	ctx.save();
	ctx.font = "8px Tiny5";
	ctx.textBaseline = "top";

	const lines = opts.maxWidthPx ? wrapText(text, opts.maxWidthPx) : [text];
	const lineH = 9;

	const paddingX = opts.paddingX;
	const paddingY = opts.paddingY;

	let maxW = 0;
	for (const line of lines) {
		const w = ctx.measureText(line).width;
		if (w > maxW) maxW = w;
	}

	// Optional: tiny size pop on emphasis by padding, not font (keeps pixel font crisp)
	const emphPad = Math.round((emphasis - 1) * 2);

	const bubbleW = Math.ceil(maxW + (paddingX + emphPad) * 2);
	const bubbleH = Math.ceil(lines.length * lineH + (paddingY + emphPad) * 2);

	const bx = Math.round(xPx - bubbleW / 2);
	const by = Math.round(yPx - bubbleH);

	ctx.globalAlpha = alpha;

	// bubble bg
	ctx.fillStyle = "rgba(0,0,0,0.45)";
	roundRectFill(bx, by, bubbleW, bubbleH, opts.radiusPx);

	// text
	ctx.fillStyle = "#ffffff";
	ctx.textRendering = "geometricPrecision";
	ctx.shadowColor = "rgba(0,0,0,0.30)";
	ctx.shadowOffsetX = 0;
	ctx.shadowOffsetY = 1;
	ctx.shadowBlur = 0;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (!line) continue;
		ctx.fillText(
			line,
			bx + paddingX + emphPad,
			by + paddingY + emphPad + i * lineH,
		);
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

	// Markup rules:
	// - *word* => emphasis
	// - | / || / ||| => pauses
	// - ... => long-ish pause (like thinking)
	//
	// We keep punctuation attached to words, then apply hold based on last char.
	const raw = content.trim();
	if (!raw) return [];

	const out: RSVPTok[] = [];

	const parts = tokenizeMarkup(raw);

	for (const p of parts) {
		if (p.kind === "pause") {
			out.push({ kind: "pause", ms: p.ms });
			continue;
		}

		// Word token
		const base = opts.baseWordMs + randJitter(opts.jitterMs);

		const punct = trailingPunct(p.text);
		const punctHold = punct ? (opts.punctHoldMs[punct] ?? 0) : 0;

		const emphasis = p.emphasis ? opts.emphasisMult : 1;
		const ms = Math.max(40, Math.round((base + punctHold) * emphasis));

		out.push({ kind: "word", text: p.text, ms, emphasis });
	}

	return out;
}

function tokenizeMarkup(
	text: string,
):
	| { kind: "word"; text: string; emphasis: boolean }
	| { kind: "pause"; ms: number }[] {
	// We want to preserve tokens like:
	// "Oh... *wow*! | actually"
	//
	// Strategy:
	// - split on whitespace
	// - each chunk may be:
	//   - "|" "||" "|||"
	//   - contains "..." (treated as word WITHOUT the dots + then a pause) OR just "..."
	//   - "*word*" (emphasis)
	const chunks = text.replace(/\s+/g, " ").split(" ");

	const out: (
		| { kind: "word"; text: string; emphasis: boolean }
		| { kind: "pause"; ms: number }
	)[] = [];

	for (const c of chunks) {
		if (!c) continue;

		if (c === "|") {
			out.push({ kind: "pause", ms: DEFAULT_OPTS.pauseShortMs });
			continue;
		}
		if (c === "||") {
			out.push({ kind: "pause", ms: DEFAULT_OPTS.pauseMedMs });
			continue;
		}
		if (c === "|||") {
			out.push({ kind: "pause", ms: DEFAULT_OPTS.pauseLongMs });
			continue;
		}

		// Handle "..." as a pure pause
		if (c === "..." || c === "…") {
			out.push({ kind: "pause", ms: DEFAULT_OPTS.pauseLongMs });
			continue;
		}

		// Handle word ending with "..." => word then pause
		if (c.endsWith("...")) {
			const w = c.slice(0, -3);
			if (w) out.push(parseEmphasisWord(w));
			out.push({ kind: "pause", ms: DEFAULT_OPTS.pauseLongMs });
			continue;
		}

		// Normal word
		out.push(parseEmphasisWord(c));
	}

	return out as any;
}

function parseEmphasisWord(raw: string) {
	// emphasis if wrapped in *...* (single-token)
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
	// structured tokens: hash stable fields
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

export function dialogTest(dt: number) {
	beginDialogFrame(dt);

	rsvp("player-greeting", "Oh... *wow*! || Hello there!", () => ({
		xPx: player.xPx - camera.xPx + player.width / 2,
		yPx: player.yPx - camera.yPx,
	}));

	endDialogFrame(dt);
}
