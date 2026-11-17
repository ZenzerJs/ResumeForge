"use client";

import React, { useState } from "react";
import Link from "next/link";
import { BrandIcon } from "@/components/design-system/brand-icon";

const MATCHED_SKILLS = ["Go", "PostgreSQL", "gRPC", "Kafka"] as const;
const GAP_SKILLS = ["Terraform", "PCI-DSS"] as const;

export function ProductProofCard() {
  const [decision, setDecision] = useState<"pending" | "accepted" | "rejected">("pending");

  return (
    <div
      className="w-full rounded-[14px] border surface-glass p-5 sm:p-[22px] space-y-4"
      data-testid="product-proof-card"
    >
      {/* Top header row matching palette-lab.html#ember .proof-top */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            <BrandIcon name="stripe" className="h-3.5 w-3.5 shrink-0" />
            ATS match · Stripe, SWE Intern
          </span>
          <span className="sr-only">Sample Workspace Layout · Protected Master</span>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-signal/40 bg-signal/10 px-2.5 py-0.5 text-xs font-semibold text-signal">
          <span className="h-1.5 w-1.5 rounded-full bg-signal" aria-hidden />
          Synthetic example
        </span>
      </div>

      {/* Conic-gradient Electric Blue score ring + Strong match copy */}
      <div className="flex items-center gap-4">
        <div
          className="relative grid h-[84px] w-[84px] shrink-0 place-items-center rounded-full"
          style={{
            background:
              "conic-gradient(rgb(var(--accent-contrast)) 86%, rgb(214 196 176 / 0.14) 0)",
            filter: "drop-shadow(0 0 14px rgb(var(--accent-contrast) / 0.35))",
          }}
          aria-label="ATS match score 86"
        >
          <div className="grid h-[68px] w-[68px] place-items-center rounded-full bg-panel font-sans text-[26px] font-bold tracking-[-0.03em] tabular-nums text-foreground">
            86
          </div>
        </div>
        <div className="min-w-0">
          <strong className="block text-base font-semibold text-foreground">
            Strong match
          </strong>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            14 of 17 requirements backed by evidence
          </p>
        </div>
      </div>

      {/* Keyword chips: matched in Electric Blue (--c), gaps in Warm Gold (--p) */}
      <div className="flex flex-wrap gap-1.5" aria-label="Matched and gap keywords">
        {MATCHED_SKILLS.map((skill) => (
          <span
            key={skill}
            className="inline-flex items-center gap-1.5 rounded-[6px] border border-signal/35 bg-signal/10 px-2.5 py-1 text-xs font-semibold text-signal"
          >
            <BrandIcon name={skill} className="h-3 w-3 shrink-0" />
            <span>{skill}</span>
          </span>
        ))}
        {GAP_SKILLS.map((skill) => (
          <span
            key={skill}
            className="inline-flex items-center gap-1.5 rounded-[6px] border border-primary/35 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary"
          >
            <BrandIcon name={skill} className="h-3 w-3 shrink-0" />
            <span>{skill}</span>
          </span>
        ))}
      </div>

      {/* Atomic diff block with citation footer */}
      <div className="overflow-hidden rounded-[8px] border border-hairline font-mono text-[12.5px] leading-[1.6]">
        <div
          className="px-3 py-[7px]"
          style={{
            backgroundColor: "rgb(255 138 128 / 0.09)",
            color: "#ffb3ab",
          }}
        >
          − Built backend endpoints for a class project.
        </div>
        <div className="bg-signal/10 px-3 py-[7px] text-signal">
          + Implemented idempotent Go webhook handlers backed by PostgreSQL transactions.
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 bg-inset px-3 py-[7px] text-xs text-muted-foreground">
          <span>cites ev_0142 · ev_0157</span>
          <span>bullet 3 · Protected Master</span>
        </div>
      </div>

      {/* Action row + illustrative workspace label */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-0.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDecision("accepted")}
            aria-pressed={decision === "accepted"}
            className="inline-flex h-9 items-center justify-center rounded-[8px] bg-primary px-3.5 text-[13px] font-semibold text-primary-foreground btn-glow transition-transform active:scale-[0.98]"
          >
            {decision === "accepted" ? "Accepted ✓" : "Accept"}
          </button>
          <button
            type="button"
            onClick={() => setDecision("rejected")}
            aria-pressed={decision === "rejected"}
            className="inline-flex h-9 items-center justify-center rounded-[8px] border border-control/60 bg-white/[0.04] px-3.5 text-[13px] font-semibold text-foreground backdrop-blur-sm transition-colors hover:border-control"
          >
            {decision === "rejected" ? "Rejected" : "Reject"}
          </button>
        </div>
        <Link
          href="/tailor"
          className="font-mono text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Sample Workspace Layout →
        </Link>
      </div>
    </div>
  );
}
