import { describe, it, expect } from "vitest";
import React from "react";
import { AtsSandboxSection } from "@/components/landing/ats-sandbox-section";
import { extractTechnologies, COMMON_TECH_CATALOG } from "@/lib/evidence/tech-extractor";

describe("Landing ATS Sandbox & Typst Bundle Optimization", () => {
  it("exports AtsSandboxSection and instantiates without mounting WASM", () => {
    expect(typeof AtsSandboxSection).toBe("function");
    const element = React.createElement(AtsSandboxSection);
    expect(element).toBeTruthy();
    expect(element.type).toBe(AtsSandboxSection);
  });

  it("extracts technologies cleanly via pure helper without pdfjs-dist dependency", () => {
    const sampleText = "Engineered Next.js frontend with TypeScript and PostgreSQL backend deployed on Docker.";
    const extracted = extractTechnologies(sampleText);

    expect(extracted).toContain("Next.js");
    expect(extracted).toContain("TypeScript");
    expect(extracted).toContain("PostgreSQL");
    expect(extracted).toContain("Docker");
    expect(COMMON_TECH_CATALOG.length).toBeGreaterThan(50);
  });

  it("extractTechnologies properly tokenizes custom skill lines", () => {
    const rawSkills = ["Languages: Rust, Python, Go, C++", "Cloud: AWS, GCP, Cloudflare"];
    const extracted = extractTechnologies("General development", rawSkills);

    expect(extracted).toContain("Rust");
    expect(extracted).toContain("Python");
    expect(extracted).toContain("Go");
    expect(extracted).toContain("C++");
    expect(extracted).toContain("AWS");
    expect(extracted).toContain("GCP");
  });
});
