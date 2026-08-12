import { Suspense } from "react";
import { Metadata } from "next";
import { TailorWorkspace } from "@/components/tailor/tailor-workspace";
import { PageSkeleton } from "@/components/design-system/page-skeleton";

export const metadata: Metadata = {
  title: "Job Tailoring & Requirement Matcher | ResumeForge",
  description: "Deterministic JD requirement extraction and Evidence Bank matching workspace",
};

export default function TailorPage() {
  return (
    <Suspense fallback={<PageSkeleton variant="tailor" />}>
      <TailorWorkspace />
    </Suspense>
  );
}
