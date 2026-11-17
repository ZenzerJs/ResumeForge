import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { classifySkillBacking } from "@/components/tailor/ats-score-panel";

describe("ATS Score & Patch Diff Review clarity contracts", () => {
  it("distinguishes evaluated résumé wording from Evidence Bank-only backing", () => {
    const draftTypst = `
#resume-section("Experience")
*Backend Engineer*
- Built TypeScript APIs with Docker containers.

#resume-section("Skills")
Languages: TypeScript, GraphQL
`;

    expect(
      classifySkillBacking(
        {
          skill: "TypeScript",
          category: "required",
          status: "DEMONSTRATED_IN_EXPERIENCE",
          score: 10,
          maxScore: 10,
        },
        draftTypst,
        true,
        "working draft"
      )
    ).toMatchObject({
      backing: "in-resume-experience",
      inEvaluatedResume: true,
      evidenceBankOnly: false,
      badgeLabel: "In working draft",
    });

    expect(
      classifySkillBacking(
        {
          skill: "GraphQL",
          category: "preferred",
          status: "LISTED_IN_SKILLS_ONLY",
          score: 2.5,
          maxScore: 5,
        },
        draftTypst,
        true,
        "working draft"
      )
    ).toMatchObject({
      backing: "in-resume-skills",
      inEvaluatedResume: true,
      evidenceBankOnly: false,
      badgeLabel: "In résumé skills only",
    });

    // Bank has PostgreSQL, draft omits it -> must NOT claim it is in the draft
    const bankOnly = classifySkillBacking(
      {
        skill: "PostgreSQL",
        category: "required",
        status: "DEMONSTRATED_IN_EXPERIENCE",
        score: 10,
        maxScore: 10,
      },
      draftTypst,
      true,
      "master résumé"
    );
    expect(bankOnly.backing).toBe("evidence-bank-only");
    expect(bankOnly.inEvaluatedResume).toBe(false);
    expect(bankOnly.evidenceBankOnly).toBe(true);
    expect(bankOnly.badgeLabel).toBe("Evidence Bank only");
    expect(bankOnly.sourceNote).toContain("omitted from this master résumé");

    expect(
      classifySkillBacking(
        {
          skill: "Rust",
          category: "required",
          status: "UNSUPPORTED_GAP",
          score: 0,
          maxScore: 10,
        },
        draftTypst,
        true,
        "job-specific variant"
      )
    ).toMatchObject({
      backing: "unsupported",
      inEvaluatedResume: false,
      evidenceBankOnly: false,
      badgeLabel: "Unsupported Gap",
    });
  });

  it("enforces DESIGN.md typography tokens, source labels, citation details, and Editor handoff continuity", () => {
    const atsSrc = fs.readFileSync(
      path.join(process.cwd(), "src/components/tailor/ats-score-panel.tsx"),
      "utf8"
    );
    const atsCss = fs.readFileSync(
      path.join(process.cwd(), "src/components/tailor/ats-score-panel.module.css"),
      "utf8"
    );
    const patchSrc = fs.readFileSync(
      path.join(process.cwd(), "src/components/tailor/patch-diff-review.tsx"),
      "utf8"
    );

    expect(atsSrc).toContain("text-heading-lg");
    expect(atsSrc).not.toContain("text-[22px]");
    expect(atsCss).not.toContain("3rem");
    expect(atsSrc).toContain('data-testid="ats-evaluated-source"');
    expect(atsSrc).toContain("% skill match");
    expect(atsSrc).not.toContain("ResumeVariant");

    expect(patchSrc).toContain("text-body-dense");
    expect(patchSrc).not.toContain("sm:text-[15px]");
    expect(patchSrc).toContain("% evidence match");
    expect(patchSrc).toContain("Inspect source &amp; IDs");
    expect(patchSrc).toContain("buildEditorHref");
    expect(patchSrc).toContain("Open in Editor");
    expect(patchSrc).toContain("master résumé");
    expect(patchSrc).toContain("working draft");
    expect(patchSrc).toContain("job-specific variant");
  });
});
