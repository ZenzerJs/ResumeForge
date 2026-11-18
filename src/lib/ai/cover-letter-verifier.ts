/**
 * Cover Letter Evidence Grounding Verifier Service
 *
 * Verifies that all evidenceIds cited in a generated cover letter correspond to valid,
 * active (non-archived) EvidenceItem or Bullet records in the candidate's Evidence Bank.
 */

import { CoverLetterResponseSchema, type CoverLetterResponse } from "./cover-letter-schema";
import { extractJsonObject, normalizeCoverLetterPayload } from "./json-response";
import { sanitizeError } from "./redact";
import { extractCandidateNameFromTypst, replacePlaceholderSignature } from "../export/resume-text";

export function buildCoverLetterEvidenceContext<
  T extends { id: string; status: string; bullets?: Array<{ id: string }> }
>(
  evidenceItems: T[],
  masterTypstSource?: string | null,
  providedCandidateName?: unknown
): {
  activeEvidenceItems: T[];
  activeEvidenceIds: string[];
  resolvedCandidateName: string;
} {
  const activeEvidenceItems = evidenceItems.filter((e) => e.status !== "archived");
  const activeEvidenceIds: string[] = [];
  for (const item of activeEvidenceItems) {
    activeEvidenceIds.push(item.id);
    if (Array.isArray(item.bullets)) {
      for (const bullet of item.bullets) {
        activeEvidenceIds.push(bullet.id);
      }
    }
  }
  const providedName =
    typeof providedCandidateName === "string" ? providedCandidateName.trim() : "";
  const resolvedCandidateName =
    providedName && providedName.toLowerCase() !== "candidate"
      ? providedName
      : extractCandidateNameFromTypst(masterTypstSource) || "Candidate";

  return {
    activeEvidenceItems,
    activeEvidenceIds,
    resolvedCandidateName,
  };
}

export interface CoverLetterPayload {
  salutation?: string;
  openingParagraph?: string;
  bodyParagraphs?: string[];
  closingParagraph?: string;
  fullMarkdown?: string;
  evidenceCitations?: string[];
}

export interface VerificationResult {
  verified: boolean;
  validCitations: string[];
  invalidCitations: string[];
  reason?: string;
}

export type ValidatedCoverLetterOutput =
  | { ok: true; data: CoverLetterResponse }
  | {
      ok: false;
      status: 422;
      body: Record<string, unknown>;
    };

export function parseAndVerifyCoverLetterOutput(
  rawJson: string,
  resolvedCandidateName: string,
  activeEvidenceIds: string[]
): ValidatedCoverLetterOutput {
  let parsedResponse: unknown;
  try {
    parsedResponse = extractJsonObject(rawJson);
  } catch {
    return {
      ok: false,
      status: 422,
      body: {
        success: false,
        error: "AI provider returned malformed non-JSON output for cover letter.",
        rawOutput: sanitizeError(rawJson.slice(0, 300)),
      },
    };
  }

  const normalized = normalizeCoverLetterPayload(parsedResponse, resolvedCandidateName);
  if (normalized && typeof normalized === "object" && "fullMarkdown" in normalized) {
    const record = normalized as Record<string, unknown>;
    if (typeof record.fullMarkdown === "string") {
      record.fullMarkdown = replacePlaceholderSignature(record.fullMarkdown, resolvedCandidateName);
    }
  }
  const schemaValidation = CoverLetterResponseSchema.safeParse(normalized);
  if (!schemaValidation.success) {
    return {
      ok: false,
      status: 422,
      body: {
        success: false,
        error: "Generated cover letter output failed schema validation.",
        details: schemaValidation.error.flatten().fieldErrors,
      },
    };
  }

  const coverLetter = schemaValidation.data;
  const groundingVerification = verifyCoverLetterGrounding(coverLetter, activeEvidenceIds);
  if (!groundingVerification.verified) {
    return {
      ok: false,
      status: 422,
      body: {
        success: false,
        error:
          "SECURITY CONTRACT REJECTION: Generated cover letter contained unverified or hallucinated evidence citations.",
        reason: groundingVerification.reason,
        invalidCitations: groundingVerification.invalidCitations,
      },
    };
  }

  return { ok: true, data: coverLetter };
}

export function verifyCoverLetterGrounding(
  coverLetter: CoverLetterPayload,
  activeEvidenceIds: string[]
): VerificationResult {
  const citations = coverLetter.evidenceCitations || [];
  const activeSet = new Set(activeEvidenceIds);

  const validCitations: string[] = [];
  const invalidCitations: string[] = [];

  for (const citationId of citations) {
    if (activeSet.has(citationId)) {
      validCitations.push(citationId);
    } else {
      invalidCitations.push(citationId);
    }
  }

  if (invalidCitations.length > 0) {
    return {
      verified: false,
      validCitations,
      invalidCitations,
      reason: `Cover letter cited ${invalidCitations.length} invalid/non-existent evidence ID(s): ${invalidCitations.join(", ")}. Grounding contract broken.`,
    };
  }

  if (activeEvidenceIds.length > 0 && citations.length === 0) {
    return {
      verified: false,
      validCitations: [],
      invalidCitations: [],
      reason:
        "Cover letter must cite at least one Evidence Bank ID when evidence items exist. Generic ungrounded letters are rejected.",
    };
  }

  return {
    verified: true,
    validCitations,
    invalidCitations: [],
  };
}
