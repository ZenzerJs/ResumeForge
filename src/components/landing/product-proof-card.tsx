"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { FileCode, ShieldCheck, Database, Sparkles } from "lucide-react";
import TextType from "@/components/ui/text-type";

interface ProductProofCardProps {
  shouldReduceMotion?: boolean;
}

export function ProductProofCard({ shouldReduceMotion = false }: ProductProofCardProps) {
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (shouldReduceMotion) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    setRotateX(-y / 40);
    setRotateY(x / 40);
  };

  const handleMouseLeave = () => {
    setRotateX(0);
    setRotateY(0);
  };

  return (
    <motion.div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      animate={{ rotateX, rotateY }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      style={{ transformStyle: "preserve-3d" }}
      className="w-full bg-slate-950/90 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4 backdrop-blur-md relative overflow-hidden"
      data-testid="product-proof-card"
    >
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-amber-400">
            WORKSPACE PREVIEW
          </span>
        </div>
        <span className="text-[10px] font-mono text-slate-400 italic">
          Illustrative interface — sample layout only
        </span>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-3 font-mono text-xs">
        <div className="flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-2">
            <FileCode className="h-4 w-4 text-amber-400" />
            <span className="text-white font-semibold">master-resume.typ</span>
            <span className="text-[10px] text-amber-400/90 bg-amber-950/50 border border-amber-800/50 px-2 py-0.5 rounded">
              Protected Master
            </span>
          </div>
          <span className="text-slate-400 text-[10px]">WASM Compiled</span>
        </div>

        <div className="bg-slate-950 border border-slate-800/80 rounded-lg p-3 min-h-[140px] text-[11px] text-slate-300 overflow-x-auto">
          {shouldReduceMotion ? (
            <div className="space-y-1.5">
              <div className="text-amber-300/90">#let section(title) = block(width: 100%)[ ... ]</div>
              <div className="text-slate-300">#section(&quot;Technical Experience&quot;)</div>
            </div>
          ) : (
            <TextType
              text={[
                '#let master = import("resume.pdf")',
                '#set section(title) = block(width: 100%) [ ... ]\n\n#section("Technical Experience")\n#entry(title: "Senior Software Engineer", company: "TechCorp") [\n  - Architected high-throughput microservices using Go and gRPC.\n]',
              ]}
              typingSpeed={35}
              pauseDuration={3000}
              loop={true}
              showCursor={true}
              cursorCharacter="█"
              cursorClassName="text-[#ff8c00] font-bold"
              className="font-mono text-xs text-amber-200/90 leading-relaxed"
            />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 flex items-center gap-2 text-xs">
          <ShieldCheck className="h-4 w-4 text-amber-400 shrink-0" />
          <div>
            <span className="text-[10px] text-slate-400 font-mono uppercase block">Constraint</span>
            <span className="font-medium text-slate-200 text-[11px]">Protected Master</span>
          </div>
        </div>
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 flex items-center gap-2 text-xs">
          <Database className="h-4 w-4 text-emerald-400 shrink-0" />
          <div>
            <span className="text-[10px] text-slate-400 font-mono uppercase block">Grounding</span>
            <span className="font-medium text-slate-200 text-[11px]">Evidence ID: exp-01</span>
          </div>
        </div>
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 flex items-center gap-2 text-xs">
          <Sparkles className="h-4 w-4 text-purple-400 shrink-0" />
          <div>
            <span className="text-[10px] text-slate-400 font-mono uppercase block">ATS Rubric</span>
            <span className="font-medium text-slate-200 text-[11px]">100-Point Audit</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
