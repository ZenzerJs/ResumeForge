import React, { Suspense } from "react";
import { PracticeWorkspace } from "@/components/practice/practice-workspace";

export const metadata = {
  title: "Technical Interview & OA Practice — ResumeForge",
  description:
    "Master core algorithmic patterns, study blueprints and worked examples, and solve real company assessment problems in an interactive workspace.",
};

export default function PracticePage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center min-h-screen bg-rf-bg text-rf-meta font-mono text-xs">
          Loading practice workspace...
        </div>
      }
    >
      <PracticeWorkspace />
    </Suspense>
  );
}
