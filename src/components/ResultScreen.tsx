"use client";

import type { GameResult } from "./Game";
import type { Song } from "@/lib/songs";
import { DIFFICULTY_SETTINGS, type Difficulty } from "@/lib/theory";

type Props = {
  song: Song;
  difficulty: Difficulty;
  result: GameResult;
  onRetry: () => void;
  onMenu: () => void;
};

const RANK_COLOR: Record<GameResult["rank"], string> = {
  S: "text-amber-300",
  A: "text-emerald-300",
  B: "text-sky-300",
  C: "text-slate-300",
  D: "text-red-300",
};

export default function ResultScreen({ song, difficulty, result, onRetry, onMenu }: Props) {
  return (
    <div className="mx-auto flex h-full w-full max-w-md flex-col items-center justify-center gap-6 px-6 text-center text-slate-100">
      <div>
        <p className="text-sm text-slate-400">{song.title}</p>
        <p className="text-xs text-slate-500">{DIFFICULTY_SETTINGS[difficulty].label}</p>
      </div>

      <div className={`text-8xl font-black ${RANK_COLOR[result.rank]}`}>{result.rank}</div>

      <div className="w-full space-y-2 rounded-2xl bg-slate-900 p-5">
        <Row label="スコア" value={result.score.toLocaleString()} />
        <Row label="正解率" value={`${result.accuracy.toFixed(1)}%`} />
        <Row label="最大コンボ" value={`${result.maxCombo}`} />
        <Row label="正解 / ミス" value={`${result.hitCount} / ${result.missCount}`} />
        <Row label="総ノーツ数" value={`${result.totalNotes}`} />
      </div>

      <div className="flex w-full gap-3">
        <button
          onClick={onMenu}
          className="flex-1 rounded-xl bg-slate-800 py-3 font-semibold active:bg-slate-700"
        >
          曲を選び直す
        </button>
        <button
          onClick={onRetry}
          className="flex-1 rounded-xl bg-sky-500 py-3 font-semibold text-white active:bg-sky-600"
        >
          もう一度
        </button>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-400">{label}</span>
      <span className="font-mono font-semibold">{value}</span>
    </div>
  );
}
