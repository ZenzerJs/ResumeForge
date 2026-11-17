import { Suspense } from "react";
import { LibraryWorkspace } from "@/components/library/library-workspace";
import { PageSkeleton } from "@/components/design-system/page-skeleton";

export const metadata = {
  title: "Evidence Bank Library",
  description: "Manage verified experiences, projects, skills, and bullets",
};

export default function LibraryPage() {
  return (
    <Suspense fallback={<PageSkeleton variant="library" />}>
      <LibraryWorkspace />
    </Suspense>
  );
}
