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

  it("preserves international location, phone, quotes, and bullet brackets during round-trip", () => {
    const complexTypst = `// ResumeForge Canonical Resume Template (Typst)
#set page(paper: "us-letter", margin: (x: 1.0cm, y: 0.95cm))
#set text(font: "Liberation Sans", size: 9pt, fill: rgb("#111827"))

#align(center)[
  #text(size: 18pt, weight: "bold", fill: rgb("#111827"))[Dr. Evelyn Vance] \\
  #v(2pt)
  #text(size: 9pt, fill: rgb("#475569"))[
    Berlin, Germany #sym.dot #link("mailto:evelyn.vance@example.com")[evelyn.vance\\@example.com] #sym.dot +49 30 1234567 #sym.dot #link("https://github.com/evance")[github.com/evance] #sym.dot #link("https://linkedin.com/in/evance")[linkedin.com/in/evance]
  ]
]

// EXPERIENCE
#section("Experience")

#entry(
  title: "Quantum \\"AI\\" Systems",
  role: "Lead Architect",
  location: "Zurich, Switzerland",
  date: "2023 - Present",
  details: [
    - Architected distributed consensus cluster [Raft, eBPF] with sub-millisecond failover.
    - Mentored 12 senior engineers on fault tolerance.
  ]
)

// PROJECTS
#section("Projects")

#entry(
  title: "ResumeForge [OSS Edition]",
  role: "Maintainer",
  location: "",
  date: "2026",
  details: [
    - Built local WASM engine with 100% test coverage.
  ]
)

// SKILLS
#section("Skills")
#entry(
  details: [
    - *Languages*: Rust, Go, Python, TypeScript
    - *Infrastructure:* Kubernetes, Docker, Terraform
  ]
)
`;

    const model = parseTypstToStructuredModel(complexTypst);
    expect(model.fullName).toBe("Dr. Evelyn Vance");
    expect(model.location).toBe("Berlin, Germany");
    expect(model.phone).toBe("+49 30 1234567");
    expect(model.experience[0].title).toBe('Quantum "AI" Systems');
    expect(model.experience[0].bullets[0]).toBe(
      "Architected distributed consensus cluster [Raft, eBPF] with sub-millisecond failover."
    );
    expect(model.projects[0].title).toBe("ResumeForge [OSS Edition]");
    expect(model.skills[0].category).toBe("Languages");
    expect(model.skills[0].items).toBe("Rust, Go, Python, TypeScript");

    // Round-trip serialize and re-parse
    const reserialized = serializeStructuredModelToTypst(model);
    expect(reserialized).toContain('title: "Quantum \\"AI\\" Systems"');
    expect(reserialized).toContain("- *Languages:* Rust, Go, Python, TypeScript");
    expect(reserialized).toContain("Berlin, Germany");
    expect(reserialized).toContain("+49 30 1234567");

    const reParsed = parseTypstToStructuredModel(reserialized);
    expect(reParsed.fullName).toBe("Dr. Evelyn Vance");
    expect(reParsed.location).toBe("Berlin, Germany");
    expect(reParsed.phone).toBe("+49 30 1234567");
    expect(reParsed.experience[0].title).toBe('Quantum "AI" Systems');
    expect(reParsed.experience[0].bullets[0]).toBe(
      "Architected distributed consensus cluster [Raft, eBPF] with sub-millisecond failover."
    );
    expect(reParsed.projects[0].title).toBe("ResumeForge [OSS Edition]");
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
