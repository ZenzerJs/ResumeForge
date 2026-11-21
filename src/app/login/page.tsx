import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { WorkspaceAtmosphere } from "@/components/design-system/workspace-atmosphere";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata = buildPageMetadata({
  path: "/login",
  title: "Sign In",
  description: "Sign in or create a ResumeForge account to save resumes, evidence, and job applications.",
  noIndex: true,
});

export default function LoginPage() {
  return (
    <div className="relative min-h-dvh bg-background text-foreground flex flex-col">
      <WorkspaceAtmosphere variant="quiet" />
      <main
        id="main-content"
        tabIndex={-1}
        className="relative z-10 flex flex-1 items-center justify-center px-4 py-12 outline-none"
      >
        <Suspense fallback={<div className="h-96 w-full max-w-md animate-pulse rounded-[10px] bg-card/50" />}>
          <LoginForm />
        </Suspense>
      </main>
    </div>
  );
}
