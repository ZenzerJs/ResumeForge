export type DiffLineType = "add" | "delete" | "unchanged";

export interface DiffLine {
  type: DiffLineType;
  text: string;
  lineOld?: number;
  lineNew?: number;
}

export interface DiffStats {
  addedCount: number;
  deletedCount: number;
  unchangedCount: number;
}

export interface DiffResult {
  lines: DiffLine[];
  stats: DiffStats;
  isTruncated?: boolean;
}

export const MAX_DIFF_LINES = 2000;

/**
 * Computes deterministic line-by-line diff between two text strings using Longest Common Subsequence (LCS).
 * Includes max line count protection (MAX_DIFF_LINES = 2000) to protect main-thread responsiveness.
 */
export function computeLineDiff(oldText: string = "", newText: string = ""): DiffResult {
  const normOld = oldText ? oldText.replace(/\r\n/g, "\n") : "";
  const normNew = newText ? newText.replace(/\r\n/g, "\n") : "";

  if (normOld === normNew) {
    if (!normOld) {
      return {
        lines: [],
        stats: { addedCount: 0, deletedCount: 0, unchangedCount: 0 },
        isTruncated: false,
      };
    }
    let allLines = normOld.split("\n");
    const isTruncated = allLines.length > MAX_DIFF_LINES;
    if (isTruncated) {
      allLines = allLines.slice(0, MAX_DIFF_LINES);
    }
    const lines = allLines.map((text, idx) => ({
      type: "unchanged" as const,
      text,
      lineOld: idx + 1,
      lineNew: idx + 1,
    }));
    return {
      lines,
      stats: { addedCount: 0, deletedCount: 0, unchangedCount: lines.length },
      isTruncated,
    };
  }

  let oldLines = normOld ? normOld.split("\n") : [];
  let newLines = normNew ? normNew.split("\n") : [];

  const isTruncated = oldLines.length > MAX_DIFF_LINES || newLines.length > MAX_DIFF_LINES;

  if (isTruncated) {
    oldLines = oldLines.slice(0, MAX_DIFF_LINES);
    newLines = newLines.slice(0, MAX_DIFF_LINES);
  }

  const m = oldLines.length;
  const n = newLines.length;

  // Build DP table for LCS
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      if (oldLines[i] === newLines[j]) {
        dp[i + 1][j + 1] = dp[i][j] + 1;
      } else {
        dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  // Backtrack to assemble diff entries
  let i = m;
  let j = n;
  const reversedDiff: DiffLine[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      reversedDiff.push({
        type: "unchanged",
        text: oldLines[i - 1],
        lineOld: i,
        lineNew: j,
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      reversedDiff.push({
        type: "add",
        text: newLines[j - 1],
        lineNew: j,
      });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      reversedDiff.push({
        type: "delete",
        text: oldLines[i - 1],
        lineOld: i,
      });
      i--;
    }
  }

  const lines = reversedDiff.reverse();
  let addedCount = 0;
  let deletedCount = 0;
  let unchangedCount = 0;

  for (const line of lines) {
    if (line.type === "add") addedCount++;
    else if (line.type === "delete") deletedCount++;
    else unchangedCount++;
  }

  return {
    lines,
    stats: {
      addedCount,
      deletedCount,
      unchangedCount,
    },
    isTruncated,
  };
}
