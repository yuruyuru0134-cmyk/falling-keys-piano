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
import { computeKeyboardLayout, midiToName } from "@/lib/theory";

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
  // One physical touch/mouse pointer -> the midi note it is currently holding down.
  // Tracked independently per pointerId so multiple fingers (both hands) work at once.
  const activePointers = useRef<Map<number, number>>(new Map());
  const nonceRef = useRef(0);

  const { keys, whiteKeyCount } = useMemo(
    () => computeKeyboardLayout(lowMidi, highMidi),
    [lowMidi, highMidi]
  );
  const blackKeys = useMemo(() => keys.filter((k) => k.isBlack), [keys]);
  const whiteKeys = useMemo(() => keys.filter((k) => !k.isBlack), [keys]);

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

  // Geometric hit-test against our own layout (not DOM elementFromPoint), so it
  // stays correct regardless of which element a touch originally landed on -
  // this is what lets every simultaneous finger be tracked independently.
  const hitTest = useCallback(
    (clientX: number, clientY: number): number | null => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect || whiteKeyWidth === 0) return null;
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      if (x < 0 || y < 0 || x > rect.width || y > rect.height) return null;

      // Black keys are visually on top and only cover the upper portion.
      if (y < rect.height * 0.62) {
        for (const k of blackKeys) {
          const x0 = k.x * whiteKeyWidth;
          const x1 = x0 + k.width * whiteKeyWidth;
          if (x >= x0 && x <= x1) return k.midi;
        }
      }
      for (const k of whiteKeys) {
        const x0 = k.x * whiteKeyWidth;
        const x1 = x0 + whiteKeyWidth;
        if (x >= x0 && x <= x1) return k.midi;
      }
      return null;
    },
    [blackKeys, whiteKeys, whiteKeyWidth]
  );

  const press = useCallback(
    (midi: number) => {
      setPressed((prev) => new Set(prev).add(midi));
      onNoteOn(midi);
    },
    [onNoteOn]
  );
  const release = useCallback(
    (midi: number) => {
      setPressed((prev) => {
        const next = new Set(prev);
        next.delete(midi);
        return next;
      });
      onNoteOff(midi);
    },
    [onNoteOff]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      const midi = hitTest(e.clientX, e.clientY);
      if (midi === null) return;
      e.preventDefault();
      try {
        containerRef.current?.setPointerCapture?.(e.pointerId);
      } catch {
        // Capture can fail for synthetic/edge-case pointers - the note
        // should still sound even if we can't guarantee capture.
      }
      activePointers.current.set(e.pointerId, midi);
      press(midi);
    },
    [hitTest, press]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const prevMidi = activePointers.current.get(e.pointerId);
      if (prevMidi === undefined) return;
      const midi = hitTest(e.clientX, e.clientY);
      if (midi === null || midi === prevMidi) return;
      // Finger slid to a neighboring key (glissando) - move the held note.
      activePointers.current.set(e.pointerId, midi);
      release(prevMidi);
      press(midi);
    },
    [hitTest, press, release]
  );

  const handlePointerEnd = useCallback(
    (e: React.PointerEvent) => {
      const midi = activePointers.current.get(e.pointerId);
      if (midi === undefined) return;
      activePointers.current.delete(e.pointerId);
      release(midi);
    },
    [release]
  );

  // Belt-and-braces: if a pointerup/cancel is ever missed for any reason,
  // the audio engine itself has an independent natural-decay ceiling (see
  // lib/audio.ts) so a note can never drone forever even if the on-screen
  // "held" state here got out of sync.

  return (
    <div
      ref={containerRef}
      className="relative w-full select-none touch-none"
      style={{ height: "clamp(120px, 24vh, 220px)", touchAction: "none" }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
    >
      {whiteKeys.map((k) => {
        const flash = flashes.get(k.midi);
        const isPressed = pressed.has(k.midi);
        const showLabel = k.midi % 12 === 0; // C notes
        return (
          <div
            key={k.midi}
            role="presentation"
            aria-label={midiToName(k.midi)}
            className={[
              "absolute bottom-0 top-0 rounded-b-md border border-slate-400 box-border",
              "flex items-end justify-center pb-1 text-[10px] font-medium text-slate-400",
              "transition-colors duration-75 pointer-events-none",
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
          </div>
        );
      })}
      {blackKeys.map((k) => {
        const flash = flashes.get(k.midi);
        const isPressed = pressed.has(k.midi);
        return (
          <div
            key={k.midi}
            role="presentation"
            aria-label={midiToName(k.midi)}
            className={[
              "absolute top-0 rounded-b-md z-20 box-border pointer-events-none",
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
