"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ProviderType } from "@/lib/ai/types";
import {
  saveKey,
  getKey,
  removeKey,
  getActiveConfig,
  markProviderConnectionStatus,
  notifyByokUpdated,
  providerSupportsBaseUrl,
  readStoredAiSettings,
  type ByokProvider,
  type StoredAiSettings,
} from "@/lib/byok-vault";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Loader2,
  Key,
  Server,
  ShieldCheck,
  Trash2,
  LogOut,
  LogIn,
  UserRound,
  Lock,
  ExternalLink,
  ChevronDown,
} from "lucide-react";
import { AppShell } from "@/components/design-system/app-shell";
import { PageHeader } from "@/components/design-system/page-header";
import { Surface } from "@/components/design-system/surface";
import { PageSkeleton } from "@/components/design-system/page-skeleton";
import {
  fetchDemoConfig,
  fetchSessionUser,
  signOutAndRedirect,
  usernameInitial,
  type SessionUser,
} from "@/components/auth/session-user";
import {
  clearActiveApplicationContext,
  parseTailorReturnContext,
  type TailorReturnContext,
} from "@/lib/tailor/application-context";

const SETTINGS_STORAGE_KEY = "resumeforge_ai_settings";

const DEFAULT_MODELS: Record<string, string> = {
  gemini: "gemini-2.5-flash",
  openai: "gpt-4o",
  groq: "llama-3.3-70b-versatile",
  anthropic: "claude-3-5-sonnet-20241022",
  ollama: "llama3",
  custom: "llama3",
};

export type CloudProviderId = "gemini" | "openai" | "anthropic" | "groq";

export interface ProviderHelpInfo {
  label: string;
  whatIsNeeded: string;
  getKeyUrl: string;
  prerequisites: string;
}

export const PROVIDER_HELP: Record<CloudProviderId, ProviderHelpInfo> = {
  gemini: {
    label: "Google Gemini",
    whatIsNeeded: "A Google account and a Gemini API key from Google AI Studio (AIzaSy... or AQ....).",
    getKeyUrl: "https://aistudio.google.com/app/apikey",
    prerequisites:
      "Google AI Studio includes a rate-limited Free tier with no credit card required (prompts may be used to improve Google products). Higher limits and private data handling require linking a Google Cloud billing account.",
  },
  openai: {
    label: "OpenAI",
    whatIsNeeded: "An OpenAI Platform account and a secret API key.",
    getKeyUrl: "https://platform.openai.com/api-keys",
    prerequisites:
      "Separate from a ChatGPT subscription. Requires an OpenAI Platform organization with a payment method and prepaid API billing credits before requests succeed.",
  },
  anthropic: {
    label: "Anthropic",
    whatIsNeeded: "A Claude Console account and an API key.",
    getKeyUrl: "https://platform.claude.com/settings/keys",
    prerequisites:
      "Separate from consumer Claude plans. Requires a Claude Console organization with prepaid usage credits configured in Billing before API calls succeed.",
  },
  groq: {
    label: "Groq",
    whatIsNeeded: "A GroqCloud account (Google, GitHub, or email) and an API key.",
    getKeyUrl: "https://console.groq.com/keys",
    prerequisites:
      "GroqCloud offers a rate-limited Free tier with no credit card required to sign up. Upgrading to the pay-as-you-go Developer tier requires adding a payment method in Billing.",
  },
};

export function isCloudProvider(provider: ProviderType): provider is CloudProviderId {
  return (
    provider === "gemini" ||
    provider === "openai" ||
    provider === "anthropic" ||
    provider === "groq"
  );
}

export function hasNonDefaultAdvancedConfig(
  provider: ProviderType,
  model: string,
  baseUrl: string
): boolean {
  const trimmedModel = model.trim();
  const defaultModel = DEFAULT_MODELS[provider] || "";
  const hasCustomModel = Boolean(trimmedModel && trimmedModel !== defaultModel);
  const hasOpenAiEndpointOverride = provider === "openai" && baseUrl.trim().length > 0;
  return hasCustomModel || hasOpenAiEndpointOverride;
}

export type ConnectionTestAvailability = "loading" | "sign-in-required" | "ready";

export function isKeyRejectionFailure(message: string): boolean {
  const text = message.trim();
  if (!text) return false;
  if (
    /only https urls|invalid url|private or loopback|allowlist|econnrefused|enotfound|etimedout|timed? out|aborted|fetch failed|network error|sign in to|origin|custom endpoint base urls|internal server error|returned status (404|429|5\d\d)|test failed \((404|429|5\d\d)\)/i.test(
      text
    )
  ) {
    return false;
  }
  return /api key is missing|api key is required|api_key_invalid|api key not valid|invalid api key|incorrect api key|invalid x-api-key|invalid_api_key|authentication_error|rejected key|returned status 401|test failed \(401\)|invalid authentication|auth failed|unauthorized/i.test(
    text
  );
}

function resolveProviderBaseUrl(saved: StoredAiSettings, targetProvider: ProviderType): string {
  if (!providerSupportsBaseUrl(targetProvider)) {
    return "";
  }
  const perProvider =
    saved.baseUrls && typeof saved.baseUrls === "object"
      ? saved.baseUrls[targetProvider]
      : undefined;
  if (typeof perProvider === "string") {
    const trimmed = perProvider.trim();
    if (trimmed) return trimmed;
    return targetProvider === "ollama" ? "http://localhost:11434" : "";
  }
  if (saved.provider === targetProvider && typeof saved.baseUrl === "string") {
    const legacy = saved.baseUrl.trim();
    if (targetProvider === "custom" && legacy === "http://localhost:11434") {
      return "";
    }
    if (legacy) return legacy;
  }
  return targetProvider === "ollama" ? "http://localhost:11434" : "";
}

function readVerificationState(
  saved: StoredAiSettings,
  targetProvider: ProviderType
): "untested" | "verified" | "failed" {
  const entry = saved.verifiedProviders?.[targetProvider];
  if (entry === true) return "verified";
  if (entry === false) return "failed";
  return "untested";
}

export function getConnectionTestState(params: {
  isHydrated: boolean;
  isSessionLoaded: boolean;
  isDemoLoaded: boolean;
  sessionUser: SessionUser | null;
  demoMode: boolean;
  provider?: ProviderType;
}): ConnectionTestAvailability {
  if (!params.isHydrated || !params.isSessionLoaded || !params.isDemoLoaded) {
    return "loading";
  }
  if (!params.sessionUser && !params.demoMode) {
    if (!params.provider || isCloudProvider(params.provider)) {
      return "ready";
    }
    return "sign-in-required";
  }
  return "ready";
}

export function SettingsWorkspace() {
  const [provider, setProvider] = useState<ProviderType>("gemini");
  const [apiKey, setApiKey] = useState<string>("");
  const [baseUrl, setBaseUrl] = useState<string>("");
  const [model, setModel] = useState<string>(DEFAULT_MODELS.gemini);
  const [hasVaultKey, setHasVaultKey] = useState<boolean>(false);
  const [verificationStatus, setVerificationStatus] = useState<"untested" | "verified" | "failed">("untested");
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    latencyMs?: number;
    isKeyError?: boolean;
  } | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [isSessionLoaded, setIsSessionLoaded] = useState(false);
  const [isDemoLoaded, setIsDemoLoaded] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [tailorReturnContext, setTailorReturnContext] = useState<TailorReturnContext | null>(null);
  const [usernameDraft, setUsernameDraft] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isSavingUsername, setIsSavingUsername] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  // Load saved settings and vault key on mount
  useEffect(() => {
    let cancelled = false;
    async function loadSettings() {
      try {
        const demoConfig = await fetchDemoConfig();
        const isDemo = demoConfig.demoMode === true;
        if (!cancelled) setDemoMode(isDemo);
        const config = await getActiveConfig();
        let activeProvider = (config.provider as ProviderType) || "gemini";
        let activeModel = config.model || DEFAULT_MODELS[activeProvider] || DEFAULT_MODELS.gemini;
        const parsed = readStoredAiSettings();
        if (parsed.provider) activeProvider = parsed.provider as ProviderType;
        if (parsed.model) activeModel = parsed.model;

        if (isDemo && (activeProvider === "ollama" || activeProvider === "custom")) {
          activeProvider = "gemini";
          activeModel = DEFAULT_MODELS.gemini;
        }

        const activeBaseUrl = resolveProviderBaseUrl(parsed, activeProvider);

        if (activeProvider === "gemini" && activeModel === "gemini-3.8-flash") {
          activeModel = "gemini-2.5-flash";
        }

        const key = await getKey(activeProvider);

        if (!cancelled) {
          setProvider(activeProvider);
          setModel(activeModel);
          setBaseUrl(activeBaseUrl);
          setApiKey(key || "");
          setHasVaultKey(Boolean(key && key.trim().length > 0));
          setVerificationStatus(readVerificationState(parsed, activeProvider));
          setIsAdvancedOpen(
            hasNonDefaultAdvancedConfig(activeProvider, activeModel, activeBaseUrl)
          );
        }
      } catch (err) {
        console.error("Failed to load BYOK settings:", err);
      } finally {
        if (!cancelled) {
          setIsDemoLoaded(true);
          setIsHydrated(true);
        }
      }
    }

    void loadSettings();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetchSessionUser().then((user) => {
      if (cancelled) return;
      setSessionUser(user);
      setUsernameDraft(user?.username ?? "");
      setIsSessionLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setTailorReturnContext(
      parseTailorReturnContext(window.location.search, {
        scope: {
          userId: sessionUser?.id ?? null,
          demoMode,
          scopeResolved: isSessionLoaded && isDemoLoaded,
        },
      })
    );
  }, [sessionUser, demoMode, isSessionLoaded, isDemoLoaded]);

  const handleSaveUsername = async () => {
    setIsSavingUsername(true);
    setUsernameStatus(null);
    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: usernameDraft }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        setUsernameStatus({ type: "error", message: json.error || "Unable to update username" });
        return;
      }
      setSessionUser(json.data);
      setUsernameDraft(json.data.username);
      setUsernameStatus({ type: "success", message: "Username saved." });
    } catch {
      setUsernameStatus({ type: "error", message: "Unable to update username" });
    } finally {
      setIsSavingUsername(false);
    }
  };

  // Save non-sensitive active config to localStorage (isolating baseUrl per provider)
  const saveSettingsToStorage = (
    newProvider: ProviderType,
    newUrl: string,
    newModel: string,
    options?: { clearVerification?: boolean }
  ) => {
    try {
      const current = readStoredAiSettings();
      const nextBaseUrls: Record<string, string> = {};
      if (current.baseUrls && typeof current.baseUrls === "object") {
        for (const [k, v] of Object.entries(current.baseUrls)) {
          if (providerSupportsBaseUrl(k) && typeof v === "string" && v.trim()) {
            nextBaseUrls[k] = v.trim();
          }
        }
      }

      const persistedUrl = providerSupportsBaseUrl(newProvider) ? newUrl.trim() : "";
      if (providerSupportsBaseUrl(newProvider)) {
        if (persistedUrl) {
          nextBaseUrls[newProvider] = persistedUrl;
        } else {
          delete nextBaseUrls[newProvider];
        }
      }

      const nextVerified: Record<string, boolean> =
        current.verifiedProviders && typeof current.verifiedProviders === "object"
          ? { ...current.verifiedProviders }
          : {};
      if (options?.clearVerification) {
        delete nextVerified[newProvider];
      }

      localStorage.setItem(
        SETTINGS_STORAGE_KEY,
        JSON.stringify({
          provider: newProvider,
          baseUrl: persistedUrl,
          baseUrls: nextBaseUrls,
          model: newModel,
          verifiedProviders: nextVerified,
        })
      );
      notifyByokUpdated();
    } catch (err) {
      console.error("Failed to persist settings:", err);
    }
  };

  const selectProvider = async (nextProvider: ProviderType) => {
    setProvider(nextProvider);
    setTestResult(null);

    const nextModel = DEFAULT_MODELS[nextProvider] || "";
    setModel(nextModel);

    const saved = readStoredAiSettings();
    const nextUrl = resolveProviderBaseUrl(saved, nextProvider);
    setBaseUrl(nextUrl);

    const storedKey = await getKey(nextProvider);
    setApiKey(storedKey || "");
    setHasVaultKey(Boolean(storedKey && storedKey.trim().length > 0));
    setVerificationStatus(readVerificationState(saved, nextProvider));
    if (hasNonDefaultAdvancedConfig(nextProvider, nextModel, nextUrl)) {
      setIsAdvancedOpen(true);
    }

    saveSettingsToStorage(nextProvider, nextUrl, nextModel);
  };

  const handleProviderChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    await selectProvider(e.target.value as ProviderType);
  };

  const handleKeyChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextKey = e.target.value;
    setApiKey(nextKey);
    setTestResult(null);
    setVerificationStatus("untested");

    if (nextKey.trim()) {
      await saveKey(provider as ByokProvider, nextKey);
      setHasVaultKey(true);
      saveSettingsToStorage(provider, baseUrl, model, { clearVerification: true });
    } else {
      await removeKey(provider);
      setHasVaultKey(false);
    }
  };

  const handleBaseUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextUrl = e.target.value;
    setBaseUrl(nextUrl);
    setTestResult(null);
    setVerificationStatus("untested");
    saveSettingsToStorage(provider, nextUrl, model, { clearVerification: true });
  };

  const handleModelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextModel = e.target.value;
    setModel(nextModel);
    setTestResult(null);
    saveSettingsToStorage(provider, baseUrl, nextModel);
  };

  const handleClearKey = async () => {
    setApiKey("");
    setHasVaultKey(false);
    setTestResult(null);
    setVerificationStatus("untested");
    await removeKey(provider);
  };

  const connectionTestState = getConnectionTestState({
    isHydrated,
    isSessionLoaded,
    isDemoLoaded,
    sessionUser,
    demoMode,
    provider,
  });

  const handleTestConnection = async () => {
    if (connectionTestState !== "ready") return;
    setIsTesting(true);
    setTestResult(null);

    try {
      const res = await fetch("/api/ai/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          apiKey: apiKey.trim() || undefined,
          baseUrl: providerSupportsBaseUrl(provider) ? baseUrl.trim() || undefined : undefined,
          model: model.trim() || undefined,
        }),
      });

      const data = await res.json();
      const ok = Boolean(data.success);
      const message =
        data.message ||
        data.error ||
        (res.status === 401
          ? "Sign in to test AI provider connections."
          : "Connection test failed.");
      markProviderConnectionStatus(provider, ok);
      setVerificationStatus(ok ? "verified" : "failed");
      setTestResult({
        success: ok,
        message,
        latencyMs: data.latencyMs,
        isKeyError: !ok && isKeyRejectionFailure(message),
      });
    } catch (err) {
      markProviderConnectionStatus(provider, false);
      setVerificationStatus("failed");
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : "Network error testing connection.",
        isKeyError: false,
      });
    } finally {
      setIsTesting(false);
    }
  };

  const maskKey = (key: string) => {
    if (!key || key.length < 8) return "••••••••";
    return `${key.slice(0, 4)}••••••••${key.slice(-4)}`;
  };

  if (!isHydrated) {
    return <PageSkeleton variant="settings" />;
  }

  const cloudHelp = isCloudProvider(provider) ? PROVIDER_HELP[provider] : null;

  return (
    <AppShell variant="settings" className="overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl flex-1 p-4 sm:p-6 md:p-8">
        <div className="space-y-6">
          <PageHeader
            title={demoMode ? "Connect an AI provider for the demo" : "Connect an AI provider key (stored in this browser)"}
            description={
              demoMode
                ? "Add a cloud provider API key to use AI. Resume drafts stay in this browser. Export a copy before clearing site data."
                : "Choose a provider and test the connection."
            }
            actions={
              tailorReturnContext ? (
                <Link
                  href={tailorReturnContext.href}
                  data-testid="settings-back-to-tailor-link"
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-hairline bg-elevated px-3.5 text-sm font-medium text-foreground hover:bg-panel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden />
                  {tailorReturnContext.label}
                </Link>
              ) : undefined
            }
          />

          <Surface variant="raised" className="edge-glow p-6 space-y-6">
            {/* Provider Selection */}
            <div className="rounded-lg border border-hairline bg-inset/60 p-4">
              <label htmlFor="provider-select" className="block font-mono text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                AI provider
              </label>
              <select
                id="provider-select"
                value={provider}
                onChange={handleProviderChange}
                className="w-full rounded-md border border-hairline bg-inset px-3.5 py-2.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <option value="gemini">Google Gemini (Direct API)</option>
                <option value="openai">OpenAI (BYOK)</option>
                <option value="anthropic">Anthropic (BYOK)</option>
                <option value="groq">Groq (BYOK)</option>
                {!demoMode && <option value="ollama">Ollama (Local Inference)</option>}
                {!demoMode && <option value="custom">Custom OpenAI-compatible endpoint (Local / self-hosted endpoint)</option>}
              </select>
            </div>

            {/* Required Endpoint for Custom / Ollama (never hidden under Advanced) */}
            {(provider === "custom" || provider === "ollama") && (
              <div className="rounded-lg border border-hairline bg-inset/60 p-4 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label htmlFor="base-url-input" className="block font-mono text-xs font-semibold text-text-secondary uppercase tracking-wider">
                    {provider === "ollama" ? "Ollama Endpoint" : "Endpoint Base URL"}
                  </label>
                  <span className="font-mono text-xs text-muted-foreground">Required</span>
                </div>
                <input
                  id="base-url-input"
                  data-testid="ollama-endpoint"
                  type="url"
                  value={baseUrl}
                  onChange={handleBaseUrlChange}
                  placeholder={provider === "ollama" ? "http://localhost:11434" : "http://localhost:8000"}
                  className="w-full rounded-md border border-hairline bg-inset px-3.5 py-2.5 text-sm text-foreground placeholder-text-muted outline-none focus-visible:ring-2 focus-visible:ring-primary font-mono"
                />
                {provider === "ollama" ? (
                  <div
                    data-testid="vault-status"
                    className={`flex items-center gap-2 text-xs pt-0.5 ${
                      verificationStatus === "verified"
                        ? "text-status-success-soft"
                        : verificationStatus === "failed"
                        ? "text-status-danger"
                        : "text-muted-foreground"
                    }`}
                  >
                    <Server
                      className={`h-4 w-4 shrink-0 ${
                        verificationStatus === "verified"
                          ? "text-status-success"
                          : verificationStatus === "failed"
                          ? "text-status-danger"
                          : "text-muted-foreground"
                      }`}
                      aria-hidden="true"
                    />
                    <span>
                      {verificationStatus === "verified"
                        ? "Local daemon endpoint verified (no API key required)"
                        : verificationStatus === "failed"
                        ? "Local daemon endpoint failed last check (no API key required)"
                        : "Local daemon endpoint (no API key required — run Test Connection to verify)"}
                    </span>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Enter the base URL for your OpenAI-compatible server. An API key below is optional.
                  </p>
                )}
              </div>
            )}

            {/* Contextual Help + API Key Input (Hidden for Ollama) */}
            {provider !== "ollama" && (
              <div className="rounded-lg border border-hairline bg-inset/60 p-4 space-y-4">
                {cloudHelp && (
                  <div
                    key={provider}
                    data-testid="provider-help"
                    data-provider={provider}
                    className="rounded-lg border border-hairline bg-panel/70 p-3.5 space-y-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold uppercase tracking-wider text-text-secondary">
                        {cloudHelp.label} setup
                      </span>
                      <a
                        href={cloudHelp.getKeyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        data-testid="provider-get-key-link"
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-hairline bg-elevated px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-panel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
                      >
                        Get an API key
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                      </a>
                    </div>
                    <p className="text-sm text-foreground leading-relaxed">
                      {cloudHelp.whatIsNeeded}
                    </p>
                    <p className="text-xs text-text-secondary leading-relaxed">
                      <span className="font-semibold text-foreground">Account &amp; billing: </span>
                      {cloudHelp.prerequisites}
                    </p>
                  </div>
                )}

                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <label htmlFor="api-key-input" className="block font-mono text-xs font-semibold text-text-secondary uppercase tracking-wider">
                      API Key {provider === "custom" ? "(Optional)" : ""}
                    </label>
                    {apiKey && (
                      <button
                        type="button"
                        id="clear-key-btn"
                        data-testid="clear-key-btn"
                        onClick={handleClearKey}
                        className="inline-flex min-h-11 sm:min-h-0 items-center gap-1 text-xs text-status-danger hover:text-status-danger/80 transition-colors"
                      >
                        <Trash2 className="h-3 w-3" />
                        Clear Key
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      id="api-key-input"
                      type="password"
                      value={apiKey}
                      onChange={handleKeyChange}
                      aria-invalid={testResult && !testResult.success && testResult.isKeyError ? true : undefined}
                      aria-describedby={testResult && !testResult.success ? "test-result-banner" : undefined}
                      placeholder={
                        provider === "openai"
                          ? "sk-proj-..."
                          : provider === "anthropic"
                          ? "sk-ant-..."
                          : provider === "gemini"
                          ? "AIzaSy... or AQ...."
                          : provider === "groq"
                          ? "gsk_..."
                          : "Optional API Key for custom endpoint"
                      }
                      className="w-full rounded-md border border-hairline bg-inset px-3.5 py-2.5 text-sm text-foreground placeholder-text-muted outline-none focus-visible:ring-2 focus-visible:ring-primary font-mono"
                    />
                  </div>
                  {apiKey && (
                    <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                      <Key className="h-3.5 w-3.5 text-status-warning" />
                      <span>
                        {verificationStatus === "failed"
                          ? "Saved key (last test failed): "
                          : "Configured key: "}
                        <code className="text-text-secondary font-mono">{maskKey(apiKey)}</code>
                      </span>
                    </div>
                  )}
                  {/* Visual Vault Status Indicator (distinct from connection test status) */}
                  <div data-testid="vault-status" className="mt-2 flex items-center gap-2 text-xs">
                    {hasVaultKey ? (
                      <div className="flex items-center gap-1.5 text-status-success-soft">
                        <Lock className="h-4 w-4 text-status-success" />
                        <span>Key encrypted in browser IndexedDB or in memory if browser storage is unavailable.</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Key className="h-4 w-4 text-muted-foreground" />
                        <span>No encrypted key in vault for {provider}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Advanced Disclosure: Optional Model Name + OpenAI Endpoint Override */}
            <details
              open={isAdvancedOpen}
              onToggle={(event) => {
                setIsAdvancedOpen(event.currentTarget.open);
              }}
              data-testid="advanced-settings-disclosure"
              className="group rounded-lg border border-hairline bg-inset/60"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg p-4 text-sm font-medium text-foreground hover:bg-elevated/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                <div className="flex flex-wrap items-center gap-2 min-w-0">
                  <span className="font-mono text-xs font-semibold uppercase tracking-wider text-text-secondary">
                    Advanced
                  </span>
                  <span className="text-xs text-muted-foreground font-normal">
                    {provider === "openai"
                      ? "Optional model name and endpoint override"
                      : "Optional model name"}
                  </span>
                </div>
                <ChevronDown
                  className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-150 group-open:rotate-180 motion-reduce:transition-none"
                  aria-hidden="true"
                />
              </summary>

              <div className="space-y-4 border-t border-hairline p-4">
                {provider === "openai" && (
                  <div>
                    <label htmlFor="base-url-input" className="block font-mono text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                      Endpoint Base URL <span className="font-sans text-muted-foreground font-normal normal-case">(optional override)</span>
                    </label>
                    <input
                      id="base-url-input"
                      data-testid="ollama-endpoint"
                      type="url"
                      value={baseUrl}
                      onChange={handleBaseUrlChange}
                      placeholder="https://api.openai.com"
                      className="w-full rounded-md border border-hairline bg-inset px-3.5 py-2.5 text-sm text-foreground placeholder-text-muted outline-none focus-visible:ring-2 focus-visible:ring-primary font-mono"
                    />
                  </div>
                )}

                <div>
                  <label htmlFor="model-input" className="block font-mono text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                    Model Name <span className="font-sans text-muted-foreground font-normal normal-case">(optional — leave blank for provider default)</span>
                  </label>
                  <input
                    id="model-input"
                    type="text"
                    value={model}
                    onChange={handleModelChange}
                    placeholder={DEFAULT_MODELS[provider] || "gemini-2.5-flash"}
                    className="w-full rounded-md border border-hairline bg-inset px-3.5 py-2.5 text-sm text-foreground placeholder-text-muted outline-none focus-visible:ring-2 focus-visible:ring-primary font-mono"
                  />
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Default for {provider}: <code className="text-text-secondary font-mono">{DEFAULT_MODELS[provider]}</code>
                  </p>
                </div>
              </div>
            </details>

            {/* Action Buttons & Status */}
            {connectionTestState === "sign-in-required" && (
              <p className="text-sm text-muted-foreground">
                Sign in to test local or custom AI endpoints on this self-hosted instance.
              </p>
            )}
            <div className="pt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-hairline">
              {connectionTestState === "sign-in-required" ? (
                <Link
                  href="/login?next=%2Fsettings"
                  data-testid="settings-signin-to-test-link"
                  className="inline-flex min-h-11 w-full sm:w-auto items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 text-sm font-semibold shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <LogIn className="h-4 w-4 shrink-0" aria-hidden />
                  Sign in to test connection
                </Link>
              ) : (
                <button
                  type="button"
                  id="test-connection-btn"
                  onClick={handleTestConnection}
                  disabled={isTesting || connectionTestState !== "ready"}
                  className="inline-flex min-h-11 w-full sm:w-auto items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 text-sm font-semibold shadow-sm disabled:opacity-50 transition-colors"
                >
                  {isTesting ? (
                    <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                  ) : (
                    <Server className="h-4 w-4 shrink-0" />
                  )}
                  {isTesting
                    ? "Testing Connection..."
                    : connectionTestState === "loading"
                      ? "Checking session..."
                      : "Test Connection"}
                </button>
              )}

              <div className="flex items-start sm:items-center gap-2 text-xs text-muted-foreground min-w-0">
                <ShieldCheck className="h-4 w-4 shrink-0 text-status-success mt-0.5 sm:mt-0" aria-hidden="true" />
                <span>Your key is sent for connection tests and AI requests. ResumeForge never saves it to its database or server logs.</span>
              </div>
            </div>

            {/* Test Result Indicator */}
            {testResult && (
              <div
                id="test-result-banner"
                role="status"
                aria-live="polite"
                className={`rounded-lg p-4 border text-sm ${
                  testResult.success
                    ? "status-success-surface"
                    : "border-status-danger/30 bg-status-danger/10 text-status-danger"
                }`}
              >
                <div className="flex items-start gap-3">
                  {testResult.success ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-status-success mt-0.5" />
                  ) : (
                    <XCircle className="h-5 w-5 shrink-0 text-status-danger mt-0.5" />
                  )}
                  <div className="space-y-1">
                    <div className="font-semibold">
                      {testResult.success ? "Connection Verified" : "Connection Failed"}
                    </div>
                    <p className="text-sm opacity-90">{testResult.message}</p>
                    {testResult.latencyMs !== undefined && (
                      <div className="text-xs opacity-75">
                        Latency: {testResult.latencyMs}ms
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </Surface>

          {(!demoMode || sessionUser) && (
            <Surface variant="raised" className="edge-glow p-6 space-y-5" data-testid="account-settings">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-text-secondary">Account</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {sessionUser
                      ? "Your username appears in the navigation."
                      : "Sign in to save resumes, evidence, and jobs."}
                  </p>
                </div>
                {sessionUser ? (
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-hairline bg-elevated font-bold text-ember">
                    {usernameInitial(sessionUser.username)}
                  </span>
                ) : (
                  <UserRound className="h-5 w-5 text-muted-foreground" aria-hidden />
                )}
              </div>

              {sessionUser ? (
                <div className="space-y-4">
                  <div>
                    <label htmlFor="settings-username" className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-2">
                      Username
                    </label>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        id="settings-username"
                        value={usernameDraft}
                        onChange={(event) => setUsernameDraft(event.target.value)}
                        className="h-11 w-full rounded-md border border-hairline bg-inset px-3.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      />
                      <button
                        type="button"
                        disabled={isSavingUsername || usernameDraft.trim() === sessionUser.username}
                        onClick={() => void handleSaveUsername()}
                        className="inline-flex h-11 shrink-0 items-center justify-center rounded-md bg-elevated px-4 text-sm font-semibold text-foreground hover:bg-panel focus-visible:ring-2 focus-visible:ring-primary/60 disabled:opacity-50"
                      >
                        {isSavingUsername ? "Saving…" : "Save username"}
                      </button>
                    </div>
                  </div>
                  {usernameStatus ? (
                    <p className={`text-xs ${usernameStatus.type === "success" ? "text-status-success-soft" : "text-status-danger"}`} role="status">
                      {usernameStatus.message}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    aria-label="Sign Out"
                    disabled={isSigningOut}
                    onClick={() => {
                      setIsSigningOut(true);
                      clearActiveApplicationContext();
                      void signOutAndRedirect("/");
                    }}
                    className="inline-flex min-h-11 items-center gap-2 rounded-md border border-hairline px-4 text-sm font-medium text-foreground hover:bg-elevated focus-visible:ring-2 focus-visible:ring-primary/60 disabled:opacity-50"
                  >
                    <LogOut className="h-4 w-4" aria-hidden />
                    Sign Out
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <Link
                    href="/login"
                    className="inline-flex min-h-11 items-center gap-2 rounded-md border border-hairline px-4 text-sm font-medium text-foreground hover:bg-elevated focus-visible:ring-2 focus-visible:ring-primary/60"
                  >
                    <LogIn className="h-4 w-4" aria-hidden />
                    Sign In
                  </Link>
                  <Link
                    href="/login?mode=signup"
                    className="inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-primary/60"
                  >
                    Sign Up
                  </Link>
                </div>
              )}
            </Surface>
          )}
        </div>
      </div>
    </AppShell>
  );
}
