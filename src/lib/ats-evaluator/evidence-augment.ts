import type { EvidenceItemForPrompt } from "@/lib/ai/types";

type EvidenceLike = {
  status?: string | null;
  title: string;
  organization?: string | null;
  dates?: string | null;
  verifiedSummary?: string | null;
  tags?: string[] | null;
  bullets?: Array<{ text: string; technologies?: string[] | null; verified?: boolean | null }> | null;
};

/**
 * Appends verified Evidence Bank text to Typst so ATS keyword matching
 * reflects both the saved master resume and verified evidence library records.
 * Unverified drafts and archived records are excluded.
 */
export function augmentTypstWithEvidenceBank(
  typstContent: string,
  evidenceItems: EvidenceLike[]
): string {
  const verified = evidenceItems.filter((item) => item.status === "verified");
  if (verified.length === 0) return typstContent;

  const blocks = verified.map((item) => {
    const tags = Array.isArray(item.tags) ? item.tags.join(", ") : "";
    const bullets = (item.bullets || [])
      .filter((b) => b.verified !== false)
      .map((b) => {
        const tech = Array.isArray(b.technologies) && b.technologies.length
          ? ` [${b.technologies.join(", ")}]`
          : "";
        return `- ${b.text}${tech}`;
      })
      .join("\n");

    return [
      `=== ${item.title}${item.organization ? ` @ ${item.organization}` : ""}`,
      item.dates ? `Dates: ${item.dates}` : null,
      item.verifiedSummary || null,
      tags ? `Tags: ${tags}` : null,
      bullets || null,
    ]
      .filter(Boolean)
      .join("\n");
  });

  return `${typstContent.trim()}

= Evidence Bank
${blocks.join("\n\n")}
`;
}

export function toEvidencePromptItems(evidenceItems: EvidenceLike[]): EvidenceItemForPrompt[] {
  return evidenceItems
    .filter((item) => item.status === "verified")
    .map((item) => ({
      id: (item as { id?: string }).id || item.title,
      type: (item as { type?: string }).type || "experience",
      title: item.title,
      organization: item.organization || null,
      dates: item.dates || null,
      verifiedSummary: item.verifiedSummary || "",
      tags: item.tags || [],
      status: "verified",
      bullets: (item.bullets || [])
        .filter((b) => b.verified !== false)
        .map((b, idx) => ({
          id: (b as { id?: string }).id || `bullet-${idx}`,
          text: b.text,
          technologies: b.technologies || [],
          roleAffinity: [],
          verified: true,
        })),
    })) as EvidenceItemForPrompt[];
}
