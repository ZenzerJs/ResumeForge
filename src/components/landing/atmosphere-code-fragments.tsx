"use client";

import React from "react";
import { motion } from "framer-motion";

interface AtmosphereCodeFragmentsProps {
  shouldReduceMotion?: boolean;
}

const CODE_FRAGMENTS = [
  { text: '#set page(paper: "a4")', top: "10%", left: "4%", duration: 18, delay: 0, showOnMobile: true },
  { text: "#let evidence = bank.query(id)", top: "35%", right: "4%", duration: 22, delay: 2, showOnMobile: false },
  { text: 'status: "VERIFIED_EVIDENCE"', top: "58%", left: "5%", duration: 20, delay: 4, showOnMobile: true },
  { text: "#show: resume(author: name)", top: "78%", right: "5%", duration: 24, delay: 1, showOnMobile: false },
  { text: "atsScore: 94 // target matched", top: "90%", left: "10%", duration: 19, delay: 3, showOnMobile: false },
];

export function AtmosphereCodeFragments({ shouldReduceMotion = false }: AtmosphereCodeFragmentsProps) {
  if (shouldReduceMotion) return null;

  return (
    <div
      className="absolute inset-0 pointer-events-none z-0 overflow-hidden select-none"
      aria-hidden="true"
      data-testid="atmosphere-code-fragments"
    >
      {CODE_FRAGMENTS.map((frag, idx) => (
        <motion.div
          key={idx}
          animate={{
            y: [-10, 15, -10],
            opacity: [0.15, 0.35, 0.15],
          }}
          transition={{
            duration: frag.duration,
            repeat: Infinity,
            ease: "easeInOut",
            delay: frag.delay,
          }}
          className={`absolute font-mono text-[10px] sm:text-[11px] text-amber-300/40 bg-slate-950/60 border border-amber-500/20 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded backdrop-blur-[2px] shadow-sm ${
            frag.showOnMobile ? "block" : "hidden md:block"
          }`}
          style={{
            top: frag.top,
            left: frag.left,
            right: frag.right,
          }}
        >
          {frag.text}
        </motion.div>
      ))}
    </div>
  );
}
