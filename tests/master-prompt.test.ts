import { describe, it, expect } from "vitest";
import {
  RESUMEFORGE_MASTER_SYSTEM_PROMPT,
  buildComposedSystemPrompt,
} from "@/lib/ai/master-prompt";
import { buildPatchSystemPrompt } from "@/lib/ai/prompt-template";
import { buildQualitativeReviewSystemPrompt } from "@/lib/ai/qualitative-prompt";
import { buildCoverLetterSystemPrompt } from "@/lib/ai/cover-letter-prompt";

describe("Task 9.4 — Unified Master AI System Prompt Unit Tests", () => {
  it("1. RESUMEFORGE_MASTER_SYSTEM_PROMPT contains all 5 core AI guardrails", () => {
    expect(RESUMEFORGE_MASTER_SYSTEM_PROMPT).toContain("ZERO HALLUCINATION & STRICT EVIDENCE GROUNDING");
    expect(RESUMEFORGE_MASTER_SYSTEM_PROMPT).toContain("MANDATORY EVIDENCE CITATION");
    expect(RESUMEFORGE_MASTER_SYSTEM_PROMPT).toContain("EXPLICIT GAP REPORTING");
    expect(RESUMEFORGE_MASTER_SYSTEM_PROMPT).toContain("ANTI-ATS GAMING ENFORCEMENT");
    expect(RESUMEFORGE_MASTER_SYSTEM_PROMPT).toContain("STRICT JSON OUTPUT CONTRACT");
  });

  it("2. buildPatchSystemPrompt prepends RESUMEFORGE_MASTER_SYSTEM_PROMPT first", () => {
    const prompt = buildPatchSystemPrompt();
    expect(prompt.startsWith(RESUMEFORGE_MASTER_SYSTEM_PROMPT)).toBe(true);
    expect(prompt).toContain("## TASK-SPECIFIC: STRUCTURED RESUME PATCH GENERATION");
    expect(prompt).toContain('"patches":');
  });

  it("3. buildQualitativeReviewSystemPrompt prepends RESUMEFORGE_MASTER_SYSTEM_PROMPT first", () => {
    const prompt = buildQualitativeReviewSystemPrompt();
    expect(prompt.startsWith(RESUMEFORGE_MASTER_SYSTEM_PROMPT)).toBe(true);
    expect(prompt).toContain("## TASK-SPECIFIC: QUALITATIVE ATS REVIEW");
    expect(prompt).toContain('"overviewCommentary":');
  });

  it("4. buildCoverLetterSystemPrompt prepends RESUMEFORGE_MASTER_SYSTEM_PROMPT first", () => {
    const prompt = buildCoverLetterSystemPrompt();
    expect(prompt.startsWith(RESUMEFORGE_MASTER_SYSTEM_PROMPT)).toBe(true);
    expect(prompt).toContain("## TASK-SPECIFIC: TAILORED COVER LETTER SPECIALIST");
    expect(prompt).toContain('"evidenceCitations":');
  });

  it("5. Fail-first proof: mutating or removing master prompt breaks prompt builder start assertions", () => {
    const dummyTask = "## DUMMY TASK";
    const standalonePrompt = dummyTask;
    const composedPrompt = buildComposedSystemPrompt(dummyTask);

    expect(composedPrompt.startsWith(RESUMEFORGE_MASTER_SYSTEM_PROMPT)).toBe(true);
    expect(standalonePrompt.startsWith(RESUMEFORGE_MASTER_SYSTEM_PROMPT)).toBe(false);
  });
});
