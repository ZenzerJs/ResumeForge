import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  PROVIDER_HELP,
  hasNonDefaultAdvancedConfig,
  isCloudProvider,
  SettingsWorkspace,
} from "@/components/settings/settings-workspace";

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
});
