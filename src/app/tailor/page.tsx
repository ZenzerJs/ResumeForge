import { Suspense } from "react";
import { Metadata } from "next";
import { TailorWorkspace } from "@/components/tailor/tailor-workspace";
import { PageSkeleton } from "@/components/design-system/page-skeleton";

import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildPageMetadata({
  path: "/tailor",
  title: "Job Tailoring & Requirement Matcher",
  description: "Deterministic JD requirement extraction and Evidence Bank matching workspace",
  noIndex: true,
});

export default function TailorPage() {
  return (
    <Suspense fallback={<PageSkeleton variant="tailor" />}>
      <TailorWorkspace />
    </Suspense>
  );
}
