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

  it("4. Intercepts and calls preventDefault() to prevent browser native save dialog", async () => {
    const preventDefaultSpy = vi.fn();
    const onSaveSpy = vi.fn();
    const isLockedRef = { current: false };

    const event = { ctrlKey: true, key: "s", preventDefault: preventDefaultSpy };
    const result = await handleSaveShortcut({ event, onSave: onSaveSpy, isLockedRef });

    expect(result).toBe(true);
    expect(preventDefaultSpy).toHaveBeenCalledTimes(1);
    expect(onSaveSpy).toHaveBeenCalledTimes(1);
  });

  it("5. Rapid repeated Ctrl+S presses while locked or compiling are rejected", async () => {
    let resolveCompile: () => void = () => {};
    const slowCompileSave = () => new Promise<void>((res) => { resolveCompile = res; });
    const isLockedRef = { current: false };
    const event = { ctrlKey: true, key: "s", preventDefault: vi.fn() };

    // Start first async save/compile
    const promise1 = handleSaveShortcut({ event, onSave: slowCompileSave, isLockedRef });
    expect(isLockedRef.current).toBe(true);

    // Second press while compile is in-flight is rejected (returns false)
    const res2 = await handleSaveShortcut({ event, onSave: slowCompileSave, isLockedRef });
    expect(res2).toBe(false);

    // Resolve first compile
    resolveCompile();
    await promise1;
  });

  it("6. Async compilation error in onSave releases lock in finally block without swallowing exceptions", async () => {
    const failingSave = async () => {
      throw new Error("Typst compilation error");
    };
    const isLockedRef = { current: false };
    const event = { ctrlKey: true, key: "s", preventDefault: vi.fn() };

    await expect(
      handleSaveShortcut({ event, onSave: failingSave, isLockedRef, lockDurationMs: 0 })
    ).rejects.toThrow("Typst compilation error");

    await new Promise((res) => setTimeout(res, 10));
    // Verify lock is released after error
    expect(isLockedRef.current).toBe(false);
  });

  it("7. Shortcut handler executes onSave callback and returns boolean status without side effects", async () => {
    const isLockedRef = { current: false };
    const event = { ctrlKey: true, key: "s", preventDefault: vi.fn() };

    let draftSaved = false;
    const result = await handleSaveShortcut({
      event,
      onSave: () => { draftSaved = true; },
      isLockedRef,
    });

    expect(result).toBe(true);
    expect(draftSaved).toBe(true);
  });
});
