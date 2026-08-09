"use client";

import React from "react";
import { motion } from "framer-motion";

interface AtmosphereGridProps {
  shouldReduceMotion?: boolean;
}

export function AtmosphereGrid({ shouldReduceMotion = false }: AtmosphereGridProps) {
  if (shouldReduceMotion) {
    return (
      <div
        className="absolute inset-0 pointer-events-none z-0 opacity-40"
        aria-hidden="true"
        data-testid="atmosphere-grid"
        style={{
          backgroundImage:
            "linear-gradient(rgba(245, 158, 11, 0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(245, 158, 11, 0.08) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />
    );
  }

  return (
    <div
      className="absolute inset-0 pointer-events-none z-0 overflow-hidden"
      aria-hidden="true"
      data-testid="atmosphere-grid"
    >
      <motion.div
        animate={{ y: [0, 60] }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "linear",
        }}
        className="absolute -top-[60px] inset-x-0 bottom-0 opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(rgba(245, 158, 11, 0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(245, 158, 11, 0.08) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />
    </div>
  );
}
