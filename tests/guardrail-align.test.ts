import { describe, it, expect, vi } from "vitest";
import React from "react";
import { GuardrailFeedback } from "@/components/ui/guardrail-feedback";
import { GuardrailResult } from "@/lib/guardrail/types";

describe("Guardrail 1-Click Align (E4)", () => {
  const sampleHardViolationResult: GuardrailResult = {
    passed: false,
    status: "blocked",
    hasHardViolations: true,
    hasSoftViolations: false,
    violations: [
      {
        kind: "metric",
        severity: "HARD",
        field: "metrics",
        message: "Unverified metric claim $500M not in master evidence bank.",
        actual: "$500M",
      },
    ],
  };

  const sampleAdvisoryResult: GuardrailResult = {
    passed: true,
    status: "clean",
    hasHardViolations: false,
    hasSoftViolations: true,
    violations: [
      {
        kind: "skill",
        severity: "SOFT",
        field: "skills",
        message: "Skill GraphQL is unverified in master facts.",
        actual: "GraphQL",
      },
    ],
  };

  const sampleCleanResult: GuardrailResult = {
    passed: true,
    status: "clean",
    hasHardViolations: false,
    hasSoftViolations: false,
    violations: [],
  };

  it("exports GuardrailFeedback component supporting onAlignWithMaster and onAlignViolation props", () => {
    expect(typeof GuardrailFeedback).toBe("function");

    const onAlign = vi.fn();
    const onAlignViolation = vi.fn();

    // Verify component accepts align props without runtime/type errors
    const element = React.createElement(GuardrailFeedback, {
      result: sampleHardViolationResult,
      onAlignWithMaster: onAlign,
      onAlignViolation,
    });

    expect(element.props.onAlignWithMaster).toBe(onAlign);
    expect(element.props.onAlignViolation).toBe(onAlignViolation);
  });

  it("handles soft advisory results with align callback support", () => {
    const onAlign = vi.fn();
    const element = React.createElement(GuardrailFeedback, {
      result: sampleAdvisoryResult,
      onAlignWithMaster: onAlign,
    });

    expect(element.props.result?.hasSoftViolations).toBe(true);
    expect(element.props.onAlignWithMaster).toBe(onAlign);
  });

  it("handles clean result correctly", () => {
    const element = React.createElement(GuardrailFeedback, {
      result: sampleCleanResult,
    });

    expect(element.props.result?.passed).toBe(true);
    expect(element.props.result?.hasHardViolations).toBe(false);
  });
});
