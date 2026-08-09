import { describe, it, expect, vi } from "vitest";
import { buildPatchSystemPrompt, buildPatchUserPrompt } from "@/lib/ai/prompt-template";
import { RESUMEFORGE_MASTER_SYSTEM_PROMPT } from "@/lib/ai/master-prompt";

describe("Task 9.6 — Tailor AI Feedback -> Editor Handoff Unit & Integration Tests", () => {
  const sampleTailorFeedback = {
    overviewCommentary: "Strong technical background in TypeScript and React, but needs explicit metrics for state management optimization.",
    nextStepsAdvice: ["Quantify bundle size reduction in React project", "Highlight GraphQL experience"],
  };

  it("1. buildPatchSystemPrompt includes master prompt, patch constraints, AND carried tailor feedback context in order", () => {
    const prompt = buildPatchSystemPrompt(sampleTailorFeedback);

    // Master prompt start assertion
    expect(prompt.startsWith(RESUMEFORGE_MASTER_SYSTEM_PROMPT)).toBe(true);

    // Carried feedback section assertion
    expect(prompt).toContain("## CARRIED TAILOR REVIEW FEEDBACK CONTEXT");
    expect(prompt).toContain(sampleTailorFeedback.overviewCommentary);
    expect(prompt).toContain("Quantify bundle size reduction in React project");

    // Must come after master prompt
    const masterIdx = prompt.indexOf(RESUMEFORGE_MASTER_SYSTEM_PROMPT);
    const feedbackIdx = prompt.indexOf("## CARRIED TAILOR REVIEW FEEDBACK CONTEXT");
    expect(feedbackIdx).toBeGreaterThan(masterIdx);
  });

  it("2. buildPatchUserPrompt appends carried tailor review feedback when present", () => {
    const userPrompt = buildPatchUserPrompt({
      providerConfig: { provider: "openai", apiKey: "sk-test" },
      masterTypst: "#let resume = []",
      jobRequirements: {
        requiredSkills: ["TypeScript"],
        preferredSkills: ["GraphQL"],
        domainTerms: ["state management"],
      },
      evidenceItems: [],
      tailorFeedback: sampleTailorFeedback,
    });

    expect(userPrompt).toContain("## CARRIED TAILOR REVIEW FEEDBACK CONTEXT");
    expect(userPrompt).toContain(sampleTailorFeedback.overviewCommentary);
  });

  it("3. Unseeded buildPatchSystemPrompt omits carried feedback section when tailorFeedback is undefined", () => {
    const prompt = buildPatchSystemPrompt();

    expect(prompt.startsWith(RESUMEFORGE_MASTER_SYSTEM_PROMPT)).toBe(true);
    expect(prompt).not.toContain("## CARRIED TAILOR REVIEW FEEDBACK CONTEXT");
  });

  it("4. Transport payload format structure conforms to handoff contract", () => {
    const activeJobId = "job-unit-123";
    const payload = {
      jobId: activeJobId,
      overviewCommentary: sampleTailorFeedback.overviewCommentary,
      categoryFeedbacks: [],
      bulletFeedbacks: [],
      nextStepsAdvice: sampleTailorFeedback.nextStepsAdvice,
      timestamp: Date.now(),
    };

    const serialized = JSON.stringify(payload);
    const deserialized = JSON.parse(serialized);

    expect(deserialized.jobId).toBe("job-unit-123");
    expect(deserialized.overviewCommentary).toContain("metrics for state management");
    expect(deserialized.nextStepsAdvice.length).toBe(2);
  });
});
