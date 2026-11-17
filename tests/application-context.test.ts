import { describe, it, expect, vi } from "vitest";
import {
  ACTIVE_APPLICATION_STORAGE_KEY,
  LEGACY_ACTIVE_JOB_STORAGE_KEY,
  PENDING_REVIEW_CHOICES_STORAGE_KEY,
  buildEditorHref,
  buildLibraryHref,
  buildSafeInternalRouteHref,
  buildSettingsHref,
  buildTailorHref,
  buildTailorNewJobHref,
  buildTailorSampleHref,
  clearActiveApplicationContext,
  createSaveBeforeNavigationController,
  isKnownAppRoute,
  isRecognizedTailorTab,
  isValidContextId,
  normalizeEditorModeParam,
  normalizeTailorTabParam,
  parseTailorReturnContext,
  readActiveApplicationContext,
  readPendingReviewChoices,
  resolveApplicationScopeKey,
  resolveGlobalTailorContext,
  resolveGlobalTailorHref,
  resolveTailorEntryContext,
  updateActiveApplicationContext,
  writeActiveApplicationContext,
  writePendingReviewChoices,
  type StorageLike,
} from "@/lib/tailor/application-context";

function createMemoryStorage(): StorageLike & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store,
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
  };
}

describe("application-context continuity helpers", () => {
  it("validates routes, tabs, editor modes, and entity IDs strictly", () => {
    expect(isRecognizedTailorTab("job-info")).toBe(true);
    expect(isRecognizedTailorTab("3-pane")).toBe(true);
    expect(isRecognizedTailorTab("overview")).toBe(true);
    expect(isRecognizedTailorTab("cover-letter")).toBe(true);
    expect(isRecognizedTailorTab("diagnostic")).toBe(true);
    expect(isRecognizedTailorTab("unknown")).toBe(false);
    expect(normalizeTailorTabParam("unknown")).toBe("job-info");
    expect(normalizeTailorTabParam("3-pane")).toBe("3-pane");

    expect(normalizeEditorModeParam("visual")).toBe("visual");
    expect(normalizeEditorModeParam("code")).toBe("code");
    expect(normalizeEditorModeParam("raw")).toBeNull();

    expect(isKnownAppRoute("/tailor")).toBe(true);
    expect(isKnownAppRoute("/editor")).toBe(true);
    expect(isKnownAppRoute("/library")).toBe(true);
    expect(isKnownAppRoute("/settings")).toBe(true);
    expect(isKnownAppRoute("/tracker")).toBe(true);
    expect(isKnownAppRoute("/tracker/feed")).toBe(true);
    expect(isKnownAppRoute("//evil.com")).toBe(false);
    expect(isKnownAppRoute("https://evil.com")).toBe(false);
    expect(isKnownAppRoute("/unknown")).toBe(false);

    expect(isValidContextId("job_123-abc.1")).toBe(true);
    expect(isValidContextId("guest-job-1700000")).toBe(true);
    expect(isValidContextId("../secret")).toBe(false);
    expect(isValidContextId("job/123")).toBe(false);
    expect(isValidContextId("job 123")).toBe(false);
    expect(isValidContextId("")).toBe(false);
    expect(isValidContextId(null)).toBe(false);
  });

  it("scopes active-job storage to current account or guest session and prevents cross-account leaks", () => {
    const storage = createMemoryStorage();
    const userA = { userId: "user-a", demoMode: false };
    const userB = { userId: "user-b", demoMode: false };
    const guest = { userId: null, demoMode: false };
    const demo = { userId: null, demoMode: true };

    expect(resolveApplicationScopeKey({ scopeResolved: false })).toBeNull();
    expect(resolveApplicationScopeKey(userA)).toBe("user:user-a");
    expect(resolveApplicationScopeKey(guest)).toBe("guest:default");
    expect(resolveApplicationScopeKey(demo)).toBe("demo:default");

    const written = writeActiveApplicationContext(
      {
        jobId: "job-a1",
        tab: "3-pane",
        roleTitle: "Staff Engineer",
        company: "Acme",
        variantId: "var-a1",
        mode: "visual",
      },
      userA,
      storage
    );
    expect(written?.jobId).toBe("job-a1");
    expect(storage.getItem(LEGACY_ACTIVE_JOB_STORAGE_KEY)).toBe("job-a1");
    expect(readActiveApplicationContext(userA, storage)?.roleTitle).toBe("Staff Engineer");

    // Unresolved auth must not read any user's stored job
    expect(readActiveApplicationContext({ scopeResolved: false }, storage)).toBeNull();

    // Switching to user B or logging out to guest must return null and purge stale keys
    expect(readActiveApplicationContext(userB, storage)).toBeNull();
    expect(storage.getItem(ACTIVE_APPLICATION_STORAGE_KEY)).toBeNull();
    expect(storage.getItem(LEGACY_ACTIVE_JOB_STORAGE_KEY)).toBeNull();

    // Guest session writes and updates independently, then clear removes all keys
    writeActiveApplicationContext({ jobId: "guest-job-1", tab: "overview" }, guest, storage);
    updateActiveApplicationContext({ roleTitle: "Platform Lead" }, guest, storage);
    expect(readActiveApplicationContext(guest, storage)).toMatchObject({
      jobId: "guest-job-1",
      tab: "overview",
      roleTitle: "Platform Lead",
    });
    expect(readActiveApplicationContext(demo, storage)).toBeNull();

    clearActiveApplicationContext(storage);
    expect(storage.getItem(ACTIVE_APPLICATION_STORAGE_KEY)).toBeNull();
    expect(storage.getItem(LEGACY_ACTIVE_JOB_STORAGE_KEY)).toBeNull();
  });

  it("enforces entry precedence: explicit new job / sample / jobId / document link over stored active job", () => {
    const storage = createMemoryStorage();
    const scope = { userId: "user-1", demoMode: false };

    writeActiveApplicationContext(
      {
        jobId: "stored-job-1",
        tab: "3-pane",
        roleTitle: "Stored Role",
        variantId: "var-stored",
        mode: "visual",
      },
      scope,
      storage
    );

    // 1. Explicit new job beats stored active job
    const newEntry = resolveTailorEntryContext("?new=1", scope, { storage });
    expect(newEntry.source).toBe("explicit-new");
    expect(newEntry.jobId).toBeNull();
    expect(newEntry.tab).toBe("job-info");

    // 2. Explicit sample beats stored active job
    const sampleEntry = resolveTailorEntryContext("?sample=backend&tab=job-info", scope, { storage });
    expect(sampleEntry.source).toBe("explicit-sample");
    expect(sampleEntry.sampleKind).toBe("backend");
    expect(sampleEntry.jobId).toBeNull();

    // 3. Explicit jobId beats stored active job
    const explicitJobEntry = resolveTailorEntryContext("?jobId=job-2&tab=overview", scope, { storage });
    expect(explicitJobEntry.source).toBe("explicit-job");
    expect(explicitJobEntry.jobId).toBe("job-2");
    expect(explicitJobEntry.tab).toBe("overview");
    expect(explicitJobEntry.variantId).toBeNull();

    // 4. Explicit document link (variantId / resumeId) beats stored active job
    const docEntry = resolveTailorEntryContext("?variantId=var-direct&mode=code", scope, { storage });
    expect(docEntry.source).toBe("explicit-document");
    expect(docEntry.jobId).toBeNull();
    expect(docEntry.variantId).toBe("var-direct");
    expect(docEntry.mode).toBe("code");

    // 5. No explicit context restores stored active job for current scope
    const restored = resolveTailorEntryContext("", scope, { storage });
    expect(restored.source).toBe("stored-active");
    expect(restored.jobId).toBe("stored-job-1");
    expect(restored.tab).toBe("3-pane");
    expect(restored.variantId).toBe("var-stored");
    expect(restored.mode).toBe("visual");

    // 6. Global Tailor href helpers reflect stored context
    expect(resolveGlobalTailorHref(scope, storage)).toBe(
      "/tailor?jobId=stored-job-1&tab=3-pane&variantId=var-stored&mode=visual"
    );
    expect(resolveGlobalTailorContext({ userId: "other-user" }, storage)).toEqual({
      href: "/tailor",
      activeContext: null,
    });
  });

  it("builds safe internal links and parses valid Tailor return contexts only", () => {
    const storage = createMemoryStorage();
    const scope = { userId: "user-1", demoMode: false };
    writeActiveApplicationContext(
      {
        jobId: "job-99",
        tab: "3-pane",
        roleTitle: "Backend Engineer",
        company: "Nova Labs",
        variantId: "var-99",
        mode: "visual",
      },
      scope,
      storage
    );

    expect(buildSafeInternalRouteHref("https://evil.example/tailor", { jobId: "job-99" })).toBeNull();
    expect(buildSafeInternalRouteHref("/admin", { jobId: "job-99" })).toBeNull();
    expect(buildTailorNewJobHref()).toBe("/tailor?new=1");
    expect(buildTailorSampleHref({ sample: "frontend" })).toBe("/tailor?sample=frontend");
    expect(
      buildEditorHref({
        variantId: "var-99",
        mode: "visual",
        from: "tailor",
        tab: "3-pane",
        jobId: "job-99",
      })
    ).toBe("/editor?jobId=job-99&from=tailor&tab=3-pane&variantId=var-99&mode=visual");
    expect(
      buildSettingsHref({
        from: "tailor",
        tab: "overview",
        jobId: "job-99",
        variantId: "var-99",
        mode: "visual",
      })
    ).toBe("/settings?jobId=job-99&from=tailor&tab=overview&variantId=var-99&mode=visual");
    expect(
      buildLibraryHref({
        from: "tailor",
        tab: "3-pane",
        jobId: "job-99",
        skill: "PostgreSQL",
      })
    ).toBe("/library?jobId=job-99&from=tailor&tab=3-pane&skill=PostgreSQL");

    // Valid return context with jobId enriches role title & preserves variant/mode
    const parsed = parseTailorReturnContext(
      "?from=tailor&jobId=job-99&tab=3-pane&variantId=var-99&mode=visual",
      { scope, storage }
    );
    expect(parsed).toEqual({
      from: "tailor",
      href: "/tailor?jobId=job-99&tab=3-pane&variantId=var-99&mode=visual",
      jobId: "job-99",
      tab: "3-pane",
      roleTitle: "Backend Engineer",
      company: "Nova Labs",
      variantId: "var-99",
      resumeId: null,
      mode: "visual",
      label: "Back to Tailor · Backend Engineer",
    });

    // Overrides (e.g., user switched mode in Editor) update return href
    const withOverride = parseTailorReturnContext(
      "?from=tailor&jobId=job-99&tab=3-pane&variantId=var-99&mode=visual",
      { scope, storage, overrides: { mode: "code" } }
    );
    expect(withOverride?.href).toBe(
      "/tailor?jobId=job-99&tab=3-pane&variantId=var-99&mode=code"
    );

    // Invalid or missing context hides the return action
    expect(parseTailorReturnContext("?jobId=job-99&tab=3-pane", { scope, storage })).toBeNull();
    expect(parseTailorReturnContext("?from=tailor", { scope, storage })).toBeNull();
    expect(parseTailorReturnContext("?from=tailor&tab=bogus", { scope, storage })).toBeNull();
    expect(parseTailorReturnContext("?from=tailor&jobId=../bad&tab=overview", { scope, storage })).toBeNull();
    expect(
      parseTailorReturnContext("?from=tailor&tab=overview", {
        scope,
        storage,
        requireJobId: true,
      })
    ).toBeNull();
    // Settings return without jobId is valid when recognized tab is present and requireJobId is false
    expect(parseTailorReturnContext("?from=tailor&tab=overview", { scope, storage })).toMatchObject({
      href: "/tailor?tab=overview",
      tab: "overview",
      jobId: null,
      label: "Back to Tailor",
    });
    expect(buildTailorHref({ jobId: "job-1", tab: "bogus" })).toBe("/tailor?jobId=job-1&tab=job-info");
  });

  it("scopes pending review choices by account and jobId", () => {
    const storage = createMemoryStorage();
    const userA = { userId: "user-a", demoMode: false };
    const userB = { userId: "user-b", demoMode: false };

    writePendingReviewChoices(
      {
        jobId: "job-1",
        batchId: "batch-1",
        decisions: { "p-1": "accepted", "p-2": "rejected" },
        acknowledgedSkills: ["Kubernetes"],
      },
      userA,
      storage
    );

    expect(readPendingReviewChoices("job-1", userA, storage)).toMatchObject({
      jobId: "job-1",
      batchId: "batch-1",
      decisions: { "p-1": "accepted", "p-2": "rejected" },
      acknowledgedSkills: ["Kubernetes"],
    });
    expect(readPendingReviewChoices("job-2", userA, storage)).toBeNull();
    expect(readPendingReviewChoices("job-1", userB, storage)).toBeNull();
    expect(storage.getItem(PENDING_REVIEW_CHOICES_STORAGE_KEY)).toBeNull();
  });

  it("handles save-before-navigation waiting, failure focus/retry, and review-choice preservation", async () => {
    const controller = createSaveBeforeNavigationController();
    const draftText = "Important unsaved job notes";
    const focusError = vi.fn();
    const navigate = vi.fn();

    // Pending save failure keeps edits, focuses error, and unlocks for retry
    let shouldFail = true;
    let releaseSave!: () => void;
    const pendingSaveGate = new Promise<void>((resolve) => {
      releaseSave = resolve;
    });

    const firstAttemptPromise = controller.execute({
      hasPendingSave: true,
      save: async () => {
        await pendingSaveGate;
        if (shouldFail) {
          return { ok: false, error: "Network timeout saving draft" };
        }
        return { ok: true, context: { jobId: "saved-job-1" } };
      },
      onNavigate: navigate,
      onErrorFocus: focusError,
    });

    // Duplicate click while save is in flight is ignored
    const duplicateClick = await controller.execute({
      hasPendingSave: true,
      save: async () => ({ ok: true }),
      onNavigate: navigate,
    });
    expect(duplicateClick).toEqual({ status: "in-flight" });

    releaseSave();
    const firstOutcome = await firstAttemptPromise;
    expect(firstOutcome).toEqual({
      status: "failed",
      error: "Network timeout saving draft",
      canRetry: true,
    });
    expect(draftText).toBe("Important unsaved job notes");
    expect(focusError).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
    expect(controller.isPending).toBe(false);

    // Retry succeeds and navigates
    shouldFail = false;
    const retryOutcome = await controller.execute({
      hasPendingSave: true,
      save: async () => ({ ok: true, context: { jobId: "saved-job-1" } }),
      onNavigate: navigate,
      onErrorFocus: focusError,
    });
    expect(retryOutcome).toEqual({
      status: "navigated",
      context: { jobId: "saved-job-1" },
    });
    expect(navigate).toHaveBeenCalledWith({ jobId: "saved-job-1" });

    // Unpreservable review choices let user stay before discarding
    const stayOutcome = await controller.execute({
      hasPendingSave: false,
      hasPendingReviewChoices: true,
      canPreserveReviewChoices: false,
      confirmDiscardReviewChoices: async () => false,
      save: async () => ({ ok: true }),
      onNavigate: navigate,
    });
    expect(stayOutcome).toEqual({
      status: "cancelled",
      reason: "review-choices-retained",
    });
    expect(navigate).toHaveBeenCalledTimes(1);

    // Preservable review choices save and navigate without prompting discard
    const preserveMock = vi.fn(() => true);
    const preserveOutcome = await controller.execute({
      hasPendingSave: false,
      hasPendingReviewChoices: true,
      canPreserveReviewChoices: true,
      preserveReviewChoices: preserveMock,
      confirmDiscardReviewChoices: async () => false,
      save: async () => ({ ok: true }),
      onNavigate: navigate,
    });
    expect(preserveMock).toHaveBeenCalledTimes(1);
    expect(preserveOutcome).toEqual({ status: "navigated", context: undefined });
    expect(navigate).toHaveBeenCalledTimes(2);
  });
});
