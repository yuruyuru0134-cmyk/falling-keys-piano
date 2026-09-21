"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { computeKeyboardLayout, midiToName } from "@/lib/theory";
import type { NoteEvent } from "@/lib/songs";

export type JudgedNote = "hit" | "miss" | null;

export type FallingNotesHandle = {
  render: (currentTime: number, judged: JudgedNote[]) => void;
};

type Props = {
  notes: NoteEvent[];
  lowMidi: number;
  highMidi: number;
  fallTime: number;
  showLabels: boolean;
};

const FallingNotesCanvas = forwardRef<FallingNotesHandle, Props>(function FallingNotesCanvas(
  { notes, lowMidi, highMidi, fallTime, showLabels },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ width: 0, height: 0, dpr: 1 });

  const { keys, whiteKeyCount } = useMemo(
    () => computeKeyboardLayout(lowMidi, highMidi),
    [lowMidi, highMidi]
  );
  const layoutByMidi = useMemo(() => {
    const map = new Map<number, { x: number; width: number; isBlack: boolean }>();
    for (const k of keys) map.set(k.midi, { x: k.x, width: k.width, isBlack: k.isBlack });
    return map;
  }, [keys]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement!;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        sizeRef.current = { width, height, dpr };
      }
    });
    ro.observe(parent);
    return () => ro.disconnect();
  }, []);

  useImperativeHandle(ref, () => ({
    render(currentTime, judged) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const { width, height, dpr } = sizeRef.current;
      if (width === 0 || height === 0) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const whiteKeyWidth = whiteKeyCount > 0 ? width / whiteKeyCount : 0;

      // Guide lines for each white key (helps line up bars with keys)
      ctx.strokeStyle = "rgba(148, 163, 184, 0.15)";
      ctx.lineWidth = 1;
      for (const k of keys) {
        if (k.isBlack) continue;
        ctx.beginPath();
        ctx.moveTo(k.x * whiteKeyWidth, 0);
        ctx.lineTo(k.x * whiteKeyWidth, height);
        ctx.stroke();
      }

      // Hit line
      ctx.strokeStyle = "rgba(56, 189, 248, 0.9)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, height - 2);
      ctx.lineTo(width, height - 2);
      ctx.stroke();

      notes.forEach((note, i) => {
        const remaining = note.time - currentTime;
        if (remaining > fallTime || remaining < -0.4) return;
        const status = judged[i];
        if (status === "hit") return;

        const layout = layoutByMidi.get(note.midi);
        if (!layout) return;

        const pxHeight = Math.max((note.duration / fallTime) * height, 10);
        const bottom = height - (remaining / fallTime) * height;
        const top = bottom - pxHeight;

        const inset = layout.isBlack ? 2 : 3;
        const x = layout.x * whiteKeyWidth + inset;
        const w = Math.max(layout.width * whiteKeyWidth - inset * 2, 4);

        const grad = ctx.createLinearGradient(0, top, 0, bottom);
        if (status === "miss") {
          grad.addColorStop(0, "#94a3b8");
          grad.addColorStop(1, "#64748b");
        } else if (layout.isBlack) {
          grad.addColorStop(0, "#a78bfa");
          grad.addColorStop(1, "#7c3aed");
        } else {
          grad.addColorStop(0, "#38bdf8");
          grad.addColorStop(1, "#0284c7");
        }
        ctx.fillStyle = grad;
        const r = 5;
        ctx.beginPath();
        ctx.roundRect(x, top, w, Math.max(bottom - top, 6), r);
        ctx.fill();

        if (showLabels && w > 18) {
          ctx.fillStyle = "rgba(255,255,255,0.9)";
          ctx.font = "10px system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(midiToName(note.midi), x + w / 2, Math.max(top + 12, 12));
        }
      });
    },
  }));

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />;
});

export default FallingNotesCanvas;
