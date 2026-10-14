import React, { Suspense } from "react";
import { DsaWorkspace } from "@/components/interview/dsa-workspace";
import { TopNav } from "@/components/navigation/top-nav";

export const metadata = {
  title: "In-Browser DSA Sandbox — ResumeForge",
  description: "Un-paywalled in-browser DSA practice environment with target role JD pattern matching.",
};

export default function DsaPage() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <TopNav />
      <main className="flex-1 flex flex-col">
        <Suspense
          fallback={
            <div className="flex-1 flex items-center justify-center p-12 text-slate-400 text-sm font-mono">
              Loading DSA Execution Sandbox...
            </div>
          }
        >
          <DsaWorkspace />
        </Suspense>
      </main>
    </div>
  );
}
