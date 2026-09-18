import { describe, it, expect } from "vitest";
import { computeLineDiff, MAX_DIFF_LINES } from "@/lib/diff/simple-diff";

describe("computeLineDiff algorithm", () => {
  it("handles identical texts", () => {
    const text = "= Jane Doe\n== EXPERIENCE\n*Stripe* -- Engineer";
    const result = computeLineDiff(text, text);

    expect(result.stats.addedCount).toBe(0);
    expect(result.stats.deletedCount).toBe(0);
    expect(result.stats.unchangedCount).toBe(3);
    expect(result.lines).toHaveLength(3);
    expect(result.isTruncated).toBe(false);
    expect(result.lines[0]).toEqual({
      type: "unchanged",
      text: "= Jane Doe",
      lineOld: 1,
      lineNew: 1,
    });
  });

  it("handles completely empty texts", () => {
    const result = computeLineDiff("", "");
    expect(result.stats).toEqual({ addedCount: 0, deletedCount: 0, unchangedCount: 0 });
    expect(result.lines).toEqual([]);
    expect(result.isTruncated).toBe(false);
  });

  it("handles creation from empty prior text (all additions)", () => {
    const newText = "Line 1\nLine 2\nLine 3";
    const result = computeLineDiff("", newText);

    expect(result.stats.addedCount).toBe(3);
    expect(result.stats.deletedCount).toBe(0);
    expect(result.stats.unchangedCount).toBe(0);
    expect(result.lines.every((l) => l.type === "add")).toBe(true);
    expect(result.lines[0].lineNew).toBe(1);
    expect(result.lines[2].lineNew).toBe(3);
  });

  it("handles total deletion to empty text", () => {
    const oldText = "Line 1\nLine 2";
    const result = computeLineDiff(oldText, "");

    expect(result.stats.addedCount).toBe(0);
    expect(result.stats.deletedCount).toBe(2);
    expect(result.stats.unchangedCount).toBe(0);
    expect(result.lines.every((l) => l.type === "delete")).toBe(true);
    expect(result.lines[0].lineOld).toBe(1);
    expect(result.lines[1].lineOld).toBe(2);
  });

  it("detects line additions in the middle of a document", () => {
    const oldText = "Header\nFooter";
    const newText = "Header\nMiddle Line 1\nMiddle Line 2\nFooter";

    const result = computeLineDiff(oldText, newText);

    expect(result.stats.addedCount).toBe(2);
    expect(result.stats.deletedCount).toBe(0);
    expect(result.stats.unchangedCount).toBe(2);

    expect(result.lines[0]).toEqual({ type: "unchanged", text: "Header", lineOld: 1, lineNew: 1 });
    expect(result.lines[1]).toEqual({ type: "add", text: "Middle Line 1", lineNew: 2 });
    expect(result.lines[2]).toEqual({ type: "add", text: "Middle Line 2", lineNew: 3 });
    expect(result.lines[3]).toEqual({ type: "unchanged", text: "Footer", lineOld: 2, lineNew: 4 });
  });

  it("detects line deletions and replacements correctly", () => {
    const oldText = "= Jane Doe\n== EXPERIENCE\n*Google* -- Engineer\n- Reduced latency by 20ms.";
    const newText = "= Jane Doe\n== EXPERIENCE\n*Stripe* -- Senior Engineer\n- Reduced latency by 45ms.";

    const result = computeLineDiff(oldText, newText);

    expect(result.stats.unchangedCount).toBe(2); // "= Jane Doe", "== EXPERIENCE"
    expect(result.stats.deletedCount).toBe(2);   // "*Google*...", "- Reduced latency by 20ms."
    expect(result.stats.addedCount).toBe(2);     // "*Stripe*...", "- Reduced latency by 45ms."

    const addedLines = result.lines.filter((l) => l.type === "add").map((l) => l.text);
    const deletedLines = result.lines.filter((l) => l.type === "delete").map((l) => l.text);

    expect(addedLines).toContain("*Stripe* -- Senior Engineer");
    expect(addedLines).toContain("- Reduced latency by 45ms.");
    expect(deletedLines).toContain("*Google* -- Engineer");
    expect(deletedLines).toContain("- Reduced latency by 20ms.");
  });

  it("normalizes Windows CRLF line endings transparently", () => {
    const oldText = "Line 1\r\nLine 2\r\n";
    const newText = "Line 1\nLine 2\nLine 3";

    const result = computeLineDiff(oldText, newText);
    expect(result.stats.addedCount).toBe(1);
    expect(result.stats.unchangedCount).toBe(2);
  });

  it("caps oversized inputs exceeding 2,000 lines with isTruncated flag", () => {
    const hugeOld = Array.from({ length: 2500 }, (_, i) => `Line ${i + 1}`).join("\n");
    const hugeNew = Array.from({ length: 2500 }, (_, i) => (i === 10 ? `Line 11 Modified` : `Line ${i + 1}`)).join("\n");

    const result = computeLineDiff(hugeOld, hugeNew);

    expect(result.isTruncated).toBe(true);
    expect(result.lines.length).toBeLessThanOrEqual(MAX_DIFF_LINES + 5);
    expect(result.stats.addedCount).toBeGreaterThanOrEqual(1);
  });
});
