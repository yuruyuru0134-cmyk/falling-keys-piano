"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import PianoKeyboard, { PianoKeyboardHandle } from "./PianoKeyboard";
import FallingNotesCanvas, { FallingNotesHandle, JudgedNote } from "./FallingNotesCanvas";
import type { Song } from "@/lib/songs";
import { DIFFICULTY_SETTINGS, type Difficulty } from "@/lib/theory";
import { getActiveNotes, getBackingNotes, getDisplayRange } from "@/lib/range";
import { getAudioEngine, type InstrumentId } from "@/lib/audio";

const MemoKeyboard = memo(PianoKeyboard);
const MemoFalling = memo(FallingNotesCanvas);

// Quiet enough to sit behind the player's own (louder) notes, but present
// enough to actually carry the song's harmony/bass line - some pieces
// (Canon in D especially) are only really recognizable *because* of the
// bass progression, so this needs to be clearly audible, not just a hint.
const BACKING_VELOCITY = 0.55;

export type GameResult = {
  score: number;
  hitCount: number;
  missCount: number;
  wrongCount: number;
  maxCombo: number;
  totalNotes: number;
  accuracy: number;
  rank: "S" | "A" | "B" | "C" | "D";
};

type Props = {
  song: Song;
  difficulty: Difficulty;
  instrument: InstrumentId;
  onExit: () => void;
  onFinish: (result: GameResult) => void;
};

function rankFor(accuracy: number): GameResult["rank"] {
  if (accuracy >= 98) return "S";
  if (accuracy >= 90) return "A";
  if (accuracy >= 75) return "B";
  if (accuracy >= 50) return "C";
  return "D";
}

export default function Game({ song, difficulty, instrument, onExit, onFinish }: Props) {
  const settings = DIFFICULTY_SETTINGS[difficulty];
  const notes = useMemo(() => getActiveNotes(song, difficulty), [song, difficulty]);
  const backingNotes = useMemo(() => getBackingNotes(song, difficulty), [song, difficulty]);
  const { low, high } = useMemo(() => getDisplayRange(song, difficulty), [song, difficulty]);

  const keyboardRef = useRef<PianoKeyboardHandle>(null);
  const fallingRef = useRef<FallingNotesHandle>(null);
  const judgedRef = useRef<JudgedNote[]>(notes.map(() => null));
  const heldMidiRef = useRef<Map<number, number>>(new Map()); // midi -> pointer count
  // Indexed the same as backingNotes; tracks each backing note's auto-play state.
  const backingStateRef = useRef<("pending" | "on" | "done")[]>(backingNotes.map(() => "pending"));

  const [hud, setHud] = useState({ score: 0, combo: 0, maxCombo: 0, hit: 0, miss: 0, wrong: 0 });
  const [progress, setProgress] = useState(0);
  const [countdown, setCountdown] = useState(Math.ceil(settings.fallTime + 0.3));
  const [paused, setPaused] = useState(false);
  const finishedRef = useRef(false);

  const totalDuration = useMemo(
    // Notes are sorted by start time, but with melody + harmony merged
    // (hard mode) the note that starts last isn't necessarily the one that
    // ends last - a sustained bass note can outlast a short melody note
    // that started after it. Take the true max end time over all notes.
    () => (notes.length ? Math.max(...notes.map((n) => n.time + n.duration)) : 1),
    [notes]
  );
  const countdownSeconds = settings.fallTime + 0.3;

  // Game is given a fresh `key` by the parent for every start/retry, so this
  // ref only ever needs to be stamped once, on mount (see effect below).
  const stateRef = useRef({ startPerf: 0, pauseAccum: 0, pauseStartedAt: 0 });

  useEffect(() => {
    stateRef.current.startPerf = performance.now();
  }, []);

  useEffect(() => {
    getAudioEngine().setInstrument(instrument);
  }, [instrument]);

  useEffect(() => {
    let raf = 0;

    const loop = () => {
      raf = requestAnimationFrame(loop);
      const s = stateRef.current;
      if (paused) return;
      const elapsedMs = performance.now() - s.startPerf - s.pauseAccum;
      const currentTime = elapsedMs / 1000 - countdownSeconds;

      const cd = Math.max(0, Math.ceil(countdownSeconds - (elapsedMs / 1000)));
      setCountdown((prev) => (prev !== cd ? cd : prev));

      // Auto-miss notes that have fallen past the hit window.
      let missDelta = 0;
      let comboBreak = false;
      for (let i = 0; i < notes.length; i++) {
        if (judgedRef.current[i] !== null) continue;
        if (currentTime - notes[i].time > settings.hitWindow) {
          judgedRef.current[i] = "miss";
          missDelta++;
          comboBreak = true;
          keyboardRef.current?.flashKey(notes[i].midi, "wrong");
        }
      }
      if (missDelta > 0) {
        setHud((prev) => ({
          ...prev,
          miss: prev.miss + missDelta,
          combo: comboBreak ? 0 : prev.combo,
        }));
      }

      // Auto-play the harmony/bass line quietly in the background so the
      // song still sounds like itself even when the player is only playing
      // (or fumbling) the melody - otherwise a missed note is just silence.
      const engine = getAudioEngine();
      for (let i = 0; i < backingNotes.length; i++) {
        const state = backingStateRef.current[i];
        const n = backingNotes[i];
        if (state === "pending" && currentTime >= n.time) {
          engine.noteOn(n.midi, BACKING_VELOCITY);
          backingStateRef.current[i] = "on";
        } else if (state === "on" && currentTime >= n.time + n.duration) {
          engine.noteOff(n.midi);
          backingStateRef.current[i] = "done";
        }
      }

      fallingRef.current?.render(currentTime, judgedRef.current);
      setProgress(Math.min(1, Math.max(0, currentTime / totalDuration)));

      if (!finishedRef.current && currentTime > totalDuration + 1.2) {
        finishedRef.current = true;
        getAudioEngine().allNotesOff();
        const hitCount = judgedRef.current.filter((j) => j === "hit").length;
        const missCount = judgedRef.current.filter((j) => j === "miss").length;
        setHud((prev) => {
          const accuracy = notes.length ? (hitCount / notes.length) * 100 : 0;
          const result: GameResult = {
            score: prev.score,
            hitCount,
            missCount,
            wrongCount: prev.wrong,
            maxCombo: prev.maxCombo,
            totalNotes: notes.length,
            accuracy,
            rank: rankFor(accuracy),
          };
          setTimeout(() => onFinish(result), 400);
          return prev;
        });
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes, backingNotes, settings.hitWindow, totalDuration, countdownSeconds, paused]);

  function togglePause() {
    const s = stateRef.current;
    if (!paused) {
      s.pauseStartedAt = performance.now();
      setPaused(true);
    } else {
      s.pauseAccum += performance.now() - s.pauseStartedAt;
      setPaused(false);
    }
  }

  function currentElapsed() {
    const s = stateRef.current;
    const elapsedMs = performance.now() - s.startPerf - s.pauseAccum;
    return elapsedMs / 1000 - countdownSeconds;
  }

  function handleNoteOn(midi: number) {
    getAudioEngine().unlock();
    getAudioEngine().noteOn(midi, 0.9);
    heldMidiRef.current.set(midi, (heldMidiRef.current.get(midi) ?? 0) + 1);

    const now = currentElapsed();
    let bestIdx = -1;
    let bestDelta = Infinity;
    for (let i = 0; i < notes.length; i++) {
      if (judgedRef.current[i] !== null) continue;
      if (notes[i].midi !== midi) continue;
      const delta = Math.abs(notes[i].time - now);
      if (delta <= settings.hitWindow && delta < bestDelta) {
        bestDelta = delta;
        bestIdx = i;
      }
    }

    if (bestIdx >= 0) {
      judgedRef.current[bestIdx] = "hit";
      keyboardRef.current?.flashKey(midi, "correct");
      fallingRef.current?.pulse(midi);
      setHud((prev) => {
        const combo = prev.combo + 1;
        const gained = 100 + Math.min(combo, 20) * 5;
        return {
          ...prev,
          score: prev.score + gained,
          combo,
          maxCombo: Math.max(prev.maxCombo, combo),
          hit: prev.hit + 1,
        };
      });
    } else {
      keyboardRef.current?.flashKey(midi, "wrong");
      setHud((prev) => ({ ...prev, combo: 0, wrong: prev.wrong + 1 }));
    }
  }

  function handleNoteOff(midi: number) {
    const count = (heldMidiRef.current.get(midi) ?? 1) - 1;
    if (count <= 0) {
      heldMidiRef.current.delete(midi);
      getAudioEngine().noteOff(midi);
    } else {
      heldMidiRef.current.set(midi, count);
    }
  }

  return (
    <div
      className="game-screen flex h-full w-full flex-col overscroll-none bg-slate-950 text-slate-100"
      style={{ touchAction: "none" }}
    >
      <div className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
        <button
          onClick={() => {
            getAudioEngine().allNotesOff();
            onExit();
          }}
          className="rounded-md bg-slate-800 px-3 py-1.5 font-medium text-slate-200 active:bg-slate-700"
        >
          ← 終了
        </button>
        <div className="flex items-center gap-4 font-mono">
          <span>スコア {hud.score}</span>
          <span className={hud.combo >= 5 ? "text-amber-300" : ""}>コンボ {hud.combo}</span>
        </div>
        <button
          onClick={togglePause}
          className="rounded-md bg-slate-800 px-3 py-1.5 font-medium text-slate-200 active:bg-slate-700"
        >
          {paused ? "▶ 再開" : "⏸ 一時停止"}
        </button>
      </div>

      <div className="h-1.5 w-full bg-slate-800">
        <div
          className="h-full bg-sky-400 transition-[width] duration-100"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      <div className="relative flex-1 min-h-0">
        <MemoFalling
          ref={fallingRef}
          notes={notes}
          lowMidi={low}
          highMidi={high}
          fallTime={settings.fallTime}
          showLabels={settings.showLabels}
        />
        {countdown > 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="text-7xl font-black text-white/90 drop-shadow-lg">{countdown}</span>
          </div>
        )}
        {paused && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <span className="text-3xl font-bold">一時停止中</span>
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-slate-800 bg-slate-900 p-2">
        <MemoKeyboard ref={keyboardRef} lowMidi={low} highMidi={high} onNoteOn={handleNoteOn} onNoteOff={handleNoteOff} />
      </div>
    </div>
  );
}
