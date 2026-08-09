"use client";

import React from "react";
import { motion } from "framer-motion";

interface AtmosphereCodeFragmentsProps {
  shouldReduceMotion?: boolean;
}

const CODE_FRAGMENTS = [
  { text: '#set page(paper: "a4", margin: 1.25cm)', top: "12%", left: "6%", duration: 18, delay: 0 },
  { text: "#let evidence = bank.query(id)", top: "35%", right: "5%", duration: 22, delay: 2 },
  { text: 'status: "VERIFIED_EVIDENCE"', top: "58%", left: "8%", duration: 20, delay: 4 },
  { text: "#show: resume(author: name)", top: "78%", right: "8%", duration: 24, delay: 1 },
  { text: "atsScore: 94 // target matched", top: "90%", left: "15%", duration: 19, delay: 3 },
];

export function AtmosphereCodeFragments({ shouldReduceMotion = false }: AtmosphereCodeFragmentsProps) {
  if (shouldReduceMotion) return null;

  return (
    <div
      className="absolute inset-0 pointer-events-none z-0 overflow-hidden select-none"
      aria-hidden="true"
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
          className="absolute font-mono text-[11px] text-amber-300/40 bg-slate-950/60 border border-amber-500/20 px-2.5 py-1 rounded backdrop-blur-[2px] shadow-sm hidden md:block"
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
