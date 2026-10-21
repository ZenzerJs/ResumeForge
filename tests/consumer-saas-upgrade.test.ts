import { describe, it, expect, beforeEach } from "vitest";
import {
  resolveClientProviderConfig,
  saveKey,
} from "@/lib/byok-vault";
import {
  parseTypstToStructuredModel,
  serializeStructuredModelToTypst,
} from "@/components/editor/resume-form-builder";

describe("Consumer SaaS Upgrade (P0–P3)", () => {
  const store: Record<string, string> = {};

  beforeEach(() => {
    Object.keys(store).forEach((k) => delete store[k]);
    const mockStorage = {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, val: string) => {
        store[key] = String(val);
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        Object.keys(store).forEach((k) => delete store[k]);
      },
    };
    (globalThis as any).window = { localStorage: mockStorage };
    (globalThis as any).localStorage = mockStorage;
  });

  it("normalizes invalid gemini-3.8-flash model ID to gemini-2.5-flash in resolveClientProviderConfig", async () => {
    store["resumeforge_ai_settings"] = JSON.stringify({
      provider: "gemini",
      model: "gemini-3.8-flash",
    });
    await saveKey("gemini", "AIzaSyTestKey123456");

    const config = await resolveClientProviderConfig();
    expect(config).toBeDefined();
    expect(config?.provider).toBe("gemini");
    expect(config?.apiKey).toBe("AIzaSyTestKey123456");
    expect(config?.model).toBe("gemini-2.5-flash");
  });

  it("parses and serializes structured resume form fields and formatting controls round-trip", () => {
    const sampleTypst = `#set page(paper: "us-letter", margin: (x: 0.5in, y: 0.5in))
#set text(font: "Inter", size: 10pt)

= Alex Rivera
alex@example.com | San Francisco, CA | github.com/alexr

== SUMMARY
Staff engineer building distributed systems and developer tools.

== EXPERIENCE
*Stripe* -- *Senior Software Engineer* (2022 – Present)
- Reduced payment API p99 latency by 38% across 4 regions.
- Led migration of 12 microservices to TypeScript and Go.

== EDUCATION
*University of Waterloo* -- *B.S. Computer Science* (2018 – 2022)
- Graduated with Distinction

== SKILLS
- *Core:* TypeScript, Go, PostgreSQL, Kubernetes
`;

    const parsed = parseTypstToStructuredModel(sampleTypst);
    expect(parsed.fullName).toBe("Alex Rivera");
    expect(parsed.fontSize).toBe("10pt");
    expect(parsed.marginPreset).toBe("balanced");
    expect(parsed.experience.length).toBeGreaterThanOrEqual(1);
    expect(parsed.experience[0].title).toBe("Stripe");
    expect(parsed.experience[0].role).toBe("Senior Software Engineer");
    expect(parsed.education.length).toBeGreaterThanOrEqual(1);
    expect(parsed.education[0].title).toBe("University of Waterloo");
    expect(parsed.skills.some((s) => s.items.includes("TypeScript"))).toBe(true);

    // Modify formatting controls and verify serialized output
    parsed.fontSize = "10.5pt";
    parsed.marginPreset = "compact";
    const serialized = serializeStructuredModelToTypst(parsed);
    expect(serialized).toContain("size: 10.5pt");
    expect(serialized).toContain("x: 1.0cm");
    expect(serialized).toContain("Alex Rivera");
    expect(serialized).toContain('title: "Stripe"');
  });

  it("resolves credentials and custom baseUrl from legacy resumeforge_ai_settings when vault key is absent", async () => {
    store["resumeforge_ai_settings"] = JSON.stringify({
      provider: "openai",
      apiKey: "sk-legacy-settings-key",
      model: "gpt-4o-mini",
      baseUrl: "https://custom.openai.proxy/v1",
    });

    const config = await resolveClientProviderConfig();
    expect(config).toEqual({
      provider: "openai",
      apiKey: "sk-legacy-settings-key",
      model: "gpt-4o-mini",
      baseUrl: "https://custom.openai.proxy/v1",
    });
  });

  it("exports both PUT and PATCH handlers on /api/evidence/[id] for duplicate merge & status updates", async () => {
    const routeModule = await import("@/app/api/evidence/[id]/route");
    expect(typeof routeModule.PUT).toBe("function");
    expect(typeof routeModule.PATCH).toBe("function");
    expect(typeof routeModule.DELETE).toBe("function");
  });
});
