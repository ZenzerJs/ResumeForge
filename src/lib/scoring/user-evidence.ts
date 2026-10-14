import { prisma } from "@/lib/prisma";
import type { EvidenceItemWithBullets } from "@/lib/matching/matcher";

function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

/** Personalized scoring uses only the signed-in user's skill tags. Guests get none. */
export async function loadScoringEvidence(userId: string | null): Promise<{
  candidateSkills: string[];
  evidenceItemsForMatching: EvidenceItemWithBullets[];
}> {
  if (!userId) {
    return { candidateSkills: [], evidenceItemsForMatching: [] };
  }

  const evidenceRecords = await prisma.evidenceItem.findMany({
    where: { userId, status: "verified" },
    select: {
      id: true,
      tags: true,
      bullets: { select: { id: true, technologies: true } },
    },
  });

  const evidenceItemsForMatching: EvidenceItemWithBullets[] = evidenceRecords.map((e) => {
    const tags = parseJsonArray(e.tags);
    const bullets = e.bullets.map((b) => ({
      id: b.id,
      text: "",
      technologies: parseJsonArray(b.technologies),
      roleAffinity: [] as string[],
      verified: true,
    }));
    return {
      id: e.id,
      type: "experience",
      title: "",
      verifiedSummary: "",
      tags,
      status: "verified",
      bullets,
    };
  });

  const candidateSkills = evidenceItemsForMatching.flatMap((e) => [
    ...e.tags,
    ...e.bullets.flatMap((b) => b.technologies),
  ]);

  return { candidateSkills, evidenceItemsForMatching };
}
