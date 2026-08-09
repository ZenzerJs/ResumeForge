"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { AtmospherePointerGlow } from "../landing/atmosphere-pointer-glow";
import { AtmosphereGrid } from "../landing/atmosphere-grid";
import { AtmosphereSignalLines } from "../landing/atmosphere-signal-lines";
import { AtmosphereCodeFragments } from "../landing/atmosphere-code-fragments";

export type AtmosphereVariant =
  | "landing"
  | "editor"
  | "tracker"
  | "tailor"
  | "library"
  | "discover"
  | "settings"
  | "quiet";

interface AmbientBackgroundProps {
  variant?: AtmosphereVariant;
  isCompiling?: boolean;
}

function usePageVisible() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const onVisibility = () => setVisible(document.visibilityState === "visible");
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);
  return visible;
}

export function AmbientBackground({
  variant = "quiet",
  isCompiling = false,
}: AmbientBackgroundProps) {
  const shouldReduceMotion = useReducedMotion() ?? false;
  const pageVisible = usePageVisible();
  const motionAllowed = !shouldReduceMotion && pageVisible;

  if (variant === "quiet" || variant === "settings") {
    return (
      <div
        className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-rf-bg"
        aria-hidden="true"
        data-testid="ambient-background-quiet"
      >
        <div className="absolute top-0 left-1/2 h-[400px] w-[800px] -translate-x-1/2 rounded-full bg-slate-900/20 blur-[140px]" />
      </div>
    );
  }

  if (variant === "landing") {
    return (
      <div
        className="absolute inset-0 z-0 overflow-hidden pointer-events-none"
        aria-hidden="true"
        data-testid="landing-atmosphere"
      >
        <LandingAtmosphereBase shouldReduceMotion={!motionAllowed} />
      </div>
    );
  }

  if (variant === "editor") {
    return (
      <div
        className="fixed inset-0 z-0 overflow-hidden pointer-events-none bg-rf-bg"
        aria-hidden="true"
        data-testid="ambient-background-editor"
      >
        <div className="absolute inset-0 opacity-20">
          <Image
            src="/landing/editorial-atmosphere.svg"
            alt=""
            fill
            unoptimized
            className="object-cover"
          />
        </div>
        <div
          className="absolute inset-0 opacity-25"
          style={{
            backgroundImage:
              "linear-gradient(rgba(245, 158, 11, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(245, 158, 11, 0.05) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
        {isCompiling && motionAllowed ? (
          <motion.div
            initial={{ top: "0%", opacity: 0 }}
            animate={{ top: ["0%", "100%"], opacity: [0, 0.9, 0] }}
            transition={{ duration: 1.2, ease: "easeInOut" }}
            className="absolute inset-x-0 h-[2px] bg-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.8)]"
            data-testid="editor-compile-scan"
          />
        ) : null}
      </div>
    );
  }

  if (variant === "tracker") {
    return (
      <div
        className="fixed inset-0 z-0 overflow-hidden pointer-events-none bg-rf-bg"
        aria-hidden="true"
        data-testid="ambient-background-tracker"
      >
        <div className="absolute right-1/4 top-0 h-[350px] w-[600px] rounded-full bg-amber-500/5 blur-[130px]" />
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "linear-gradient(rgba(30, 41, 59, 0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(30, 41, 59, 0.4) 1px, transparent 1px)",
            backgroundSize: "80px 80px",
          }}
        />
      </div>
    );
  }

  if (variant === "tailor") {
    return (
      <div
        className="fixed inset-0 z-0 overflow-hidden pointer-events-none bg-rf-bg"
        aria-hidden="true"
        data-testid="ambient-background-tailor"
      >
        <div className="absolute left-1/3 top-1/3 h-[400px] w-[700px] rounded-full bg-emerald-500/5 blur-[150px]" />
        <div className="absolute right-1/4 top-10 h-[300px] w-[500px] rounded-full bg-amber-500/5 blur-[130px]" />
      </div>
    );
  }

  if (variant === "library") {
    return (
      <div
        className="fixed inset-0 z-0 overflow-hidden pointer-events-none bg-rf-bg"
        aria-hidden="true"
        data-testid="ambient-background-library"
      >
        <div className="absolute inset-0 opacity-25">
          <Image
            src="/landing/editorial-atmosphere.svg"
            alt=""
            fill
            unoptimized
            className="object-cover"
          />
        </div>
      </div>
    );
  }

  if (variant === "discover") {
    return (
      <div
        className="fixed inset-0 z-0 overflow-hidden pointer-events-none bg-rf-bg"
        aria-hidden="true"
        data-testid="ambient-background-discover"
      >
        <div className="absolute left-1/2 top-10 h-[350px] w-[700px] -translate-x-1/2 rounded-full bg-amber-500/5 blur-[140px]" />
        <div
          className="absolute inset-0 opacity-15"
          style={{
            backgroundImage:
              "linear-gradient(rgba(245, 158, 11, 0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(245, 158, 11, 0.04) 1px, transparent 1px)",
            backgroundSize: "72px 72px",
          }}
        />
      </div>
    );
  }

  return null;
}

function LandingAtmosphereBase({ shouldReduceMotion }: { shouldReduceMotion: boolean }) {
  return (
    <>
      <div className="absolute inset-0 -z-10 opacity-40">
        <Image
          src="/landing/editorial-atmosphere.svg"
          alt=""
          fill
          priority
          unoptimized
          className="object-cover"
        />
      </div>
      <AtmospherePointerGlow shouldReduceMotion={shouldReduceMotion} />
      <AtmosphereGrid shouldReduceMotion={shouldReduceMotion} />
      <AtmosphereSignalLines shouldReduceMotion={shouldReduceMotion} />
      <AtmosphereCodeFragments shouldReduceMotion={shouldReduceMotion} />
    </>
  );
}
