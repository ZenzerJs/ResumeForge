"use client";

import React from "react";
import type { AtmosphereVariant } from "./app-shell";

interface BlobOrbConfig {
  id: number;
  animClass: string;
  positionClass: string;
  delay: string;
  background: (alphaScale: number) => string;
}

function featheredOrbGradient(colorChannels: string, peakAlpha: number, alphaScale: number): string {
  const peak = Math.min(0.24, peakAlpha * alphaScale);
  const mid = peak * 0.45;
  return `radial-gradient(circle at 50% 50%, rgb(${colorChannels} / ${peak.toFixed(3)}) 0%, rgb(${colorChannels} / ${mid.toFixed(3)}) 36%, transparent 72%)`;
}

const BLOB_ORBS: BlobOrbConfig[] = [
  {
    id: 0,
    animClass: "ambient-blob-a",
    positionClass: "-left-24 top-8 h-[460px] w-[560px]",
    delay: "-3s",
    background: (s) => featheredOrbGradient("var(--accent-action)", 0.16, s),
  },
  {
    id: 1,
    animClass: "ambient-blob-b",
    positionClass: "-right-20 top-16 h-[500px] w-[600px]",
    delay: "-7.5s",
    background: (s) => featheredOrbGradient("var(--accent-contrast)", 0.15, s),
  },
  {
    id: 2,
    animClass: "ambient-blob-c",
    positionClass: "left-[16%] top-[36%] h-[440px] w-[540px]",
    delay: "-12s",
    background: (s) => featheredOrbGradient("var(--accent-secondary)", 0.14, s),
  },
  {
    id: 3,
    animClass: "ambient-blob-d",
    positionClass: "right-[18%] top-[28%] h-[470px] w-[570px]",
    delay: "-5s",
    background: (s) => featheredOrbGradient("var(--accent-action)", 0.13, s),
  },
  {
    id: 4,
    animClass: "ambient-blob-e",
    positionClass: "left-[28%] bottom-[-90px] h-[480px] w-[600px]",
    delay: "-15.5s",
    background: (s) => {
      const peak = 0.17 * s;
      const mid = peak * 0.45;
      return `radial-gradient(ellipse at 50% 50%, rgb(var(--accent-secondary) / ${peak.toFixed(3)}) 0%, rgb(var(--accent-contrast) / ${mid.toFixed(3)}) 36%, transparent 72%)`;
    },
  },
  {
    id: 5,
    animClass: "ambient-blob-f",
    positionClass: "right-[8%] bottom-[-70px] h-[450px] w-[550px]",
    delay: "-9.5s",
    background: (s) => featheredOrbGradient("var(--accent-contrast)", 0.15, s),
  },
  {
    id: 6,
    animClass: "ambient-blob-a",
    positionClass: "left-[46%] top-[8%] h-[430px] w-[530px]",
    delay: "-17s",
    background: (s) => featheredOrbGradient("var(--accent-secondary)", 0.14, s),
  },
];

export interface AmbientColorBlobsProps {
  testId?: string;
  variant?: AtmosphereVariant | "landing-lower";
  className?: string;
}

/**
 * Pure CSS drifting multi-stop feathered radial color orbs paused cleanly under reduced motion.
 */
export function AmbientColorBlobs({
  testId = "ambient-floating-blobs",
  variant = "library",
  className,
}: AmbientColorBlobsProps) {
  const alphaScale = variant === "landing-lower" ? 1.15 : 1;

  return (
    <div
      className={
        className
          ? `pointer-events-none absolute inset-0 select-none overflow-hidden ${className}`
          : "pointer-events-none absolute inset-0 select-none overflow-hidden"
      }
      aria-hidden="true"
      data-testid={testId}
      data-blob-variant={variant}
    >
      {BLOB_ORBS.map((orb) => (
        <div
          key={orb.id}
          data-blob-orb={String(orb.id)}
          className={`${orb.animClass} absolute rounded-full ${orb.positionClass}`}
          style={{
            animationDelay: orb.delay,
            background: orb.background(alphaScale),
          }}
        />
      ))}
    </div>
  );
}

export interface WorkspaceAtmosphereProps {
  variant: AtmosphereVariant;
}

/**
 * Layered fixed background for non-landing, non-editor workspaces:
 * lit ground ramp, 7 pure CSS roaming color orbs, and ombre top rule.
 */
export function WorkspaceAtmosphere({ variant }: WorkspaceAtmosphereProps) {
  if (variant === "landing" || variant === "editor") {
    return null;
  }

  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      aria-hidden="true"
      data-testid="workspace-atmosphere"
      data-variant={variant}
      data-atmosphere-variant={variant}
    >
      {/* Lit ground: steps from canvas at top to deep floor at bottom */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgb(var(--surface-canvas)) 0%, rgb(var(--surface-deep)) 100%)",
        }}
      />

      {/* 7 pure CSS roaming Ember Ink & Electric Blue orbs */}
      <AmbientColorBlobs testId="ambient-floating-blobs" variant={variant} />

      {/* Ombre divider: TopNav provides the primary ombre-divider at its boundary; unconditional top-16 divider removed */}
    </div>
  );
}
