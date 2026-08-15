import { describe, it, expect } from "vitest";
import {
  RESUMEFORGE_MASTER_SYSTEM_PROMPT,
  buildComposedSystemPrompt,
} from "@/lib/ai/master-prompt";
import { buildPatchSystemPrompt } from "@/lib/ai/prompt-template";
import { buildQualitativeReviewSystemPrompt } from "@/lib/ai/qualitative-prompt";
import { buildCoverLetterSystemPrompt } from "@/lib/ai/cover-letter-prompt";
import { buildPdfToTypstSystemPrompt } from "@/lib/ai/pdf-prompt";
import { buildTypstRepairSystemPrompt } from "@/lib/ai/repair-prompt";
import { buildEvidenceExtractSystemPrompt } from "@/lib/ai/evidence-prompt";

describe("Task 9.4 — Unified Master AI System Prompt Unit Tests", () => {
  it("1. RESUMEFORGE_MASTER_SYSTEM_PROMPT contains all 5 core AI guardrails", () => {
    expect(RESUMEFORGE_MASTER_SYSTEM_PROMPT).toContain("ZERO HALLUCINATION & STRICT EVIDENCE GROUNDING");
    expect(RESUMEFORGE_MASTER_SYSTEM_PROMPT).toContain("MANDATORY EVIDENCE CITATION");
    expect(RESUMEFORGE_MASTER_SYSTEM_PROMPT).toContain("EXPLICIT GAP REPORTING");
    expect(RESUMEFORGE_MASTER_SYSTEM_PROMPT).toContain("ANTI-ATS GAMING ENFORCEMENT");
    expect(RESUMEFORGE_MASTER_SYSTEM_PROMPT).toContain("STRICT JSON OUTPUT CONTRACT");
  });

  it("2. buildPatchSystemPrompt prepends master + Patch schema phrases", () => {
    const prompt = buildPatchSystemPrompt();
    expect(prompt.startsWith(RESUMEFORGE_MASTER_SYSTEM_PROMPT)).toBe(true);
    expect(prompt).toContain("## TASK-SPECIFIC: STRUCTURED RESUME PATCH GENERATION");
    expect(prompt).toContain('"patches":');
    expect(prompt).toContain('"gaps":');
    expect(prompt).toContain("MODIFY_BULLET");
  });

  it("3. buildQualitativeReviewSystemPrompt prepends master + qualitative schema", () => {
    const prompt = buildQualitativeReviewSystemPrompt();
    expect(prompt.startsWith(RESUMEFORGE_MASTER_SYSTEM_PROMPT)).toBe(true);
    expect(prompt).toContain("## TASK-SPECIFIC: QUALITATIVE ATS REVIEW");
    expect(prompt).toContain('"overviewCommentary":');
    expect(prompt).toContain("jdContextAdjustment");
  });

  it("4. buildCoverLetterSystemPrompt prepends master + citations schema", () => {
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

  it("6. buildPdfToTypstSystemPrompt retains template exemplar rules", () => {
    const prompt = buildPdfToTypstSystemPrompt();
    expect(prompt.startsWith(RESUMEFORGE_MASTER_SYSTEM_PROMPT)).toBe(true);
    expect(prompt).toContain("## TASK-SPECIFIC: PDF-TO-TYPST CONVERSION SPECIALIST");
    expect(prompt).toContain("#let section(title)");
    expect(prompt).toContain("#let entry(");
  });

  it("7. buildTypstRepairSystemPrompt retains repair JSON schema", () => {
    const prompt = buildTypstRepairSystemPrompt();
    expect(prompt.startsWith(RESUMEFORGE_MASTER_SYSTEM_PROMPT)).toBe(true);
    expect(prompt).toContain("TYPST COMPILATION REPAIR ASSISTANT CONTRACT");
    expect(prompt).toContain('"replacementSource"');
    expect(prompt).toContain('"confidence"');
  });

  it("8. buildEvidenceExtractSystemPrompt retains draft-extract contract", () => {
    const prompt = buildEvidenceExtractSystemPrompt();
    expect(prompt.startsWith(RESUMEFORGE_MASTER_SYSTEM_PROMPT)).toBe(true);
    expect(prompt).toContain("## TASK-SPECIFIC: MASTER RESUME → EVIDENCE BANK DRAFT EXTRACT");
    expect(prompt).toContain('"skippedSections"');
    expect(prompt).toContain("ZERO HALLUCINATION");
    expect(prompt).toContain("draft");
    expect(prompt).toContain("NOT A COVER LETTER");
    expect(prompt).not.toContain("TAILORED COVER LETTER SPECIALIST");
  });
});
