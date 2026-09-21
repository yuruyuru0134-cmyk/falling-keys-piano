"use client";

import { useRef, useState } from "react";
import type { Song } from "@/lib/songs";
import { DIFFICULTIES, DIFFICULTY_SETTINGS, type Difficulty } from "@/lib/theory";

type Props = {
  songs: Song[];
  onStart: (song: Song, difficulty: Difficulty) => void;
  onImportMidi: (file: File) => Promise<void>;
  importError: string | null;
};

export default function StartScreen({ songs, onStart, onImportMidi, importError }: Props) {
  const [selectedId, setSelectedId] = useState(songs[0]?.id ?? "");
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selected = songs.find((s) => s.id === selectedId) ?? songs[0];

  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col gap-5 overflow-y-auto px-4 py-6 text-slate-100">
      <header className="text-center">
        <h1 className="text-2xl font-black tracking-tight">Falling Keys Piano</h1>
        <p className="mt-1 text-sm text-slate-400">
          落ちてくるバーに合わせて鍵盤を押して演奏しよう
        </p>
      </header>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-300">曲を選ぶ</h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {songs.map((song) => (
            <button
              key={song.id}
              onClick={() => setSelectedId(song.id)}
              className={[
                "rounded-xl border px-4 py-3 text-left transition-colors",
                song.id === selectedId
                  ? "border-sky-400 bg-sky-500/10"
                  : "border-slate-800 bg-slate-900 active:bg-slate-800",
              ].join(" ")}
            >
              <div className="font-semibold">{song.title}</div>
              <div className="text-xs text-slate-400">{song.subtitle}</div>
            </button>
          ))}
        </div>

        <div className="mt-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".mid,.midi,audio/midi"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              setImporting(true);
              await onImportMidi(file);
              setImporting(false);
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="w-full rounded-xl border border-dashed border-slate-700 px-4 py-3 text-sm text-slate-400 active:bg-slate-900"
          >
            {importing ? "取り込み中…" : "＋ 自分の MIDI ファイルを追加"}
          </button>
          {importError && <p className="mt-1 text-xs text-red-400">{importError}</p>}
          <p className="mt-1 text-xs text-slate-500">
            収録曲はすべてパブリックドメインの民謡・クラシック曲です。好きな曲を増やしたい場合は、
            権利的に問題のない MIDI ファイル（自作・フリー素材サイトなど）を取り込んで練習できます。
          </p>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-300">難易度を選ぶ</h2>
        <div className="grid grid-cols-3 gap-2">
          {DIFFICULTIES.map((d) => {
            const s = DIFFICULTY_SETTINGS[d];
            return (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                className={[
                  "rounded-xl border px-3 py-3 text-center transition-colors",
                  d === difficulty
                    ? "border-emerald-400 bg-emerald-500/10"
                    : "border-slate-800 bg-slate-900 active:bg-slate-800",
                ].join(" ")}
              >
                <div className="font-semibold">{s.label}</div>
                <div className="mt-1 text-[11px] leading-tight text-slate-400">{s.description}</div>
              </button>
            );
          })}
        </div>
      </section>

      <button
        disabled={!selected}
        onClick={() => selected && onStart(selected, difficulty)}
        className="mt-2 w-full rounded-xl bg-sky-500 py-4 text-lg font-bold text-white shadow-lg shadow-sky-500/30 active:bg-sky-600 disabled:opacity-50"
      >
        スタート
      </button>
    </div>
  );
}
