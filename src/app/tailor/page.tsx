import { Suspense } from "react";
import { Metadata } from "next";
import { TailorWorkspace } from "@/components/tailor/tailor-workspace";

export const metadata: Metadata = {
  title: "Job Tailoring & Requirement Matcher | ResumeForge",
  description: "Deterministic JD requirement extraction and Evidence Bank matching workspace",
};

export default function TailorPage() {
  return (
    <Suspense
      fallback={
        <div className="dark flex h-dvh w-screen items-center justify-center bg-slate-950 text-slate-400 text-xs font-mono">
          Loading tailor workspace...
        </div>
      }
    >
      <TailorWorkspace />
    </Suspense>
  );
}
