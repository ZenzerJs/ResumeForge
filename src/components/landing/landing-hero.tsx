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
  return (
    <motion.section
      initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: shouldReduceMotion ? 0 : 0.4, ease: "easeOut" }}
      className="flex flex-col gap-10 max-w-5xl mx-auto w-full pt-4 md:pt-8 relative"
    >
      {/* Decorative Atmosphere SVG Layer */}
      <div className="absolute inset-0 -z-10 rounded-3xl overflow-hidden pointer-events-none" aria-hidden="true">
        <Image
          src="/landing/editorial-atmosphere.svg"
          alt=""
          fill
          priority
          className="object-cover opacity-60"
        />
      </div>

      {/* Top Editorial Eyebrow & Headline Block */}
      <div className="flex flex-col items-center text-center gap-4 max-w-3xl mx-auto z-10">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-amber-500/30 bg-amber-950/40 text-amber-300 text-xs font-mono font-semibold tracking-wider uppercase">
          <ShieldCheck className="h-3.5 w-3.5 text-amber-400" />
          LOCAL-FIRST RESUME INTELLIGENCE
        </div>

        {/* Softened Headline Contrast (Cloud #f5f5f7) */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.1] text-[#f5f5f7]">
          Make every application feel{" "}
          <span className="font-serif italic font-normal text-amber-400">intentional.</span>
        </h1>

        {/* Softened Body Copy Contrast (Muted Slate #cbd5e1) */}
        <p className="text-sm sm:text-base text-[#cbd5e1] max-w-2xl leading-relaxed font-sans">
          Craft evidence-grounded, job-tailored resume variants from one protected master resume. Zero hallucination. WASM compilation with local BYOK AI gateway.
        </p>

        {/* CTA Action Row */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          {/* Main Primary Action CTA: White Fill + Black Text + Arrow */}
          <Link href="/editor">
            <button
              type="button"
              className="flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-bold bg-white text-slate-950 hover:bg-slate-100 transition-all duration-150 shadow-lg active:scale-[0.98]"
            >
              <FileText className="h-4 w-4 text-slate-950" />
              Open Typst Editor
              <ArrowRight className="h-4 w-4 text-slate-950" />
            </button>
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

          <button
            type="button"
            disabled={isUploadingPdf}
            onClick={onPdfUploadClick}
            className="flex items-center gap-2 px-5 py-3 rounded-lg text-sm font-semibold border border-slate-700 bg-slate-900/90 hover:bg-slate-800 text-slate-200 transition-all duration-150 shadow-md"
            data-testid="upload-pdf-hero-btn"
          >
            {isUploadingPdf ? (
              <Loader2 className="h-4 w-4 animate-spin text-amber-400" />
            ) : (
              <Upload className="h-4 w-4 text-amber-400" />
            )}
            {isUploadingPdf ? "Converting PDF with AI..." : "Upload PDF Resume"}
          </button>

          {hasMasterResume && (
            <button
              type="button"
              disabled={isClearingMaster}
              onClick={onClearMaster}
              className="flex items-center gap-1.5 px-3 py-3 rounded-lg text-xs font-mono text-slate-400 hover:text-red-400 transition-colors border border-transparent hover:border-red-900/40"
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
      <div className="w-full max-w-4xl mx-auto pt-2 z-10 bg-[#161922]/80 border border-slate-800/80 rounded-2xl p-2 shadow-md">
        <ProductProofCard />
      </div>
    </motion.section>
  );
}
