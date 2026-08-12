"use client";

import React from "react";
import { motion, Variants } from "framer-motion";

export interface StaggeredTextProps {
  text: string;
  className?: string;
  staggerDelay?: number;
  highlightWord?: string;
  highlightClassName?: string;
}

export function StaggeredText({
  text,
  className = "",
  staggerDelay = 0.04,
  highlightWord,
  highlightClassName = "text-[#ff8c00] font-extrabold",
}: StaggeredTextProps) {
  const words = text.split(" ");

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: (i: number = 1) => ({
      opacity: 1,
      transition: { staggerChildren: staggerDelay, delayChildren: 0.1 * i },
    }),
  };

  const childVariants: Variants = {
    visible: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: {
        type: "spring",
        damping: 14,
        stiffness: 200,
      },
    },
    hidden: {
      opacity: 0,
      y: 20,
      filter: "blur(8px)",
      transition: {
        type: "spring",
        damping: 14,
        stiffness: 200,
      },
    },
  };

  return (
    <motion.div
      className={`inline-flex flex-wrap ${className}`}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {words.map((word, index) => {
        const isHighlight = highlightWord && word.toLowerCase().includes(highlightWord.toLowerCase());
        return (
          <motion.span
            key={`${word}-${index}`}
            variants={childVariants}
            className={`inline-block mr-[0.28em] ${isHighlight ? highlightClassName : ""}`}
          >
            {word}
          </motion.span>
        );
      })}
    </motion.div>
  );
}
