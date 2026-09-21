// Self-contained piano-ish synth using the Web Audio API (additive synthesis
// with a percussive amplitude envelope). No external samples/network needed,
// so it works fully offline once the PWA shell is cached.

type Voice = {
  gain: GainNode;
  oscillators: OscillatorNode[];
  releasedAt: number | null;
};

const HARMONIC_GAINS = [1, 0.55, 0.3, 0.18, 0.1, 0.06];
const NATURAL_DECAY_SECONDS = 6.5;

export class PianoAudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private voices = new Map<number, Voice>();

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

    const freq = 440 * Math.pow(2, (midi - 69) / 12);
    const now = ctx.currentTime;

    const voiceGain = ctx.createGain();
    voiceGain.gain.setValueAtTime(0, now);
    const peak = 0.22 * velocity;
    const sustain = peak * 0.35;
    voiceGain.gain.linearRampToValueAtTime(peak, now + 0.008);
    voiceGain.gain.exponentialRampToValueAtTime(Math.max(sustain, 0.0001), now + 0.35);
    // Like a real piano string, the note keeps fading even while the key is
    // still "held" - this guarantees it reaches silence on its own within a
    // few seconds even if a noteOff event is ever lost (e.g. a dropped
    // pointerup on a flaky touchscreen), instead of droning forever.
    voiceGain.gain.exponentialRampToValueAtTime(0.0001, now + NATURAL_DECAY_SECONDS);
    voiceGain.connect(this.master!);

    const oscillators: OscillatorNode[] = [];
    HARMONIC_GAINS.forEach((amp, i) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq * (i + 1);
      const partialGain = ctx.createGain();
      partialGain.gain.value = amp;
      osc.connect(partialGain);
      partialGain.connect(voiceGain);
      osc.start(now);
      // Safety net: stop the oscillator on its own even if noteOff() is
      // never called for this voice.
      osc.stop(now + NATURAL_DECAY_SECONDS + 0.1);
      oscillators.push(osc);
    });

    this.voices.set(midi, { gain: voiceGain, oscillators, releasedAt: null });
  }

  noteOff(midi: number, immediate = false) {
    const voice = this.voices.get(midi);
    if (!voice || !this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const releaseTime = immediate ? 0.03 : 0.35;

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
