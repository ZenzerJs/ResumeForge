import type { PatchProposal } from "@/lib/ai/patch-schema";

export interface AppliedPatchProposals {
  typstSource: string;
  appliedIds: string[];
}

/** Reconstruct accepted changes from the exact base source; never trusts merged client text. */
export function applyPatchProposals(
  baseTypstSource: string,
  patches: readonly PatchProposal[]
): AppliedPatchProposals {
  let typstSource = baseTypstSource;
  const appliedIds: string[] = [];
  for (const patch of patches) {
    if (!patch.before.trim()) throw new Error(`Patch ${patch.id} has no source anchor.`);
    const first = typstSource.indexOf(patch.before);
    if (first < 0 || typstSource.indexOf(patch.before, first + 1) >= 0) {
      throw new Error(`Patch ${patch.id} source anchor is missing or ambiguous.`);
    }
    const next = typstSource.slice(0, first) + patch.after + typstSource.slice(first + patch.before.length);
    if (next === typstSource) throw new Error(`Patch ${patch.id} makes no change.`);
    typstSource = next;
    appliedIds.push(patch.id);
  }
  return { typstSource, appliedIds };
}
