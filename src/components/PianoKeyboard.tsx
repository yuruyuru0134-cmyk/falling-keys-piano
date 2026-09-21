"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { computeKeyboardLayout, isBlackKey, midiToName } from "@/lib/theory";

export type FlashType = "correct" | "wrong";

export type PianoKeyboardHandle = {
  flashKey: (midi: number, type: FlashType) => void;
};

type Props = {
  lowMidi: number;
  highMidi: number;
  onNoteOn: (midi: number) => void;
  onNoteOff: (midi: number) => void;
};

type FlashState = { type: FlashType; nonce: number };

const PianoKeyboard = forwardRef<PianoKeyboardHandle, Props>(function PianoKeyboard(
  { lowMidi, highMidi, onNoteOn, onNoteOff },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [pressed, setPressed] = useState<Set<number>>(new Set());
  const [flashes, setFlashes] = useState<Map<number, FlashState>>(new Map());
  const flashTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const pointerToMidi = useRef<Map<number, number>>(new Map());
  const nonceRef = useRef(0);

  const { keys, whiteKeyCount } = useMemo(
    () => computeKeyboardLayout(lowMidi, highMidi),
    [lowMidi, highMidi]
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) setContainerWidth(entry.contentRect.width);
    });
    ro.observe(el);
    setContainerWidth(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);

  useImperativeHandle(ref, () => ({
    flashKey(midi, type) {
      nonceRef.current += 1;
      const nonce = nonceRef.current;
      setFlashes((prev) => {
        const next = new Map(prev);
        next.set(midi, { type, nonce });
        return next;
      });
      const existingTimer = flashTimers.current.get(midi);
      if (existingTimer) clearTimeout(existingTimer);
      const timer = setTimeout(() => {
        setFlashes((prev) => {
          const cur = prev.get(midi);
          if (!cur || cur.nonce !== nonce) return prev;
          const next = new Map(prev);
          next.delete(midi);
          return next;
        });
      }, 260);
      flashTimers.current.set(midi, timer);
    },
  }));

  const whiteKeyWidth = whiteKeyCount > 0 ? containerWidth / whiteKeyCount : 0;

  const handleDown = useCallback(
    (e: React.PointerEvent, midi: number) => {
      e.preventDefault();
      (e.target as Element).setPointerCapture?.(e.pointerId);
      pointerToMidi.current.set(e.pointerId, midi);
      setPressed((prev) => new Set(prev).add(midi));
      onNoteOn(midi);
    },
    [onNoteOn]
  );

  const releasePointer = useCallback(
    (e: React.PointerEvent) => {
      const midi = pointerToMidi.current.get(e.pointerId);
      if (midi === undefined) return;
      pointerToMidi.current.delete(e.pointerId);
      setPressed((prev) => {
        const next = new Set(prev);
        next.delete(midi);
        return next;
      });
      onNoteOff(midi);
    },
    [onNoteOff]
  );

  const whiteKeys = keys.filter((k) => !k.isBlack);
  const blackKeys = keys.filter((k) => k.isBlack);

  return (
    <div
      ref={containerRef}
      className="relative w-full select-none touch-none"
      style={{ height: "clamp(120px, 24vh, 220px)" }}
    >
      {whiteKeys.map((k) => {
        const flash = flashes.get(k.midi);
        const isPressed = pressed.has(k.midi);
        const showLabel = k.midi % 12 === 0; // C notes
        return (
          <button
            key={k.midi}
            aria-label={midiToName(k.midi)}
            onPointerDown={(e) => handleDown(e, k.midi)}
            onPointerUp={releasePointer}
            onPointerCancel={releasePointer}
            onPointerLeave={(e) => {
              if (pointerToMidi.current.has(e.pointerId)) releasePointer(e);
            }}
            className={[
              "absolute bottom-0 top-0 rounded-b-md border border-slate-400 box-border",
              "flex items-end justify-center pb-1 text-[10px] font-medium text-slate-400",
              "transition-colors duration-75",
              flash?.type === "correct"
                ? "bg-white ring-4 ring-emerald-300 z-10"
                : flash?.type === "wrong"
                  ? "bg-red-500 text-white z-10"
                  : isPressed
                    ? "bg-sky-100"
                    : "bg-white",
            ].join(" ")}
            style={{ left: k.x * whiteKeyWidth, width: whiteKeyWidth }}
          >
            {showLabel ? midiToName(k.midi) : ""}
          </button>
        );
      })}
      {blackKeys.map((k) => {
        const flash = flashes.get(k.midi);
        const isPressed = pressed.has(k.midi);
        return (
          <button
            key={k.midi}
            aria-label={midiToName(k.midi)}
            onPointerDown={(e) => handleDown(e, k.midi)}
            onPointerUp={releasePointer}
            onPointerCancel={releasePointer}
            onPointerLeave={(e) => {
              if (pointerToMidi.current.has(e.pointerId)) releasePointer(e);
            }}
            className={[
              "absolute top-0 rounded-b-md z-20 box-border",
              "transition-colors duration-75",
              flash?.type === "correct"
                ? "bg-white ring-4 ring-emerald-300"
                : flash?.type === "wrong"
                  ? "bg-red-500"
                  : isPressed
                    ? "bg-sky-500"
                    : "bg-slate-900",
            ].join(" ")}
            style={{
              left: k.x * whiteKeyWidth,
              width: k.width * whiteKeyWidth,
              height: "62%",
            }}
          />
        );
      })}
    </div>
  );
});

export default PianoKeyboard;
export { computeKeyboardLayout as computeLayoutForKeyboard };
export function isBlack(midi: number) {
  return isBlackKey(midi);
}
