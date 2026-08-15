"use client";

import React from "react";
import { AsciiWaves } from "@/components/design-system/ascii-waves";

interface LandingAtmosphereProps {
  shouldReduceMotion?: boolean;
}

export function LandingAtmosphere({ shouldReduceMotion = false }: LandingAtmosphereProps) {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden bg-[#0b1326]"
      aria-hidden="true"
      data-testid="landing-atmosphere"
    >
      {shouldReduceMotion ? (
        <div className="absolute inset-0 bg-[#0b1326]" data-testid="atmosphere-static-fallback" />
      ) : (
        <AsciiWaves
          color="#94a3b8"
          speed={1}
          intensity={1}
          noiseScale={1}
          elementSize={16}
          waveTension={0.5}
          waveTwist={0.1}
          hasCursorInteraction={false}
        />
      )}
      <div className="absolute inset-0 bg-[#0b1326]/40 backdrop-blur-[2px]" />
    </div>
  );
}
