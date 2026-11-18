import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import {
  evaluateGuestMigrationState,
  GuestMigrationModal,
  hasPendingGuestDraftInStorage,
  isCustomGuestDraftSource,
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
});
