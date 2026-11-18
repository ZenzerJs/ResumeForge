"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2, Lock, Mail, User } from "lucide-react";
import { fetchDemoConfig } from "@/components/auth/session-user";
import { readApiResponse } from "@/lib/api-error";

export type AuthMode = "signin" | "signup";

export function resolveEffectiveAuthMode(requestedMode: string | null | undefined, signupEnabled: boolean): AuthMode {
  if (!signupEnabled) return "signin";
  return requestedMode === "signup" ? "signup" : "signin";
}

export function validateSignupPasswords(password: string, confirmPassword: string): string | null {
  if (password.length < 8) {
    return "Password must be at least 8 characters.";
  }
  if (password !== confirmPassword) {
    return "Passwords do not match.";
  }
  return null;
}

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
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [signupEnabled, setSignupEnabled] = useState(true);

  const emailInputRef = useRef<HTMLInputElement>(null);
  const usernameInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const confirmPasswordInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchDemoConfig().then((config) => {
      if (!cancelled && config?.signupEnabled === false) {
        setSignupEnabled(false);
        setMode("signin");
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!signupEnabled) {
      setMode("signin");
      return;
    }
    const urlMode =
      searchParams.get("mode") ||
      (typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("mode")
        : null);
    if (urlMode === "signup" || urlMode === "signin") {
      setMode(resolveEffectiveAuthMode(urlMode, signupEnabled));
    }
  }, [searchParams, signupEnabled]);

  const effectiveMode: AuthMode = resolveEffectiveAuthMode(mode, signupEnabled);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    // Read values directly from DOM input elements as primary/fallback to handle password managers & browser autofill
    const formEl = event.currentTarget;
    const domEmail = emailInputRef.current?.value ?? (formEl.elements.namedItem("email") as HTMLInputElement | null)?.value ?? "";
    const domUsername = usernameInputRef.current?.value ?? (formEl.elements.namedItem("username") as HTMLInputElement | null)?.value ?? "";
    const domPassword = passwordInputRef.current?.value ?? (formEl.elements.namedItem("password") as HTMLInputElement | null)?.value ?? "";
    const domConfirmPassword =
      confirmPasswordInputRef.current?.value ??
      (formEl.elements.namedItem("confirmPassword") as HTMLInputElement | null)?.value ??
      "";

    let formEmail = "";
    let formUsername = "";
    let formPassword = "";
    let formConfirmPassword = "";
    try {
      const formData = new FormData(formEl);
      formEmail = (formData.get("email") as string | null) ?? "";
      formUsername = (formData.get("username") as string | null) ?? "";
      formPassword = (formData.get("password") as string | null) ?? "";
      formConfirmPassword = (formData.get("confirmPassword") as string | null) ?? "";
    } catch {}

    const activeEmail = (domEmail || formEmail || email).trim();
    const activeUsername = (domUsername || formUsername || username).trim();
    const activePassword = domPassword || formPassword || password;
    const activeConfirmPassword = domConfirmPassword || formConfirmPassword || confirmPassword;

    // Sync state back to inputs if filled via autofill
    if (activeEmail !== email) setEmail(activeEmail);
    if (activeUsername !== username) setUsername(activeUsername);
    if (activePassword !== password) setPassword(activePassword);
    if (activeConfirmPassword !== confirmPassword) setConfirmPassword(activeConfirmPassword);

    if (effectiveMode === "signup") {
      if (!activeEmail || !activeEmail.includes("@")) {
        setError("Please enter a valid email address.");
        return;
      }
      if (activeUsername.length < 3 || activeUsername.length > 24) {
        setError("Username must be between 3 and 24 characters.");
        return;
      }
      const passwordError = validateSignupPasswords(activePassword, activeConfirmPassword);
      if (passwordError) {
        setError(passwordError);
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
      const endpoint = effectiveMode === "signup" ? "/api/auth/signup" : "/api/auth/login";
      const body =
        effectiveMode === "signup"
          ? { email: activeEmail, username: activeUsername, password: activePassword }
          : { email: activeEmail, identifier: activeEmail, password: activePassword };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const defaultAuthError =
        effectiveMode === "signup"
          ? "Unable to create account. Please check your information."
          : "Invalid email, username, or password.";
      const { ok, error: apiError } = await readApiResponse<{ success?: boolean }>(
        res,
        defaultAuthError
      );

      if (!ok) {
        setError(apiError || defaultAuthError);
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
      className={`w-full max-w-md rounded-[10px] border border-border bg-card p-8 shadow-2xl ${className}`}
    >
      <div className="mb-6">
        <div className="flex items-center gap-2.5 mb-2">
          <div
            aria-hidden="true"
            className="w-8 h-8 rounded-[6px] bg-primary flex items-center justify-center font-bold text-primary-foreground text-base"
          >
            R
          </div>
          <span className="text-xl font-bold tracking-tight text-foreground">ResumeForge</span>
        </div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">
          {effectiveMode === "signup" ? "Create your account" : "Welcome back"}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
          {effectiveMode === "signup"
            ? "Sign up to store evidence, tailor resumes, and sync job applications."
            : "Sign in with your email or username to access your workspace."}
        </p>
      </div>

      {effectiveMode === "signup" ? (
        <div className="mb-4">
          <label htmlFor="username" className="block text-xs font-mono uppercase tracking-wider text-on-surface-variant font-semibold mb-1.5">
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
              className="h-11 w-full rounded-[6px] border border-outline/70 bg-input px-3 pl-10 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            />
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground font-mono">
            3–24 characters. Letters, numbers, underscores, or hyphens.
          </p>
        </div>
      ) : null}

      <div className="mb-4">
        <label htmlFor="email" className="block text-xs font-mono uppercase tracking-wider text-on-surface-variant font-semibold mb-1.5">
          {effectiveMode === "signup" ? "Email address" : "Email or username"}
        </label>
        <div className="relative">
          <input
            ref={emailInputRef}
            id="email"
            name="email"
            data-testid="login-email-input"
            type={effectiveMode === "signup" ? "email" : "text"}
            autoComplete={effectiveMode === "signup" ? "email" : "username"}
            required
            defaultValue={email}
            onChange={(event) => {
              setEmail(event.target.value);
              if (error) setError(null);
            }}
            placeholder={effectiveMode === "signup" ? "name@example.com" : "Email or username"}
            className="h-11 w-full rounded-[6px] border border-outline/70 bg-input px-3 pl-10 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          />
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        </div>
      </div>

      <div className="mb-5">
        <label htmlFor="password" className="block text-xs font-mono uppercase tracking-wider text-on-surface-variant font-semibold mb-1.5">
          Password
        </label>
        <div className="relative">
          <input
            ref={passwordInputRef}
            id="password"
            name="password"
            data-testid="login-password-input"
            type={showPassword ? "text" : "password"}
            autoComplete={effectiveMode === "signup" ? "new-password" : "current-password"}
            spellCheck={false}
            required
            minLength={effectiveMode === "signup" ? 8 : undefined}
            defaultValue={password}
            onChange={(event) => {
              setPassword(event.target.value);
              if (error) setError(null);
            }}
            placeholder={effectiveMode === "signup" ? "Minimum 8 characters" : "Enter your password"}
            className="h-11 w-full rounded-[6px] border border-outline/70 bg-input px-3 pl-10 pr-12 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          />
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <button
            type="button"
            data-testid="toggle-password-visibility-btn"
            onClick={() => setShowPassword((open) => !open)}
            className="absolute right-1 top-1/2 inline-flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-[6px] text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {effectiveMode === "signup" ? (
        <div className="mb-5">
          <label htmlFor="confirmPassword" className="block text-xs font-mono uppercase tracking-wider text-on-surface-variant font-semibold mb-1.5">
            Confirm Password
          </label>
          <div className="relative">
            <input
              ref={confirmPasswordInputRef}
              id="confirmPassword"
              name="confirmPassword"
              data-testid="login-confirm-password-input"
              type={showConfirmPassword ? "text" : "password"}
              autoComplete="new-password"
              spellCheck={false}
              required
              minLength={8}
              defaultValue={confirmPassword}
              onChange={(event) => {
                setConfirmPassword(event.target.value);
                if (error) setError(null);
              }}
              placeholder="Re-enter your password"
              className="h-11 w-full rounded-[6px] border border-outline/70 bg-input px-3 pl-10 pr-12 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            />
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <button
              type="button"
              data-testid="toggle-confirm-password-visibility-btn"
              onClick={() => setShowConfirmPassword((open) => !open)}
              className="absolute right-1 top-1/2 inline-flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-[6px] text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
            >
              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
      ) : (
        <div
          data-testid="login-recovery-notice"
          className="mb-5 border-t border-hairline pt-3 text-xs text-on-surface-variant leading-relaxed"
        >
          <p className="font-semibold text-foreground">Forgot your password?</p>
          <p className="mt-0.5 text-muted-foreground">
            Self-serve email password reset is not enabled yet. If you are locked out, contact your instance
            administrator or continue as a guest in this browser.
          </p>
        </div>
      )}

      {error ? (
        <div
          data-testid="login-error-msg"
          role="alert"
          className="mb-5 rounded-[6px] border border-status-danger/50 bg-status-danger/10 p-3 text-xs md:text-sm text-status-danger leading-relaxed"
        >
          {error}
        </div>
      ) : null}

      <button
        type="submit"
        data-testid="login-submit-btn"
        disabled={isSubmitting}
        aria-busy={isSubmitting}
        className="flex h-11 w-full items-center justify-center rounded-[6px] bg-primary font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background transition disabled:opacity-50 text-sm cursor-pointer"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            {effectiveMode === "signup" ? "Creating account…" : "Signing in…"}
          </>
        ) : effectiveMode === "signup" ? (
          "Create Account"
        ) : (
          "Sign In"
        )}
      </button>

      <div className="mt-4 pt-4 border-t border-border flex flex-col gap-3 text-center">
        {signupEnabled ? <button
          type="button"
          data-testid="login-mode-toggle-btn"
          className="text-xs md:text-sm text-muted-foreground hover:text-primary transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded py-1 cursor-pointer"
          onClick={() => {
            setError(null);
            setConfirmPassword("");
            setMode(effectiveMode === "signup" ? "signin" : "signup");
          }}
        >
          {effectiveMode === "signup"
            ? "Already have an account? Sign in"
            : "Don't have an account? Create one"}
        </button> : <p className="text-sm text-muted-foreground">Public signup is disabled in the demo. Self-host ResumeForge to create an account.</p>}

        <Link
          href="/"
          data-testid="login-guest-btn"
          className="flex h-10 w-full items-center justify-center rounded-[6px] border border-outline/70 text-xs md:text-sm text-on-surface-variant hover:bg-elevated hover:text-foreground transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Continue as guest
        </Link>
      </div>
    </form>
  );
}
