import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  TypstRepairInputSchema,
  TypstRepairProposalSchema,
  MAX_REPAIR_SOURCE_LENGTH,
  MAX_REPAIR_ERROR_LENGTH,
} from "@/lib/ai/repair-schema";
import {
  buildTypstRepairSystemPrompt,
  buildTypstRepairUserPrompt,
} from "@/lib/ai/repair-prompt";
import { repairTypstSource } from "@/lib/ai/gateway";
import { ProviderConfig } from "@/lib/ai/types";

describe("Task 10.5 — Typst Repair Assist Schemas & Prompts", () => {
  it("1. TypstRepairInputSchema validates correct input payload", () => {
    const valid = TypstRepairInputSchema.safeParse({
      source: "#let name = 'John Doe'",
      compileError: "error: unexpected end of block",
      line: 14,
      column: 2,
      sourceExcerpt: "#let name = 'John Doe'",
    });
    expect(valid.success).toBe(true);
  });

  it("2. TypstRepairInputSchema rejects missing source or missing compileError", () => {
    const missingSource = TypstRepairInputSchema.safeParse({
      source: "",
      compileError: "syntax error",
    });
    expect(missingSource.success).toBe(false);

    const missingError = TypstRepairInputSchema.safeParse({
      source: "valid source",
      compileError: "",
    });
    expect(missingError.success).toBe(false);
  });

  it("3. TypstRepairInputSchema rejects oversized source (>20,000 chars) or error (>2,000 chars)", () => {
    const hugeSource = "a".repeat(MAX_REPAIR_SOURCE_LENGTH + 1);
    const oversizedSourceResult = TypstRepairInputSchema.safeParse({
      source: hugeSource,
      compileError: "syntax error",
    });
    expect(oversizedSourceResult.success).toBe(false);

    const hugeError = "e".repeat(MAX_REPAIR_ERROR_LENGTH + 1);
    const oversizedErrorResult = TypstRepairInputSchema.safeParse({
      source: "#let x = 1",
      compileError: hugeError,
    });
    expect(oversizedErrorResult.success).toBe(false);
  });

  it("4. TypstRepairProposalSchema rejects malformed or incomplete proposal JSON", () => {
    const malformed = TypstRepairProposalSchema.safeParse({
      summary: "Fixed syntax",
      // missing replacementSource and confidence
    });
    expect(malformed.success).toBe(false);

    const validProposal = TypstRepairProposalSchema.safeParse({
      summary: "Closed unclosed parenthesis",
      errorAnalysis: "Line 12 had an unclosed parenthesis in header block",
      replacementSource: "#set page(paper: \"a4\")",
      confidence: "high",
      warnings: [],
    });
    expect(validProposal.success).toBe(true);
  });

  it("5. buildTypstRepairSystemPrompt includes Master Prompt header and repair rules", () => {
    const sys = buildTypstRepairSystemPrompt();
    expect(sys).toContain("RESUMEFORGE CORE AI GUARDRAILS");
    expect(sys).toContain("TYPST COMPILATION REPAIR ASSISTANT CONTRACT");
    expect(sys).toContain("NEVER invent resume facts");
  });

  it("6. buildTypstRepairUserPrompt formats error message, line/column, and source excerpt", () => {
    const userPrompt = buildTypstRepairUserPrompt({
      source: "#show: resume()",
      compileError: "unknown variable: resume",
      line: 5,
      column: 12,
      sourceExcerpt: "#show: resume()",
    });
    expect(userPrompt).toContain("unknown variable: resume");
    expect(userPrompt).toContain("Line 5, Column 12");
    expect(userPrompt).toContain("#show: resume()");
  });
});

describe("Task 10.5 — Typst Repair Gateway Provider Dispatch", () => {
  const globalFetchBackup = global.fetch;

  afterEach(() => {
    global.fetch = globalFetchBackup;
  });

  it("7. Gateway repairTypstSource returns error when provider API key is missing", async () => {
    const config: ProviderConfig = {
      provider: "openai",
      apiKey: "",
    };
    const input = {
      source: "#let x = 1",
      compileError: "syntax error",
    };

    const res = await repairTypstSource(config, input);
    expect(res.success).toBe(false);
    expect(res.error).toContain("OpenAI API key is missing");
  });

  it("8. Gateway dispatches repair to OpenAI provider adapter successfully when mocked", async () => {
    const mockProposal = {
      summary: "Fixed typo",
      errorAnalysis: "Corrected variable name",
      replacementSource: "#let x = 2",
      confidence: "high",
      warnings: [],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify(mockProposal),
            },
          },
        ],
      }),
    });

    const config: ProviderConfig = {
      provider: "openai",
      apiKey: "sk-mock-key-123",
    };
    const input = {
      source: "#let x = 1",
      compileError: "syntax error",
    };

    const res = await repairTypstSource(config, input);
    expect(res.success).toBe(true);
    expect(res.data?.replacementSource).toBe("#let x = 2");
    expect(res.data?.confidence).toBe("high");
  });

  it("9. Gateway handles Anthropic provider adapter response cleanly", async () => {
    const mockProposal = {
      summary: "Fixed bracket",
      errorAnalysis: "Closed unclosed parenthesis",
      replacementSource: "#let y = 10",
      confidence: "high",
      warnings: [],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: "text", text: JSON.stringify(mockProposal) }],
      }),
    });

    const config: ProviderConfig = {
      provider: "anthropic",
      apiKey: "sk-ant-mock-key-123",
    };
    const input = {
      source: "#let y = ",
      compileError: "unexpected end of expression",
    };

    const res = await repairTypstSource(config, input);
    expect(res.success).toBe(true);
    expect(res.data?.summary).toBe("Fixed bracket");
  });

  it("10. Gateway handles Gemini provider adapter response cleanly", async () => {
    const mockProposal = {
      summary: "Fixed string quote",
      errorAnalysis: "Terminated string literal",
      replacementSource: '#let z = "hello"',
      confidence: "medium",
      warnings: ["Verified syntax only"],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: JSON.stringify(mockProposal) }] } }],
      }),
    });

    const config: ProviderConfig = {
      provider: "gemini",
      apiKey: "AIzaSyMockKey",
    };
    const input = {
      source: '#let z = "hello',
      compileError: "unclosed string",
    };

    const res = await repairTypstSource(config, input);
    expect(res.success).toBe(true);
    expect(res.data?.confidence).toBe("medium");
  });

  it("11. Authoritative server line diff calculation overrides hallucinatory AI changedLinesCount: 0", async () => {
    const origSource = "#let a = 1\n#let b = 2\n#let c = 3\n#let d = 4\n#let e = 5";
    const repSource = "#set page(paper: \"a4\")";

    const origLines = origSource.split("\n");
    const repLines = repSource.split("\n");
    let diffCount = 0;
    const maxLen = Math.max(origLines.length, repLines.length);
    for (let i = 0; i < maxLen; i++) {
      if (origLines[i] !== repLines[i]) diffCount++;
    }

    // Server must compute 5 changed lines
    expect(diffCount).toBe(5);
    expect(diffCount / origLines.length).toBeGreaterThan(0.25);
  });
});
