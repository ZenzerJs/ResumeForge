import { Suspense } from "react";
import { LibraryWorkspace } from "@/components/library/library-workspace";
import { PageSkeleton } from "@/components/design-system/page-skeleton";

import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata = buildPageMetadata({
  path: "/library",
  title: "Evidence Bank Library",
  description: "Manage verified experiences, projects, skills, and bullets",
  noIndex: true,
});

export default function LibraryPage() {
  return (
    <Suspense fallback={<PageSkeleton variant="library" />}>
      <LibraryWorkspace />
    </Suspense>
  );
}
