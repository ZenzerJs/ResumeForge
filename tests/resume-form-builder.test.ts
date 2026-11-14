import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import {
  isResumeSourceSafeForForm,
  parseTypstToStructuredModel,
  serializeStructuredModelToTypst,
} from "@/components/editor/resume-form-builder";

describe("ResumeFormBuilder round-trip and safeToEdit", () => {
  const starter = fs.readFileSync(
    path.join(process.cwd(), "public/templates/starter-resume.typ"),
    "utf8"
  );

  it("allows editing public/templates/starter-resume.typ safely", () => {
    expect(isResumeSourceSafeForForm(starter)).toBe(true);
    const parsed = parseTypstToStructuredModel(starter);
    expect(parsed.fullName).toBe("Alex Morgan");
    expect(parsed.location).toBe("San Francisco, CA");
    expect(parsed.phone).toBe("(555) 019-2834");
    expect(parsed.skills.length).toBe(3);
    expect(parsed.skills[0]?.items).toContain("HTML/CSS");
  });

  it("round-trips T5 visual form edits without escaping corruption", () => {
    const base = parseTypstToStructuredModel(starter);
    const edited = {
      ...base,
      fullName: "Sarah Connor",
      location: "Berlin, Germany",
      phone: "+49 30 123456",
      summary: "Cybernetic defense engineer specializing in temporal resilience.",
    };
    const typst = serializeStructuredModelToTypst(edited);
    expect(typst).toContain("Sarah Connor");
    expect(typst).toContain("Berlin, Germany");
    expect(typst).toContain("+49 30 123456");
    expect(isResumeSourceSafeForForm(typst)).toBe(true);

    const reparsed = parseTypstToStructuredModel(typst);
    expect(reparsed.fullName).toBe("Sarah Connor");
    expect(reparsed.location).toBe("Berlin, Germany");
    expect(reparsed.phone).toBe("+49 30 123456");
    expect(reparsed.summary).toBe("Cybernetic defense engineer specializing in temporal resilience.");
  });

  it("does not misparse entry dates as phone when phone is empty", () => {
    const base = parseTypstToStructuredModel(starter);
    const edited = {
      ...base,
      phone: "",
      experience: base.experience.map((e, i) => (i === 0 ? { ...e, date: "2020-2024" } : e)),
    };
    const typst = serializeStructuredModelToTypst(edited);
    const reparsed = parseTypstToStructuredModel(typst);
    expect(reparsed.phone).toBe("");
    expect(isResumeSourceSafeForForm(typst)).toBe(true);
  });

  it("does not misparse phone as location when location and email are empty", () => {
    const base = parseTypstToStructuredModel(starter);
    const edited = {
      ...base,
      location: "",
      email: "",
      phone: "+49 30 123456",
    };
    const typst = serializeStructuredModelToTypst(edited);
    const reparsed = parseTypstToStructuredModel(typst);
    expect(reparsed.location).toBe("");
    expect(reparsed.phone).toBe("+49 30 123456");
    expect(isResumeSourceSafeForForm(typst)).toBe(true);
  });

  it("blocks custom or patched Typst sources from silent loss", () => {
    expect(isResumeSourceSafeForForm("= Protected Master\n")).toBe(false);
    expect(isResumeSourceSafeForForm(`// @resumeforge-patched: true\n${starter}`)).toBe(false);
    expect(isResumeSourceSafeForForm(`${starter}\n#let custom = 1 + 2\n`)).toBe(false);
  });
});
