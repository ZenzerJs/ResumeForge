import { describe, it, expect } from "vitest";
import {
  dossierSchema,
  generateOfflineDossier,
  buildCompanyDossierPrompt,
} from "@/lib/company-dossier";
import {
  parseHwwLine,
  COMPANY_ALLOWLIST,
} from "../scripts/seed-company-intel";

describe("Company Dossier Schema & Lenient Coercions (lib/company-dossier.ts)", () => {
  it("validates and parses a compliant company intelligence payload", () => {
    const valid = {
      companyName: "Stripe",
      interviewStyle: {
        format: "Practical / Systems",
        primaryEvaluationCriteria: ["Architecture", "Code Quality", "Communication"],
        roundBreakdown: ["1. Recruiter Screen", "2. Technical Deep Dive", "3. System Design"],
        proTips: ["Clarify assumptions first", "State complexity explicitly"],
      },
      engineeringCulture: {
        workLifeBalanceRating: 4.1,
        deploymentVelocity: "Continuous / Daily (est.)",
        remoteCulture: "Remote-first (est.)",
        pros: ["Strong technical bar", "High autonomy"],
        cons: ["High pacing on flagship launches"],
      },
      recentSignals: "Actively hiring for payment infrastructure and agentic billing APIs.",
    };

    const parsed = dossierSchema.parse(valid);
    expect(parsed.companyName).toBe("Stripe");
    expect(parsed.interviewStyle.format).toBe("Practical / Systems");
    expect(parsed.engineeringCulture.workLifeBalanceRating).toBe(4.1);
  });

  it("coerces string numbers and truncates oversized arrays safely", () => {
    const loose = {
      companyName: "Amazon",
      interviewStyle: {
        format: "LeetCode Heavy",
        primaryEvaluationCriteria: ["1", "2", "3", "4", "5", "6", "7", "8", "9"], // exceeds 6
        roundBreakdown: ["R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8", "R9", "R10"], // exceeds 8
        proTips: ["P1", "P2", "P3", "P4", "P5", "P6", "P7"], // exceeds 5
      },
      engineeringCulture: {
        workLifeBalanceRating: "3.7", // coerced string to number
        deploymentVelocity: "Multiple times daily",
        remoteCulture: "Return to Office 5 days (est.)",
        pros: ["Scale", "Cloud Leadership", "Leadership Principles", "Compensation", "Growth", "Extra 1", "Extra 2"],
        cons: ["Pacing", "Stack Ranking", "Oncall", "Documentation", "Process", "Extra 3"],
      },
      recentSignals: "AWS expanding custom silicon and GenAI foundation model infrastructure.",
    };

    const parsed = dossierSchema.parse(loose);
    expect(parsed.engineeringCulture.workLifeBalanceRating).toBe(3.7);
    expect(parsed.interviewStyle.primaryEvaluationCriteria.length).toBe(6);
    expect(parsed.interviewStyle.roundBreakdown.length).toBe(8);
    expect(parsed.interviewStyle.proTips.length).toBe(5);
    expect(parsed.engineeringCulture.pros.length).toBe(5);
    expect(parsed.engineeringCulture.cons.length).toBe(5);
  });

  it("rejects invalid interview format enum values", () => {
    const invalidFormat = {
      companyName: "InvalidCo",
      interviewStyle: {
        format: "Random Trivia Game", // Invalid
        primaryEvaluationCriteria: [],
        roundBreakdown: [],
        proTips: [],
      },
      engineeringCulture: {
        workLifeBalanceRating: 3,
        deploymentVelocity: "Weekly",
        remoteCulture: "Hybrid",
        pros: [],
        cons: [],
      },
      recentSignals: "None",
    };

    const result = dossierSchema.safeParse(invalidFormat);
    expect(result.success).toBe(false);
  });

  it("builds prompt with primary ground truth evidence", () => {
    const { systemPrompt, userPrompt } = buildCompanyDossierPrompt({
      companyName: "Automattic",
      processNotes: "Trial project (paid) and text-only Slack interviews. Zero whiteboards.",
      referenceNotes: "Distributed work pioneer.",
    });

    expect(systemPrompt).toContain("Expert Tech Career Advisor");
    expect(userPrompt).toContain("Automattic");
    expect(userPrompt).toContain("Zero whiteboards");
    expect(userPrompt).toContain("Distributed work pioneer");
  });

  it("generates structured offline fallback dossier", () => {
    const fallback = generateOfflineDossier({
      companyName: "Linear",
      processNotes: "Pair programming on real issue in private fork. No LeetCode.",
    });

    expect(fallback.companyName).toBe("Linear");
    expect(fallback.interviewStyle.format).toBe("Practical / Systems");
    expect(fallback.engineeringCulture.workLifeBalanceRating).toBeGreaterThanOrEqual(1);
    expect(fallback.recentSignals).toContain("Hiring Without Whiteboards listed");
  });
});

describe("Hiring Without Whiteboards & Handbook Parser (scripts/seed-company-intel.ts)", () => {
  it("parses valid HWW markdown line with link and process notes", () => {
    const line = "- [Automattic](https://automattic.com/work-with-us/) | Worldwide | Paid trial project and chat-based interviews.";
    const parsed = parseHwwLine(line);

    expect(parsed).not.toBeNull();
    expect(parsed?.displayName).toBe("Automattic");
    expect(parsed?.slug).toBe("automattic");
    expect(parsed?.processNotes).toBe("Paid trial project and chat-based interviews.");
  });

  it("parses valid HWW markdown line without markdown link", () => {
    const line = "* Basecamp | Chicago, IL & Remote | Take-home project review followed by team chat.";
    const parsed = parseHwwLine(line);

    expect(parsed).not.toBeNull();
    expect(parsed?.displayName).toBe("Basecamp");
    expect(parsed?.slug).toBe("basecamp");
    expect(parsed?.processNotes).toBe("Take-home project review followed by team chat.");
  });

  it("returns null for non-list or header lines", () => {
    expect(parseHwwLine("# Hiring Without Whiteboards")).toBeNull();
    expect(parseHwwLine("| Company | Location | Process |")).toBeNull();
    expect(parseHwwLine("")).toBeNull();
  });

  it("contains curated tier 1 tech companies in COMPANY_ALLOWLIST", () => {
    expect(COMPANY_ALLOWLIST).toContain("amazon");
    expect(COMPANY_ALLOWLIST).toContain("stripe");
    expect(COMPANY_ALLOWLIST).toContain("meta");
    expect(COMPANY_ALLOWLIST).toContain("shopify");
    expect(COMPANY_ALLOWLIST).toContain("anthropic");
    expect(COMPANY_ALLOWLIST).not.toContain("behavioral-questions");
  });
});
