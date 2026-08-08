export interface SaveShortcutOptions {
  event: KeyboardEvent | { ctrlKey?: boolean; metaKey?: boolean; key: string; preventDefault?: () => void };
  onSave: () => void | Promise<void>;
  isLockedRef: { current: boolean };
  lockDurationMs?: number;
}

/**
 * Detects if a keyboard event is Ctrl+S (Windows/Linux) or Cmd+S (macOS).
 */
export function isSaveShortcutEvent(e: { ctrlKey?: boolean; metaKey?: boolean; key: string }): boolean {
  const isModifier = Boolean(e.ctrlKey || e.metaKey);
  const isSKey = typeof e.key === "string" && e.key.toLowerCase() === "s";
  return isModifier && isSKey;
}

/**
 * Handles Ctrl+S / Cmd+S save shortcut execution with event.preventDefault() and debounce locking.
 * Returns true if the shortcut was executed, false if ignored or locked.
 */
export function handleSaveShortcut({
  event,
  onSave,
  isLockedRef,
  lockDurationMs = 300,
}: SaveShortcutOptions): boolean {
  if (!isSaveShortcutEvent(event)) {
    return false;
  }

  // Intercept and prevent browser's default Save Page dialog
  if (typeof event.preventDefault === "function") {
    event.preventDefault();
  }

  // Guard against rapid key repeat spamming
  if (isLockedRef.current) {
    return false;
  }

  isLockedRef.current = true;

  try {
    onSave();
  } finally {
    setTimeout(() => {
      isLockedRef.current = false;
    }, lockDurationMs);
  }

  return true;
}
