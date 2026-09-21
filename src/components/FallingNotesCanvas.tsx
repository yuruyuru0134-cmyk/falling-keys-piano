"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { computeKeyboardLayout, midiToName } from "@/lib/theory";
import type { NoteEvent } from "@/lib/songs";

export type JudgedNote = "hit" | "miss" | null;

export type FallingNotesHandle = {
  render: (currentTime: number, judged: JudgedNote[]) => void;
  /** Trigger a one-shot glow burst on the hit line at this note, e.g. on a correct hit. */
  pulse: (midi: number) => void;
};

type Props = {
  notes: NoteEvent[];
  lowMidi: number;
  highMidi: number;
  fallTime: number;
  showLabels: boolean;
};

const PULSE_MS = 260;

const FallingNotesCanvas = forwardRef<FallingNotesHandle, Props>(function FallingNotesCanvas(
  { notes, lowMidi, highMidi, fallTime, showLabels },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ width: 0, height: 0, dpr: 1 });
  const pulsesRef = useRef<{ midi: number; startedAt: number }[]>([]);

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
    pulse(midi) {
      pulsesRef.current.push({ midi, startedAt: performance.now() });
    },
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
      const hitLineY = height - 3;

      // Alternating soft lane shading, like a piano-roll track, so the eye
      // can line up a lane with its key even before a bar reaches it.
      for (const k of keys) {
        if (k.isBlack) continue;
        const x0 = k.x * whiteKeyWidth;
        ctx.fillStyle = Math.round(k.x) % 2 === 0 ? "rgba(148,163,184,0.035)" : "rgba(148,163,184,0.07)";
        ctx.fillRect(x0, 0, whiteKeyWidth, height);
      }

      // Hit line - a bright core with a soft glow underneath.
      ctx.save();
      ctx.shadowColor = "rgba(56, 189, 248, 0.9)";
      ctx.shadowBlur = 12;
      ctx.strokeStyle = "rgba(125, 211, 252, 0.95)";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, hitLineY);
      ctx.lineTo(width, hitLineY);
      ctx.stroke();
      ctx.restore();

      // Hit pulses: a brief bright glow burst where a note was just played correctly.
      const now = performance.now();
      pulsesRef.current = pulsesRef.current.filter((p) => now - p.startedAt < PULSE_MS);
      for (const p of pulsesRef.current) {
        const layout = layoutByMidi.get(p.midi);
        if (!layout) continue;
        const t = (now - p.startedAt) / PULSE_MS; // 0..1
        const cx = layout.isBlack
          ? (layout.x + layout.width / 2) * whiteKeyWidth
          : (layout.x + 0.5) * whiteKeyWidth;
        const w = (layout.isBlack ? layout.width : 1) * whiteKeyWidth;
        const alpha = 1 - t;
        const radius = w * (0.6 + t * 0.9);

        const glow = ctx.createRadialGradient(cx, hitLineY, 0, cx, hitLineY, radius);
        glow.addColorStop(0, `rgba(255,255,255,${0.55 * alpha})`);
        glow.addColorStop(0.4, `rgba(110,231,183,${0.35 * alpha})`);
        glow.addColorStop(1, "rgba(110,231,183,0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(cx, hitLineY, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      notes.forEach((note, i) => {
        const remaining = note.time - currentTime;
        if (remaining > fallTime || remaining < -0.4) return;
        const status = judged[i];

        const layout = layoutByMidi.get(note.midi);
        if (!layout) return;

        const pxHeight = Math.max((note.duration / fallTime) * height, 10);
        const bottom = height - (remaining / fallTime) * height;
        const top = bottom - pxHeight;
        const barH = Math.max(bottom - top, 6);

        const inset = layout.isBlack ? 2 : 3;
        const x = layout.x * whiteKeyWidth + inset;
        const w = Math.max(layout.width * whiteKeyWidth - inset * 2, 4);
        const r = Math.min(7, w / 2, barH / 2);

        // How close this bar's leading edge is to the hit line - used to
        // brighten/glow it as it approaches, like an "incoming" cue.
        const approach = Math.max(0, 1 - Math.max(0, remaining) / (fallTime * 0.35));

        let top1: string, bot1: string, glowColor: string;
        if (status === "hit") {
          // Keeps falling naturally through the hit line instead of
          // popping out of existence the instant it's caught, styled bright
          // to read as "success" as it slides the rest of the way through.
          top1 = "#ffffff";
          bot1 = "#e2e8f0";
          glowColor = "rgba(255,255,255,0.85)";
        } else if (status === "miss") {
          top1 = "#94a3b8";
          bot1 = "#64748b";
          glowColor = "rgba(148,163,184,0)";
        } else if (layout.isBlack) {
          top1 = "#c4b5fd";
          bot1 = "#7c3aed";
          glowColor = `rgba(167,139,250,${0.25 + approach * 0.45})`;
        } else {
          top1 = "#7dd3fc";
          bot1 = "#0284c7";
          glowColor = `rgba(56,189,248,${0.25 + approach * 0.45})`;
        }

        ctx.save();
        if (status !== "miss") {
          ctx.shadowColor = glowColor;
          ctx.shadowBlur = 6 + approach * 14;
        }
        const grad = ctx.createLinearGradient(0, top, 0, bottom);
        grad.addColorStop(0, top1);
        grad.addColorStop(1, bot1);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(x, top, w, barH, r);
        ctx.fill();
        ctx.restore();

        // Glassy highlight strip down the middle for a glossy, game-like look.
        if (w > 10) {
          ctx.fillStyle = "rgba(255,255,255,0.35)";
          ctx.beginPath();
          ctx.roundRect(x + w * 0.16, top + 2, Math.max(w * 0.22, 2), Math.max(barH - 4, 2), 3);
          ctx.fill();
        }

        // Bright leading cap right at the bottom edge of the bar.
        if (status !== "miss" && barH > 6) {
          ctx.fillStyle = "rgba(255,255,255,0.55)";
          ctx.beginPath();
          ctx.roundRect(x, bottom - 3, w, 3, 1.5);
          ctx.fill();
        }

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
