import { Suspense } from "react";
import { EditorWorkspace } from "@/components/editor/editor-workspace";

export const metadata = {
  title: "Typst Workspace | ResumeForge",
  description: "Live Typst resume preview and source workspace",
};

export default function EditorPage() {
  return (
    <Suspense
      fallback={
        <div className="dark flex h-dvh w-screen items-center justify-center bg-background text-muted-foreground text-xs font-mono">
          Loading editor workspace...
        </div>
      }
    >
      <EditorWorkspace />
    </Suspense>
  );
}
