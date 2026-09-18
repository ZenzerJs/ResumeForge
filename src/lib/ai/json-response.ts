/**
 * Shared helpers for extracting and lightly normalizing AI JSON payloads
 * before Zod schema validation.
 */

/** Pull the first JSON object from model output (fences, prose, trailing text). */
export function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("Empty AI response");
  }

  let candidate = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(candidate);
  } catch {
    // Fall through — try to locate a top-level object
  }

  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON object found in AI response");
  }

  candidate = candidate.slice(start, end + 1);
  return JSON.parse(candidate);
}

const CATEGORY_ALIASES: Record<string, string> = {
  "base resume health": "Base Resume Health",
  "resume health": "Base Resume Health",
  "base health": "Base Resume Health",
  "required role match": "Required Role Match",
  "required match": "Required Role Match",
  "required skills": "Required Role Match",
  "preferred match": "Preferred Match",
  preferred: "Preferred Match",
  "preferred skills": "Preferred Match",
  "role-relevant evidence": "Role-Relevant Evidence",
  "role relevant evidence": "Role-Relevant Evidence",
  "role evidence": "Role-Relevant Evidence",
};

const VERDICT_ALIASES: Record<string, string> = {
  strong_evidence: "STRONG_EVIDENCE",
  strong: "STRONG_EVIDENCE",
  "strong evidence": "STRONG_EVIDENCE",
  weak_evidence: "WEAK_EVIDENCE",
  weak: "WEAK_EVIDENCE",
  "weak evidence": "WEAK_EVIDENCE",
  keyword_stuffing: "KEYWORD_STUFFING",
  "keyword stuffing": "KEYWORD_STUFFING",
  vague_claim: "VAGUE_CLAIM",
  vague: "VAGUE_CLAIM",
  "vague claim": "VAGUE_CLAIM",
};

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v ?? "")).filter((v) => v.trim().length > 0);
}

function normalizeCategoryName(raw: unknown): string {
  const s = String(raw ?? "").trim();
  return CATEGORY_ALIASES[s.toLowerCase()] || s;
}

function normalizeVerdict(raw: unknown): string {
  const s = String(raw ?? "").trim();
  return VERDICT_ALIASES[s.toLowerCase()] || s.toUpperCase().replace(/\s+/g, "_");
}

/**
 * Coerce common LLM mistakes into a shape closer to AtsQualitativeReviewSchema.
 * Prefer safe defaults (adjustment 0) over inventing JD quotes.
 */
export function normalizeQualitativeReviewPayload(input: unknown): unknown {
  if (!input || typeof input !== "object") return input;
  const obj = { ...(input as Record<string, unknown>) };

  let overview = String(obj.overviewCommentary ?? "");
  overview = overview
    .replace(/\b\d{1,3}\s*\/\s*100\b/gi, "the deterministic baseline")
    .replace(/\b\d{1,2}\s*\/\s*10\b/gi, "the baseline rating")
    .replace(/\bgrade\s*[A-F][+-]?\b/gi, "solid alignment");
  obj.overviewCommentary = overview.trim() || "Resume shows partial alignment with the target role; see category notes below.";

  const categoryFeedbacks = Array.isArray(obj.categoryFeedbacks) ? obj.categoryFeedbacks : [];
  obj.categoryFeedbacks = categoryFeedbacks.map((cf) => {
    const row = (cf && typeof cf === "object" ? cf : {}) as Record<string, unknown>;
    return {
      categoryName: normalizeCategoryName(row.categoryName),
      observations: asStringArray(row.observations),
      strengths: asStringArray(row.strengths),
      weaknesses: asStringArray(row.weaknesses),
    };
  });

  const bulletFeedbacks = Array.isArray(obj.bulletFeedbacks) ? obj.bulletFeedbacks : [];
  obj.bulletFeedbacks = bulletFeedbacks
    .map((bf) => {
      const row = (bf && typeof bf === "object" ? bf : {}) as Record<string, unknown>;
      return {
        bulletText: String(row.bulletText ?? "").trim(),
        verdict: normalizeVerdict(row.verdict),
        reasoning: String(row.reasoning ?? "").trim() || "Needs clearer evidence linkage.",
        improvementAdvice:
          String(row.improvementAdvice ?? "").trim() ||
          "Add concrete metrics or technologies from the Evidence Bank if available.",
      };
    })
    .filter((bf) => bf.bulletText.length > 0);

  let adjustment = Number(obj.jdContextAdjustment);
  if (!Number.isFinite(adjustment)) adjustment = 0;
  adjustment = Math.max(-10, Math.min(10, Math.round(adjustment)));

  let reasoning = Array.isArray(obj.adjustmentReasoning) ? obj.adjustmentReasoning : [];
  reasoning = reasoning
    .map((r) => {
      const row = (r && typeof r === "object" ? r : {}) as Record<string, unknown>;
      const points = Math.round(Number(row.points) || 0);
      return {
        points,
        jdSignal: String(row.jdSignal ?? "").trim(),
        targetCategory: normalizeCategoryName(row.targetCategory),
        explanation: String(row.explanation ?? "").trim() || "JD emphasis adjustment.",
      };
    })
    .filter((r) => r.jdSignal.length >= 5);

  const sum = reasoning.reduce((acc, r) => acc + r.points, 0);
  if (adjustment === 0 || reasoning.length === 0 || sum !== adjustment) {
    // Safe fallback: no JD adjustment rather than inventing quotes
    adjustment = 0;
    reasoning = [];
  }

  obj.jdContextAdjustment = adjustment;
  obj.adjustmentReasoning = reasoning;
  obj.detectedAntiPatterns = asStringArray(obj.detectedAntiPatterns);
  obj.nextStepsAdvice = asStringArray(obj.nextStepsAdvice);

  return obj;
}

/**
 * Coerce common cover-letter LLM mistakes before CoverLetterResponseSchema.
 */
export function normalizeCoverLetterPayload(input: unknown, candidateName = "Candidate"): unknown {
  if (!input || typeof input !== "object") return input;
  const obj = { ...(input as Record<string, unknown>) };

  obj.title = String(obj.title ?? "Cover Letter").trim() || "Cover Letter";
  obj.salutation = String(obj.salutation ?? "Dear Hiring Team,").trim() || "Dear Hiring Team,";

  let opening = String(obj.openingParagraph ?? "").trim();
  if (opening.length > 0 && opening.length < 20) {
    opening = `${opening} I am excited to contribute based on my verified experience.`;
  }
  obj.openingParagraph = opening;

  let bodies = Array.isArray(obj.bodyParagraphs)
    ? obj.bodyParagraphs.map((p) => String(p ?? "").trim()).filter(Boolean)
    : [];
  bodies = bodies.map((p) =>
    p.length < 30
      ? `${p} This experience is grounded in my Evidence Bank achievements and aligns with the role.`
      : p
  );
  if (bodies.length === 0) {
    bodies = [
      "My verified experience includes relevant technical work documented in my Evidence Bank, and I am prepared to apply those skills to this role's priorities.",
    ];
  }
  obj.bodyParagraphs = bodies;

  let closing = String(obj.closingParagraph ?? "").trim();
  if (closing.length > 0 && closing.length < 20) {
    closing = `${closing} Thank you for your time and consideration.`;
  }
  if (!closing) {
    closing = "Thank you for your time and consideration. I welcome the chance to discuss how I can contribute.";
  }
  obj.closingParagraph = closing;

  obj.evidenceCitations = Array.isArray(obj.evidenceCitations)
    ? obj.evidenceCitations.map((id) => String(id).trim()).filter(Boolean)
    : [];
  obj.gapsAddressed = Array.isArray(obj.gapsAddressed)
    ? obj.gapsAddressed.map((g) => String(g).trim()).filter(Boolean)
    : [];

  let fullMarkdown = String(obj.fullMarkdown ?? "").trim();
  if (fullMarkdown.length < 100) {
    fullMarkdown = [
      `# ${obj.title}`,
      "",
      obj.salutation,
      "",
      obj.openingParagraph,
      "",
      ...bodies.flatMap((p) => [p, ""]),
      obj.closingParagraph,
      "",
      "Sincerely,",
      candidateName,
    ].join("\n");
  }
  obj.fullMarkdown = fullMarkdown;

  return obj;
}
