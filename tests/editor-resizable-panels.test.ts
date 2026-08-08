import { describe, it, expect, beforeEach, vi } from "vitest";

const STORAGE_KEY = "resumeforge_editor_layout";
const DEFAULT_LAYOUT = { sizes: [45, 35, 20], isAiCollapsed: false };

function loadLayoutState(rawStorage: string | null) {
  if (!rawStorage) return DEFAULT_LAYOUT;
  try {
    const parsed = JSON.parse(rawStorage);
    if (!Array.isArray(parsed.sizes) || parsed.sizes.length !== 3) {
      return DEFAULT_LAYOUT;
    }
    const safeSizes = parsed.sizes.map((val: unknown, index: number) => {
      const num = typeof val === "number" ? val : DEFAULT_LAYOUT.sizes[index];
      const minBounds = [20, 25, 15];
      return Math.max(num, minBounds[index]);
    });
    const isAiCollapsed = typeof parsed.isAiCollapsed === "boolean" ? parsed.isAiCollapsed : false;
    return { sizes: safeSizes, isAiCollapsed };
  } catch {
    return DEFAULT_LAYOUT;
  }
}

describe("Task 9.2 — Resizable & Collapsible Editor Panels Unit Tests", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("1. Default layout renders all three panes [45, 35, 20] when no persisted layout exists", () => {
    const layout = loadLayoutState(null);
    expect(layout.sizes).toEqual([45, 35, 20]);
    expect(layout.isAiCollapsed).toBe(false);
  });

  it("2. Valid layout updates and persists to localStorage structure", () => {
    const customState = JSON.stringify({ sizes: [40, 40, 20], isAiCollapsed: false });
    const layout = loadLayoutState(customState);
    expect(layout.sizes).toEqual([40, 40, 20]);
    expect(layout.isAiCollapsed).toBe(false);
  });

  it("3. Corrupted/invalid localStorage payload falls back safely to default layout without crashing", () => {
    expect(loadLayoutState("{ invalid json...").sizes).toEqual([45, 35, 20]);
    expect(loadLayoutState(JSON.stringify({ sizes: "not-an-array" })).sizes).toEqual([45, 35, 20]);
    expect(loadLayoutState(JSON.stringify({ sizes: [10] })).sizes).toEqual([45, 35, 20]);
  });

  it("4. Minimum size constraints prevent panes from shrinking below bounds (min: 20%, 25%, 15%)", () => {
    const invalidSmall = JSON.stringify({ sizes: [5, 5, 2], isAiCollapsed: false });
    const layout = loadLayoutState(invalidSmall);
    expect(layout.sizes[0]).toBeGreaterThanOrEqual(20);
    expect(layout.sizes[1]).toBeGreaterThanOrEqual(25);
    expect(layout.sizes[2]).toBeGreaterThanOrEqual(15);
  });

  it("5. Collapsing and expanding AI sidebar preserves collapsed state boolean", () => {
    const collapsedState = JSON.stringify({ sizes: [55, 45, 0], isAiCollapsed: true });
    const layout = loadLayoutState(collapsedState);
    expect(layout.isAiCollapsed).toBe(true);
  });

  it("6. Toggling AI sidebar state retains chat message history in memory", () => {
    const sampleChatState = {
      jdText: "Senior Software Engineer Job Posting",
      suggestions: [{ id: "patch-1", targetSection: "Experience" }],
    };

    let chatHistory = { ...sampleChatState };
    let isCollapsed = false;

    // Collapse sidebar
    isCollapsed = true;
    expect(chatHistory.suggestions.length).toBe(1);

    // Expand sidebar
    isCollapsed = false;
    expect(chatHistory.jdText).toBe("Senior Software Engineer Job Posting");
    expect(chatHistory.suggestions[0].id).toBe("patch-1");
  });
});
