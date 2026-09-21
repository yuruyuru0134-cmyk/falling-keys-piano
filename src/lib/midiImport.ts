import { Midi } from "@tonejs/midi";
import type { Song, NoteEvent } from "./songs";
import { DURATION_SCALE } from "./theory";

/**
 * Parses a standard MIDI file (picked up from any site the user has the
 * rights to use, or their own composition) into the app's Song format.
 * The top voice at each moment becomes the "melody" (easy/medium), and
 * everything else becomes "harmony" (hard difficulty only).
 */
export async function songFromMidiFile(file: File): Promise<Song> {
  const buffer = await file.arrayBuffer();
  const midi = new Midi(buffer);

  const allNotes: NoteEvent[] = [];
  for (const track of midi.tracks) {
    for (const n of track.notes) {
      allNotes.push({
        midi: n.midi,
        time: n.time * DURATION_SCALE,
        duration: Math.max(n.duration, 0.08) * DURATION_SCALE,
      });
    }
  }

  if (allNotes.length === 0) {
    throw new Error("この MIDI ファイルには音符が見つかりませんでした。");
  }

  allNotes.sort((a, b) => a.time - b.time);

  // Bucket notes into short time windows; the highest note per window is
  // "melody", the rest becomes "harmony".
  const melody: NoteEvent[] = [];
  const harmony: NoteEvent[] = [];
  const WINDOW = 0.06 * DURATION_SCALE;
  let i = 0;
  while (i < allNotes.length) {
    let j = i;
    let top = allNotes[i];
    while (j < allNotes.length && allNotes[j].time - allNotes[i].time < WINDOW) {
      if (allNotes[j].midi > top.midi) top = allNotes[j];
      j++;
    }
    for (let k = i; k < j; k++) {
      if (allNotes[k] === top) melody.push(allNotes[k]);
      else harmony.push(allNotes[k]);
    }
    i = j;
  }

  const low = Math.min(...allNotes.map((n) => n.midi));
  const high = Math.max(...allNotes.map((n) => n.midi));
  const lengthSeconds = Math.max(...allNotes.map((n) => n.time + n.duration)) + 1.5;
  const bpm = (midi.header.tempos[0]?.bpm ?? 100) / DURATION_SCALE;

  const name = file.name.replace(/\.midi?$/i, "");
  return {
    id: `midi-${Date.now()}`,
    title: name || "インポートした曲",
    subtitle: "取り込んだ MIDI ファイル",
    bpm,
    category: "custom",
    melody,
    harmony,
    lengthSeconds,
    range: { low, high },
  };
}
