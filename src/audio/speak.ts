const audioCtx = new AudioContext();

const vowels = ["a", "e", "i", "o", "u"] as const;
type Vowel = (typeof vowels)[number];

function isVowel(char: string): char is Vowel {
	return vowels.includes(char as Vowel);
}

type SpeechOptions = {
	pitch?: number; // 0.5 (deep) to 2.0 (high)
	tempo?: number; // 0.5 (slow) to 2.0 (fast)
	seed?: number; // optional deterministic randomness
	intensity?: number; // 0..1 (how animated)
};

const defaultOptions = {
	pitch: 1,
	tempo: 0.6,
	intensity: 1,
} as const satisfies SpeechOptions;

const VOWEL_FORMANTS = {
	a: { freq: 800, q: 6 },
	e: { freq: 1000, q: 8 },
	i: { freq: 1200, q: 10 },
	o: { freq: 700, q: 6 },
	u: { freq: 600, q: 5 },
} as const satisfies Record<Vowel, { freq: number; q: number }>;

const master = audioCtx.createGain();
master.gain.value = 0.9;

const hp = audioCtx.createBiquadFilter();
hp.type = "highpass";
hp.frequency.value = 60;

const comp = audioCtx.createDynamicsCompressor();
comp.threshold.value = -20;
comp.knee.value = 24;
comp.ratio.value = 6;
comp.attack.value = 0.005;
comp.release.value = 0.12;

hp.connect(comp).connect(master).connect(audioCtx.destination);

const SOFT_CLIP_CURVE = makeSoftClipCurve(1);

// 0.5s shared noise buffer (we slice it by setting playbackRate + stop time)
const NOISE_BUFFER = makeNoiseBuffer(audioCtx, 0.5);

export function speak(word: string, options: SpeechOptions = defaultOptions) {
	if (audioCtx.state === "suspended") void audioCtx.resume();

	const tempo = options.tempo ?? defaultOptions.tempo;

	const intensityUser = options.intensity ?? defaultOptions.intensity;
	const intensityInternal = intensityUser * 0.5;

	const now = audioCtx.currentTime;
	let t = now + 0.01;

	const text = word.toLowerCase();

	// overlap amount: higher tempo => slightly more overlap
	const overlap = 0.035 / tempo;

	// ---- Per-utterance bus (volume compensation) ----
	const utteranceBus = audioCtx.createGain();

	// Make loud intensities quieter, but keep intensity=1 unchanged
	const loudnessGain = intensityToGain(intensityInternal);

	// Small safety trim so intensity spikes don't jump your ears even if source waveshape clips
	const safetyTrim = 0.95;

	utteranceBus.gain.setValueAtTime(loudnessGain * safetyTrim, now);

	// Route into the shared chain (hp -> comp -> master -> destination)
	utteranceBus.connect(hp);

	// ---- Compressor automation for this utterance ----
	const { threshold: compThresh, ratio: compRatio } =
		intensityToCompressor(intensityInternal);

	// Save current "defaults" (what you set at initialization)
	const defaultThresh = -20;
	const defaultRatio = 6;

	// Apply quickly, then restore after utterance ends
	comp.threshold.cancelScheduledValues(now);
	comp.ratio.cancelScheduledValues(now);

	// Don’t slam instantly: short ramp
	comp.threshold.setTargetAtTime(compThresh, now, 0.01);
	comp.ratio.setTargetAtTime(compRatio, now, 0.01);

	// ---- Synthesis scheduling ----
	const speechOptionsInternal: SpeechOptions = {
		...options,
		intensity: intensityInternal,
	};

	for (let i = 0; i < text.length; i++) {
		const ch = text[i];
		if (!ch) continue;

		const next = text[i + 1];

		if (ch === " ") {
			t += 0.04 / tempo;
			continue;
		}
		if (ch === "." || ch === "!" || ch === "?") {
			t += 0.18 / tempo;
			continue;
		}
		if (ch === "," || ch === ";" || ch === ":") {
			t += 0.11 / tempo;
			continue;
		}

		if (isVowel(ch)) {
			const dur = playVowel(ch, t, speechOptionsInternal, utteranceBus);
			t += Math.max(0.02 / tempo, dur - overlap);
			continue;
		}

		// consonant as “melt” transition
		const dur = playConsonant(ch, t, next, speechOptionsInternal, utteranceBus);
		t += Math.max(0.015 / tempo, dur - overlap * 0.75);
	}

	// ---- Cleanup: restore compressor + disconnect bus after it’s done ----
	const endAt = t + 0.25; // conservative tail for releases
	comp.threshold.setTargetAtTime(defaultThresh, endAt, 0.04);
	comp.ratio.setTargetAtTime(defaultRatio, endAt, 0.04);

	// disconnect bus once we're safely past tail
	const disconnectAt = endAt + 0.5;
	const dc = () => {
		try {
			utteranceBus.disconnect();
		} catch {}
	};

	// schedule with a timeout; AudioContext time -> ms
	const ms = Math.max(0, (disconnectAt - audioCtx.currentTime) * 1000);
	setTimeout(dc, ms);
}

function playConsonant(
	c: string,
	time: number,
	next: string | undefined,
	options: SpeechOptions = defaultOptions,
	bus?: AudioNode,
) {
	const pitch = options.pitch ?? defaultOptions.pitch;
	const tempo = options.tempo ?? defaultOptions.tempo;

	// classify (keep it simple)
	const isFric = "sfxzhv".includes(c) || c === "h";
	const isNasal = "mn".includes(c);
	const isLiquid = "lrwy".includes(c);
	const isPlosive = "ptkbdg".includes(c);

	// consonants should be short and soft; no percussive envelopes
	const dur =
		(isPlosive
			? 0.028
			: isFric
				? 0.05
				: isNasal
					? 0.055
					: isLiquid
						? 0.045
						: 0.035) / tempo;

	const attack = 0.006 / tempo;
	const release = 0.04 / tempo;

	// pick a “target mouth shape”
	const targetFormant =
		next && isVowel(next)
			? VOWEL_FORMANTS[next].freq
			: isFric
				? 3200
				: isNasal
					? 450
					: isLiquid
						? 900
						: 1400;

	const startFormant = isFric
		? targetFormant * 0.85
		: isNasal
			? targetFormant * 1.1
			: isLiquid
				? targetFormant * 0.95
				: isPlosive
					? targetFormant * 0.9
					: targetFormant * 0.98;

	// ----- nodes -----
	const out = audioCtx.createGain();
	out.gain.value = 0;

	const formant = audioCtx.createBiquadFilter();
	formant.type = "bandpass";
	formant.Q.value = isFric ? 7 : isNasal ? 5 : isLiquid ? 6 : 6;

	const lp = audioCtx.createBiquadFilter();
	lp.type = "lowpass";
	lp.frequency.value = isFric ? 7000 : 5200;

	const shaper = audioCtx.createWaveShaper();
	shaper.curve = makeSoftClipCurve(0.8);
	shaper.oversample = "2x";

	// voiced body
	const osc = audioCtx.createOscillator();
	osc.type = isNasal ? "sine" : "triangle";

	const base = (170 + Math.random() * 70) * pitch;
	const f0 = isLiquid
		? base * 1.05
		: isNasal
			? base * 0.85
			: isPlosive
				? base * 0.95
				: base;

	osc.frequency.setValueAtTime(f0 * 0.98, time);
	osc.frequency.exponentialRampToValueAtTime(f0 * 1.01, time + dur * 0.6);

	// subtle hiss layer for fricatives — NOT bursty
	let noise: AudioBufferSourceNode | null = null;
	let noiseGain: GainNode | null = null;
	let noiseBP: BiquadFilterNode | null = null;

	if (isFric) {
		noise = audioCtx.createBufferSource();
		noise.buffer = makeNoiseBuffer(audioCtx, dur + 0.1 / tempo);
		noise.loop = false;

		noiseGain = audioCtx.createGain();
		noiseGain.gain.value = 0;

		noiseBP = audioCtx.createBiquadFilter();
		noiseBP.type = "bandpass";
		noiseBP.Q.value = c === "h" ? 1.2 : 3.5;
		noiseBP.frequency.value =
			c === "f" || c === "v" ? 2200 : c === "h" ? 1200 : 4200;

		const nPeak = (c === "h" ? 0.018 : 0.032) * (0.8 + Math.random() * 0.5);
		noiseGain.gain.setValueAtTime(0.0001, time);
		noiseGain.gain.exponentialRampToValueAtTime(nPeak, time + attack);
		noiseGain.gain.exponentialRampToValueAtTime(0.0001, time + dur + release);

		noise.connect(noiseBP).connect(noiseGain).connect(formant);
	}

	// ----- connect graph -----
	const dest = bus ?? hp; // default to your shared chain
	osc.connect(formant).connect(lp).connect(shaper).connect(out).connect(dest);

	// ----- envelope -----
	const peak =
		(isPlosive
			? 0.055
			: isFric
				? 0.07
				: isNasal
					? 0.065
					: isLiquid
						? 0.06
						: 0.058) *
		(0.85 + Math.random() * 0.4);

	out.gain.setValueAtTime(0.0001, time);
	out.gain.exponentialRampToValueAtTime(peak, time + attack);
	out.gain.exponentialRampToValueAtTime(peak * 0.55, time + attack + dur * 0.6);
	out.gain.exponentialRampToValueAtTime(0.0001, time + dur + release);

	// ----- mouth motion -----
	formant.frequency.setValueAtTime(startFormant, time);
	formant.frequency.exponentialRampToValueAtTime(
		Math.max(60, targetFormant),
		time + dur * 0.85,
	);

	if (isPlosive) {
		out.gain.exponentialRampToValueAtTime(peak * 0.45, time + dur * 0.25);
		out.gain.exponentialRampToValueAtTime(peak, time + dur * 0.5);
	}

	// schedule
	const stopAt = time + dur + release + 0.03;
	osc.start(time);
	osc.stop(stopAt);

	if (noise) {
		noise.start(time);
		noise.stop(stopAt);
	}

	osc.onended = () => {
		try {
			osc.disconnect();
			formant.disconnect();
			lp.disconnect();
			shaper.disconnect();
			out.disconnect();
			noise?.disconnect();
			noiseBP?.disconnect();
			noiseGain?.disconnect();
		} catch {}
	};

	return dur;
}

function playVowel(
	vowel: Vowel,
	time: number,
	options: SpeechOptions,
	bus?: AudioNode,
) {
	const tempo = options.tempo ?? defaultOptions.tempo;
	const pitch = options.pitch ?? defaultOptions.pitch;
	const intensity = options.intensity ?? defaultOptions.intensity;

	const { freq: formantFreq, q } = VOWEL_FORMANTS[vowel];

	// time
	const dur = (0.09 + Math.random() * 0.05) / tempo;
	const attack = (0.004 + Math.random() * 0.002) / tempo;
	const release = (0.045 + Math.random() * 0.02) / tempo;

	// base pitch
	const base = (220 + Math.random() * 90) * pitch;

	const vowelPitchBias: Record<Vowel, number> = {
		a: 1.0,
		e: 1.07,
		i: 1.14,
		o: 0.93,
		u: 0.86,
	};
	const f0 = base * vowelPitchBias[vowel];

	// nodes
	const out = audioCtx.createGain();
	out.gain.value = 0;

	const formant = audioCtx.createBiquadFilter();
	formant.type = "bandpass";
	formant.frequency.value = formantFreq;
	formant.Q.value = q;

	const lp = audioCtx.createBiquadFilter();
	lp.type = "lowpass";
	lp.frequency.value = 5200;

	const shaper = audioCtx.createWaveShaper();
	shaper.curve = SOFT_CLIP_CURVE;
	shaper.oversample = "2x";

	const osc1 = audioCtx.createOscillator();
	osc1.type = "sawtooth";

	const osc2 = audioCtx.createOscillator();
	osc2.type = "triangle";

	const mix = audioCtx.createGain();
	mix.gain.value = lerp(0.48, 0.62, intensity);

	const osc2Gain = audioCtx.createGain();
	osc2Gain.gain.value = lerp(0.16, 0.28, intensity);

	// light breath
	const noise = audioCtx.createBufferSource();
	noise.buffer = NOISE_BUFFER;

	const noiseGain = audioCtx.createGain();
	noiseGain.gain.value =
		lerp(0.03, 0.09, intensity) * (0.7 + Math.random() * 0.6);

	const noiseHP = audioCtx.createBiquadFilter();
	noiseHP.type = "highpass";
	noiseHP.frequency.value = 3500 + Math.random() * 800;
	// connect
	osc1.connect(mix);
	osc2.connect(osc2Gain).connect(mix);

	const dest = bus ?? hp;
	mix.connect(formant).connect(lp).connect(shaper).connect(out).connect(dest);

	noise.connect(noiseHP).connect(noiseGain).connect(formant);

	// envelope (avoid exponential from 0)
	const peak = (0.1 + Math.random() * 0.09) * lerp(0.8, 1.1, intensity);
	out.gain.setValueAtTime(0.0008, time);
	out.gain.exponentialRampToValueAtTime(peak, time + attack);
	out.gain.exponentialRampToValueAtTime(peak * 0.7, time + attack + dur * 0.55);
	out.gain.exponentialRampToValueAtTime(0.0008, time + dur + release);

	// pitch glide
	osc1.frequency.setValueAtTime(f0 * 0.92, time);
	osc1.frequency.exponentialRampToValueAtTime(
		f0 * 1.03,
		time + attack + 0.014 / tempo,
	);

	osc2.frequency.setValueAtTime(f0 * 0.52, time);
	osc2.frequency.exponentialRampToValueAtTime(
		f0 * 0.54,
		time + attack + 0.014 / tempo,
	);

	// wobble
	const lfo = audioCtx.createOscillator();
	lfo.type = "sine";
	lfo.frequency.value = 2 + Math.random() * 4;

	const lfoGain = audioCtx.createGain();
	lfoGain.gain.value = lerp(4, 12, intensity) * (0.8 + Math.random() * 0.5);

	lfo.connect(lfoGain).connect(osc1.frequency);

	// mouth motion
	const mouth = audioCtx.createOscillator();
	mouth.type = "sine";
	mouth.frequency.value = 8 + Math.random() * 8;

	const mouthGain = audioCtx.createGain();
	mouthGain.gain.value = formantFreq * lerp(0.004, 0.012, intensity);

	mouth.connect(mouthGain).connect(formant.frequency);

	// start/stop
	const stopAt = time + dur + release + 0.03;

	osc1.start(time);
	osc2.start(time);
	noise.start(time);

	lfo.start(time);
	mouth.start(time);

	// stop noise early; it’s just breath
	noise.stop(time + dur + 0.02);

	osc1.stop(stopAt);
	osc2.stop(stopAt);
	lfo.stop(stopAt);
	mouth.stop(stopAt);

	osc1.onended = () => {
		try {
			osc1.disconnect();
			osc2.disconnect();
			noise.disconnect();
			lfo.disconnect();
			mouth.disconnect();
			mix.disconnect();
			formant.disconnect();
			lp.disconnect();
			shaper.disconnect();
			out.disconnect();
			noiseHP.disconnect();
			noiseGain.disconnect();
			osc2Gain.disconnect();
			lfoGain.disconnect();
			mouthGain.disconnect();
		} catch {
			// ignore
		}
	};

	return dur * 0.85; // return effective “advance” time (keeps speech snappy)
}

function makeSoftClipCurve(amount = 1) {
	const n = 256;
	const curve = new Float32Array(n);
	for (let i = 0; i < n; i++) {
		const x = (i / (n - 1)) * 2 - 1;
		curve[i] = Math.tanh(x * (1 + amount * 6));
	}
	return curve;
}

function makeNoiseBuffer(ctx: AudioContext, seconds: number) {
	const sampleRate = ctx.sampleRate;
	const length = Math.max(1, Math.floor(sampleRate * seconds));
	const buffer = ctx.createBuffer(1, length, sampleRate);
	const data = buffer.getChannelData(0);
	for (let i = 0; i < length; i++) {
		const t = i / length;
		const amp = 1 - t * 0.6;
		data[i] = (Math.random() * 2 - 1) * amp;
	}
	return buffer;
}

function lerp(a: number, b: number, t: number) {
	return a + (b - a) * t;
}

function intensityToGain(intensity: number) {
	// Keep intensity=1 unchanged.
	// Above 1, reduce loudness using a gentle power curve.
	//  4  -> 0.5
	//  16 -> 0.25
	//  20 -> ~0.223
	if (!Number.isFinite(intensity) || intensity <= 1) return 1;
	return intensity ** -1;
}

function intensityToCompressor(intensity: number) {
	// Make the shared compressor work harder when intensity is high.
	// We only *increase* compression above intensity=1.
	const i = Math.max(1, intensity);

	// More intensity -> lower threshold (more compression)
	// log scaling so 2->small change, 20->bigger but not insane
	const extraDb = 10 * Math.log10(i); // 1->0dB, 10->10dB, 20->13dB
	const threshold = clamp(-20 - extraDb, -40, -18);

	// More intensity -> higher ratio
	const ratio = clamp(6 + Math.log2(i) * 2.2, 6, 18);

	return { threshold, ratio };
}

function clamp(x: number, min: number, max: number) {
	return Math.max(min, Math.min(max, x));
}
