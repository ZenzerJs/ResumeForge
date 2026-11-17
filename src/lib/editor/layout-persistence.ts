export const EDITOR_LAYOUT_STORAGE_KEY = "resumeforge_editor_layout";

export interface EditorLayoutState {
  sizes: Record<string, number>;
  isAiCollapsed: boolean;
}

export const DEFAULT_EDITOR_LAYOUT: EditorLayoutState = {
  sizes: {
    "panel-code": 30,
    "panel-preview": 50,
    "panel-ai": 20,
  },
  isAiCollapsed: false,
};

export const MIN_PANEL_SIZES: Record<string, number> = {
  "panel-code": 20,
  "panel-preview": 25,
  "panel-ai": 15,
};

const DEFAULT_DEMO_EDITOR_LAYOUT = { ...DEFAULT_EDITOR_LAYOUT, isAiCollapsed: true };

export const TWO_PANE_EDITOR_LAYOUT = { "panel-code": 35, "panel-preview": 65 };

/**
 * Parses and validates persisted editor layout state from localStorage.
 * Uses the deployment's default only when no valid preference was stored.
 */
export function parsePersistedLayout(rawStorage: string | null, demoMode = false): EditorLayoutState {
  const defaults = demoMode ? DEFAULT_DEMO_EDITOR_LAYOUT : DEFAULT_EDITOR_LAYOUT;
  if (!rawStorage) return defaults;
  try {
    const parsed = JSON.parse(rawStorage);
    if (!parsed || typeof parsed !== "object" || !parsed.sizes || typeof parsed.sizes !== "object" || Array.isArray(parsed.sizes)) {
      return defaults;
    }

    const isAiCollapsed = typeof parsed.isAiCollapsed === "boolean" ? parsed.isAiCollapsed : defaults.isAiCollapsed;
    const sizes: Record<string, number> = {};
    for (const [key, defaultVal] of Object.entries(defaults.sizes)) {
      const value = parsed.sizes[key];
      const size = typeof value === "number" && Number.isFinite(value) ? Math.min(value, 100) : defaultVal;
      const minSize = isAiCollapsed && key === "panel-ai" && size === 0 ? 0 : MIN_PANEL_SIZES[key];
      sizes[key] = Math.max(size, minSize);
    }

    return { sizes, isAiCollapsed };
  } catch {
    return defaults;
  }
}

export function getDesktopPanelLayout(sizes: EditorLayoutState["sizes"], isAiCollapsed: boolean) {
  if (!isAiCollapsed) return sizes;
  return {
    "panel-code": sizes["panel-code"],
    "panel-preview": sizes["panel-preview"] + sizes["panel-ai"],
    "panel-ai": 0,
  };
}

/**
 * Serializes layout sizes and collapsed state into JSON for localStorage.
 */
export function serializeLayoutState(sizes: Record<string, number>, isAiCollapsed: boolean): string {
  return JSON.stringify({ sizes, isAiCollapsed });
}
