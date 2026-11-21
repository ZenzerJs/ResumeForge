import { createHash } from "node:crypto";
import { normalizePdfText } from "./pdfExtractor";

export interface EvidenceBulletSnapshot {
  id: string;
  text: string;
  technologies: string[];
  verified: boolean;
}

export interface EvidenceItemSnapshot {
  id: string;
  userId: string | null;
  type: string;
  title: string;
  organization: string | null;
  verifiedSummary: string;
  tags: string[];
  status: string;
  updatedAt: string;
  citationCount: number;
  bullets: EvidenceBulletSnapshot[];
}

export type RepairAction = "UPDATE_TEXT" | "FLAG_FOR_MANUAL_REVIEW";

export interface EvidenceRepairCandidate {
  itemId: string;
  userId: string | null;
  status: string;
  updatedAt: string;
  citationCount: number;
  repairAction: RepairAction;
  reasons: string[];
  before: {
    title: string;
    organization: string | null;
    verifiedSummary: string;
    tags: string[];
    bullets: Array<{ id: string; text: string }>;
  };
  proposedAfter: {
    title: string;
    organization: string | null;
    verifiedSummary: string;
    tags: string[];
    bullets: Array<{ id: string; text: string }>;
  };
}

export interface EvidenceRepairManifest {
  version: 1;
  generatedAt: string;
  scannedCount: number;
  affectedCount: number;
  autoRepairCount: number;
  manualReviewCount: number;
  candidates: EvidenceRepairCandidate[];
  manifestSha256: string;
}

function hasUnbalancedParens(text: string): boolean {
  let depth = 0;
  for (const ch of text) {
    if (ch === "(") depth++;
    else if (ch === ")") {
      depth--;
      if (depth < 0) return true;
    }
  }
  return depth !== 0;
}

function looksMidWordTruncatedAt200(summary: string): boolean {
  if (summary.length !== 200) return false;
  if (hasUnbalancedParens(summary)) return true;
  // Ends in an incomplete word (no terminal punctuation)
  return /[a-zA-Z0-9,(\-]$/.test(summary);
}

const FRAGMENT_TAG_PAIRS: ReadonlyArray<[string, string, string]> = [
  ["tool", "calling", "tool calling"],
  ["machine", "learning", "Machine Learning"],
  ["deep", "learning", "Deep Learning"],
  ["system", "design", "System Design"],
  ["prompt", "engineering", "Prompt Engineering"],
  ["unit", "testing", "Unit Testing"],
];

function recombineFragmentedTags(tags: string[], contextText: string): { nextTags: string[]; changed: boolean } {
  const lowerCtx = contextText.toLowerCase();
  const next: string[] = [];
  let changed = false;
  for (let i = 0; i < tags.length; i++) {
    const cur = tags[i];
    const nxt = tags[i + 1];
    let merged = false;
    if (nxt) {
      for (const [a, b, combined] of FRAGMENT_TAG_PAIRS) {
        if (
          cur.trim().toLowerCase() === a &&
          nxt.trim().toLowerCase() === b &&
          lowerCtx.includes(combined.toLowerCase())
        ) {
          next.push(combined);
          i++;
          changed = true;
          merged = true;
          break;
        }
      }
    }
    if (!merged) next.push(cur);
  }
  return { nextTags: Array.from(new Set(next)), changed };
}

export function auditEvidenceItemForRepair(item: EvidenceItemSnapshot): EvidenceRepairCandidate | null {
  const reasons: string[] = [];
  let needsManualReview = false;

  const nextTitle = normalizePdfText(item.title);
  if (nextTitle !== item.title) {
    reasons.push("Normalized broken ligature/hyphen spacing in title");
  }

  let nextOrg = item.organization;
  if (
    item.type === "skill" &&
    item.organization &&
    item.title.trim().toLowerCase().endsWith(item.organization.trim().toLowerCase())
  ) {
    nextOrg = null;
    reasons.push("Cleared duplicated organization matching skill category title");
  }

  const nextBullets = item.bullets.map((b) => ({
    id: b.id,
    text: normalizePdfText(b.text),
  }));
  const bulletsChanged = nextBullets.some((b, idx) => b.text !== item.bullets[idx]?.text);
  if (bulletsChanged) {
    reasons.push("Normalized broken ligature/hyphen spacing in bullet text");
  }

  const nextSummary = normalizePdfText(item.verifiedSummary);
  if (nextSummary !== item.verifiedSummary) {
    reasons.push("Normalized broken ligature/hyphen spacing in summary");
  }

  if (looksMidWordTruncatedAt200(item.verifiedSummary)) {
    needsManualReview = true;
    reasons.push("Summary appears truncated at 200 chars (requires manual review; cannot safely reconstruct)");
  }

  if (
    hasUnbalancedParens(nextSummary) ||
    nextBullets.some((b) => hasUnbalancedParens(b.text)) ||
    item.tags.some((t) => hasUnbalancedParens(t))
  ) {
    needsManualReview = true;
    reasons.push("Contains unbalanced parentheses (requires manual review)");
  }

  const fullContext = [nextTitle, nextSummary, ...nextBullets.map((b) => b.text)].join(" ");
  const { nextTags, changed: tagsChanged } = recombineFragmentedTags(item.tags, fullContext);
  if (tagsChanged) {
    reasons.push("Recombined fragmented compound tags verified against item text");
  }

  if (reasons.length === 0) return null;

  const hasAutoChanges =
    nextTitle !== item.title ||
    nextOrg !== item.organization ||
    nextSummary !== item.verifiedSummary ||
    bulletsChanged ||
    tagsChanged;

  return {
    itemId: item.id,
    userId: item.userId,
    status: item.status,
    updatedAt: item.updatedAt,
    citationCount: item.citationCount,
    repairAction: needsManualReview ? "FLAG_FOR_MANUAL_REVIEW" : hasAutoChanges ? "UPDATE_TEXT" : "FLAG_FOR_MANUAL_REVIEW",
    reasons,
    before: {
      title: item.title,
      organization: item.organization,
      verifiedSummary: item.verifiedSummary,
      tags: item.tags,
      bullets: item.bullets.map((b) => ({ id: b.id, text: b.text })),
    },
    proposedAfter: {
      title: nextTitle,
      organization: nextOrg,
      verifiedSummary: nextSummary,
      tags: nextTags,
      bullets: nextBullets,
    },
  };
}

export function computeRepairManifestHash(candidates: EvidenceRepairCandidate[]): string {
  return createHash("sha256").update(JSON.stringify(candidates)).digest("hex");
}

export function buildEvidenceRepairManifest(items: EvidenceItemSnapshot[]): EvidenceRepairManifest {
  const candidates: EvidenceRepairCandidate[] = [];
  for (const item of items) {
    const candidate = auditEvidenceItemForRepair(item);
    if (candidate) candidates.push(candidate);
  }
  const autoRepairCount = candidates.filter((c) => c.repairAction === "UPDATE_TEXT").length;
  const manualReviewCount = candidates.filter((c) => c.repairAction === "FLAG_FOR_MANUAL_REVIEW").length;

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    scannedCount: items.length,
    affectedCount: candidates.length,
    autoRepairCount,
    manualReviewCount,
    candidates,
    manifestSha256: computeRepairManifestHash(candidates),
  };
}

export function verifyRepairManifestIntegrity(manifest: EvidenceRepairManifest): boolean {
  if (!manifest || manifest.version !== 1 || !Array.isArray(manifest.candidates)) {
    return false;
  }
  return computeRepairManifestHash(manifest.candidates) === manifest.manifestSha256;
}

export function renderRepairManifestMarkdown(manifest: EvidenceRepairManifest): string {
  const lines: string[] = [
    "# Evidence Bank Repair Dry-Run Report",
    "",
    `- **Generated at:** ${manifest.generatedAt}`,
    `- **Items scanned:** ${manifest.scannedCount}`,
    `- **Affected items:** ${manifest.affectedCount}`,
    `- **Auto-repairable (\`UPDATE_TEXT\`):** ${manifest.autoRepairCount}`,
    `- **Manual review required (\`FLAG_FOR_MANUAL_REVIEW\`):** ${manifest.manualReviewCount}`,
    `- **Manifest SHA-256:** \`${manifest.manifestSha256}\``,
    "",
    "> **Safety guarantee:** This script performs zero row deletes and never modifies `PatchCitation` foreign keys.",
    "",
  ];

  if (manifest.candidates.length === 0) {
    lines.push("No corrupted Evidence Bank records detected.");
    return lines.join("\n");
  }

  for (const c of manifest.candidates) {
    lines.push(`## ${c.itemId} — \`${c.repairAction}\``);
    lines.push(`- **User:** ${c.userId ?? "(unowned)"} | **Status:** ${c.status} | **Citations:** ${c.citationCount}`);
    lines.push(`- **Reasons:** ${c.reasons.join("; ")}`);
    if (c.before.title !== c.proposedAfter.title) {
      lines.push(`- **Title:** \`${c.before.title}\` -> \`${c.proposedAfter.title}\``);
    }
    if (c.before.organization !== c.proposedAfter.organization) {
      lines.push(`- **Organization:** \`${c.before.organization ?? "null"}\` -> \`${c.proposedAfter.organization ?? "null"}\``);
    }
    if (c.before.verifiedSummary !== c.proposedAfter.verifiedSummary) {
      lines.push(`- **Summary:** \`${c.before.verifiedSummary}\` -> \`${c.proposedAfter.verifiedSummary}\``);
    }
    lines.push("");
  }
  return lines.join("\n");
}
