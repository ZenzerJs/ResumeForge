import { Suspense } from "react";
import { EditorWorkspace } from "@/components/editor/editor-workspace";
import { EditorWorkspaceSkeleton } from "@/components/editor/editor-workspace-skeleton";

export const metadata = {
  title: "Typst Workspace | ResumeForge",
  description: "Live Typst resume preview and source workspace",
};

export default function EditorPage() {
  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Suspense fallback={<EditorWorkspaceSkeleton />}>
        <EditorWorkspace />
      </Suspense>
    </div>
  );
}
