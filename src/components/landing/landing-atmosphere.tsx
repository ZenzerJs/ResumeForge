"use client";

import React from "react";
import { AtmospherePointerGlow } from "./atmosphere-pointer-glow";
import { AtmosphereGrid } from "./atmosphere-grid";
import { AtmosphereSignalLines } from "./atmosphere-signal-lines";
import { AtmosphereCodeFragments } from "./atmosphere-code-fragments";

interface LandingAtmosphereProps {
  shouldReduceMotion?: boolean;
}

export function LandingAtmosphere({ shouldReduceMotion = false }: LandingAtmosphereProps) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0" aria-hidden="true">
      {/* 1. Cursor Spotlight Glow */}
      <AtmospherePointerGlow shouldReduceMotion={shouldReduceMotion} />

      {/* 2. Document Grid Drift */}
      <AtmosphereGrid shouldReduceMotion={shouldReduceMotion} />

      {/* 3. Compiler Signal Scanning Line & Pulse Nodes */}
      <AtmosphereSignalLines shouldReduceMotion={shouldReduceMotion} />

      {/* 4. Floating Typst Code Fragments */}
      <AtmosphereCodeFragments shouldReduceMotion={shouldReduceMotion} />
    </div>
  );
}
