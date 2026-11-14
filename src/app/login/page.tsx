"use client";

import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <main
      id="main-content"
      className="min-h-dvh bg-background text-foreground flex items-center justify-center px-4 py-12 relative"
    >
      <Suspense fallback={<div className="h-96 w-full max-w-md animate-pulse rounded-[10px] bg-card/50" />}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
