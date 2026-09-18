import { ResumeFacts } from "@/lib/facts/types";
import { extractResumeFacts } from "@/lib/facts/extract";
import { extractMetricsFromText, normalizeEmployer, normalizeSkillToken, normalizeTitle } from "@/lib/facts/normalize";
import { GuardrailResult, GuardrailViolation } from "./types";

export interface CheckGuardrailOptions {
  /** Optional patch proposals to check before applying */
  patches?: Array<{
    id?: string;
    after?: string;
    afterContent?: string;
    evidenceIds?: string[];
    evidenceCitations?: string[] | string;
    targetSection?: string;
  }>;
}

/**
 * Executes a fail-closed mechanical guardrail check comparing candidate Typst or patches against
 * the frozen master ResumeFacts snapshot.
 */
export function checkGuardrail(
  candidateTypst: string,
  masterFacts: ResumeFacts,
  options?: CheckGuardrailOptions
): GuardrailResult {
  const violations: GuardrailViolation[] = [];

  // Master lookup sets
  const masterEmployers = new Set(masterFacts.employers.map((e) => e.normalized));
  const masterTitles = new Set(masterFacts.titles.map((t) => t.normalized));
  const masterSkills = new Set(masterFacts.skills.map((s) => s.toLowerCase()));
  const masterEvidenceIds = new Set(masterFacts.evidenceIds);

  // 1. Check Patches Citations
  if (options?.patches) {
    for (const patch of options.patches) {
      const citations = parseCitations(patch.evidenceIds || patch.evidenceCitations);
      for (const citId of citations) {
        if (!masterEvidenceIds.has(citId)) {
          violations.push({
            kind: "evidence",
            severity: "HARD",
            field: "evidenceIds",
            message: `Patch cites invalid or unverified evidence ID "${citId}" not present in candidate Evidence Bank.`,
            actual: citId,
          });
        }
      }

      // Check text in patch after content
      const patchText = patch.after || patch.afterContent || "";
      if (patchText) {
        checkTextMetrics(patchText, masterFacts, violations);
      }
    }
  }

  // 2. Extract facts from candidate Typst
  const candidateFacts = extractResumeFacts(candidateTypst);

  // 3. Check Employers (HARD)
  for (const emp of candidateFacts.employers) {
    if (!masterEmployers.has(emp.normalized)) {
      // Check partial match for safety
      const matchesMaster = Array.from(masterEmployers).some(
        (m) => emp.normalized.includes(m) || m.includes(emp.normalized)
      );
      if (!matchesMaster) {
        violations.push({
          kind: "employer",
          severity: "HARD",
          field: "employers",
          message: `Unverified employer "${emp.raw}" introduced without supporting master evidence.`,
          expected: masterFacts.employers.map((e) => e.raw).join(", "),
          actual: emp.raw,
        });
      }
    }
  }

  // 4. Check Job Titles (HARD)
  for (const title of candidateFacts.titles) {
    if (!masterTitles.has(title.normalized)) {
      const matchesMaster = Array.from(masterTitles).some(
        (m) => title.normalized.includes(m) || m.includes(title.normalized)
      );
      if (!matchesMaster) {
        violations.push({
          kind: "title",
          severity: "HARD",
          field: "titles",
          message: `Unverified job title "${title.raw}" introduced without supporting master evidence.`,
          expected: masterFacts.titles.map((t) => t.raw).join(", "),
          actual: title.raw,
        });
      }
    }
  }

  // 5. Check Metrics (HARD)
  // Non-trivial metrics in candidate must match an existing metric value/unit in master facts
  for (const candMetric of candidateFacts.metrics) {
    if (candMetric.isTrivial) continue;

    const matchedMaster = masterFacts.metrics.find((m) => {
      if (m.isTrivial) return false;
      const sameUnit = m.unit.toLowerCase() === candMetric.unit.toLowerCase();
      // Exact or within 0.1 tolerance for float
      const sameValue = Math.abs(m.value - candMetric.value) < 0.001;
      return sameUnit && sameValue;
    });

    if (!matchedMaster) {
      violations.push({
        kind: "metric",
        severity: "HARD",
        field: "metrics",
        message: `Unverified or inflated metric claim "${candMetric.raw}" (${candMetric.value}${candMetric.unit}) not supported by master evidence.`,
        actual: candMetric.raw,
        snippet: candMetric.context,
      });
    }
  }

  // 6. Check Skills (SOFT)
  for (const skill of candidateFacts.skills) {
    const norm = normalizeSkillToken(skill);
    if (norm && !masterSkills.has(norm)) {
      violations.push({
        kind: "skill",
        severity: "SOFT",
        field: "skills",
        message: `Skill token "${skill}" is not documented in master evidence.`,
        actual: skill,
      });
    }
  }

  const hasHardViolations = violations.some((v) => v.severity === "HARD");
  const hasSoftViolations = violations.some((v) => v.severity === "SOFT");
  const passed = !hasHardViolations;

  return {
    passed,
    status: passed ? (hasSoftViolations ? "clean" : "clean") : "blocked",
    hasHardViolations,
    hasSoftViolations,
    violations,
  };
}

function checkTextMetrics(text: string, masterFacts: ResumeFacts, violations: GuardrailViolation[]) {
  const metrics = extractMetricsFromText(text);
  for (const candMetric of metrics) {
    if (candMetric.isTrivial) continue;

    const matchedMaster = masterFacts.metrics.find((m) => {
      if (m.isTrivial) return false;
      const sameUnit = m.unit.toLowerCase() === candMetric.unit.toLowerCase();
      const sameValue = Math.abs(m.value - candMetric.value) < 0.001;
      return sameUnit && sameValue;
    });

    if (!matchedMaster) {
      violations.push({
        kind: "metric",
        severity: "HARD",
        field: "metrics",
        message: `Proposed patch introduces unbacked metric "${candMetric.raw}".`,
        actual: candMetric.raw,
        snippet: candMetric.context,
      });
    }
  }
}

function parseCitations(val: string[] | string | undefined): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return val.split(",").map((s) => s.trim()).filter(Boolean);
  }
}
