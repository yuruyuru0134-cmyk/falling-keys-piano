// Self-contained synth using the Web Audio API - no external samples/network
// needed, so it works fully offline once the PWA shell is cached. Several
// selectable timbres ("instruments") share the same envelope engine below.

export type InstrumentId = "piano" | "organ" | "synth" | "marimba";

export const INSTRUMENTS: { id: InstrumentId; label: string }[] = [
  { id: "piano", label: "ピアノ" },
  { id: "organ", label: "オルガン" },
  { id: "synth", label: "シンセ" },
  { id: "marimba", label: "マリンバ" },
];

type BuildFn = (ctx: AudioContext, freq: number, dest: AudioNode) => OscillatorNode[];

type InstrumentPreset = {
  build: BuildFn;
  peakGain: number;
  attack: number;
  decayTime: number;
  sustainRatio: number; // level held during "sustain", as a fraction of peak
  /** notes keep fading even while "held", reaching silence on their own by
   *  this many seconds - guarantees no voice can drone forever even if a
   *  noteOff event is ever lost. */
  naturalDecaySeconds: number;
  releaseTime: number;
};

function additive(ratios: number[], gains: number[]): BuildFn {
  return (ctx, freq, dest) =>
    ratios.map((ratio, i) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq * ratio;
      const g = ctx.createGain();
      g.gain.value = gains[i] ?? 0;
      osc.connect(g);
      g.connect(dest);
      return osc;
    });
}

function waveform(type: OscillatorType, detunesCents: number[]): BuildFn {
  return (ctx, freq, dest) =>
    detunesCents.map((cents) => {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = freq;
      osc.detune.value = cents;
      const g = ctx.createGain();
      g.gain.value = 1 / detunesCents.length;
      osc.connect(g);
      g.connect(dest);
      return osc;
    });
}

const PRESETS: Record<InstrumentId, InstrumentPreset> = {
  piano: {
    build: additive([1, 2, 3, 4, 5, 6], [1, 0.55, 0.3, 0.18, 0.1, 0.06]),
    peakGain: 0.22,
    attack: 0.008,
    decayTime: 0.35,
    sustainRatio: 0.35,
    naturalDecaySeconds: 6.5,
    releaseTime: 0.35,
  },
  organ: {
    // Flat drawbar-style stack (fundamental + octave + twelfth + ...), holds
    // near its peak the whole time it's "on", like a real electric organ.
    build: additive([1, 2, 3, 4, 6, 8], [1, 0.35, 0.55, 0.2, 0.3, 0.12]),
    peakGain: 0.15,
    attack: 0.025,
    decayTime: 0.05,
    sustainRatio: 0.92,
    naturalDecaySeconds: 9,
    releaseTime: 0.07,
  },
  synth: {
    // A couple of slightly detuned sawtooths for a thick lead-synth tone.
    build: waveform("sawtooth", [-6, 6]),
    peakGain: 0.13,
    attack: 0.01,
    decayTime: 0.12,
    sustainRatio: 0.55,
    naturalDecaySeconds: 5,
    releaseTime: 0.12,
  },
  marimba: {
    // Slightly inharmonic overtones + a very fast pluck + quick decay.
    build: additive([1, 3.93, 9.2], [1, 0.45, 0.2]),
    peakGain: 0.3,
    attack: 0.002,
    decayTime: 0.12,
    sustainRatio: 0.12,
    naturalDecaySeconds: 2.4,
    releaseTime: 0.08,
  },
};

type Voice = {
  gain: GainNode;
  oscillators: OscillatorNode[];
  releaseTime: number;
};

export class PianoAudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private voices = new Map<number, Voice>();
  private instrument: InstrumentId = "piano";

  setInstrument(id: InstrumentId) {
    this.instrument = id;
  }

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  /** Must be called from a user gesture (touch/click) to satisfy iOS autoplay rules. */
  unlock() {
    const ctx = this.ensureContext();
    if (ctx.state === "suspended") ctx.resume();
  }

  noteOn(midi: number, velocity = 0.9) {
    const ctx = this.ensureContext();
    if (ctx.state === "suspended") ctx.resume();
    this.noteOff(midi, true);

    const preset = PRESETS[this.instrument];
    const freq = 440 * Math.pow(2, (midi - 69) / 12);
    const now = ctx.currentTime;

    const voiceGain = ctx.createGain();
    voiceGain.gain.setValueAtTime(0, now);
    const peak = preset.peakGain * velocity;
    const sustain = peak * preset.sustainRatio;
    voiceGain.gain.linearRampToValueAtTime(peak, now + preset.attack);
    voiceGain.gain.exponentialRampToValueAtTime(Math.max(sustain, 0.0001), now + preset.decayTime);
    voiceGain.gain.exponentialRampToValueAtTime(0.0001, now + preset.naturalDecaySeconds);
    voiceGain.connect(this.master!);

    const oscillators = preset.build(ctx, freq, voiceGain);
    const stopAt = now + preset.naturalDecaySeconds + 0.1;
    oscillators.forEach((osc) => {
      osc.start(now);
      osc.stop(stopAt);
    });

    this.voices.set(midi, { gain: voiceGain, oscillators, releaseTime: preset.releaseTime });
  }

  noteOff(midi: number, immediate = false) {
    const voice = this.voices.get(midi);
    if (!voice || !this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const releaseTime = immediate ? 0.03 : voice.releaseTime;

    voice.gain.gain.cancelScheduledValues(now);
    const current = voice.gain.gain.value;
    voice.gain.gain.setValueAtTime(Math.max(current, 0.0001), now);
    voice.gain.gain.exponentialRampToValueAtTime(0.0001, now + releaseTime);

    voice.oscillators.forEach((osc) => {
      try {
        osc.stop(now + releaseTime + 0.05);
      } catch {
        // already stopped
      }
    });
    this.voices.delete(midi);
  }

  allNotesOff() {
    for (const midi of Array.from(this.voices.keys())) this.noteOff(midi, true);
  }
}

let singleton: PianoAudioEngine | null = null;
export function getAudioEngine(): PianoAudioEngine {
  if (!singleton) singleton = new PianoAudioEngine();
  return singleton;
}
