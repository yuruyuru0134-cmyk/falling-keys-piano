"use client";

import { useCallback, useEffect, useState } from "react";
import StartScreen from "@/components/StartScreen";
import Game, { GameResult } from "@/components/Game";
import ResultScreen from "@/components/ResultScreen";
import { SONGS, type Song } from "@/lib/songs";
import type { Difficulty } from "@/lib/theory";
import { songFromMidiFile } from "@/lib/midiImport";
import type { InstrumentId } from "@/lib/audio";

const CUSTOM_SONGS_KEY = "falling-keys-custom-songs";

type View = "menu" | "playing" | "result";

export default function Home() {
  const [customSongs, setCustomSongs] = useState<Song[]>([]);
  const [view, setView] = useState<View>("menu");
  const [song, setSong] = useState<Song | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [instrument, setInstrument] = useState<InstrumentId>("piano");
  const [result, setResult] = useState<GameResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState(0);

  useEffect(() => {
    // Reading localStorage must happen post-hydration (it's unavailable
    // during the static server render), so this necessarily updates state
    // from inside an effect rather than during render.
    try {
      const raw = localStorage.getItem(CUSTOM_SONGS_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setCustomSongs(JSON.parse(raw));
    } catch {
      // ignore corrupt storage
    }
  }, []);

  const handleImportMidi = useCallback(async (file: File) => {
    setImportError(null);
    try {
      const imported = await songFromMidiFile(file);
      setCustomSongs((prev) => {
        const next = [...prev, imported];
        try {
          localStorage.setItem(CUSTOM_SONGS_KEY, JSON.stringify(next));
        } catch {
          // storage full/unavailable - keep in-memory only
        }
        return next;
      });
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "MIDI ファイルの読み込みに失敗しました。");
    }
  }, []);

  const allSongs = [...SONGS, ...customSongs];

  function handleStart(s: Song, d: Difficulty, i: InstrumentId) {
    setSong(s);
    setDifficulty(d);
    setInstrument(i);
    setResult(null);
    setSessionId((id) => id + 1);
    setView("playing");
  }

  function handleRetry() {
    setResult(null);
    setSessionId((id) => id + 1);
    setView("playing");
  }

  return (
    <div className="fixed inset-0 flex flex-col overscroll-none bg-slate-950">
      {view === "menu" && (
        <StartScreen
          songs={allSongs}
          onStart={handleStart}
          onImportMidi={handleImportMidi}
          importError={importError}
        />
      )}
      {view === "playing" && song && (
        <Game
          key={sessionId}
          song={song}
          difficulty={difficulty}
          instrument={instrument}
          onExit={() => setView("menu")}
          onFinish={(r) => {
            setResult(r);
            setView("result");
          }}
        />
      )}
      {view === "result" && song && result && (
        <ResultScreen
          song={song}
          difficulty={difficulty}
          result={result}
          onRetry={handleRetry}
          onMenu={() => setView("menu")}
        />
      )}
    </div>
  );
}
