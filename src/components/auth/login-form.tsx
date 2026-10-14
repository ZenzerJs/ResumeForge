"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2, Lock, Mail, User } from "lucide-react";

export type AuthMode = "signin" | "signup";

export interface LoginFormProps {
  initialMode?: AuthMode;
  redirectTo?: string;
  className?: string;
}

export function resolvePostLoginRedirect(
  searchParams?: { get: (name: string) => string | null } | null,
  redirectTo?: string
): string {
  let paramTarget: string | null = null;
  if (searchParams) {
    paramTarget =
      searchParams.get("next") ||
      searchParams.get("redirect") ||
      searchParams.get("returnUrl") ||
      searchParams.get("callbackUrl");
  }

  if (!paramTarget && typeof window !== "undefined" && window.location.search) {
    try {
      const sp = new URLSearchParams(window.location.search);
      paramTarget =
        sp.get("next") ||
        sp.get("redirect") ||
        sp.get("returnUrl") ||
        sp.get("callbackUrl");
    } catch {}
  }

  const rawTarget = paramTarget || redirectTo || "/";

  let decoded = "/";
  try {
    decoded = decodeURIComponent(rawTarget);
  } catch {
    decoded = rawTarget;
  }

  if (decoded.startsWith("/") && !decoded.startsWith("//") && !decoded.startsWith("/\\")) {
    return decoded;
  }
  return "/";
}

export function LoginForm({ initialMode, redirectTo, className = "" }: LoginFormProps) {
  const searchParams = useSearchParams();
  const defaultMode: AuthMode =
    initialMode ?? (searchParams.get("mode") === "signup" ? "signup" : "signin");

  const [mode, setMode] = useState<AuthMode>(defaultMode);
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const emailInputRef = useRef<HTMLInputElement>(null);
  const usernameInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const urlMode =
      searchParams.get("mode") ||
      (typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("mode")
        : null);
    if (urlMode === "signup" || urlMode === "signin") {
      setMode(urlMode);
    }
  }, [searchParams]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    // Read values directly from DOM input elements as primary/fallback to handle password managers & browser autofill
    const formEl = event.currentTarget;
    const domEmail = emailInputRef.current?.value ?? (formEl.elements.namedItem("email") as HTMLInputElement | null)?.value ?? "";
    const domUsername = usernameInputRef.current?.value ?? (formEl.elements.namedItem("username") as HTMLInputElement | null)?.value ?? "";
    const domPassword = passwordInputRef.current?.value ?? (formEl.elements.namedItem("password") as HTMLInputElement | null)?.value ?? "";

    let formEmail = "";
    let formUsername = "";
    let formPassword = "";
    try {
      const formData = new FormData(formEl);
      formEmail = (formData.get("email") as string | null) ?? "";
      formUsername = (formData.get("username") as string | null) ?? "";
      formPassword = (formData.get("password") as string | null) ?? "";
    } catch {}

    const activeEmail = (domEmail || formEmail || email).trim();
    const activeUsername = (domUsername || formUsername || username).trim();
    const activePassword = domPassword || formPassword || password;

    // Sync state back to inputs if filled via autofill
    if (activeEmail !== email) setEmail(activeEmail);
    if (activeUsername !== username) setUsername(activeUsername);
    if (activePassword !== password) setPassword(activePassword);

    if (mode === "signup") {
      if (!activeEmail || !activeEmail.includes("@")) {
        setError("Please enter a valid email address.");
        return;
      }
      if (activeUsername.length < 3 || activeUsername.length > 24) {
        setError("Username must be between 3 and 24 characters.");
        return;
      }
      if (activePassword.length < 8) {
        setError("Password must be at least 8 characters.");
        return;
      }
    } else {
      if (!activeEmail) {
        setError("Please enter your email or username.");
        return;
      }
      if (!activePassword) {
        setError("Please enter your password.");
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const endpoint = mode === "signup" ? "/api/auth/signup" : "/api/auth/login";
      const body =
        mode === "signup"
          ? { email: activeEmail, username: activeUsername, password: activePassword }
          : { email: activeEmail, identifier: activeEmail, password: activePassword };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json.success) {
        let errorMsg = json.error;
        if (json.details && typeof json.details === "object") {
          const fieldMsgs = Object.values(json.details)
            .flat()
            .filter((msg): msg is string => typeof msg === "string" && Boolean(msg.trim()));
          if (fieldMsgs.length > 0) {
            errorMsg = fieldMsgs.join(". ");
          }
        }
        setError(
          errorMsg ||
            (mode === "signup"
              ? "Unable to create account. Please check your information."
              : "Invalid email, username, or password.")
        );
        setIsSubmitting(false);
        return;
      }

      const target = resolvePostLoginRedirect(searchParams, redirectTo);
      window.location.assign(target);
    } catch {
      setError("Unable to connect to the authentication service. Please try again.");
      setIsSubmitting(false);
    }
  };

  return (
    <form
      data-testid="login-form"
      onSubmit={handleSubmit}
      noValidate
      className={`w-full max-w-md rounded-2xl border border-slate-800 bg-[#121929]/95 p-8 shadow-2xl backdrop-blur-md ${className}`}
    >
      <div className="mb-6">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-8 h-8 rounded-lg bg-[#ff8c00] flex items-center justify-center font-bold text-black text-base shadow-[0_0_12px_rgba(255,140,0,0.3)]">
            R
          </div>
          <span className="text-xl font-bold tracking-tight text-white">ResumeForge</span>
        </div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">
          {mode === "signup" ? "Create your account" : "Welcome back"}
        </h1>
        <p className="mt-1.5 text-sm text-slate-400 leading-relaxed">
          {mode === "signup"
            ? "Sign up to store evidence, tailor resumes, and sync job applications."
            : "Sign in with your email or username to access your workspace."}
        </p>
      </div>

      {mode === "signup" ? (
        <div className="mb-4">
          <label htmlFor="username" className="block text-xs font-mono uppercase tracking-wider text-slate-300 font-semibold mb-1.5">
            Username
          </label>
          <div className="relative">
            <input
              ref={usernameInputRef}
              id="username"
              name="username"
              data-testid="login-username-input"
              type="text"
              autoComplete="username"
              required
              minLength={3}
              maxLength={24}
              defaultValue={username}
              onChange={(event) => {
                setUsername(event.target.value);
                if (error) setError(null);
              }}
              placeholder="e.g. janesmith"
              className="h-11 w-full rounded-lg border border-slate-700 bg-slate-900/90 px-3 pl-10 text-sm text-white placeholder:text-slate-500 outline-none transition focus-visible:border-amber-500 focus-visible:ring-2 focus-visible:ring-amber-500/30"
            />
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
          </div>
          <p className="mt-1.5 text-xs text-slate-500 font-mono">
            3–24 characters. Letters, numbers, underscores, or hyphens.
          </p>
        </div>
      ) : null}

      <div className="mb-4">
        <label htmlFor="email" className="block text-xs font-mono uppercase tracking-wider text-slate-300 font-semibold mb-1.5">
          {mode === "signup" ? "Email address" : "Email or username"}
        </label>
        <div className="relative">
          <input
            ref={emailInputRef}
            id="email"
            name="email"
            data-testid="login-email-input"
            type={mode === "signup" ? "email" : "text"}
            autoComplete={mode === "signup" ? "email" : "username"}
            required
            defaultValue={email}
            onChange={(event) => {
              setEmail(event.target.value);
              if (error) setError(null);
            }}
            placeholder={mode === "signup" ? "name@example.com" : "Email or username"}
            className="h-11 w-full rounded-lg border border-slate-700 bg-slate-900/90 px-3 pl-10 text-sm text-white placeholder:text-slate-500 outline-none transition focus-visible:border-amber-500 focus-visible:ring-2 focus-visible:ring-amber-500/30"
          />
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
        </div>
      </div>

      <div className="mb-5">
        <label htmlFor="password" className="block text-xs font-mono uppercase tracking-wider text-slate-300 font-semibold mb-1.5">
          Password
        </label>
        <div className="relative">
          <input
            ref={passwordInputRef}
            id="password"
            name="password"
            data-testid="login-password-input"
            type={showPassword ? "text" : "password"}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            spellCheck={false}
            required
            minLength={mode === "signup" ? 8 : undefined}
            defaultValue={password}
            onChange={(event) => {
              setPassword(event.target.value);
              if (error) setError(null);
            }}
            placeholder={mode === "signup" ? "Minimum 8 characters" : "Enter your password"}
            className="h-11 w-full rounded-lg border border-slate-700 bg-slate-900/90 px-3 pl-10 pr-12 text-sm text-white placeholder:text-slate-500 outline-none transition focus-visible:border-amber-500 focus-visible:ring-2 focus-visible:ring-amber-500/30"
          />
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
          <button
            type="button"
            data-testid="toggle-password-visibility-btn"
            onClick={() => setShowPassword((open) => !open)}
            className="absolute right-1 top-1/2 inline-flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:text-white focus-visible:ring-2 focus-visible:ring-amber-500/60"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {error ? (
        <div
          data-testid="login-error-msg"
          role="alert"
          className="mb-5 rounded-lg border border-rose-800/80 bg-rose-950/40 p-3 text-xs md:text-sm text-rose-300 leading-relaxed"
        >
          {error}
        </div>
      ) : null}

      <button
        type="submit"
        data-testid="login-submit-btn"
        disabled={isSubmitting}
        aria-busy={isSubmitting}
        className="flex h-11 w-full items-center justify-center rounded-lg bg-[#ff8c00] font-semibold text-black hover:bg-[#ffa024] focus-visible:ring-2 focus-visible:ring-amber-500/60 transition disabled:opacity-50 text-sm shadow-[0_0_15px_rgba(255,140,0,0.25)] cursor-pointer"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            {mode === "signup" ? "Creating account…" : "Signing in…"}
          </>
        ) : mode === "signup" ? (
          "Create Account"
        ) : (
          "Sign In"
        )}
      </button>

      <div className="mt-4 pt-4 border-t border-slate-800/80 flex flex-col gap-3 text-center">
        <button
          type="button"
          data-testid="login-mode-toggle-btn"
          className="text-xs md:text-sm text-slate-400 hover:text-amber-400 transition focus-visible:ring-2 focus-visible:ring-amber-500/60 rounded py-1 cursor-pointer"
          onClick={() => {
            setError(null);
            setMode(mode === "signup" ? "signin" : "signup");
          }}
        >
          {mode === "signup"
            ? "Already have an account? Sign in"
            : "Don't have an account? Create one"}
        </button>

        <Link
          href="/"
          data-testid="login-guest-btn"
          className="flex h-10 w-full items-center justify-center rounded-lg border border-slate-700/80 text-xs md:text-sm text-slate-300 hover:bg-slate-800/60 hover:text-white transition focus-visible:ring-2 focus-visible:ring-amber-500/60"
        >
          Continue as guest
        </Link>
      </div>
    </form>
  );
}
