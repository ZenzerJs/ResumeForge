"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";

type Mode = "signin" | "signup";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>(
    searchParams.get("mode") === "signup" ? "signup" : "signin"
  );
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      const endpoint = mode === "signup" ? "/api/auth/signup" : "/api/auth/login";
      const body =
        mode === "signup"
          ? { email, username, password }
          : { email, password };
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        setError(json.error || (mode === "signup" ? "Unable to create account" : "Invalid email, username, or password"));
        return;
      }
      const next = searchParams.get("next") || "/";
      router.replace(next.startsWith("/") ? next : "/");
      router.refresh();
    } catch {
      setError("Unable to continue. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main
      id="main-content"
      className="min-h-dvh bg-[#0b1326] text-slate-100 flex items-center justify-center px-6"
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-xl border border-slate-800 bg-[#121929] p-6"
      >
        <h1 className="text-xl font-bold tracking-tight text-white text-pretty">ResumeForge</h1>
        <p className="mt-2 text-sm text-slate-400">
          {mode === "signup"
            ? "Create an account to save resumes, evidence, and jobs."
            : "Sign in with your email or username, or continue as a guest."}
        </p>
        {mode === "signup" ? (
          <>
            <label htmlFor="username" className="mt-6 block text-sm font-medium text-slate-200">
              Username
            </label>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              required
              minLength={3}
              maxLength={24}
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="mt-2 h-11 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-white outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
            />
            <p className="mt-1.5 text-[11px] text-slate-500">3–24 characters. Letters, numbers, underscores, or hyphens.</p>
          </>
        ) : null}
        <label htmlFor="email" className={`block text-sm font-medium text-slate-200 ${mode === "signup" ? "mt-4" : "mt-6"}`}>
          {mode === "signup" ? "Email" : "Email or username"}
        </label>
        <input
          id="email"
          name="email"
          type={mode === "signup" ? "email" : "text"}
          autoComplete={mode === "signup" ? "email" : "username"}
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-2 h-11 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-white outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
        />
        <label htmlFor="password" className="mt-4 block text-sm font-medium text-slate-200">
          Password
        </label>
        <div className="relative mt-2">
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            spellCheck={false}
            required
            minLength={mode === "signup" ? 8 : undefined}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="h-11 w-full rounded-md border border-slate-700 bg-slate-900 px-3 pr-12 text-sm text-white outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
          />
          <button
            type="button"
            onClick={() => setShowPassword((open) => !open)}
            className="absolute right-1 top-1/2 inline-flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:text-white focus-visible:ring-2 focus-visible:ring-amber-500/60"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {error ? (
          <p className="mt-3 text-sm text-red-400" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
          className="mt-6 flex h-11 w-full items-center justify-center rounded-md bg-[#ff8c00] font-semibold text-black hover:bg-[#ffa024] focus-visible:ring-2 focus-visible:ring-amber-500/60 disabled:opacity-50"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              {mode === "signup" ? "Creating account…" : "Signing in…"}
            </>
          ) : mode === "signup" ? (
            "Create account"
          ) : (
            "Sign In"
          )}
        </button>
        <button
          type="button"
          className="mt-3 w-full text-center text-sm text-slate-400 hover:text-white focus-visible:ring-2 focus-visible:ring-amber-500/60 rounded"
          onClick={() => {
            setError(null);
            setMode(mode === "signup" ? "signin" : "signup");
          }}
        >
          {mode === "signup" ? "Already have an account? Sign in" : "Need an account? Create one"}
        </button>
        <Link
          href="/"
          className="mt-4 flex h-11 w-full items-center justify-center rounded-md border border-slate-700 text-sm text-slate-200 hover:bg-slate-800/60 focus-visible:ring-2 focus-visible:ring-amber-500/60"
        >
          Continue as guest
        </Link>
      </form>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main id="main-content" className="min-h-dvh bg-[#0b1326]" />}>
      <LoginForm />
    </Suspense>
  );
}
