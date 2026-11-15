"use client";

import React, { useEffect, useRef } from "react";

export interface AsciiWavesProps {
  /** String of characters to use for the ASCII gradient. */
  characters?: string;
  /** Primary crest color (defaults to Ember Ink Warm Gold #f7bd3f). */
  color?: string;
  /** Secondary swell color (defaults to Ember Ink Amber #ff8b3d). */
  secondaryColor?: string;
  /** Contrast interference / cursor wake color (defaults to Electric Blue #4f8fff). */
  contrastColor?: string;
  /** Trough ash color (defaults to Warm Stone Ash #9e9287). */
  troughColor?: string;
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

interface CellDrawOp {
  ch: string;
  px: number;
  py: number;
  alpha: number;
}

/**
 * Multi-color ASCII wave field ("Ember Ridges + Signal Glints").
 * Batches characters into 4 Ember Ink topographic bands:
 * - Troughs (u < 0.44): Warm Stone Ash (#9e9287)
 * - Rising Swells (0.44 <= u < 0.64): Ember Amber (#ff8b3d)
 * - Wave Crests (u >= 0.64): Warm Gold (#f7bd3f)
 * - Interference Nodes & Cursor Wake: Electric Blue (#4f8fff)
 */
export function AsciiWaves({
  characters = " .:-+*=%@#",
  color = "#f7bd3f",
  secondaryColor = "#ff8b3d",
  contrastColor = "#4f8fff",
  troughColor = "#9e9287",
  waveTension = 0.5,
  waveTwist = 0.14,
  invert = false,
  noiseScale = 1.0,
  elementSize = 20,
  speed = 0,
  hasCursorInteraction = false,
  intensity = 1.0,
  interactionIntensity = 0,
  className = "",
}: AsciiWavesProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouseRef = useRef({ x: -9999, y: -9999, active: false });

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
    let hasRenderedInitialFrame = false;

    const chars = characters.length > 0 ? characters : " .:-+*=%@#";
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let prefersReduced = motionQuery.matches;

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
      hasRenderedInitialFrame = false;
    };

    resize();

    const onPointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        active: true,
      };
    };

    const onPointerLeave = () => {
      mouseRef.current = { x: -9999, y: -9999, active: false };
    };

    if (hasCursorInteraction) {
      window.addEventListener("pointermove", onPointerMove, { passive: true });
      window.addEventListener("pointerleave", onPointerLeave);
    }

    const cell = Math.max(10, elementSize);
    const start = performance.now();

    const sampleField = (
      col: number,
      row: number,
      t: number,
      mx: number,
      my: number,
      pointerActive: boolean
    ) => {
      const scale = Math.max(0.15, noiseScale);
      const tension = Math.max(0.1, waveTension);
      const twist = Math.max(0, Math.min(1, waveTwist));

      const x = col * 0.14 * scale;
      const y = row * 0.16 * scale;

      const primaryWave =
        Math.sin(x * 1.7 * tension + t * 0.85) *
          Math.cos(y * 1.35 * tension - t * 0.55) +
        Math.sin((x + y) * 0.9 * tension + t * 0.4) * 0.55;

      const counterWave = Math.sin(
        x * (1.35 + twist * 2.1) - y * (1.1 + twist * 1.8) - t * 0.75
      );

      let cursorBoost = 0;
      if (hasCursorInteraction && pointerActive) {
        const dx = col * cell - mx;
        const dy = row * cell - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const radius = Math.max(140, Math.min(width, height) * 0.24);
        if (dist < radius * 1.6) {
          const falloff = Math.exp(-(dist * dist) / (2 * radius * radius));
          const ripple = Math.cos(dist * 0.045 - t * 3.2) * 0.35 + 0.65;
          cursorBoost = falloff * ripple * interactionIntensity;
        }
      }

      const raw = (primaryWave + counterWave * 0.38) * intensity + cursorBoost * 1.25;
      return { raw, counterWave, cursorBoost };
    };

    const fpsInterval = 1000 / 30;
    let lastFrameTime = performance.now();
    let isIntersecting = true;
    let observer: IntersectionObserver | null = null;

    if (typeof IntersectionObserver !== "undefined") {
      observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          const nextIntersecting = entry ? entry.isIntersecting : true;
          if (nextIntersecting && !isIntersecting) {
            isIntersecting = true;
            if (!prefersReduced && !disposed) {
              lastFrameTime = performance.now();
              cancelAnimationFrame(animationFrameId);
              animationFrameId = requestAnimationFrame(draw);
            }
          } else {
            isIntersecting = nextIntersecting;
          }
        },
        { threshold: 0 }
      );
      observer.observe(canvas);
    }

    const renderBatch = (ops: CellDrawOp[], fillStyle: string) => {
      if (ops.length === 0) return;
      ctx.fillStyle = fillStyle;
      for (let i = 0; i < ops.length; i++) {
        const op = ops[i];
        ctx.globalAlpha = op.alpha;
        ctx.fillText(op.ch, op.px, op.py);
      }
    };

    const draw = (now: number) => {
      if (disposed || !isIntersecting) return;

      const elapsed = now - lastFrameTime;
      if (hasRenderedInitialFrame && elapsed < fpsInterval) {
        if (!prefersReduced && isIntersecting && !disposed) {
          animationFrameId = requestAnimationFrame(draw);
        }
        return;
      }
      hasRenderedInitialFrame = true;
      lastFrameTime = now - (elapsed % fpsInterval);

      const isStaticField = prefersReduced || speed <= 0;
      const t = isStaticField ? 1.85 : ((now - start) / 1000) * speed;
      const cols = Math.ceil(width / cell) + 1;
      const rows = Math.ceil(height / cell) + 1;
      const { x: mx, y: my, active: pointerActive } = mouseRef.current;

      ctx.clearRect(0, 0, width, height);
      ctx.font = `600 ${Math.floor(cell * 0.72)}px "JetBrains Mono", ui-monospace, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const troughBatch: CellDrawOp[] = [];
      const swellBatch: CellDrawOp[] = [];
      const crestBatch: CellDrawOp[] = [];
      const signalBatch: CellDrawOp[] = [];

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const { raw, counterWave, cursorBoost } = sampleField(
            col,
            row,
            t,
            mx,
            my,
            pointerActive
          );
          let u = (raw + 2) / 4;
          u = Math.max(0, Math.min(1, u));
          if (invert) u = 1 - u;

          if (u < 0.16) continue;

          const idx = Math.min(chars.length - 1, Math.floor(u * chars.length));
          const ch = chars[idx];
          if (ch === " ") continue;

          const px = col * cell + cell * 0.5;
          const py = row * cell + cell * 0.5;

          const isInterferenceGlint = u >= 0.58 && counterWave > 0.68;
          const isCursorWake = hasCursorInteraction && cursorBoost > 0.22;

          if (isInterferenceGlint || isCursorWake) {
            const alpha = Math.min(0.85, 0.55 + Math.max(cursorBoost * 0.4, (u - 0.55) * 0.7));
            signalBatch.push({ ch, px, py, alpha });
          } else if (u >= 0.64) {
            const alpha = 0.55 + Math.min(1, (u - 0.64) / 0.36) * 0.25;
            crestBatch.push({ ch, px, py, alpha });
          } else if (u >= 0.44) {
            const alpha = 0.35 + ((u - 0.44) / 0.2) * 0.2;
            swellBatch.push({ ch, px, py, alpha });
          } else {
            const alpha = 0.16 + ((u - 0.16) / 0.28) * 0.12;
            troughBatch.push({ ch, px, py, alpha });
          }
        }
      }

      renderBatch(troughBatch, troughColor);
      renderBatch(swellBatch, secondaryColor);
      renderBatch(crestBatch, color);
      renderBatch(signalBatch, contrastColor);

      ctx.globalAlpha = 1;
      if (!isStaticField && isIntersecting && !disposed) {
        animationFrameId = requestAnimationFrame(draw);
      }
    };

    const handleResize = () => {
      cancelAnimationFrame(animationFrameId);
      resize();
      if (!disposed && isIntersecting) {
        lastFrameTime = 0;
        draw(performance.now());
      }
    };
    window.addEventListener("resize", handleResize);
    window.visualViewport?.addEventListener("resize", handleResize);

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && canvas.parentElement) {
      resizeObserver = new ResizeObserver(() => {
        if (!disposed && canvas.parentElement && (canvas.parentElement.clientWidth !== width || canvas.parentElement.clientHeight !== height)) {
          handleResize();
        }
      });
      resizeObserver.observe(canvas.parentElement);
    }

    const handleMotionChange = (e: MediaQueryListEvent) => {
      prefersReduced = e.matches;
      cancelAnimationFrame(animationFrameId);
      hasRenderedInitialFrame = false;
      if (!disposed && isIntersecting) {
        animationFrameId = requestAnimationFrame(draw);
      }
    };
    motionQuery.addEventListener("change", handleMotionChange);

    animationFrameId = requestAnimationFrame(draw);

    return () => {
      disposed = true;
      cancelAnimationFrame(animationFrameId);
      observer?.disconnect();
      resizeObserver?.disconnect();
      window.removeEventListener("resize", handleResize);
      window.visualViewport?.removeEventListener("resize", handleResize);
      motionQuery.removeEventListener("change", handleMotionChange);
      if (hasCursorInteraction) {
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerleave", onPointerLeave);
      }
    };
  }, [
    characters,
    color,
    secondaryColor,
    contrastColor,
    troughColor,
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
      aria-hidden="true"
      data-testid="ascii-waves-canvas"
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
    />
  );
}
