import { describe, it, expect, vi, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  PROVIDER_HELP,
  hasNonDefaultAdvancedConfig,
  isCloudProvider,
  getConnectionTestState,
  SettingsWorkspace,
} from "@/components/settings/settings-workspace";
import { POST as testConnectionPOST } from "@/app/api/ai/test-connection/route";
import * as aiGateway from "@/lib/ai/gateway";
import { authedRequest, createTestUser } from "./helpers/auth";
import { prisma } from "@/lib/prisma";

describe("Settings provider onboarding helpers", () => {
  it("defines verified official key URLs and prerequisites for all 4 cloud providers", () => {
    expect(PROVIDER_HELP.gemini.getKeyUrl).toBe("https://aistudio.google.com/app/apikey");
    expect(PROVIDER_HELP.openai.getKeyUrl).toBe("https://platform.openai.com/api-keys");
    expect(PROVIDER_HELP.anthropic.getKeyUrl).toBe("https://platform.claude.com/settings/keys");
    expect(PROVIDER_HELP.groq.getKeyUrl).toBe("https://console.groq.com/keys");

    for (const key of ["gemini", "openai", "anthropic", "groq"] as const) {
      const info = PROVIDER_HELP[key];
      expect(info.getKeyUrl.startsWith("https://")).toBe(true);
      expect(info.whatIsNeeded.length).toBeGreaterThan(10);
      expect(info.prerequisites.length).toBeGreaterThan(10);
    }
  });

  it("identifies cloud providers vs local/custom providers", () => {
    expect(isCloudProvider("gemini")).toBe(true);
    expect(isCloudProvider("openai")).toBe(true);
    expect(isCloudProvider("anthropic")).toBe(true);
    expect(isCloudProvider("groq")).toBe(true);
    expect(isCloudProvider("ollama")).toBe(false);
    expect(isCloudProvider("custom")).toBe(false);
  });

  it("detects non-default model or OpenAI endpoint overrides for auto-expanding Advanced", () => {
    expect(hasNonDefaultAdvancedConfig("gemini", "gemini-2.5-flash", "")).toBe(false);
    expect(hasNonDefaultAdvancedConfig("gemini", "", "")).toBe(false);
    expect(hasNonDefaultAdvancedConfig("gemini", "gemini-2.5-pro", "")).toBe(true);

    expect(hasNonDefaultAdvancedConfig("openai", "gpt-4o", "")).toBe(false);
    expect(hasNonDefaultAdvancedConfig("openai", "gpt-4o", "   ")).toBe(false);
    expect(hasNonDefaultAdvancedConfig("openai", "gpt-4o", "https://proxy.example.com/v1")).toBe(true);
    expect(hasNonDefaultAdvancedConfig("openai", "gpt-4o-mini", "")).toBe(true);

    // Ollama and Custom keep their endpoints outside Advanced, so endpoint values do not auto-expand Advanced
    expect(hasNonDefaultAdvancedConfig("ollama", "llama3", "http://localhost:11434")).toBe(false);
    expect(hasNonDefaultAdvancedConfig("custom", "llama3", "http://localhost:8000")).toBe(false);
    expect(hasNonDefaultAdvancedConfig("custom", "mistral", "http://localhost:8000")).toBe(true);
  });

  it("renders SettingsWorkspace skeleton cleanly on initial server render", () => {
    const html = renderToStaticMarkup(React.createElement(SettingsWorkspace));
    expect(html).toContain("workspace-atmosphere");
  });

  it("gates connection test readiness on resolved session & demoMode and offers sign-in for self-hosted guests", () => {
    const mockUser = { id: "u-1", email: "u@example.com", username: "u1" };

    expect(
      getConnectionTestState({
        isHydrated: true,
        isSessionLoaded: false,
        isDemoLoaded: true,
        sessionUser: null,
        demoMode: false,
      })
    ).toBe("loading");

    expect(
      getConnectionTestState({
        isHydrated: true,
        isSessionLoaded: true,
        isDemoLoaded: false,
        sessionUser: null,
        demoMode: false,
      })
    ).toBe("loading");

    expect(
      getConnectionTestState({
        isHydrated: true,
        isSessionLoaded: true,
        isDemoLoaded: true,
        sessionUser: null,
        demoMode: false,
      })
    ).toBe("sign-in-required");

    expect(
      getConnectionTestState({
        isHydrated: true,
        isSessionLoaded: true,
        isDemoLoaded: true,
        sessionUser: null,
        demoMode: true,
      })
    ).toBe("ready");

    expect(
      getConnectionTestState({
        isHydrated: true,
        isSessionLoaded: true,
        isDemoLoaded: true,
        sessionUser: mockUser,
        demoMode: false,
      })
    ).toBe("ready");

    const src = fs.readFileSync(
      path.join(process.cwd(), "src/components/settings/settings-workspace.tsx"),
      "utf8"
    );
    expect(src).toContain("whitespace-nowrap");
    expect(src).toContain("Sign in to test connection");
    expect(src).toContain("parseTailorReturnContext");
    expect(src).toContain("clearActiveApplicationContext");
  });
});

describe("Settings /api/ai/test-connection auth + fixture provider", () => {
  const createdUserIds: string[] = [];

  afterEach(async () => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
      createdUserIds.length = 0;
    }
  });

  it("rejects signed-out self-hosted requests with 401 before touching the fixture provider", async () => {
    vi.stubEnv("DEMO_MODE", "false");
    const spy = vi.spyOn(aiGateway, "testProviderConnection");

    const req = new Request("http://localhost:3000/api/ai/test-connection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "openai", apiKey: "sk-fixture-test" }),
    });

    const res = await testConnectionPOST(req);
    expect(res.status).toBe(401);
    expect(spy).not.toHaveBeenCalled();
  });

  it("allows signed-in users and reports fixture provider success and recoverable failure", async () => {
    vi.stubEnv("DEMO_MODE", "false");
    const { user, cookie } = await createTestUser("settings-test@resumeforge.test");
    createdUserIds.push(user.id);

    const spy = vi
      .spyOn(aiGateway, "testProviderConnection")
      .mockResolvedValueOnce({
        success: true,
        provider: "openai",
        message: "Fixture provider connected",
        modelCount: 3,
        latencyMs: 42,
      })
      .mockResolvedValueOnce({
        success: false,
        provider: "openai",
        message: "Fixture provider rejected key (401)",
        latencyMs: 18,
      });

    const okReq = authedRequest(
      "http://localhost:3000/api/ai/test-connection",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "openai", apiKey: "sk-fixture-ok" }),
      },
      cookie
    );
    const okRes = await testConnectionPOST(okReq);
    expect(okRes.status).toBe(200);
    expect(await okRes.json()).toMatchObject({
      success: true,
      provider: "openai",
      message: "Fixture provider connected",
      latencyMs: 42,
    });

    const failReq = authedRequest(
      "http://localhost:3000/api/ai/test-connection",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "openai", apiKey: "sk-fixture-bad" }),
      },
      cookie
    );
    const failRes = await testConnectionPOST(failReq);
    expect(failRes.status).toBe(200);
    expect(await failRes.json()).toMatchObject({
      success: false,
      provider: "openai",
      message: "Fixture provider rejected key (401)",
    });
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("preserves public-demo test connection path when origin matches", async () => {
    vi.stubEnv("DEMO_MODE", "true");
    vi.spyOn(aiGateway, "testProviderConnection").mockResolvedValueOnce({
      success: true,
      provider: "gemini",
      message: "Demo fixture connected",
      latencyMs: 25,
    });

    const req = new Request("http://localhost:3000/api/ai/test-connection", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        origin: "http://localhost:3000",
        host: "localhost:3000",
      },
      body: JSON.stringify({ provider: "gemini", apiKey: "AIzaSyFixtureDemoKey" }),
    });
    const res = await testConnectionPOST(req);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      success: true,
      provider: "gemini",
      message: "Demo fixture connected",
    });
  });
});
