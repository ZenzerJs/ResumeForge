import { afterEach, describe, expect, it, vi } from "vitest";
import { demoAllowsMutation } from "@/lib/demo-mode";
import { resolveProviderCredentials } from "@/lib/ai/providers/credentials";
import { clearDemoSamplesForPersonalResume, getDemoContextFromBrowser, initializeDemoSamples } from "@/lib/demo-client";
import { middleware } from "@/middleware";
import { NextRequest } from "next/server";
import { resolveServerProviderConfig } from "@/lib/ai/gateway";

const originalDemoMode = process.env.DEMO_MODE;
const originalGroqKey = process.env.GROQ_API_KEY;
const originalOllamaUrl = process.env.OLLAMA_BASE_URL;

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalDemoMode === undefined) delete process.env.DEMO_MODE;
  else process.env.DEMO_MODE = originalDemoMode;
  if (originalGroqKey === undefined) delete process.env.GROQ_API_KEY;
  else process.env.GROQ_API_KEY = originalGroqKey;
  if (originalOllamaUrl === undefined) delete process.env.OLLAMA_BASE_URL;
  else process.env.OLLAMA_BASE_URL = originalOllamaUrl;
});

describe("bounded demo mode", () => {
  it("blocks persistence routes regardless of the request's signed-in state", () => {
    process.env.DEMO_MODE = "true";
    for (const path of [
      "/api/resumes/save-master",
      "/api/evidence",
      "/api/jobs",
      "/api/ai/apply-patches",
      "/api/ai/chat",
      "/api/jobs/match",
    ]) {
      expect(demoAllowsMutation(path)).toBe(false);
    }
  });

  it("rejects a persistent API write even when the request carries a session cookie", async () => {
    process.env.DEMO_MODE = "true";
    const request = new NextRequest("http://localhost:3000/api/resumes/save-master", {
      method: "POST",
      headers: { origin: "http://localhost:3000", cookie: "rf_session=existing-signed-cookie" },
      body: JSON.stringify({ typstSource: "attempted overwrite" }),
    });
    const response = await middleware(request);
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: "GUEST_READ_ONLY" });
  });

  it("keeps only stateless visitor flows and existing maintenance routes available", () => {
    process.env.DEMO_MODE = "true";
    expect(demoAllowsMutation("/api/demo/generate-patches")).toBe(true);
    expect(demoAllowsMutation("/api/resumes/upload-pdf")).toBe(true);
    expect(demoAllowsMutation("/api/ai/byok-proxy")).toBe(true);
    expect(demoAllowsMutation("/api/jobs/extract")).toBe(true);
    expect(demoAllowsMutation("/api/jobs/cleanup")).toBe(true);
    expect(demoAllowsMutation("/api/jobs/sync-pittcsc")).toBe(true);
    expect(demoAllowsMutation("/api/auth/signup")).toBe(true); // Route returns explicit demo-disabled response.
  });

  it("ignores operator provider credentials and endpoint overrides in demo mode", () => {
    process.env.DEMO_MODE = "true";
    expect(resolveProviderCredentials({
      configBaseUrl: "https://api.openai.com/v1",
      envApiKey: "operator-secret",
      envBaseUrl: "https://operator.example/v1",
      defaultBaseUrl: "https://api.openai.com/v1",
      officialHosts: ["api.openai.com"],
    })).toEqual({ apiKey: undefined, baseUrl: "https://api.openai.com/v1" });

    expect(resolveProviderCredentials({
      configApiKey: "visitor-key",
      configBaseUrl: "https://api.openai.com/v1",
      envApiKey: "operator-secret",
      defaultBaseUrl: "https://api.openai.com/v1",
      officialHosts: ["api.openai.com"],
    }).apiKey).toBe("visitor-key");

    process.env.GROQ_API_KEY = "operator-groq-key";
    process.env.OLLAMA_BASE_URL = "https://operator-ollama.example/v1";
    expect(resolveServerProviderConfig({ provider: "groq" }).apiKey).toBeUndefined();
    expect(resolveServerProviderConfig({ provider: "ollama" }).baseUrl).toBe("http://localhost:11434/v1");
  });

  it("seeds only an empty browser and clears sample evidence when personal resume text starts", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    };
    vi.stubGlobal("window", {});
    vi.stubGlobal("localStorage", storage);

    initializeDemoSamples();
    const sampleSource = values.get("resumeforge_typst_source");
    const sampleEvidence = JSON.parse(values.get("resumeforge_guest_evidence") || "[]");
    expect(sampleSource).toContain("Synthetic sample");
    expect(sampleEvidence[0].id).toBe("demo-sample-evidence-project");
    expect(values.has("resumeforge_demo_master_facts")).toBe(true);

    clearDemoSamplesForPersonalResume(`${sampleSource}\n// @resumeforge-patched: true`);
    expect(JSON.parse(values.get("resumeforge_guest_evidence") || "[]")[0].id).toBe("demo-sample-evidence-project");
    expect(values.has("resumeforge_demo_master_facts")).toBe(true);

    sampleEvidence[0].bullets[0].verified = false;
    values.set("resumeforge_guest_evidence", JSON.stringify(sampleEvidence));
    expect(getDemoContextFromBrowser()?.evidenceItems).toHaveLength(1);
    expect(getDemoContextFromBrowser()?.evidenceItems[0].bullets).toHaveLength(0);

    clearDemoSamplesForPersonalResume("= My Personal Resume\n");
    expect(values.get("resumeforge_guest_evidence")).toBe("[]");
    expect(values.has("resumeforge_demo_master_facts")).toBe(false);
    expect(JSON.parse(values.get("resumeforge_guest_jobs") || "[]")).toEqual([]);

    values.set("resumeforge_typst_source", "existing local draft");
    values.set("resumeforge_guest_evidence", JSON.stringify([{ id: "personal", status: "verified" }]));
    initializeDemoSamples();
    expect(values.get("resumeforge_typst_source")).toBe("existing local draft");
    expect(JSON.parse(values.get("resumeforge_guest_evidence") || "[]")[0].id).toBe("personal");
  });
});
