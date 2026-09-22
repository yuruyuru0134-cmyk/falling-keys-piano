"use client";

import { useMemo, useRef, useState } from "react";
import { CATEGORY_LABELS, type Song, type SongCategory } from "@/lib/songs";
import { DIFFICULTIES, DIFFICULTY_SETTINGS, type Difficulty } from "@/lib/theory";
import { INSTRUMENTS, getAudioEngine, type InstrumentId } from "@/lib/audio";

const CATEGORY_ORDER: SongCategory[] = ["world", "japan", "classical", "custom"];

type Props = {
  songs: Song[];
  onStart: (song: Song, difficulty: Difficulty, instrument: InstrumentId) => void;
  onImportMidi: (file: File) => Promise<void>;
  importError: string | null;
};

export default function StartScreen({ songs, onStart, onImportMidi, importError }: Props) {
  const [selectedId, setSelectedId] = useState(songs[0]?.id ?? "");
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [instrument, setInstrument] = useState<InstrumentId>("piano");
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selected = songs.find((s) => s.id === selectedId) ?? songs[0];

  const groupedSongs = useMemo(() => {
    const groups = new Map<SongCategory, Song[]>();
    for (const song of songs) {
      const list = groups.get(song.category) ?? [];
      list.push(song);
      groups.set(song.category, list);
    }
    return CATEGORY_ORDER.filter((c) => groups.has(c)).map((c) => ({
      category: c,
      label: CATEGORY_LABELS[c],
      songs: groups.get(c)!,
    }));
  }, [songs]);

  function previewInstrument(id: InstrumentId) {
    setInstrument(id);
    const engine = getAudioEngine();
    engine.unlock();
    engine.setInstrument(id);
    engine.noteOn(64, 0.8); // E4 - quick demo note
    window.setTimeout(() => engine.noteOff(64), 380);
  }

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
        <div className="flex flex-col gap-4">
          {groupedSongs.map((group) => (
            <div key={group.category}>
              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {group.label}
              </h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {group.songs.map((song) => (
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
            </div>
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
        <h2 className="mb-2 text-sm font-semibold text-slate-300">音源を選ぶ</h2>
        <div className="grid grid-cols-4 gap-2">
          {INSTRUMENTS.map((inst) => (
            <button
              key={inst.id}
              onClick={() => previewInstrument(inst.id)}
              className={[
                "rounded-xl border px-2 py-3 text-center text-sm font-semibold transition-colors",
                inst.id === instrument
                  ? "border-amber-400 bg-amber-500/10"
                  : "border-slate-800 bg-slate-900 active:bg-slate-800",
              ].join(" ")}
            >
              {inst.label}
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs text-slate-500">タップすると音を試聴できます。</p>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-300">難易度を選ぶ</h2>
        <div className="grid grid-cols-2 gap-2">
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
        onClick={() => {
          // Needs to happen inside a real user-gesture handler for iOS to
          // let the game's auto-played backing track make sound later.
          getAudioEngine().unlock();
          // Hides the browser chrome (address bar etc.) on browsers that
          // support it (Android Chrome, desktop, ...) so there's less edge
          // of screen for an accidental swipe to reveal it mid-song. iOS
          // Safari doesn't support this for arbitrary elements - it's a
          // no-op there, not an error.
          type FullscreenEl = HTMLElement & {
            webkitRequestFullscreen?: () => Promise<void> | void;
          };
          const el = document.documentElement as FullscreenEl;
          const request = el.requestFullscreen?.bind(el) ?? el.webkitRequestFullscreen?.bind(el);
          request?.()?.catch?.(() => {});
          if (selected) onStart(selected, difficulty, instrument);
        }}
        className="mt-2 w-full rounded-xl bg-sky-500 py-4 text-lg font-bold text-white shadow-lg shadow-sky-500/30 active:bg-sky-600 disabled:opacity-50"
      >
        スタート
      </button>
    </div>
  );
}
