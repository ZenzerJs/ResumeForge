import { FactDateRange, FactMetric, ResumeFacts } from "@/lib/facts/types";
import { extractResumeFacts } from "@/lib/facts/extract";
import {
  extractMetricsFromText,
  isCandidateTitleAllowedByMaster,
  isDateRangeContained,
  normalizeEmployer,
  normalizeSkillToken,
  resolveMetricSubject,
} from "@/lib/facts/normalize";
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
  /** Normalized or raw skill tokens explicitly acknowledged by the user */
  acknowledgedSkills?: string[];
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

  // Master lookup sets (exact normalized employer + Evidence Bank aliases)
  const masterEmployers = new Set<string>();
  for (const emp of masterFacts.employers) {
    if (emp.normalized) masterEmployers.add(emp.normalized);
    const reNorm = normalizeEmployer(emp.raw);
    if (reNorm) masterEmployers.add(reNorm);
    for (const alias of emp.aliases || []) {
      if (alias) masterEmployers.add(alias);
    }
  }

  const masterSkills = new Set(masterFacts.skills.map((s) => normalizeSkillToken(s)));
  const acknowledgedSkills = new Set(
    (options?.acknowledgedSkills || []).map((s) => normalizeSkillToken(s))
  );
  const masterEvidenceIds = new Set(masterFacts.evidenceIds);

  // 1. Check Patches Citations, Metrics, and Unacknowledged Patch Skills
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

      const patchText = patch.after || patch.afterContent || "";
      if (patchText) {
        checkTextMetrics(patchText, masterFacts, violations, "Proposed patch");
        const patchFacts = extractResumeFacts(patchText);
        for (const skill of patchFacts.skills) {
          const norm = normalizeSkillToken(skill);
          if (norm && !masterSkills.has(norm) && !acknowledgedSkills.has(norm)) {
            violations.push({
              kind: "skill",
              severity: "SOFT",
              field: "patchSkills",
              message: `Patch introduces unverified skill "${skill}" not in Master Resume or Evidence Bank. Explicit per-skill acknowledgement required.`,
              actual: skill,
            });
          }
        }
      }
    }
  }

  // 2. Extract facts from candidate Typst
  const candidateFacts = extractResumeFacts(candidateTypst);

  // 3. Check Employers (HARD — exact match after normalizeEmployer + Evidence Bank aliases)
  for (const emp of candidateFacts.employers) {
    const candidateAliases = [emp.normalized, ...(emp.aliases || [])].filter(Boolean);
    const matchesMaster = candidateAliases.some((a) => masterEmployers.has(a));
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

  // 4. Check Job Titles (HARD — token subset + level marker preservation + seniority check)
  for (const title of candidateFacts.titles) {
    // Scope to employer-specific master titles if both specify employerNormalized, else all master titles
    const employerScoped = title.employerNormalized
      ? masterFacts.titles.filter((m) => m.employerNormalized === title.employerNormalized)
      : [];
    const candidatePool = employerScoped.length > 0 ? employerScoped : masterFacts.titles;

    let matched = false;
    let failureReason: "added_seniority" | "dropped_level_marker" | "added_tokens" | undefined;

    for (const mTitle of candidatePool) {
      if (title.normalized === mTitle.normalized) {
        matched = true;
        break;
      }
      const check = isCandidateTitleAllowedByMaster(title.raw, mTitle.raw);
      if (check.allowed) {
        matched = true;
        break;
      }
      if (!failureReason || check.reason === "added_seniority" || check.reason === "dropped_level_marker") {
        failureReason = check.reason;
      }
    }

    if (!matched) {
      const reasonDetail =
        failureReason === "added_seniority"
          ? "seniority or scope qualifier added"
          : failureReason === "dropped_level_marker"
            ? "level marker (e.g. Intern/Junior/Associate) dropped"
            : "unverified title tokens introduced";

      violations.push({
        kind: "title",
        severity: "HARD",
        field: "titles",
        message: `Unverified or inflated job title "${title.raw}" (${reasonDetail}) without supporting master evidence.`,
        expected: candidatePool.map((t) => t.raw).join(", "),
        actual: title.raw,
      });
    }
  }

  // 5. Check Date Ranges (HARD — containment per employer or across master ranges)
  if (masterFacts.dateRanges && masterFacts.dateRanges.length > 0) {
    for (const candDate of candidateFacts.dateRanges) {
      if (!candDate.startIso) continue;

      const employerScopedDates: FactDateRange[] = candDate.employerNormalized
        ? masterFacts.dateRanges.filter((d) => d.employerNormalized === candDate.employerNormalized)
        : [];
      const datePool =
        employerScopedDates.length > 0 ? employerScopedDates : masterFacts.dateRanges;

      const contained = datePool.some((mDate) => isDateRangeContained(candDate, mDate));
      if (!contained) {
        violations.push({
          kind: "date",
          severity: "HARD",
          field: "dateRanges",
          message: `Date range "${candDate.raw}" widens, shifts, or extends beyond verified master dates.`,
          expected: datePool.map((d) => d.raw).join(", "),
          actual: candDate.raw,
        });
      }
    }
  }

  // 6. Check Metrics (HARD for value/unit mismatch or conflicting subject; SOFT when one side lacks subject)
  for (const candMetric of candidateFacts.metrics) {
    evaluateCandidateMetric(candMetric, masterFacts, violations, "Unverified or inflated metric claim");
  }

  // 7. Check Skills (SOFT)
  for (const skill of candidateFacts.skills) {
    const norm = normalizeSkillToken(skill);
    if (norm && !masterSkills.has(norm) && !acknowledgedSkills.has(norm)) {
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
  const status = hasHardViolations ? "blocked" : "clean";

  return {
    passed,
    status,
    hasHardViolations,
    hasSoftViolations,
    violations,
  };
}

function evaluateCandidateMetric(
  candMetric: FactMetric,
  masterFacts: ResumeFacts,
  violations: GuardrailViolation[],
  prefix: string
) {
  if (candMetric.isTrivial) return;

  const valueUnitMatches = masterFacts.metrics.filter((m) => {
    if (m.isTrivial) return false;
    const sameUnit = m.unit.toLowerCase() === candMetric.unit.toLowerCase();
    const sameValue = Math.abs(m.value - candMetric.value) < 0.001;
    return sameUnit && sameValue;
  });

  if (valueUnitMatches.length === 0) {
    violations.push({
      kind: "metric",
      severity: "HARD",
      field: "metrics",
      message: `${prefix} "${candMetric.raw}" (${candMetric.value}${candMetric.unit}) not supported by master evidence.`,
      actual: candMetric.raw,
      snippet: candMetric.context,
    });
    return;
  }

  const candSubject = resolveMetricSubject(candMetric);
  let hasExactOrCleanMatch = false;
  let hasOneSidedSubjectMatch = false;
  let mismatchedMasterSubject: string | undefined;

  for (const m of valueUnitMatches) {
    const masterSubject = resolveMetricSubject(m);

    // If master fixture context is a single word (e.g. "latency") that appears in candidate's surrounding context
    // and candidate has no conflicting trailing subject, treat as verified context match.
    const masterCtxWord = (m.context || "").trim().toLowerCase();
    if (
      !candSubject &&
      masterCtxWord &&
      /^[a-z]+$/.test(masterCtxWord) &&
      candMetric.context.toLowerCase().includes(masterCtxWord)
    ) {
      hasExactOrCleanMatch = true;
      break;
    }

    if (!candSubject && !masterSubject) {
      hasExactOrCleanMatch = true;
      break;
    }

    if (candSubject && masterSubject) {
      if (candSubject === masterSubject) {
        hasExactOrCleanMatch = true;
        break;
      } else {
        mismatchedMasterSubject = masterSubject;
      }
    } else {
      hasOneSidedSubjectMatch = true;
    }
  }

  if (hasExactOrCleanMatch) {
    return;
  }

  if (hasOneSidedSubjectMatch) {
    violations.push({
      kind: "metric",
      severity: "SOFT",
      field: "metrics",
      message: `Metric "${candMetric.raw}" matched master value/unit, but subject context (${candSubject || "unspecified"}) was only present on one side.`,
      actual: candMetric.raw,
      snippet: candMetric.context,
    });
    return;
  }

  violations.push({
    kind: "metric",
    severity: "HARD",
    field: "metrics",
    message: `Metric "${candMetric.raw}" reuses number/unit with a different subject ("${candSubject}" vs master "${mismatchedMasterSubject}").`,
    expected: mismatchedMasterSubject,
    actual: `${candMetric.raw} ${candSubject || ""}`.trim(),
    snippet: candMetric.context,
  });
}

function checkTextMetrics(
  text: string,
  masterFacts: ResumeFacts,
  violations: GuardrailViolation[],
  prefix: string
) {
  const metrics = extractMetricsFromText(text);
  for (const candMetric of metrics) {
    evaluateCandidateMetric(candMetric, masterFacts, violations, `${prefix} introduces unbacked metric`);
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
