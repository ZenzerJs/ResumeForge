import { Suspense } from "react";
import { EditorWorkspace } from "@/components/editor/editor-workspace";
import { EditorWorkspaceSkeleton } from "@/components/editor/editor-workspace-skeleton";

export const metadata = {
  title: "Typst Workspace",
  description: "Live Typst resume preview and source workspace",
};

export default function EditorPage() {
  return (
    <Suspense fallback={<EditorWorkspaceSkeleton />}>
      <EditorWorkspace />
    </Suspense>
  );
}
