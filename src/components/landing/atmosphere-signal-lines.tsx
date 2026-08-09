"use client";

import React from "react";
import { motion } from "framer-motion";

interface AtmosphereSignalLinesProps {
  shouldReduceMotion?: boolean;
}

export function AtmosphereSignalLines({ shouldReduceMotion = false }: AtmosphereSignalLinesProps) {
  if (shouldReduceMotion) return null;

  return (
    <div
      className="absolute inset-0 pointer-events-none z-0 overflow-hidden"
      aria-hidden="true"
      data-testid="atmosphere-scan-line"
    >
      {/* Horizontal Scanning Line */}
      <motion.div
        animate={{ top: ["0%", "100%"], opacity: [0, 0.8, 0.8, 0] }}
        transition={{
          duration: 12,
          repeat: Infinity,
          ease: "easeInOut",
          repeatDelay: 3,
        }}
        className="absolute inset-x-0 h-[1.5px] bg-gradient-to-r from-transparent via-amber-500/50 to-transparent shadow-[0_0_12px_rgba(245,158,11,0.6)]"
      />

      {/* Explicit Framer Motion Signal Pulse Nodes */}
      <motion.div
        animate={{ scale: [1, 2.2, 1], opacity: [0.6, 0, 0.6] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-[20%] left-[15%] w-2 h-2 rounded-full bg-amber-400/40"
      />
      <motion.div
        animate={{ scale: [1, 2.2, 1], opacity: [0.6, 0, 0.6] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        className="absolute top-[45%] right-[12%] w-2 h-2 rounded-full bg-amber-400/40"
      />
      <motion.div
        animate={{ scale: [1, 2.2, 1], opacity: [0.6, 0, 0.6] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
        className="absolute top-[75%] left-[22%] w-2 h-2 rounded-full bg-amber-400/40"
      />
    </div>
  );
}
