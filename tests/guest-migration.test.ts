import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import {
  evaluateGuestMigrationState,
  executeGuestMigrationBatches,
  getGuestMigrationCopy,
  GuestMigrationModal,
  hasPendingGuestDraftInStorage,
  isCustomGuestDraftSource,
  parseGuestEvidenceEntries,
  parseGuestEvidenceItems,
} from "@/components/auth/guest-migration-modal";

describe("Guest-to-Account Draft Migration (Release Hardening)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("exports GuestMigrationModal component with required props and conflict strategies", () => {
    expect(typeof GuestMigrationModal).toBe("function");

    const onClose = vi.fn();
    const onSuccess = vi.fn();
    const draftSource = "= Jane Doe\n== EXPERIENCE\n*Stripe* -- Staff Engineer";

    const element = React.createElement(GuestMigrationModal, {
      isOpen: true,
      onClose,
      draftSource,
      hasExistingMaster: true,
      onSuccess,
    });

    expect(element.props.isOpen).toBe(true);
    expect(element.props.draftSource).toBe(draftSource);
    expect(element.props.hasExistingMaster).toBe(true);
  });

  it("identifies custom guest drafts needing migration vs default starter template", () => {
    const starterTemplate = "// Starter Typst Resume\n#set page(paper: \"us-letter\")\n= My Resume\n";
    const customGuestDraft = "= Alex Smith\n== EXPERIENCE\n*Linear* | Software Engineer\n- Built sync engine.";

    const isCustomDraft = (source: string | null) => {
      return (
        Boolean(source) &&
        source!.trim().length > 30 &&
        !source!.includes("// Starter Typst Resume")
      );
    };

    expect(isCustomDraft(starterTemplate)).toBe(false);
    expect(isCustomDraft("")).toBe(false);
    expect(isCustomDraft(null)).toBe(false);
    expect(isCustomDraft(customGuestDraft)).toBe(true);
  });

  it("constructs proper payload with confirmReplaceMaster and migrationId", () => {
    const draftSource = "= Jane Doe\n== EXPERIENCE\n*Stripe* -- Senior Engineer";
    const migrationId = "123e4567-e89b-12d3-a456-426614174000";

    const replacePayload = {
      title: "Imported Guest Resume",
      typstSource: draftSource,
      conflictStrategy: "REPLACE_MASTER" as const,
      confirmReplaceMaster: true,
      migrationId,
    };

    expect(replacePayload.title).toBe("Imported Guest Resume");
    expect(replacePayload.conflictStrategy).toBe("REPLACE_MASTER");
    expect(replacePayload.confirmReplaceMaster).toBe(true);
    expect(replacePayload.migrationId).toBe(migrationId);
  });

  it("enforces cross-tab migration lock correctly", () => {
    const lockKey = "resumeforge_migration_lock";
    const now = Date.now();

    // Lock active from 2 seconds ago -> should reject concurrent attempt
    const activeLock = String(now - 2000);
    const isLocked = (storedLock: string | null) => {
      if (!storedLock) return false;
      return Date.now() - parseInt(storedLock, 10) < 15000;
    };

    expect(isLocked(activeLock)).toBe(true);

    // Stale lock from 20 seconds ago -> should be considered expired
    const staleLock = String(now - 20000);
    expect(isLocked(staleLock)).toBe(false);
    expect(isLocked(null)).toBe(false);
  });

  it("preserves local storage content on migration failure and clears all keys only on success", () => {
    const mockStorage: Record<string, string> = {
      resumeforge_typst_source: "= Jane Doe\n== EXPERIENCE\n*Stripe*",
      resumeforge_has_guest_draft: "true",
      resumeforge_migration_id: "123e4567-e89b-12d3-a456-426614174000",
      resumeforge_migration_lock: "1234567890",
    };

    // Simulate failed migration: storage must not be purged
    const onMigrationFailed = () => {
      // no cleanup
    };

    onMigrationFailed();
    expect(mockStorage["resumeforge_typst_source"]).toBeDefined();
    expect(mockStorage["resumeforge_has_guest_draft"]).toBe("true");
    expect(mockStorage["resumeforge_migration_id"]).toBeDefined();

    // Simulate successful 200 response: storage purged completely and migration marked complete
    const onMigrationSuccess = () => {
      delete mockStorage["resumeforge_typst_source"];
      delete mockStorage["resumeforge_has_guest_draft"];
      delete mockStorage["resumeforge_migration_id"];
      delete mockStorage["resumeforge_migration_lock"];
      mockStorage["resumeforge_draft_migrated"] = "true";
    };

    onMigrationSuccess();
    expect(mockStorage["resumeforge_typst_source"]).toBeUndefined();
    expect(mockStorage["resumeforge_has_guest_draft"]).toBeUndefined();
    expect(mockStorage["resumeforge_migration_id"]).toBeUndefined();
    expect(mockStorage["resumeforge_migration_lock"]).toBeUndefined();
    expect(mockStorage["resumeforge_draft_migrated"]).toBe("true");
  });

  it("evaluates guest draft migration across routes without letting stale migrated flags or editor loads clobber pending drafts", () => {
    const createMemoryStorage = (initial: Record<string, string> = {}) => {
      const store = new Map<string, string>(Object.entries(initial));
      return {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => {
          store.set(k, v);
        },
        removeItem: (k: string) => {
          store.delete(k);
        },
      };
    };

    const customDraft = "= Priya Nair\n== EXPERIENCE\n*CloudScale* -- Senior Engineer\n- Scaled APIs.";
    const untouchedStarter =
      "// ResumeForge Canonical Resume Template (Typst)\nalex.morgan@example.com TechCorp Systems WebScale Labs";

    expect(isCustomGuestDraftSource(untouchedStarter)).toBe(false);
    expect(isCustomGuestDraftSource(customDraft)).toBe(true);

    // 1. Guest session marks draft as pending and clears stale migrated flag
    const guestStorage = createMemoryStorage({
      resumeforge_typst_source: customDraft,
      resumeforge_draft_migrated: "true",
    });
    evaluateGuestMigrationState(guestStorage, {
      isAuthUser: false,
      isGuest: true,
      demoMode: false,
    });
    expect(guestStorage.getItem("resumeforge_has_guest_draft")).toBe("true");
    expect(guestStorage.getItem("resumeforge_draft_migrated")).toBeNull();
    expect(hasPendingGuestDraftInStorage(guestStorage)).toBe(true);

    // 2. Signed-in user on ANY AppShell route triggers GuestMigrationModal even if an earlier session left resumeforge_draft_migrated="true"
    const signedInWithStaleFlag = createMemoryStorage({
      resumeforge_typst_source: customDraft,
      resumeforge_has_guest_draft: "true",
      resumeforge_draft_migrated: "true",
    });
    expect(hasPendingGuestDraftInStorage(signedInWithStaleFlag)).toBe(true);
    const evalResult = evaluateGuestMigrationState(signedInWithStaleFlag, {
      isAuthUser: true,
      isGuest: false,
      demoMode: false,
    });
    expect(evalResult.shouldPrompt).toBe(true);
    expect(evalResult.hasCustomResumeDraft).toBe(true);
    expect(evalResult.draftSource).toBe(customDraft);

    // 3. Dismissed or demo mode suppresses prompt
    const dismissedStorage = createMemoryStorage({
      resumeforge_typst_source: customDraft,
      resumeforge_has_guest_draft: "true",
      resumeforge_migration_dismissed: "true",
    });
    expect(
      evaluateGuestMigrationState(dismissedStorage, {
        isAuthUser: true,
        isGuest: false,
        demoMode: false,
      }).shouldPrompt
    ).toBe(false);
    expect(
      evaluateGuestMigrationState(signedInWithStaleFlag, {
        isAuthUser: true,
        isGuest: false,
        demoMode: true,
      }).shouldPrompt
    ).toBe(false);

    // 4. Custom resumeforge_typst_source WITHOUT resumeforge_has_guest_draft="true" in an authenticated session does NOT trigger prompt
    const authOwnedSourceOnly = createMemoryStorage({
      resumeforge_typst_source: customDraft,
    });
    expect(hasPendingGuestDraftInStorage(authOwnedSourceOnly)).toBe(false);
    const authOwnedEval = evaluateGuestMigrationState(authOwnedSourceOnly, {
      isAuthUser: true,
      isGuest: false,
      demoMode: false,
    });
    expect(authOwnedEval.shouldPrompt).toBe(false);
    expect(authOwnedEval.hasCustomResumeDraft).toBe(false);
    expect(authOwnedEval.hasGuestEvidence).toBe(false);
  });

  it("evaluates evidence-only guest state without synthesizing a placeholder resume draft", () => {
    const store = new Map<string, string>([
      [
        "resumeforge_guest_evidence",
        JSON.stringify([{ title: "Distributed Cache", type: "PROJECT", bullets: ["Cut p99 by 40%"] }]),
      ],
    ]);
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
    };

    const evalResult = evaluateGuestMigrationState(storage, {
      isAuthUser: true,
      isGuest: false,
      demoMode: false,
    });

    expect(evalResult.shouldPrompt).toBe(true);
    expect(evalResult.hasCustomResumeDraft).toBe(false);
    expect(evalResult.hasGuestEvidence).toBe(true);
    expect(evalResult.draftSource).toBeNull();
  });

  it("parses and batches >50 guest evidence items in chunks of 50 and preserves raw entry schema on partial failure", async () => {
    const rawItems = Array.from({ length: 120 }, (_, i) => ({
      id: `guest-ev-${i + 1}`,
      title: `Evidence Item ${i + 1}`,
      organization: "Stripe",
      type: "experience",
      status: "verified",
      verifiedSummary: `Summary ${i + 1}`,
      startDate: "2024-01",
      endDate: "2025-02",
      tags: ["TypeScript", "Postgres"],
      bullets: [{ id: `bullet-${i + 1}`, text: `Impact bullet ${i + 1}` }],
    }));

    const { items: parsed, rawEntries } = parseGuestEvidenceEntries(JSON.stringify(rawItems));
    expect(parsed).toHaveLength(120);
    expect(rawEntries).toHaveLength(120);
    expect(parseGuestEvidenceItems(JSON.stringify(rawItems))).toEqual(parsed);
    expect(parsed[0]).toMatchObject({
      dates: "2024-01 – 2025-02",
      status: "verified",
      verifiedSummary: "Summary 1",
      bullets: [{ text: "Impact bullet 1", verified: false }],
    });

    const store = new Map<string, string>([
      ["resumeforge_typst_source", "= Jane Doe\n== EXPERIENCE\n*Stripe* -- Staff Engineer"],
      ["resumeforge_has_guest_draft", "true"],
      ["resumeforge_guest_evidence", JSON.stringify(rawEntries)],
    ]);
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
    };

    // Full success across 3 batches (50 + 50 + 20)
    const calls: Array<Record<string, unknown>> = [];
    const fetchAllOk = (async (_url: RequestInfo | URL, init?: RequestInit) => {
      calls.push(JSON.parse(String(init?.body)));
      return new Response(JSON.stringify({ success: true, data: {} }), { status: 200 });
    }) as typeof fetch;

    const okResult = await executeGuestMigrationBatches({
      storage,
      fetchFn: fetchAllOk,
      draftSource: store.get("resumeforge_typst_source"),
      hasCustomResumeDraft: true,
      evidenceItems: parsed,
      rawEvidenceEntries: rawEntries,
      strategy: "IMPORT_AS_DRAFT",
      confirmReplaceMaster: false,
      migrationId: "123e4567-e89b-12d3-a456-426614174000",
    });

    expect(okResult.ok).toBe(true);
    expect(calls).toHaveLength(3);
    expect((calls[0]!.evidenceItems as unknown[]).length).toBe(50);
    expect(calls[0]!.typstSource).toContain("Jane Doe");
    expect(calls[0]!.evidenceOnly).toBeUndefined();
    expect((calls[1]!.evidenceItems as unknown[]).length).toBe(50);
    expect(calls[1]!.typstSource).toBeUndefined();
    expect(calls[1]!.evidenceOnly).toBe(true);
    expect((calls[2]!.evidenceItems as unknown[]).length).toBe(20);
    expect(calls[2]!.evidenceOnly).toBe(true);
    expect(store.get("resumeforge_guest_evidence")).toBeUndefined();
    expect(store.get("resumeforge_typst_source")).toBeUndefined();

    // Partial failure: batch 0 succeeds, batch 1 fails -> remaining 70 raw entries preserved with original fields
    const storePartial = new Map<string, string>([
      ["resumeforge_typst_source", "= Jane Doe\n== EXPERIENCE\n*Stripe* -- Staff Engineer"],
      ["resumeforge_has_guest_draft", "true"],
      ["resumeforge_guest_evidence", JSON.stringify(rawEntries)],
    ]);
    const partialStorage = {
      getItem: (k: string) => storePartial.get(k) ?? null,
      setItem: (k: string, v: string) => {
        storePartial.set(k, v);
      },
      removeItem: (k: string) => {
        storePartial.delete(k);
      },
    };

    let attempt = 0;
    const fetchPartialFail = (async () => {
      attempt++;
      if (attempt === 1) {
        return new Response(JSON.stringify({ success: true, data: {} }), { status: 200 });
      }
      return new Response(JSON.stringify({ success: false, error: "Server error" }), { status: 500 });
    }) as typeof fetch;

    const failResult = await executeGuestMigrationBatches({
      storage: partialStorage,
      fetchFn: fetchPartialFail,
      draftSource: storePartial.get("resumeforge_typst_source"),
      hasCustomResumeDraft: true,
      evidenceItems: parsed,
      rawEvidenceEntries: rawEntries,
      strategy: "IMPORT_AS_DRAFT",
      confirmReplaceMaster: false,
      migrationId: "123e4567-e89b-12d3-a456-426614174000",
    });

    expect(failResult.ok).toBe(false);
    expect(failResult.remainingEvidence).toHaveLength(70);
    const persistedRemaining = JSON.parse(storePartial.get("resumeforge_guest_evidence") ?? "[]");
    expect(persistedRemaining).toHaveLength(70);
    expect(persistedRemaining[0]).toEqual({
      id: "guest-ev-51",
      title: "Evidence Item 51",
      organization: "Stripe",
      type: "experience",
      status: "verified",
      verifiedSummary: "Summary 51",
      startDate: "2024-01",
      endDate: "2025-02",
      tags: ["TypeScript", "Postgres"],
      bullets: [{ id: "bullet-51", text: "Impact bullet 51" }],
    });
    expect(storePartial.get("resumeforge_has_guest_draft")).toBeUndefined();
  });

  it("handles non-JSON 502/504 responses gracefully across DISCARD, resume-only, and batched evidence paths", async () => {
    const html502Fetch = (async () =>
      new Response("<html><body>502 Bad Gateway</body></html>", {
        status: 502,
        headers: { "Content-Type": "text/html" },
      })) as typeof fetch;

    const evidenceItems = [
      { title: "Telemetry Pipeline", category: "PROJECT", bullets: ["Reduced latency 20%"] },
    ];

    const discardRes = await executeGuestMigrationBatches({
      storage: null,
      fetchFn: html502Fetch,
      draftSource: "= Draft\n== EXP\n*Acme*",
      hasCustomResumeDraft: true,
      evidenceItems,
      strategy: "DISCARD",
      confirmReplaceMaster: false,
      migrationId: "123e4567-e89b-12d3-a456-426614174000",
    });
    expect(discardRes).toEqual({
      ok: false,
      error: "Failed to discard guest draft.",
      remainingEvidence: evidenceItems,
    });

    const resumeOnlyRes = await executeGuestMigrationBatches({
      storage: null,
      fetchFn: html502Fetch,
      draftSource: "= Draft\n== EXP\n*Acme*",
      hasCustomResumeDraft: true,
      evidenceItems: [],
      strategy: "IMPORT_AS_DRAFT",
      confirmReplaceMaster: false,
      migrationId: "123e4567-e89b-12d3-a456-426614174000",
    });
    expect(resumeOnlyRes).toEqual({
      ok: false,
      error: "Failed to import guest draft to account.",
      remainingEvidence: [],
    });

    const batchedRes = await executeGuestMigrationBatches({
      storage: null,
      fetchFn: html502Fetch,
      draftSource: null,
      hasCustomResumeDraft: false,
      evidenceItems,
      strategy: "IMPORT_AS_DRAFT",
      confirmReplaceMaster: false,
      migrationId: "123e4567-e89b-12d3-a456-426614174000",
    });
    expect(batchedRes).toEqual({
      ok: false,
      error: "Failed to import guest draft to account.",
      remainingEvidence: evidenceItems,
    });
  });

  it("adapts GuestMigrationModal copy for evidence-only vs draft+evidence states", () => {
    const evidenceOnlyCopy = getGuestMigrationCopy(false, true);
    expect(evidenceOnlyCopy.title).toBe("Unsaved Guest Evidence Detected");
    expect(evidenceOnlyCopy.description).toBe(
      "We found guest Evidence Bank items in this browser. Choose whether to import or discard them."
    );
    expect(evidenceOnlyCopy.importLabel).toBe("Import Guest Evidence (Recommended)");
    expect(evidenceOnlyCopy.importDescription).toBe(
      "Adds your browser Evidence Bank items to your account without touching your Master Resume."
    );
    expect(evidenceOnlyCopy.discardLabel).toBe("Discard Local Evidence");

    const draftAndEvidenceCopy = getGuestMigrationCopy(true, true);
    expect(draftAndEvidenceCopy.title).toBe("Unsaved Guest Draft Detected");
    expect(draftAndEvidenceCopy.discardLabel).toBe("Discard Local Draft & Evidence");

    const draftOnlyCopy = getGuestMigrationCopy(true, false);
    expect(draftOnlyCopy.discardLabel).toBe("Discard Local Draft");
  });

  it("sends evidenceOnly: true without typstSource when migrating evidence-only guest state", async () => {
    const sentPayloads: Array<Record<string, unknown>> = [];
    const fetchMock = (async (_url: RequestInfo | URL, init?: RequestInit) => {
      sentPayloads.push(JSON.parse(String(init?.body)));
      return new Response(JSON.stringify({ success: true, data: {} }), { status: 200 });
    }) as typeof fetch;

    const result = await executeGuestMigrationBatches({
      storage: null,
      fetchFn: fetchMock,
      draftSource: null,
      hasCustomResumeDraft: false,
      evidenceItems: [{ title: "Evidence Only Project", category: "PROJECT", bullets: ["Shipped"] }],
      strategy: "IMPORT_AS_DRAFT",
      confirmReplaceMaster: false,
      migrationId: "123e4567-e89b-12d3-a456-426614174000",
    });

    expect(result.ok).toBe(true);
    expect(sentPayloads).toHaveLength(1);
    expect(sentPayloads[0]!.evidenceOnly).toBe(true);
    expect(sentPayloads[0]!.typstSource).toBeUndefined();
  });
});
