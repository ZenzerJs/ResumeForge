import { ResumeFacts } from "@/lib/facts/types";
import { checkGuardrail } from "./check";
import { GuardrailResult, GuardrailStatus } from "./types";

export class GuardrailBlockError extends Error {
  public result: GuardrailResult;
  constructor(message: string, result: GuardrailResult) {
    super(message);
    this.name = "GuardrailBlockError";
    this.result = result;
  }
}

/**
 * Validates that document or patch proposals can be safely exported.
 * Throws GuardrailBlockError on hard violations.
 */
export function assertCanExport(
  source: string,
  masterFacts?: ResumeFacts | null
): GuardrailResult {
  if (!masterFacts) {
    return {
      passed: true,
      status: "clean",
      hasHardViolations: false,
      hasSoftViolations: false,
      violations: [],
    };
  }

  const result = checkGuardrail(source, masterFacts);
  if (result.hasHardViolations) {
    throw new GuardrailBlockError(
      `Export blocked by mechanical guardrail: ${result.violations.filter((v) => v.severity === "HARD").map((v) => v.message).join(" ")}`,
      result
    );
  }

  return result;
}

/**
 * Validates that proposed patches can be applied to a variant.
 * Throws GuardrailBlockError on hard violations.
 */
export function assertCanApplyPatches(
  candidateTypst: string,
  masterFacts: ResumeFacts,
  patches?: Array<{
    id?: string;
    after?: string;
    evidenceIds?: string[];
  }>
): GuardrailResult {
  const result = checkGuardrail(candidateTypst, masterFacts, { patches });
  if (result.hasHardViolations) {
    throw new GuardrailBlockError(
      `Cannot apply patches with mechanical guardrail violations: ${result.violations.filter((v) => v.severity === "HARD").map((v) => v.message).join(" ")}`,
      result
    );
  }

  return result;
}

export interface TailoringGenerationResult {
  patches: any[];
  gaps: any[];
  guardrail: GuardrailResult;
  status: GuardrailStatus;
}

/**
 * Executes tailoring with a 1x automatic retry policy before failing closed.
 */
export async function executeTailoringWithRetry(
  generateFn: (feedback?: string) => Promise<{ patches: any[]; gaps: any[] }>,
  masterTypst: string,
  masterFacts: ResumeFacts
): Promise<TailoringGenerationResult> {
  // Attempt 1
  const attempt1 = await generateFn();
  const check1 = checkGuardrail(masterTypst, masterFacts, { patches: attempt1.patches });

  if (!check1.hasHardViolations) {
    return {
      patches: attempt1.patches,
      gaps: attempt1.gaps,
      guardrail: check1,
      status: "clean",
    };
  }

  // Attempt 2 (Retry 1x with specific violation feedback)
  const feedback = `The previous patch generation was rejected by the mechanical guardrail for the following violations:
${check1.violations.map((v) => `- [${v.kind.toUpperCase()}] ${v.message}`).join("\n")}
You MUST ground all metrics, employers, and dates in verified evidence. Do not hallucinate or inflate numbers.`;

  const attempt2 = await generateFn(feedback);
  const check2 = checkGuardrail(masterTypst, masterFacts, { patches: attempt2.patches });

  if (!check2.hasHardViolations) {
    return {
      patches: attempt2.patches,
      gaps: attempt2.gaps,
      guardrail: {
        ...check2,
        status: "retried",
      },
      status: "retried",
    };
  }

  // Fail closed: retain empty or clean patches, report gaps
  return {
    patches: [],
    gaps: [
      ...attempt2.gaps,
      {
        requirement: "Evidence Grounding Guardrail Failure",
        severity: "CRITICAL",
        recommendation: "AI tailoring failed mechanical guardrail check twice. Fell back to verified master baseline.",
      },
    ],
    guardrail: {
      ...check2,
      status: "fell_back",
    },
    status: "fell_back",
  };
}
