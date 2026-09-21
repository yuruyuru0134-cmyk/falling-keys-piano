import type { Song } from "./songs";
import type { Difficulty } from "./theory";
import { DIFFICULTY_SETTINGS } from "./theory";

const PIANO_LOW = 21; // A0
const PIANO_HIGH = 108; // C8
const MIN_SPAN = 14; // keep at least a bit more than one octave visible

export function getDisplayRange(song: Song, difficulty: Difficulty): { low: number; high: number } {
  const settings = DIFFICULTY_SETTINGS[difficulty];
  const notes = settings.useFullArrangement ? [...song.melody, ...song.harmony] : song.melody;
  let low = Math.min(...notes.map((n) => n.midi));
  let high = Math.max(...notes.map((n) => n.midi));

  low -= 2;
  high += 2;

  while (high - low < MIN_SPAN) {
    if (low > PIANO_LOW) low -= 1;
    if (high - low < MIN_SPAN && high < PIANO_HIGH) high += 1;
    if (low <= PIANO_LOW && high >= PIANO_HIGH) break;
  }

  return { low: Math.max(PIANO_LOW, low), high: Math.min(PIANO_HIGH, high) };
}

export function getActiveNotes(song: Song, difficulty: Difficulty) {
  const settings = DIFFICULTY_SETTINGS[difficulty];
  const speed = settings.speedMultiplier;
  const source = settings.useFullArrangement ? [...song.melody, ...song.harmony] : song.melody;
  return source
    .map((n) => ({ midi: n.midi, time: n.time / speed, duration: n.duration / speed }))
    .sort((a, b) => a.time - b.time);
}
