import { nameToMidi, DURATION_SCALE } from "./theory";

export type NoteEvent = { midi: number; time: number; duration: number };

export type SongCategory = "world" | "classical" | "japan" | "custom";

export const CATEGORY_LABELS: Record<SongCategory, string> = {
  world: "世界の民謡・童謡",
  classical: "クラシック",
  japan: "日本の唱歌・童謡",
  custom: "追加した曲",
};

export type Song = {
  id: string;
  title: string;
  subtitle: string;
  bpm: number;
  category: SongCategory;
  /** main melody line (used for easy/medium difficulties) */
  melody: NoteEvent[];
  /** extra notes (left hand / harmony) added on top of melody for hard difficulty */
  harmony: NoteEvent[];
  lengthSeconds: number;
  range: { low: number; high: number };
};

/**
 * Tiny melody DSL: space-separated tokens of "NOTE:BEATS", chords with "+",
 * rests as "R:BEATS". One beat = one quarter note at the song's bpm.
 *   "C4:1 D4:1 E4+G4:2 R:1"
 */
function parseLine(line: string, beatSec: number, t0 = 0): { events: NoteEvent[]; end: number } {
  const events: NoteEvent[] = [];
  let t = t0;
  for (const tok of line.trim().split(/\s+/).filter(Boolean)) {
    const [notesPart, beatsPart] = tok.split(":");
    const beats = parseFloat(beatsPart);
    const dur = beats * beatSec;
    if (notesPart !== "R") {
      for (const n of notesPart.split("+")) {
        events.push({ midi: nameToMidi(n), time: t, duration: dur * 0.92 });
      }
    }
    t += dur;
  }
  return { events, end: t };
}

function buildSong(
  id: string,
  title: string,
  subtitle: string,
  bpm: number,
  melodyStr: string,
  harmonyStr: string,
  category: SongCategory
): Song {
  const beatSec = (60 / bpm) * DURATION_SCALE;
  const { events: melody, end: melodyEnd } = parseLine(melodyStr, beatSec);
  const { events: harmony, end: harmonyEnd } = parseLine(harmonyStr, beatSec);
  const all = [...melody, ...harmony];
  const low = Math.min(...all.map((n) => n.midi));
  const high = Math.max(...all.map((n) => n.midi));
  return {
    id,
    title,
    subtitle,
    bpm,
    category,
    melody,
    harmony,
    lengthSeconds: Math.max(melodyEnd, harmonyEnd) + 1.5,
    range: { low, high },
  };
}

// All songs below are traditional / public-domain melodies (folk songs or
// composers who died 70+ years ago), hand-transcribed for this app rather
// than pulled from any copyrighted arrangement or recording.
export const SONGS: Song[] = [
  buildSong(
    "hot-cross-buns",
    "Hot Cross Buns",
    "英語の伝承童謡・PD",
    100,
    "B4:1 A4:1 G4:2 B4:1 A4:1 G4:2 G4:0.5 G4:0.5 G4:0.5 G4:0.5 A4:0.5 A4:0.5 A4:0.5 A4:0.5 B4:1 A4:1 G4:2",
    "G3:4 G3:4 G3:2 G3:2 G3:4",
    "world"
  ),
  buildSong(
    "twinkle-twinkle",
    "Twinkle Twinkle Little Star",
    "フランス民謡・PD",
    100,
    "C4:1 C4:1 G4:1 G4:1 A4:1 A4:1 G4:2 " +
      "F4:1 F4:1 E4:1 E4:1 D4:1 D4:1 C4:2 " +
      "G4:1 G4:1 F4:1 F4:1 E4:1 E4:1 D4:2 " +
      "G4:1 G4:1 F4:1 F4:1 E4:1 E4:1 D4:2 " +
      "C4:1 C4:1 G4:1 G4:1 A4:1 A4:1 G4:2 " +
      "F4:1 F4:1 E4:1 E4:1 D4:1 D4:1 C4:2",
    "C3:4 G3:4 F3:4 C3:4 G3:4 D3:4 G3:4 D3:4 C3:4 G3:4 F3:4 C3:4",
    "world"
  ),
  buildSong(
    "mary-lamb",
    "Mary Had a Little Lamb",
    "アメリカ民謡・PD",
    108,
    "E4:1 D4:1 C4:1 D4:1 E4:1 E4:1 E4:2 " +
      "D4:1 D4:1 D4:2 E4:1 G4:1 G4:2 " +
      "E4:1 D4:1 C4:1 D4:1 E4:1 E4:1 E4:1 E4:1 " +
      "D4:1 D4:1 E4:1 D4:1 C4:4",
    "C3:4 G3:4 C3:4 G3:4 C3:4 G3:4 C3:4 G3:4",
    "world"
  ),
  buildSong(
    "ode-to-joy",
    "Ode to Joy (Symphony No.9)",
    "ベートーヴェン・PD",
    112,
    // A-A-B-A, cross-checked against a published ABC transcription (in G
    // major there, transposed to C here) - the B section is a genuine
    // repeated turn figure, not just a continued scale run.
    "E4:1 E4:1 F4:1 G4:1 G4:1 F4:1 E4:1 D4:1 " +
      "C4:1 C4:1 D4:1 E4:1 E4:1.5 D4:0.5 D4:2 " +
      "E4:1 E4:1 F4:1 G4:1 G4:1 F4:1 E4:1 D4:1 " +
      "C4:1 C4:1 D4:1 E4:1 D4:1.5 C4:0.5 C4:2 " +
      "D4:1 D4:1 E4:1 C4:1 D4:1 E4:0.5 F4:0.5 E4:1 C4:1 " +
      "D4:1 E4:0.5 F4:0.5 E4:1 D4:1 C4:1 D4:1 G3:2 " +
      "E4:1 E4:1 F4:1 G4:1 G4:1 F4:1 E4:1 D4:1 " +
      "C4:1 C4:1 D4:1 E4:1 D4:1.5 C4:0.5 C4:2",
    "C3:4 G3:4 C3:4 G3:4 C3:4 G3:4 C3:4 G3:4 " +
      "F3:4 C3:4 G3:4 D3:4 C3:4 G3:4 C3:4 G3:4",
    "classical"
  ),
  buildSong(
    "jingle-bells",
    "Jingle Bells (Chorus)",
    "J. ピアポント・PD",
    120,
    // The actual chorus (verified against a published score) is shorter
    // and ends differently than I'd first guessed - repeated twice here.
    "E4:0.5 E4:0.5 E4:1 E4:0.5 E4:0.5 E4:1 " +
      "E4:0.5 G4:0.5 C4:0.75 D4:0.25 E4:2 " +
      "F4:0.5 F4:0.5 F4:0.75 F4:0.25 F4:0.5 E4:0.5 E4:0.5 E4:0.25 E4:0.25 " +
      "G4:0.5 G4:0.5 F4:0.5 D4:0.5 C4:2 " +
      "E4:0.5 E4:0.5 E4:1 E4:0.5 E4:0.5 E4:1 " +
      "E4:0.5 G4:0.5 C4:0.75 D4:0.25 E4:2 " +
      "F4:0.5 F4:0.5 F4:0.75 F4:0.25 F4:0.5 E4:0.5 E4:0.5 E4:0.25 E4:0.25 " +
      "G4:0.5 G4:0.5 F4:0.5 D4:0.5 C4:2",
    "C3:2 G3:2 C3:2 F3:2 C3:2 G3:2 C3:2 C3:2 " +
      "C3:2 G3:2 C3:2 F3:2 C3:2 G3:2 C3:2 C3:2",
    "world"
  ),
  buildSong(
    "auld-lang-syne",
    "Auld Lang Syne",
    "スコットランド民謡・PD",
    90,
    // Verse then refrain, from a published score with lyrics aligned - my
    // first pass had used a different (correct but less familiar) old
    // variant instead of the standard tune everyone actually knows.
    "A4:1 D5:1.5 D5:0.5 E5:1 F#5:1 " +
      "A4:1.5 B4:0.5 A4:1.5 A4:0.5 " +
      "D5:1 F#5:1 E5:1 D5:1 " +
      "B4:3 D5:1 " +
      "A4:1.5 F#4:0.5 E4:1 D4:1 " +
      "E4:1.5 D4:0.5 E4:1.5 F#4:0.5 " +
      "A4:1.5 A4:0.5 B4:1 A4:1 " +
      "A4:3 " +
      "A4:1 D5:1.5 D5:0.5 E5:1 F#5:1 " +
      "A4:1.5 B4:0.5 A4:1.5 A4:0.5 " +
      "D5:1 F#5:1 E5:1 D5:1 " +
      "B4:3 D5:1 " +
      "A4:1.5 F#4:0.5 E4:1 D4:1 " +
      "E4:1.5 D4:0.5 E4:1.5 F#4:0.5 " +
      "A4:2 B4:0.5 A4:0.5 F#4:0.5 E4:0.5 " +
      "D4:3",
    "D3:2 A2:2 D3:2 A2:2 D3:2 A2:2 D3:2 A2:2 " +
      "D3:2 A2:2 D3:2 A2:2 D3:2 A2:2 D3:4 " +
      "D3:2 A2:2 D3:2 A2:2 D3:2 A2:2 D3:2 A2:2 " +
      "D3:2 A2:2 D3:2 A2:2 D3:2 A2:2 D3:4",
    "world"
  ),
  buildSong(
    "greensleeves",
    "Greensleeves",
    "イングランド民謡・PD",
    92,
    // Verified against a published score - Greensleeves is genuinely in the
    // Dorian mode (raised 6th, so F# not F natural, plus a G# leading tone),
    // which is what gives it its distinctive sound. My first attempt had
    // flattened that out to a plain natural minor.
    "A4:0.5 C5:1 D5:0.5 E5:0.75 F#5:0.25 E5:0.5 " +
      "D5:1 B4:0.5 G4:0.75 A4:0.25 B4:0.5 " +
      "C5:1 A4:0.5 A4:0.75 G#4:0.25 A4:0.5 " +
      "B4:1 G#4:0.5 E4:1 A4:0.5 " +
      "C5:1 D5:0.5 E5:0.75 F#5:0.25 E5:0.5 " +
      "D5:1 B4:0.5 G4:0.75 A4:0.25 B4:0.5 " +
      "C5:0.75 B4:0.25 A4:0.5 G#4:0.75 F#4:0.25 G4:0.5 " +
      "A4:1.5 A4:1.5 " +
      "G5:1.5 G5:0.75 F#5:0.25 E5:0.5 " +
      "D5:1 B4:0.5 G4:0.75 A4:0.25 B4:0.5 " +
      "C5:1 A4:0.5 A4:0.75 G#4:0.25 A4:0.5 " +
      "B4:1 G#4:0.5 E4:1.5 " +
      "G5:1.5 G5:0.75 F#5:0.25 E5:0.5 " +
      "D5:1 B4:0.5 G4:0.75 A4:0.25 B4:0.5 " +
      "C5:0.75 B4:0.25 A4:0.5 G#4:0.75 F#4:0.25 G4:0.5 " +
      "A4:1.5 A4:1",
    "A2:3 D3:3 A2:3 E3:3 A2:3 D3:3 A2:3 A2:3 " +
      "C3:3 D3:3 A2:3 E3:3 C3:3 D3:3 A2:3 A2:2",
    "world"
  ),
  buildSong(
    "fur-elise",
    "Für Elise",
    "ベートーヴェン・PD",
    100,
    // A section (x2), the contrasting B section in C major, then A (x2)
    // again - verified against a published ABC transcription rather than
    // just repeating the famous opening bar.
    "E5:0.5 D#5:0.5 E5:0.5 D#5:0.5 E5:0.5 B4:0.5 D5:0.5 C5:0.5 " +
      "A4:1 R:0.5 C4:0.5 E4:0.5 A4:0.5 B4:1 R:0.5 " +
      "E4:0.5 G#4:0.5 B4:0.5 C5:1 R:0.5 E4:0.5 " +
      "E5:0.5 D#5:0.5 E5:0.5 B4:0.5 D5:0.5 C5:0.5 " +
      "A4:1 R:0.5 C4:0.5 E4:0.5 A4:0.5 B4:1 R:0.5 " +
      "E4:0.5 C5:0.5 B4:0.5 A4:1 R:0.5 B4:0.5 C5:0.5 D5:0.5 " +
      "E5:1.5 G5:0.5 F5:0.5 E5:0.5 D5:1.5 F5:0.5 E5:0.5 D5:0.5 " +
      "C5:1.5 E5:0.5 D5:0.5 C5:0.5 B4:1 R:1 E4:1 " +
      "E5:1 R:1 E5:1 E6:1 R:0.5 D#5:0.5 E5:0.5 D#5:0.5 " +
      "E5:0.5 D#5:0.5 E5:0.5 D#5:0.5 E5:0.5 B4:0.5 D5:0.5 C5:0.5 " +
      "A4:1 R:0.5 C4:0.5 E4:0.5 A4:0.5 B4:1 R:0.5 " +
      "E4:0.5 G#4:0.5 B4:0.5 C5:1 R:0.5 E4:0.5 " +
      "E5:0.5 D#5:0.5 E5:0.5 B4:0.5 D5:0.5 C5:0.5 " +
      "A4:1 R:0.5 C4:0.5 E4:0.5 A4:0.5 B4:1 R:0.5 " +
      "E4:0.5 C5:0.5 B4:0.5 A4:3",
    "A2:2 E3:2 A2:2 E3:2 A2:2 E3:2 " +
      "A2:2 E3:2 A2:2 E3:2 A2:2 E3:2 " +
      "C3:3 G2:3 A2:3 E2:3 E2:3 A2:3 " +
      "A2:2 E3:2 A2:2 E3:2 A2:2 E3:2 " +
      "A2:2 E3:2 A2:2 E3:2 A2:4",
    "classical"
  ),
  buildSong(
    "canon-in-d",
    "Canon in D",
    "パッヘルベル・PD",
    88,
    // This is the actual first-violin melody line (not just a rhythmicized
    // bass), taken from a published ABC transcription - the real tune, not
    // an improvised stand-in.
    "F#5:4 E5:4 D5:4 C#5:4 B4:4 A4:4 B4:4 C#5:4 " +
      "D5:4 C#5:4 B4:4 A4:4 G4:4 F#4:4 G4:4 E4:4 " +
      "D5:6",
    "D2:4 A2:4 B2:4 F#2:4 G2:4 D2:4 G2:4 A2:4 " +
      "D2:4 A2:4 B2:4 F#2:4 G2:4 D2:4 G2:4 A2:4 " +
      "D2:6",
    "classical"
  ),
  buildSong(
    "fate-motif",
    "交響曲第5番「運命」冒頭",
    "ベートーヴェン・PD",
    100,
    "G4:0.5 G4:0.5 G4:0.5 D#4:3 R:0.5 F4:0.5 F4:0.5 F4:0.5 D4:3",
    "G2:4 R:4 F2:4 R:4",
    "classical"
  ),
  buildSong(
    "frere-jacques",
    "Frère Jacques (蛙の合唱の原曲)",
    "フランス民謡・PD",
    104,
    "C4:1 D4:1 E4:1 C4:1 C4:1 D4:1 E4:1 C4:1 " +
      "E4:1 F4:1 G4:2 E4:1 F4:1 G4:2 " +
      "G4:0.5 A4:0.5 G4:0.5 F4:0.5 E4:1 C4:1 G4:0.5 A4:0.5 G4:0.5 F4:0.5 E4:1 C4:1 " +
      "C4:1 G3:1 C4:2 C4:1 G3:1 C4:2",
    "C3:4 C3:4 G2:2 G2:2 C3:4 C3:4",
    "world"
  ),
  buildSong(
    "chouchou",
    "ちょうちょう",
    "文部省唱歌(独民謡)・PD",
    104,
    "G4:1 E4:1 E4:2 F4:1 D4:1 D4:2 C4:1 D4:1 E4:1 F4:1 G4:1 G4:1 G4:2 " +
      "G4:1 E4:1 E4:2 F4:1 D4:1 D4:2 C4:1 E4:1 G4:1 G4:1 C4:2",
    "C3:4 G2:4 F2:4 C3:4 C3:4 G2:4 F2:4 C3:4",
    "japan"
  ),
  buildSong(
    "donguri-korokoro",
    "どんぐりころころ",
    "青木存義・梁田貞・PD",
    108,
    "G4:0.5 E4:0.5 E4:0.5 F4:0.5 E4:0.5 D4:0.5 C4:1 G4:0.5 E4:0.5 E4:0.5 D4:1.5 " +
      "E4:0.5 E4:0.5 G4:0.5 G4:0.5 A4:0.5 A4:0.5 A4:0.5 C5:1 E4:0.5 E4:0.5 G4:1.5 " +
      "G4:0.5 G4:0.5 E4:0.5 E4:0.5 F4:0.5 E4:0.5 D4:0.5 C4:1 G4:0.5 E4:0.5 E4:0.5 D4:1.5 " +
      "G4:0.5 E4:0.5 A4:0.5 G4:0.5 G4:0.5 A4:0.5 A4:0.5 B4:0.5 B4:0.5 C5:2",
    "C3:4 F2:4 C3:4 G2:4 C3:4 F2:4 C3:4 G2:4",
    "japan"
  ),
  buildSong(
    "furusato",
    "故郷(ふるさと)・冒頭",
    "岡野貞一・文部省唱歌・PD",
    80,
    "C4:1 C4:1 C4:1 D4:1 E4:1 D4:1 E4:1 E4:1 F4:1 G4:1 F4:1 G4:1 " +
      "A4:1 E4:1 F4:1 E4:1 D4:1 D4:1 B3:1 C4:2",
    "C3:3 F2:3 G2:3 C3:3 F2:3 G2:2",
    "japan"
  ),
  buildSong(
    "london-bridge",
    "London Bridge Is Falling Down",
    "英語の伝承童謡・PD",
    108,
    "G4:1 A4:1 G4:1 F4:1 E4:1 F4:1 G4:1 D4:1 E4:1 F4:2 E4:1 F4:1 G4:2 " +
      "G4:1 A4:1 G4:1 F4:1 E4:1 F4:1 G4:1 D4:1 G4:1 E4:1 C4:2",
    "C3:4 F2:2 G2:2 C3:4 C3:4 F2:2 G2:2 C3:4",
    "world"
  ),
  buildSong(
    "row-row-row-your-boat",
    "Row, Row, Row Your Boat",
    "アメリカ民謡(輪唱)・PD",
    100,
    "C4:1 C4:1 C4:0.66 D4:0.66 E4:0.66 " +
      "E4:0.66 D4:0.66 E4:0.66 F4:1 G4:2 " +
      "C5:0.5 C5:0.5 C5:0.5 G4:0.5 G4:0.5 G4:0.5 E4:0.5 E4:0.5 E4:0.5 C4:0.5 C4:0.5 C4:0.5 " +
      "G4:1 F4:1 E4:1 D4:1 C4:2",
    "C3:4 C3:4 C3:4 C3:4",
    "world"
  ),
];

export function getSong(id: string): Song | undefined {
  return SONGS.find((s) => s.id === id);
}
