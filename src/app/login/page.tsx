"use client";

import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <main
      id="main-content"
      className="min-h-dvh bg-[#0b1326] text-slate-100 flex items-center justify-center px-4 py-12 relative"
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(255,140,0,0.15),rgba(255,255,255,0))] pointer-events-none" />
      <Suspense fallback={<div className="h-96 w-full max-w-md animate-pulse rounded-2xl bg-[#121929]/50" />}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
