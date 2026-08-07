"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ProviderType } from "@/lib/ai/types";
import { ArrowLeft, CheckCircle2, XCircle, Loader2, Key, Server, ShieldCheck, Trash2, Briefcase } from "lucide-react";

const SETTINGS_STORAGE_KEY = "resumeforge_ai_settings";

export function SettingsWorkspace() {
  const [provider, setProvider] = useState<ProviderType>("openai");
  const [apiKey, setApiKey] = useState<string>("");
  const [baseUrl, setBaseUrl] = useState<string>("");
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    latencyMs?: number;
  } | null>(null);

  // Load saved settings from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.provider) setProvider(parsed.provider);
        if (parsed.apiKey) setApiKey(parsed.apiKey);
        if (parsed.baseUrl) setBaseUrl(parsed.baseUrl);
      }
    } catch (err) {
      console.error("Failed to load saved settings:", err);
    }
  }, []);

  // Save settings to localStorage on change
  const saveSettingsToStorage = (newProvider: ProviderType, newKey: string, newUrl: string) => {
    try {
      localStorage.setItem(
        SETTINGS_STORAGE_KEY,
        JSON.stringify({
          provider: newProvider,
          apiKey: newKey,
          baseUrl: newUrl,
        })
      );
    } catch (err) {
      console.error("Failed to persist settings:", err);
    }
  };

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextProvider = e.target.value as ProviderType;
    setProvider(nextProvider);
    setTestResult(null);
    saveSettingsToStorage(nextProvider, apiKey, baseUrl);
  };

  const handleKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextKey = e.target.value;
    setApiKey(nextKey);
    setTestResult(null);
    saveSettingsToStorage(provider, nextKey, baseUrl);
  };

  const handleBaseUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextUrl = e.target.value;
    setBaseUrl(nextUrl);
    setTestResult(null);
    saveSettingsToStorage(provider, apiKey, nextUrl);
  };

  const handleClearKey = () => {
    setApiKey("");
    setTestResult(null);
    saveSettingsToStorage(provider, "", baseUrl);
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      const res = await fetch("/api/ai/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          apiKey: apiKey.trim() || undefined,
          baseUrl: baseUrl.trim() || undefined,
        }),
      });

      const data = await res.json();
      setTestResult({
        success: data.success,
        message: data.message,
        latencyMs: data.latencyMs,
      });
    } catch (err) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : "Network error testing connection.",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const maskKey = (key: string) => {
    if (!key || key.length < 8) return "••••••••";
    return `${key.slice(0, 4)}••••••••${key.slice(-4)}`;
  };

  return (
    <div className="flex h-screen w-screen flex-col overflow-y-auto bg-slate-900 text-slate-100">
      {/* Top Navbar */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-slate-800 bg-slate-950 px-4">
        <div className="flex items-center gap-3">
          <Link
            href="/editor"
            className="flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Workspace
          </Link>
          <span className="text-xs text-slate-700">|</span>
          <Link
            href="/tracker"
            className="flex items-center gap-1 text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            <Briefcase className="h-4 w-4" />
            Tracker
          </Link>
          <span className="text-xs text-slate-700">|</span>
          <span className="text-sm font-semibold tracking-tight text-white">
            AI Provider Gateway Settings
          </span>
        </div>
      </header>

      {/* Main Form Content */}
      <main className="mx-auto w-full max-w-3xl flex-1 p-6 md:p-8">
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <Server className="h-6 w-6 text-indigo-400" />
              Bring-Your-Own-Key (BYOK) AI Configuration
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Configure your preferred LLM provider or local OpenAI-compatible endpoint. API keys are stored in browser localStorage for local single-user convenience and never saved in SQLite.
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950 p-6 space-y-6 shadow-sm">
            {/* Provider Selection */}
            <div>
              <label htmlFor="provider-select" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Select AI Provider
              </label>
              <select
                id="provider-select"
                value={provider}
                onChange={handleProviderChange}
                className="w-full rounded-md border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="openai">OpenAI (Direct API)</option>
                <option value="anthropic">Anthropic (Direct API)</option>
                <option value="gemini">Google Gemini (Direct API)</option>
                <option value="custom">Custom OpenAI-compatible endpoint (Local / self-hosted endpoint)</option>
              </select>
            </div>

            {/* API Key Input */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="api-key-input" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  API Key {provider === "custom" ? "(Optional)" : ""}
                </label>
                {apiKey && (
                  <button
                    type="button"
                    onClick={handleClearKey}
                    className="flex items-center gap-1 text-xs text-rose-400 hover:text-rose-300 transition-colors"
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
                  placeholder={
                    provider === "openai"
                      ? "sk-proj-..."
                      : provider === "anthropic"
                      ? "sk-ant-..."
                      : provider === "gemini"
                      ? "AIzaSy..."
                      : "Optional API Key for custom endpoint"
                  }
                  className="w-full rounded-md border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                />
              </div>
              {apiKey && (
                <div className="mt-1.5 flex items-center gap-2 text-xs text-slate-400">
                  <Key className="h-3.5 w-3.5 text-indigo-400" />
                  <span>Configured key: <code className="text-slate-300 font-mono">{maskKey(apiKey)}</code></span>
                </div>
              )}
            </div>

            {/* Custom Endpoint Base URL Input */}
            {(provider === "custom" || provider === "openai") && (
              <div>
                <label htmlFor="base-url-input" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Endpoint Base URL {provider === "custom" ? "" : "(Optional Override)"}
                </label>
                <input
                  id="base-url-input"
                  type="url"
                  value={baseUrl}
                  onChange={handleBaseUrlChange}
                  placeholder={provider === "custom" ? "http://localhost:8000" : "https://api.openai.com"}
                  className="w-full rounded-md border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                />
              </div>
            )}

            {/* Action Buttons & Status */}
            <div className="pt-2 flex items-center justify-between border-t border-slate-800">
              <button
                type="button"
                id="test-connection-btn"
                onClick={handleTestConnection}
                disabled={isTesting}
                className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {isTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Server className="h-4 w-4" />}
                {isTesting ? "Testing Connection..." : "Test Connection"}
              </button>

              <div className="flex items-center gap-2 text-xs text-slate-400">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                <span>Keys are never written to SQLite or server logs</span>
              </div>
            </div>

            {/* Test Result Indicator */}
            {testResult && (
              <div
                id="test-result-banner"
                className={`rounded-lg p-4 border text-sm ${
                  testResult.success
                    ? "border-emerald-800/50 bg-emerald-950/40 text-emerald-200"
                    : "border-rose-800/50 bg-rose-950/40 text-rose-200"
                }`}
              >
                <div className="flex items-start gap-3">
                  {testResult.success ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400 mt-0.5" />
                  ) : (
                    <XCircle className="h-5 w-5 shrink-0 text-rose-400 mt-0.5" />
                  )}
                  <div className="space-y-1">
                    <div className="font-semibold">
                      {testResult.success ? "Connection Verified" : "Connection Failed"}
                    </div>
                    <p className="text-xs opacity-90">{testResult.message}</p>
                    {testResult.latencyMs !== undefined && (
                      <div className="text-[11px] opacity-75">
                        Latency: {testResult.latencyMs}ms
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
