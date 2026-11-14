"use client";

import React, { useEffect, useState } from "react";
import { AsciiWaves } from "@/components/design-system/ascii-waves";

export interface LandingAtmosphereProps {
  shouldReduceMotion?: boolean;
}

export function LandingAtmosphere({ shouldReduceMotion = false }: LandingAtmosphereProps) {
  const [internalReduced, setInternalReduced] = useState(shouldReduceMotion);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setInternalReduced(mq.matches || shouldReduceMotion);
    const onChange = () => setInternalReduced(mq.matches || shouldReduceMotion);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [shouldReduceMotion]);

  const isReduced = shouldReduceMotion || internalReduced;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden bg-canvas"
      aria-hidden="true"
      data-testid="landing-atmosphere"
    >
      {/* 3-color Ember Ink radial ambient glows */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(640px 400px at 18% 24%, rgb(var(--accent-action) / 0.14), transparent 70%), radial-gradient(540px 380px at 84% 32%, rgb(var(--accent-contrast) / 0.11), transparent 72%), radial-gradient(460px 320px at 56% 12%, rgb(var(--accent-secondary) / 0.09), transparent 70%)",
        }}
      />

      {isReduced ? (
        <div
          className="absolute inset-0 bg-canvas/60"
          data-testid="atmosphere-static-fallback"
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{
            maskImage:
              "radial-gradient(520px 420px at 26% 42%, rgb(0 0 0 / 0.35), #000 75%)",
            WebkitMaskImage:
              "radial-gradient(520px 420px at 26% 42%, rgb(0 0 0 / 0.35), #000 75%)",
          }}
        >
          <AsciiWaves
            color="#f7bd3f"
            secondaryColor="#ff8b3d"
            contrastColor="#4f8fff"
            troughColor="#9e9287"
            speed={0.45}
            intensity={1}
            noiseScale={1}
            elementSize={20}
            waveTension={0.5}
            waveTwist={0.14}
            hasCursorInteraction={false}
          />
        </div>
      )}

      {/* Clear-window glass plane between dynamic ASCII wave topography and foreground UI */}
      <div
        className="absolute inset-0 backdrop-blur-[1.5px] bg-canvas/[0.06]"
        data-testid="landing-glass-diffusion"
        style={{
          backgroundImage:
            "linear-gradient(115deg, rgb(255 255 255 / 0.035) 0%, transparent 38%, transparent 62%, rgb(255 255 255 / 0.02) 100%)",
          boxShadow: "inset 0 1px 0 rgb(255 255 255 / 0.06)",
        }}
      />

      {/* Soft bottom fade into subsequent landing sections */}
      <div
        className="absolute inset-x-0 top-[560px] bottom-0"
        style={{
          background:
            "linear-gradient(180deg, transparent 0%, rgb(var(--surface-canvas) / 0.85) 220px, rgb(var(--surface-canvas)) 420px)",
        }}
      />
    </div>
  );
}
