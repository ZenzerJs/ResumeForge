import { describe, it, expect } from "vitest";

describe("ResumeForge Phase 0 Environment Smoke Test", () => {
  it("verifies test execution runner and environment invariants", () => {
    expect(true).toBe(true);
    expect(process.env.NODE_ENV).toBeDefined();
  });

  it("verifies product identity constant", () => {
    const appTitle = "ResumeForge — password-gated AI resume workspace";
    expect(appTitle).toContain("ResumeForge");
    expect(appTitle).toContain("password-gated");
  });
});
