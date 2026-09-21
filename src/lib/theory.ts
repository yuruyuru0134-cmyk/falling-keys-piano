// Music theory + piano geometry helpers.
// MIDI note numbers: 60 = C4 (middle C).

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;
const WHITE_PITCH_CLASSES = new Set([0, 2, 4, 5, 7, 9, 11]); // C D E F G A B

// Global slow-down applied to every bundled/imported song's timeline, so
// practicing feels less rushed. 2 = twice as long / half the effective tempo.
export const DURATION_SCALE = 2;

export function isBlackKey(midi: number): boolean {
  return !WHITE_PITCH_CLASSES.has(((midi % 12) + 12) % 12);
}

export function midiToName(midi: number): string {
  const pitchClass = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[pitchClass]}${octave}`;
}

// Parses "C4", "F#3", "Bb5" -> midi number
export function nameToMidi(name: string): number {
  const match = /^([A-Ga-g])([#b]?)(-?\d+)$/.exec(name.trim());
  if (!match) throw new Error(`Invalid note name: ${name}`);
  const [, letter, accidental, octaveStr] = match;
  const base: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  let pitchClass = base[letter.toUpperCase()];
  if (accidental === "#") pitchClass += 1;
  if (accidental === "b") pitchClass -= 1;
  const octave = parseInt(octaveStr, 10);
  return (octave + 1) * 12 + pitchClass;
}

export type KeyLayout = {
  midi: number;
  isBlack: boolean;
  /** left offset, in "white key units" (1 unit = 1 white key width) */
  x: number;
  /** width, in white key units */
  width: number;
};

/**
 * Lays out a contiguous range of piano keys [lowMidi, highMidi] using
 * real piano proportions (black keys ~60% width, offset between the
 * two neighboring white keys they sit over).
 */
export function computeKeyboardLayout(lowMidi: number, highMidi: number): {
  keys: KeyLayout[];
  whiteKeyCount: number;
} {
  const keys: KeyLayout[] = [];
  let whiteX = 0;
  const whiteXByMidi = new Map<number, number>();

  for (let m = lowMidi; m <= highMidi; m++) {
    if (!isBlackKey(m)) {
      whiteXByMidi.set(m, whiteX);
      keys.push({ midi: m, isBlack: false, x: whiteX, width: 1 });
      whiteX += 1;
    }
  }
  const whiteKeyCount = whiteX;

  const BLACK_WIDTH = 0.62;
  for (let m = lowMidi; m <= highMidi; m++) {
    if (isBlackKey(m)) {
      // Find the white key immediately below (m-1) to anchor position.
      const leftWhite = whiteXByMidi.get(m - 1);
      if (leftWhite === undefined) continue;
      const x = leftWhite + 1 - BLACK_WIDTH / 2;
      keys.push({ midi: m, isBlack: true, x, width: BLACK_WIDTH });
    }
  }

  keys.sort((a, b) => a.midi - b.midi);
  return { keys, whiteKeyCount };
}

export const DIFFICULTIES = ["easy", "medium", "mediumHard", "hard"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const DIFFICULTY_SETTINGS: Record<
  Difficulty,
  {
    label: string;
    description: string;
    /** seconds a note takes to fall from top of screen to the keyboard */
    fallTime: number;
    /** tempo multiplier applied to the song's native bpm */
    speedMultiplier: number;
    /** +/- seconds allowed around the exact hit time to count as correct */
    hitWindow: number;
    /** include left-hand / harmony notes, not just melody */
    useFullArrangement: boolean;
    /** show note name labels on falling bars */
    showLabels: boolean;
  }
> = {
  easy: {
    label: "かんたん",
    description: "メロディのみ・ゆっくり・判定甘め",
    fallTime: 3.6,
    speedMultiplier: 0.75,
    hitWindow: 0.28,
    useFullArrangement: false,
    showLabels: true,
  },
  medium: {
    label: "ふつう",
    description: "メロディのみ・標準テンポ",
    fallTime: 2.6,
    speedMultiplier: 1.0,
    hitWindow: 0.18,
    useFullArrangement: false,
    showLabels: true,
  },
  mediumHard: {
    label: "やや難しい",
    description: "メロディのみ・少し速め・判定やや厳しめ",
    fallTime: 2.2,
    speedMultiplier: 1.08,
    hitWindow: 0.15,
    useFullArrangement: false,
    showLabels: true,
  },
  hard: {
    label: "むずかしい",
    description: "両手アレンジ・速い・判定シビア",
    fallTime: 1.9,
    speedMultiplier: 1.15,
    hitWindow: 0.12,
    useFullArrangement: true,
    showLabels: false,
  },
};
