"use client";

import React, { useEffect, useState } from "react";
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
  const [reduceMotion, setReduceMotion] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduceMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

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

  if (reduceMotion) {
    return (
      <span className={`inline-flex flex-wrap ${className}`}>
        {words.map((word, index) => {
          const isHighlight = highlightWord && word.toLowerCase().includes(highlightWord.toLowerCase());
          return (
            <React.Fragment key={`${word}-${index}`}>
              <span className={`inline-block ${isHighlight ? highlightClassName : ""}`}>
                {word}
              </span>
              {index < words.length - 1 ? " " : null}
            </React.Fragment>
          );
        })}
      </span>
    );
  }

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
          <React.Fragment key={`${word}-${index}`}>
            <motion.span
              variants={childVariants}
              className={`inline-block ${isHighlight ? highlightClassName : ""}`}
            >
              {word}
            </motion.span>
            {index < words.length - 1 ? "\u00A0" : null}
          </React.Fragment>
        );
      })}
    </motion.div>
  );
}
