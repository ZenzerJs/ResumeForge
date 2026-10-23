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

export interface AssertCanExportOptions {
  /**
   * Set to true ONLY when exporting the untailored Master Resume itself or
   * an untouched starter/guest draft on first run. Derived or AI-patched
   * variants always require a frozen masterFacts snapshot.
   */
  allowUnfrozenMasterSelfExport?: boolean;
}

export const PATCHED_DOCUMENT_MARKER = "// @resumeforge-patched: true";

/**
 * Stamps the Typst document source itself with a persistent patch provenance comment
 * so "AI patches applied" travels with the document across tabs, sessions, localStorage, and DB variants.
 */
export function markDocumentAsPatched(typstSource: string): string {
  if (!typstSource || typstSource.includes(PATCHED_DOCUMENT_MARKER)) {
    return typstSource;
  }
  return `${PATCHED_DOCUMENT_MARKER}\n${typstSource}`;
}

/**
 * Returns true if the document source carries a persistent patch or AI-conversion provenance marker.
 */
export function isDocumentPatched(typstSource: string): boolean {
  if (!typstSource) return false;
  return (
    typstSource.includes(PATCHED_DOCUMENT_MARKER) ||
    typstSource.includes("// @conversion-path: ai")
  );
}

/**
 * Strips the patch provenance marker when a document is explicitly frozen as the canonical Master Resume.
 */
export function stripPatchedDocumentMarker(typstSource: string): string {
  if (!typstSource) return typstSource;
  return typstSource.replace(/^\/\/ @resumeforge-patched: true\r?\n?/m, "");
}

/**
 * Validates that a document can be safely exported against the frozen master ResumeFacts snapshot.
 * Fails closed (throws GuardrailBlockError) on hard violations or when masterFacts is missing
 * for a derived/patched variant. Even if allowUnfrozenMasterSelfExport is passed, a document
 * carrying the persistent patch marker is always blocked when masterFacts is missing.
 */
export function assertCanExport(
  source: string,
  masterFacts?: ResumeFacts | null,
  options?: AssertCanExportOptions
): GuardrailResult {
  if (!masterFacts) {
    if (options?.allowUnfrozenMasterSelfExport && !isDocumentPatched(source)) {
      return {
        passed: true,
        status: "clean",
        hasHardViolations: false,
        hasSoftViolations: false,
        violations: [],
      };
    }

    const missingMasterResult: GuardrailResult = {
      passed: false,
      status: "blocked",
      hasHardViolations: true,
      hasSoftViolations: false,
      violations: [
        {
          kind: "evidence",
          severity: "HARD",
          field: "masterFacts",
          message: "Freeze your master resume first before exporting a tailored or AI-patched variant.",
          actual: "missing_master_snapshot",
        },
      ],
    };
    throw new GuardrailBlockError(
      "Export blocked by mechanical guardrail: Freeze your master resume first before exporting a tailored or AI-patched variant.",
      missingMasterResult
    );
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
 * Throws GuardrailBlockError on hard violations or when a patch adds an unverified skill
 * without explicit per-skill acknowledgement.
 */
export function assertCanApplyPatches(
  candidateTypst: string,
  masterFacts: ResumeFacts,
  patches?: Array<{
    id?: string;
    after?: string;
    afterContent?: string;
    evidenceIds?: string[];
  }>,
  options?: { acknowledgedSkills?: string[] }
): GuardrailResult {
  const result = checkGuardrail(candidateTypst, masterFacts, {
    patches,
    acknowledgedSkills: options?.acknowledgedSkills,
  });

  const unacknowledgedPatchSkills = result.violations.filter(
    (v) => v.kind === "skill" && v.field === "patchSkills"
  );

  if (result.hasHardViolations || unacknowledgedPatchSkills.length > 0) {
    const messages = [
      ...result.violations.filter((v) => v.severity === "HARD").map((v) => v.message),
      ...unacknowledgedPatchSkills.map((v) => v.message),
    ];
    throw new GuardrailBlockError(
      `Cannot apply patches with mechanical guardrail violations: ${messages.join(" ")}`,
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
