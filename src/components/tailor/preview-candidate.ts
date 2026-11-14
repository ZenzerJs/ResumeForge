import type { PatchProposal } from "@/lib/ai/patch-schema";
import { applyPatchProposals } from "@/lib/ai/patch-application";

type Decision = "pending" | "accepted" | "rejected";

/** A preview is ephemeral; every change must apply uniquely to both the batch base and candidate. */
export function buildPreviewCandidate(
  base: string,
  patches: PatchProposal[],
  decisions: Record<string, Decision>,
) {
  let source = base;
  const included: string[] = [];
  const excluded: string[] = [];
  const counts = new Map<string, number>();
  for (const patch of patches)
    counts.set(patch.id, (counts.get(patch.id) || 0) + 1);
  for (const patch of patches) {
    if (decisions[patch.id] === "rejected") continue;
    try {
      if (counts.get(patch.id) !== 1 || !patch.evidenceIds.length)
        throw new Error("Invalid proposal");
      applyPatchProposals(base, [patch]);
      source = applyPatchProposals(source, [patch]).typstSource;
      included.push(patch.id);
    } catch {
      excluded.push(patch.id);
    }
  }
  return { source, included, excluded };
}
