import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  parsePersistedLayout,
  serializeLayoutState,
  DEFAULT_EDITOR_LAYOUT,
  MIN_PANEL_SIZES,
  EDITOR_LAYOUT_STORAGE_KEY,
} from "@/lib/editor/layout-persistence";

describe("Task 9.2 — Resizable & Collapsible Editor Panels Unit Tests", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("1. Default layout renders all three panes [panel-code: 45, panel-preview: 35, panel-ai: 20] when no persisted layout exists", () => {
    const layout = parsePersistedLayout(null);
    expect(layout.sizes).toEqual({
      "panel-code": 45,
      "panel-preview": 35,
      "panel-ai": 20,
    });
    expect(layout.isAiCollapsed).toBe(false);
  });

  it("2. Valid layout updates and persists to localStorage structure via serializeLayoutState", () => {
    const customSizes = { "panel-code": 40, "panel-preview": 40, "panel-ai": 20 };
    const serialized = serializeLayoutState(customSizes, false);
    const layout = parsePersistedLayout(serialized);

    expect(layout.sizes).toEqual(customSizes);
    expect(layout.isAiCollapsed).toBe(false);
  });

  it("3. Corrupted/invalid localStorage payload falls back safely to DEFAULT_EDITOR_LAYOUT without crashing", () => {
    expect(parsePersistedLayout("{ invalid json...").sizes).toEqual(DEFAULT_EDITOR_LAYOUT.sizes);
    expect(parsePersistedLayout(JSON.stringify({ sizes: "not-an-object" })).sizes).toEqual(
      DEFAULT_EDITOR_LAYOUT.sizes
    );
    expect(parsePersistedLayout(JSON.stringify({ sizes: [] })).sizes).toEqual(
      DEFAULT_EDITOR_LAYOUT.sizes
    );
  });

  it("4. Minimum size constraints prevent panes from shrinking below bounds (min: 20%, 25%, 15%)", () => {
    const invalidSmall = JSON.stringify({
      sizes: { "panel-code": 5, "panel-preview": 5, "panel-ai": 2 },
      isAiCollapsed: false,
    });
    const layout = parsePersistedLayout(invalidSmall);

    expect(layout.sizes["panel-code"]).toBeGreaterThanOrEqual(MIN_PANEL_SIZES["panel-code"]);
    expect(layout.sizes["panel-preview"]).toBeGreaterThanOrEqual(MIN_PANEL_SIZES["panel-preview"]);
    expect(layout.sizes["panel-ai"]).toBeGreaterThanOrEqual(MIN_PANEL_SIZES["panel-ai"]);
  });

  it("5. Collapsing and expanding AI sidebar preserves collapsed state boolean", () => {
    const collapsedState = serializeLayoutState(
      { "panel-code": 55, "panel-preview": 45, "panel-ai": 0 },
      true
    );
    const layout = parsePersistedLayout(collapsedState);
    expect(layout.isAiCollapsed).toBe(true);
  });

  it("6. Storage key constant matches resumeforge_editor_layout", () => {
    expect(EDITOR_LAYOUT_STORAGE_KEY).toBe("resumeforge_editor_layout");
  });
});
