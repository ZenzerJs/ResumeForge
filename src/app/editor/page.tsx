import { Suspense } from "react";
import { EditorWorkspace } from "@/components/editor/editor-workspace";
import { EditorWorkspaceSkeleton } from "@/components/editor/editor-workspace-skeleton";

import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata = buildPageMetadata({
  path: "/editor",
  title: "Typst Workspace",
  description: "Live Typst resume preview and source workspace",
  noIndex: true,
});

export default function EditorPage() {
  return (
    <Suspense fallback={<EditorWorkspaceSkeleton />}>
      <EditorWorkspace />
    </Suspense>
  );
}
