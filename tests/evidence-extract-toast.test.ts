import { describe, it, expect } from "vitest";

function formatEvidenceExtractToast(persist?: {
  createdCount?: number;
  skippedDuplicateDraftCount?: number;
  skippedVerifiedCount?: number;
}): string {
  const n = persist?.createdCount ?? 0;
  const dup = persist?.skippedDuplicateDraftCount ?? 0;
  const ver = persist?.skippedVerifiedCount ?? 0;

  if (n > 0) {
    return `${n} draft evidence item${n === 1 ? "" : "s"} created — review in Library`;
  }
  if (dup > 0 || ver > 0) {
    return `No new items — ${dup} already drafted, ${ver} verified (edit in Library)`;
  }
  return "No extractable evidence found in this resume.";
}

describe("Evidence Extract Toast Formatting", () => {
  it("formats newly created draft items correctly", () => {
    const result1 = formatEvidenceExtractToast({ createdCount: 1 });
    expect(result1).toBe("1 draft evidence item created — review in Library");

    const result3 = formatEvidenceExtractToast({ createdCount: 3 });
    expect(result3).toBe("3 draft evidence items created — review in Library");
  });

  it("formats duplicate drafts and verified items clearly when createdCount is 0", () => {
    const resultDup = formatEvidenceExtractToast({
      createdCount: 0,
      skippedDuplicateDraftCount: 2,
      skippedVerifiedCount: 1,
    });
    expect(resultDup).toBe("No new items — 2 already drafted, 1 verified (edit in Library)");
  });

  it("returns fallback message when no extractable items and 0 duplicates found", () => {
    const resultEmpty = formatEvidenceExtractToast({
      createdCount: 0,
      skippedDuplicateDraftCount: 0,
      skippedVerifiedCount: 0,
    });
    expect(resultEmpty).toBe("No extractable evidence found in this resume.");
  });
});
