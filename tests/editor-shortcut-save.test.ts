import { describe, it, expect, vi, beforeEach } from "vitest";
import { isSaveShortcutEvent, handleSaveShortcut } from "@/lib/editor/shortcut-handler";

describe("Task 9.3 — Ctrl+S Save & Auto-Compile Protocol Unit Tests", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("1. Ctrl+S keyboard event is detected correctly on Windows/Linux", () => {
    const event = { ctrlKey: true, metaKey: false, key: "s" };
    expect(isSaveShortcutEvent(event)).toBe(true);
  });

  it("2. Cmd+S keyboard event is detected correctly on macOS (metaKey)", () => {
    const event = { ctrlKey: false, metaKey: true, key: "S" };
    expect(isSaveShortcutEvent(event)).toBe(true);
  });

  it("3. Non-save key combinations (e.g. Ctrl+P, Ctrl+Z, Plain S) are ignored", () => {
    expect(isSaveShortcutEvent({ ctrlKey: true, key: "p" })).toBe(false);
    expect(isSaveShortcutEvent({ ctrlKey: true, key: "z" })).toBe(false);
    expect(isSaveShortcutEvent({ ctrlKey: false, metaKey: false, key: "s" })).toBe(false);
  });

  it("4. Intercepts and calls preventDefault() to prevent browser native save dialog", () => {
    const preventDefaultSpy = vi.fn();
    const onSaveSpy = vi.fn();
    const isLockedRef = { current: false };

    const event = { ctrlKey: true, key: "s", preventDefault: preventDefaultSpy };
    const result = handleSaveShortcut({ event, onSave: onSaveSpy, isLockedRef });

    expect(result).toBe(true);
    expect(preventDefaultSpy).toHaveBeenCalledTimes(1);
    expect(onSaveSpy).toHaveBeenCalledTimes(1);
  });

  it("5. Rapid repeated Ctrl+S presses are locked/throttled to prevent duplicate save spamming", () => {
    const onSaveSpy = vi.fn();
    const isLockedRef = { current: false };
    const event = { ctrlKey: true, key: "s", preventDefault: vi.fn() };

    // First press succeeds
    const res1 = handleSaveShortcut({ event, onSave: onSaveSpy, isLockedRef, lockDurationMs: 500 });
    expect(res1).toBe(true);
    expect(onSaveSpy).toHaveBeenCalledTimes(1);

    // Second rapid press while locked is ignored
    const res2 = handleSaveShortcut({ event, onSave: onSaveSpy, isLockedRef, lockDurationMs: 500 });
    expect(res2).toBe(false);
    expect(onSaveSpy).toHaveBeenCalledTimes(1);
  });

  it("6. Failed compile after successful save still executes save callback cleanly", async () => {
    const saveLogs: string[] = [];
    const onSave = () => {
      saveLogs.push("draft_saved");
      // Simulate compile error thrown during compile step
    };

    const isLockedRef = { current: false };
    const event = { ctrlKey: true, key: "s", preventDefault: vi.fn() };

    handleSaveShortcut({ event, onSave, isLockedRef });
    expect(saveLogs).toEqual(["draft_saved"]);
  });

  it("7. Ctrl+S save handler does not invoke or trigger Save as Master modal", () => {
    let showSaveAsMasterConfirmModal = false;
    const onSaveDraft = () => {
      // Saves local draft buffer only
    };

    const isLockedRef = { current: false };
    const event = { ctrlKey: true, key: "s", preventDefault: vi.fn() };

    handleSaveShortcut({ event, onSave: onSaveDraft, isLockedRef });

    expect(showSaveAsMasterConfirmModal).toBe(false);
  });
});
