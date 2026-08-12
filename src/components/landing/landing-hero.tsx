"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowRight, Upload, Loader2, Trash2, ShieldCheck, FileText } from "lucide-react";
import { ProductProofCard } from "./product-proof-card";

interface LandingHeroProps {
  isUploadingPdf: boolean;
  isClearingMaster: boolean;
  hasMasterResume: boolean;
  onPdfUploadClick: () => void;
  onPdfFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClearMaster: () => void;
  pdfInputRef: React.RefObject<HTMLInputElement | null>;
  shouldReduceMotion?: boolean;
}

export function LandingHero({
  isUploadingPdf,
  isClearingMaster,
  hasMasterResume,
  onPdfUploadClick,
  onPdfFileChange,
  onClearMaster,
  pdfInputRef,
  shouldReduceMotion = false,
}: LandingHeroProps) {
  const headlineWords = "Make every application feel intentional.".split(" ");

  return (
    <motion.section
      initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, filter: "blur(12px)", y: 28 }}
      animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
      transition={{ duration: shouldReduceMotion ? 0 : 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="flex flex-col gap-10 max-w-5xl mx-auto w-full pt-4 md:pt-8 relative"
    >
      {/* Decorative Atmosphere SVG Layer */}
      <div className="absolute inset-0 -z-10 rounded-3xl overflow-hidden pointer-events-none" aria-hidden="true">
        <Image
          src="/landing/editorial-atmosphere.svg"
          alt=""
          fill
          priority
          unoptimized
          className="object-cover opacity-90"
        />
      </div>

      {/* Top Editorial Eyebrow & Headline Block */}
      <div className="flex flex-col items-center text-center gap-4 max-w-3xl mx-auto z-10">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-section-label tracking-wider uppercase">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" />
          LOCAL-FIRST RESUME INTELLIGENCE
        </div>

        {/* Word-by-Word Headline Animation */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-page-title text-on-surface font-extrabold tracking-[-0.05em] leading-[1.1] flex flex-wrap justify-center" style={{ rowGap: "0.1em" }}>
          {headlineWords.map((word, i) => (
            <motion.span
              key={i}
              className="inline-block"
              style={{ marginRight: "0.28em" }}
              initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { filter: "blur(10px)", opacity: 0, y: 40 }}
              animate={
                shouldReduceMotion
                  ? { opacity: 1, y: 0 }
                  : {
                      filter: ["blur(10px)", "blur(4px)", "blur(0px)"],
                      opacity: [0, 0.5, 1],
                      y: [40, -4, 0],
                    }
              }
              transition={{
                duration: 0.7,
                times: [0, 0.5, 1],
                delay: shouldReduceMotion ? 0 : (i * 100) / 1000,
              }}
            >
              {word === "intentional." ? (
                <span className="text-primary font-bold">{word}</span>
              ) : (
                word
              )}
            </motion.span>
          ))}
        </h1>

        {/* Softened Body Copy Contrast */}
        <p className="text-sm sm:text-base text-on-surface-variant max-w-2xl leading-relaxed font-body-regular">
          Craft evidence-grounded, job-tailored resume variants from one protected master resume. Zero hallucination. WASM compilation with local BYOK AI gateway.
        </p>

        {/* CTA Action Row */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          {/* Primary Action CTA */}
          <Link href="/editor">
            <motion.button
              type="button"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
              className="flex items-center gap-2 px-6 py-3 rounded text-sm font-bold bg-primary text-on-primary hover:bg-primary-fixed transition-colors shadow-[0_0_15px_rgba(255,140,0,0.3)] hover:shadow-[0_0_25px_rgba(255,140,0,0.5)]"
            >
              <FileText className="h-4 w-4" />
              Open Typst Editor
              <ArrowRight className="h-4 w-4" />
            </motion.button>
          </Link>

          {/* Secondary Action CTA: Upload PDF Button */}
          <input
            type="file"
            ref={pdfInputRef}
            onChange={onPdfFileChange}
            accept=".pdf"
            className="hidden"
            data-testid="pdf-upload-input"
          />

          <motion.button
            type="button"
            disabled={isUploadingPdf}
            onClick={onPdfUploadClick}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
            className="flex items-center gap-2 px-5 py-3 rounded text-sm font-semibold border border-outline-variant bg-surface-container-high hover:bg-surface-variant text-on-surface transition-colors shadow-md"
            data-testid="upload-pdf-hero-btn"
          >
            {isUploadingPdf ? (
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            ) : (
              <Upload className="h-4 w-4 text-primary" />
            )}
            {isUploadingPdf ? "Converting PDF with AI..." : "Upload PDF Resume"}
          </motion.button>

          {hasMasterResume && (
            <button
              type="button"
              disabled={isClearingMaster}
              onClick={onClearMaster}
              className="flex items-center gap-1.5 px-3 py-3 rounded text-xs font-mono-data text-on-surface-variant hover:text-error transition-colors border border-transparent hover:border-error/40"
              title="Clear Master Resume status for this session"
              data-testid="clear-master-btn"
            >
              {isClearingMaster ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              Clear Master
            </button>
          )}
        </div>
      </div>

      {/* Illustrative Product Proof Mockup framed in quiet surface container */}
      <div className="w-full max-w-4xl mx-auto pt-2 z-10 glass-panel rounded-2xl p-2 shadow-2xl">
        <ProductProofCard shouldReduceMotion={shouldReduceMotion} />
      </div>
    </motion.section>
  );
}
