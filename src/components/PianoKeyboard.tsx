"use client";

import {
  forwardRef,
  memo,
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

type KeyProps = {
  midi: number;
  isBlack: boolean;
  left: number;
  width: number;
  showLabel: boolean;
  flash?: FlashState;
  isPressed: boolean;
};

// Neon-tube glow around the key's edge: white for a correct hit, red for a
// miss/wrong press. Replaces filling the whole key with a solid color so the
// key itself keeps reading as a piano key - only its outline lights up.
const NEON_WHITE =
  "z-30 border-white shadow-[0_0_4px_1px_#ffffff,0_0_16px_6px_rgba(255,255,255,0.9),0_0_34px_14px_rgba(255,255,255,0.5)]";
const NEON_RED =
  "z-30 border-red-400 shadow-[0_0_4px_1px_#f87171,0_0_16px_6px_rgba(239,68,68,0.9),0_0_34px_14px_rgba(239,68,68,0.5)]";

// Memoized so a flash/press change on ONE key doesn't force every other key
// on the keyboard to re-render and re-diff its DOM node too. With 15-36 keys
// on screen, re-rendering all of them on every miss event (common during a
// long press in a fast song) was expensive enough to cause visible stutter.
const Key = memo(function Key({ midi, isBlack, left, width, showLabel, flash, isPressed }: KeyProps) {
  const label = midiToName(midi);

  const glow =
    flash?.type === "correct"
      ? NEON_WHITE
      : flash?.type === "wrong"
        ? NEON_RED
        : isPressed
          ? isBlack
            ? "border-sky-400 shadow-[0_0_10px_2px_rgba(56,189,248,0.6)]"
            : "border-sky-400 shadow-[inset_0_-6px_10px_rgba(56,189,248,0.5)]"
          : isBlack
            ? "border-slate-950"
            : "border-slate-400";

  if (isBlack) {
    return (
      <div
        role="presentation"
        aria-label={label}
        className={[
          "absolute top-0 rounded-b-md z-20 box-border pointer-events-none border-2",
          "transition-[box-shadow,border-color] duration-100",
          isPressed
            ? "bg-gradient-to-b from-sky-400 to-sky-600"
            : "bg-gradient-to-b from-slate-800 to-slate-950",
          glow,
        ].join(" ")}
        style={{ left, width, height: "62%" }}
      />
    );
  }
  return (
    <div
      role="presentation"
      aria-label={label}
      className={[
        "absolute bottom-0 top-0 rounded-b-md border-2 box-border",
        "flex items-end justify-center pb-1 text-[10px] font-medium text-slate-400",
        "transition-[box-shadow,border-color] duration-100 pointer-events-none",
        isPressed ? "bg-sky-100" : "bg-white",
        glow,
      ].join(" ")}
      style={{ left, width }}
    >
      {showLabel ? label : ""}
    </div>
  );
});

const PianoKeyboard = forwardRef<PianoKeyboardHandle, Props>(function PianoKeyboard(
  { lowMidi, highMidi, onNoteOn, onNoteOff },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  // Cached bounding rect, refreshed only on resize/orientation change - NOT
  // on every pointer event. getBoundingClientRect() forces a synchronous
  // layout reflow; calling it on every pointermove (which fires very often
  // while a key is held down) was fighting the render loop for main-thread
  // time and made the falling bars stutter during a long press.
  const rectRef = useRef({ left: 0, top: 0, width: 0, height: 0 });
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
    const updateRect = () => {
      const r = el.getBoundingClientRect();
      rectRef.current = { left: r.left, top: r.top, width: r.width, height: r.height };
      setContainerWidth(r.width);
    };
    const ro = new ResizeObserver(updateRect);
    ro.observe(el);
    updateRect();
    window.addEventListener("scroll", updateRect, true);
    window.addEventListener("orientationchange", updateRect);
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", updateRect, true);
      window.removeEventListener("orientationchange", updateRect);
    };
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
      const rect = rectRef.current;
      if (rect.width === 0 || whiteKeyWidth === 0) return null;
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

  // If this component unmounts while a finger is still down (very likely
  // right when a fast/hard song ends mid-tap), release any pointer capture
  // explicitly. Some browsers don't cleanly hand touch input back to the
  // rest of the page when a captured element disappears mid-touch, which
  // was leaving the next screen's buttons unresponsive to taps.
  useEffect(() => {
    const container = containerRef.current;
    const pointers = activePointers.current;
    return () => {
      for (const pointerId of pointers.keys()) {
        try {
          container?.releasePointerCapture(pointerId);
        } catch {
          // already released / invalid - nothing to do
        }
      }
      pointers.clear();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="piano-keyboard relative w-full select-none touch-none"
      style={{ height: "clamp(120px, 24vh, 220px)", touchAction: "none" }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
    >
      {whiteKeys.map((k) => (
        <Key
          key={k.midi}
          midi={k.midi}
          isBlack={false}
          left={k.x * whiteKeyWidth}
          width={whiteKeyWidth}
          showLabel={k.midi % 12 === 0}
          flash={flashes.get(k.midi)}
          isPressed={pressed.has(k.midi)}
        />
      ))}
      {blackKeys.map((k) => (
        <Key
          key={k.midi}
          midi={k.midi}
          isBlack
          left={k.x * whiteKeyWidth}
          width={k.width * whiteKeyWidth}
          showLabel={false}
          flash={flashes.get(k.midi)}
          isPressed={pressed.has(k.midi)}
        />
      ))}
    </div>
  );
});

export default PianoKeyboard;
