export const EDITOR_LAYOUT_STORAGE_KEY = "resumeforge_editor_layout";

export interface EditorLayoutState {
  sizes: Record<string, number>;
  isAiCollapsed: boolean;
}

export const DEFAULT_EDITOR_LAYOUT: EditorLayoutState = {
  sizes: {
    "panel-code": 45,
    "panel-preview": 35,
    "panel-ai": 20,
  },
  isAiCollapsed: false,
};

export const MIN_PANEL_SIZES: Record<string, number> = {
  "panel-code": 20,
  "panel-preview": 25,
  "panel-ai": 15,
};

/**
 * Parses and validates persisted editor layout state from localStorage.
 * Falls back to default values [45, 35, 20] if null, corrupted, or invalid.
 */
export function parsePersistedLayout(rawStorage: string | null): EditorLayoutState {
  if (!rawStorage) return DEFAULT_EDITOR_LAYOUT;
  try {
    const parsed = JSON.parse(rawStorage);
    if (!parsed || typeof parsed !== "object" || !parsed.sizes || typeof parsed.sizes !== "object") {
      return DEFAULT_EDITOR_LAYOUT;
    }

    const sizes: Record<string, number> = {};
    for (const [key, defaultVal] of Object.entries(DEFAULT_EDITOR_LAYOUT.sizes)) {
      const val = typeof parsed.sizes[key] === "number" ? parsed.sizes[key] : defaultVal;
      const minBound = MIN_PANEL_SIZES[key] || 10;
      sizes[key] = Math.max(val, minBound);
    }

    const isAiCollapsed = typeof parsed.isAiCollapsed === "boolean" ? parsed.isAiCollapsed : false;
    return { sizes, isAiCollapsed };
  } catch {
    return DEFAULT_EDITOR_LAYOUT;
  }
}

/**
 * Serializes layout sizes and collapsed state into JSON for localStorage.
 */
export function serializeLayoutState(sizes: Record<string, number>, isAiCollapsed: boolean): string {
  return JSON.stringify({ sizes, isAiCollapsed });
}
