"use client";

import React, { useEffect, useRef } from "react";

export interface AsciiWavesProps {
  /** String of characters to use for the ASCII gradient. */
  characters?: string;
  /** Color of the ASCII characters. */
  color?: string;
  /** Tension of the wave flow (0.1–2.0). */
  waveTension?: number;
  /** Twist amount of the wave flow (0.0–1.0). */
  waveTwist?: number;
  /** Invert the character mapping. */
  invert?: boolean;
  /** Scale of the noise/wave pattern (zoom). */
  noiseScale?: number;
  /** Size of individual ASCII characters/grid cells. */
  elementSize?: number;
  /** Animation speed multiplier. */
  speed?: number;
  /** Whether the waves react to mouse cursor. */
  hasCursorInteraction?: boolean;
  /** Intensity of the wave effect. */
  intensity?: number;
  /** Intensity of the cursor interaction. */
  interactionIntensity?: number;
  className?: string;
}

/**
 * Wave field rendered as ASCII characters.
 * API aligned with React Bits Pro Ascii Waves (`ascii-waves-tw`).
 */
export function AsciiWaves({
  characters = " .:-+*=%@#",
  color = "#94a3b8",
  waveTension = 0.5,
  waveTwist = 0.1,
  invert = false,
  noiseScale = 1.0,
  elementSize = 16,
  speed = 1.0,
  hasCursorInteraction = false,
  intensity = 1.0,
  interactionIntensity = 1.0,
  className = "",
}: AsciiWavesProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouseRef = useRef({ x: -9999, y: -9999 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId = 0;
    let disposed = false;
    let width = 0;
    let height = 0;
    let dpr = 1;

    const chars = characters.length > 0 ? characters : " .:-+*=%@#";

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = parent.clientWidth;
      height = parent.clientHeight;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener("resize", resize);

    const onPointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };

    const onPointerLeave = () => {
      mouseRef.current = { x: -9999, y: -9999 };
    };

    if (hasCursorInteraction) {
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerleave", onPointerLeave);
    }

    const cell = Math.max(8, elementSize);
    const start = performance.now();

    const sampleWave = (nx: number, ny: number, t: number, mx: number, my: number) => {
      const scale = Math.max(0.15, noiseScale);
      const tension = Math.max(0.1, waveTension);
      const twist = Math.max(0, Math.min(1, waveTwist));

      const x = nx * scale;
      const y = ny * scale;

      let v =
        Math.sin(x * 1.7 * tension + t * 0.85) *
          Math.cos(y * 1.35 * tension - t * 0.55) +
        Math.sin((x + y) * 0.9 * tension + t * 0.4) * 0.55 +
        Math.sin(x * twist * 3.2 - y * twist * 2.4 + t * 0.7) * 0.35;

      if (hasCursorInteraction) {
        const dx = nx * cell - mx;
        const dy = ny * cell - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const radius = Math.min(width, height) * 0.28;
        const falloff = Math.exp(-(dist * dist) / (2 * radius * radius));
        v += falloff * interactionIntensity * 1.6;
      }

      return v * intensity;
    };

    const draw = (now: number) => {
      if (disposed) return;

      const t = ((now - start) / 1000) * speed;
      const cols = Math.ceil(width / cell) + 1;
      const rows = Math.ceil(height / cell) + 1;
      const { x: mx, y: my } = mouseRef.current;

      ctx.clearRect(0, 0, width, height);
      ctx.font = `500 ${Math.floor(cell * 0.92)}px "JetBrains Mono", ui-monospace, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = color;

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          let n = sampleWave(col, row, t, mx, my);
          // Normalize roughly from [-2,2] → [0,1]
          let u = (n + 2) / 4;
          u = Math.max(0, Math.min(1, u));
          if (invert) u = 1 - u;

          // Soften sparse cells so the field stays subtle
          if (u < 0.12) continue;

          const idx = Math.min(
            chars.length - 1,
            Math.floor(u * chars.length)
          );
          const ch = chars[idx];
          if (ch === " ") continue;

          const px = col * cell + cell * 0.5;
          const py = row * cell + cell * 0.5;
          const alpha = 0.18 + u * 0.55;
          ctx.globalAlpha = alpha;
          ctx.fillText(ch, px, py);
        }
      }

      ctx.globalAlpha = 1;
      animationFrameId = requestAnimationFrame(draw);
    };

    animationFrameId = requestAnimationFrame(draw);

    return () => {
      disposed = true;
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", resize);
      if (hasCursorInteraction) {
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerleave", onPointerLeave);
      }
    };
  }, [
    characters,
    color,
    waveTension,
    waveTwist,
    invert,
    noiseScale,
    elementSize,
    speed,
    hasCursorInteraction,
    intensity,
    interactionIntensity,
  ]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
    />
  );
}
