import { describe, it, expect } from "vitest";
import {
  STAGE_COPY,
  STAGE_ORDER,
  type AiJobStage,
} from "@/components/ui/ai-progress";

describe("WS0.2 — AI Progress Staged State Machine & Configuration", () => {
  it("defines all mandatory AI job stages", () => {
    const requiredStages: AiJobStage[] = [
      "queued",
      "connecting",
      "extracting",
      "matching",
      "writing",
      "verifying",
      "done",
      "error",
    ];

    for (const stage of requiredStages) {
      expect(STAGE_COPY[stage]).toBeDefined();
      expect(typeof STAGE_COPY[stage]).toBe("string");
      expect(STAGE_COPY[stage].length).toBeGreaterThan(0);
    }
  });

  it("maintains correct linear stage progression order", () => {
    expect(STAGE_ORDER).toEqual([
      "queued",
      "connecting",
      "extracting",
      "matching",
      "writing",
      "verifying",
      "done",
    ]);
  });

  it("maps distinct user-facing copy for each stage", () => {
    expect(STAGE_COPY.queued).toMatch(/waiting/i);
    expect(STAGE_COPY.connecting).toMatch(/connecting/i);
    expect(STAGE_COPY.extracting).toMatch(/reading/i);
    expect(STAGE_COPY.matching).toMatch(/matching/i);
    expect(STAGE_COPY.writing).toMatch(/drafting/i);
    expect(STAGE_COPY.verifying).toMatch(/checking/i);
    expect(STAGE_COPY.done).toMatch(/ready/i);
    expect(STAGE_COPY.error).toMatch(/failed/i);
  });

  it("calculates sequential step index accurately for custom pipelines", () => {
    const tailorPipeline: AiJobStage[] = ["connecting", "extracting", "writing", "verifying", "done"];
    expect(tailorPipeline.indexOf("connecting")).toBe(0);
    expect(tailorPipeline.indexOf("extracting")).toBe(1);
    expect(tailorPipeline.indexOf("writing")).toBe(2);
    expect(tailorPipeline.indexOf("verifying")).toBe(3);
    expect(tailorPipeline.indexOf("done")).toBe(4);
  });
});
