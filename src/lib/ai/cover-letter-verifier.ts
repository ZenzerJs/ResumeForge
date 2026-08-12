/**
 * Cover Letter Evidence Grounding Verifier Service
 *
 * Verifies that all evidenceIds cited in a generated cover letter correspond to valid,
 * active (non-archived) EvidenceItem or Bullet records in the candidate's Evidence Bank.
 */

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
