export interface DeterministicPatchResult {
  applied: boolean;
  patchedTypstAst: string;
  citedEvidenceId?: string;
  error?: string;
}

export function validateMetricGrounding(
  proposedBullet: string,
  sourceEvidenceBullet: string
): { valid: boolean; reason?: string } {
  const extractNumbers = (text: string) => {
    // Matches numbers with commas e.g., 1,000, 1.5, 10%
    const regex = /(?:\b|^)(\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?%?(?!\w)/g;
    return (text.match(regex) || []).map(m => {
      const isPercent = m.endsWith('%');
      const cleanNum = m.replace(/,/g, '').replace('%', '');
      const val = parseFloat(cleanNum);
      return { val, isPercent, raw: m };
    });
  };

  const proposedNums = extractNumbers(proposedBullet);
  const sourceNums = extractNumbers(sourceEvidenceBullet);

  for (const p of proposedNums) {
    let matched = false;
    for (const s of sourceNums) {
      if (p.isPercent === s.isPercent) {
        if (p.isPercent) {
          if (Math.abs(p.val - s.val) <= 1.0) {
            matched = true;
            break;
          }
        } else {
          if (p.val === s.val) {
            matched = true;
            break;
          }
        }
      }
    }
    if (!matched) {
      return { valid: false, reason: `Metric ${p.raw} not grounded in source evidence.` };
    }
  }

  return { valid: true };
}

export function applyDeterministicPatch(
  typstAst: string,
  diagnosticId: string,
  targetBulletId: string,
  availableEvidence: Array<{ id: string; content: string; extractedTechnologies: string[] }>
): DeterministicPatchResult {
  const evidence = availableEvidence.find(e => e.id === diagnosticId);
  if (!evidence) {
    return { applied: false, patchedTypstAst: typstAst, error: "Evidence not found." };
  }

  const anchor = `// RF_BULLET:${targetBulletId}`;
  if (!typstAst.includes(anchor)) {
    return { applied: false, patchedTypstAst: typstAst, error: "Target bullet anchor not found." };
  }

  const lines = typstAst.split('\n');
  let newAst = "";
  let applied = false;
  let skipMode = 0; // 0: normal, 1: just saw anchor (skip the next bullet line unconditionally), 2: skipping continuation lines

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (skipMode === 1) {
      // This is the line immediately following the anchor. It's the start of the bullet. We unconditionally skip it.
      skipMode = 2;
      continue;
    } else if (skipMode === 2) {
      // Check if this line is a continuation of the bullet.
      // A continuation line typically starts with whitespace.
      // If it doesn't start with whitespace, it's a new paragraph/bullet.
      if (line.trim() === "" || (!line.startsWith(" ") && !line.startsWith("\t"))) {
        // It's a new block, bullet, or comment. Stop skipping and process it normally.
        skipMode = 0;
      } else {
        // It's likely indented continuation text. Skip it.
        continue;
      }
    }

    if (line.includes(anchor)) {
      newAst += `${line}\n- ${evidence.content}\n`;
      applied = true;
      skipMode = 1;
    } else {
      newAst += line + (i === lines.length - 1 ? "" : "\n");
    }
  }

  if (applied) {
    return { applied, patchedTypstAst: newAst, citedEvidenceId: evidence.id };
  }
  
  return { applied: false, patchedTypstAst: typstAst, error: "Failed to apply patch." };
}
