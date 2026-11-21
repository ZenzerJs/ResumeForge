"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  Edit2,
  Archive,
  Loader2,
  Upload,
  Search,
  CheckCircle2,
  AlertCircle,
  X,
  ChevronDown,
  ChevronRight,
  FileJson,
  RotateCcw,
  Trash2,
  MoreVertical,
  CheckSquare,
  Minus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AppShell } from "@/components/design-system/app-shell";
import { PageHeader } from "@/components/design-system/page-header";
import { fetchDemoConfig, fetchSessionUser } from "@/components/auth/session-user";
import {
  parseTailorReturnContext,
  type ApplicationAccountScope,
} from "@/lib/tailor/application-context";
import { BrandIcon, hasBrandIcon } from "@/components/design-system/brand-icon";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import type { PdfEvidenceSaveItem } from "@/components/evidence/bulk-pdf-dropzone";
import { initializeDemoSamples } from "@/lib/demo-client";
import { parseApiError, readApiResponse } from "@/lib/api-error";
import { useRovingTablist } from "@/lib/hooks/use-roving-tablist";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const BulkPdfDropzone = dynamic(
  () => import("@/components/evidence/bulk-pdf-dropzone").then((mod) => mod.BulkPdfDropzone),
  {
    loading: () => (
      <div className="h-32 rounded-xl border border-dashed border-hairline bg-inset/60 p-4 animate-pulse flex items-center justify-center text-xs text-muted-foreground font-mono">
        Loading PDF dropzone...
      </div>
    ),
    ssr: false,
  }
);

export interface Bullet {
  id?: string;
  text: string;
  technologies?: string[];
  roleAffinity?: string[];
  verified?: boolean;
}

export interface EvidenceItem {
  id: string;
  userId?: string;
  type: string;
  title: string;
  organization?: string | null;
  dates?: string | null;
  verifiedSummary: string;
  tags: string[];
  status: string;
  createdAt: string;
  updatedAt?: string;
  bullets: Bullet[];
  needsReview?: boolean;
  duplicateTargetId?: string;
  exactTitleOrgMatch?: boolean;
  similarityScore?: number;
  candidateBullet?: string;
  existingBullet?: string;
}

export interface UndoArchiveEntry {
  id: string;
  title: string;
  previousStatus: "verified" | "draft";
  updatedAt: string;
}

export interface LocalBulkDirective {
  id: string;
  restoreStatus?: "verified" | "draft";
  expectedUpdatedAt?: string;
}

export interface LocalBulkResultItem {
  id: string;
  title: string;
  outcome: "succeeded" | "skipped" | "conflict";
  reason?: string;
  previousStatus?: string;
  updatedAt?: string;
}

export function archiveEvidenceItemsLocally(
  items: EvidenceItem[],
  targetIds: string[],
  nowIso = new Date().toISOString()
): {
  nextItems: EvidenceItem[];
  results: LocalBulkResultItem[];
  undoEntries: UndoArchiveEntry[];
} {
  const targetSet = new Set(targetIds);
  const results: LocalBulkResultItem[] = [];
  const undoEntries: UndoArchiveEntry[] = [];
  const nextItems = items.map((item) => {
    if (!targetSet.has(item.id)) return item;
    if (item.status === "archived") {
      results.push({
        id: item.id,
        title: item.title,
        outcome: "skipped",
        reason: "Already archived.",
      });
      return item;
    }
    const previousStatus: "verified" | "draft" =
      item.status === "verified" ? "verified" : "draft";
    undoEntries.push({
      id: item.id,
      title: item.title,
      previousStatus,
      updatedAt: nowIso,
    });
    results.push({
      id: item.id,
      title: item.title,
      outcome: "succeeded",
      previousStatus,
      updatedAt: nowIso,
    });
    return {
      ...item,
      status: "archived",
      updatedAt: nowIso,
    };
  });
  return { nextItems, results, undoEntries };
}

export function restoreEvidenceItemsLocally(
  items: EvidenceItem[],
  directives: LocalBulkDirective[],
  nowIso = new Date().toISOString()
): {
  nextItems: EvidenceItem[];
  results: LocalBulkResultItem[];
} {
  const directiveById = new Map(directives.map((d) => [d.id, d]));
  const results: LocalBulkResultItem[] = [];
  const nextItems = items.map((item) => {
    const directive = directiveById.get(item.id);
    if (!directive) return item;
    if (
      directive.expectedUpdatedAt &&
      item.updatedAt &&
      new Date(directive.expectedUpdatedAt).getTime() !==
        new Date(item.updatedAt).getTime()
    ) {
      results.push({
        id: item.id,
        title: item.title,
        outcome: "conflict",
        reason: "Item was modified since archiving; newer edits preserved.",
      });
      return item;
    }
    if (item.status !== "archived") {
      results.push({
        id: item.id,
        title: item.title,
        outcome: "skipped",
        reason: "Item is not archived.",
      });
      return item;
    }
    const nextStatus = directive.restoreStatus ?? "draft";
    results.push({
      id: item.id,
      title: item.title,
      outcome: "succeeded",
      previousStatus: item.status,
      updatedAt: nowIso,
    });
    return {
      ...item,
      status: nextStatus,
      updatedAt: nowIso,
    };
  });
  return { nextItems, results };
}

export function verifyEvidenceItemsLocally(
  items: EvidenceItem[],
  targetIds: string[],
  nowIso = new Date().toISOString()
): {
  nextItems: EvidenceItem[];
  results: LocalBulkResultItem[];
} {
  const targetSet = new Set(targetIds);
  const results: LocalBulkResultItem[] = [];
  const nextItems = items.map((item) => {
    if (!targetSet.has(item.id)) return item;
    if (item.status === "archived") {
      results.push({
        id: item.id,
        title: item.title,
        outcome: "skipped",
        reason: "Archived items must be restored before verifying.",
      });
      return item;
    }
    const hasUnverifiedBullets = (item.bullets || []).some((b) => !b.verified);
    if (item.status === "verified" && !hasUnverifiedBullets) {
      results.push({
        id: item.id,
        title: item.title,
        outcome: "skipped",
        reason: "Already verified.",
      });
      return item;
    }
    results.push({
      id: item.id,
      title: item.title,
      outcome: "succeeded",
      previousStatus: item.status,
      updatedAt: nowIso,
    });
    return {
      ...item,
      status: "verified",
      bullets: (item.bullets || []).map((b) => ({ ...b, verified: true })),
      updatedAt: nowIso,
    };
  });
  return { nextItems, results };
}

function invalidateDependentEvidenceState(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("resumeforge_evidence_revision", String(Date.now()));
    window.dispatchEvent(
      new CustomEvent("resumeforge:evidence-changed", {
        detail: { at: Date.now() },
      })
    );
  } catch {}
}

export function isLocalEvidenceId(id: string): boolean {
  return id.startsWith("guest-") || id.startsWith("demo-sample-");
}

export interface EvidenceFormData {
  type: string;
  title: string;
  organization: string;
  dates: string;
  verifiedSummary: string;
  tagsInput: string;
  status: string;
  bulletsInput: string[];
}

/**
 * Builds initial modal form state. New manual entries default to `"draft"` so
 * verification remains a deliberate user action; editing preserves `item.status`.
 */
export function createInitialEvidenceFormData(item?: EvidenceItem | null): EvidenceFormData {
  if (item) {
    return {
      type: item.type,
      title: item.title,
      organization: item.organization || "",
      dates: item.dates || "",
      verifiedSummary: item.verifiedSummary,
      tagsInput: (item.tags || []).join(", "),
      status: item.status,
      bulletsInput: (item.bullets || []).map((b) => b.text),
    };
  }
  return {
    type: "experience",
    title: "",
    organization: "",
    dates: "",
    verifiedSummary: "",
    tagsInput: "",
    status: "draft",
    bulletsInput: [""],
  };
}

function readGuestEvidenceFromStorage(): EvidenceItem[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem("resumeforge_guest_evidence");
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? (parsed as EvidenceItem[]) : [];
  } catch {
    return [];
  }
}

function writeGuestEvidenceToStorage(items: EvidenceItem[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("resumeforge_guest_evidence", JSON.stringify(items));
  } catch {}
}

export function LibraryWorkspace() {
  const searchParams = useSearchParams();
  const [accountScope, setAccountScope] = useState<ApplicationAccountScope>({
    scopeResolved: false,
  });
  const [items, setItems] = useState<EvidenceItem[]>([]);
  const [unfilteredTotal, setUnfilteredTotal] = useState<number | null>(null);
  const [statusCounts, setStatusCounts] = useState<{
    verified: number;
    draft: number;
    archived: number;
    active: number;
    total: number;
  } | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("active");
  const [activeTab, setActiveTab] = useState<"library" | "review">("library");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
    undoArchive?: UndoArchiveEntry[];
  } | null>(null);
  const [isSelectMode, setIsSelectMode] = useState<boolean>(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectionAnnouncement, setSelectionAnnouncement] = useState<string>("");
  const [isBulkSubmitting, setIsBulkSubmitting] = useState<boolean>(false);
  const [bulkMoreOpen, setBulkMoreOpen] = useState<boolean>(false);
  const [openItemMenuId, setOpenItemMenuId] = useState<string | null>(null);
  const [deleteDialogState, setDeleteDialogState] = useState<{
    open: boolean;
    eligibleItems: EvidenceItem[];
    blockedItems: Array<{
      id: string;
      title: string;
      reason: string;
      citationCount?: number;
    }>;
    isDeleting: boolean;
  }>({
    open: false,
    eligibleItems: [],
    blockedItems: [],
    isDeleting: false,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const addEvidenceBtnRef = useRef<HTMLButtonElement | null>(null);
  const modalOpenerRef = useRef<HTMLElement | null>(null);
  const { tablistRef: tabListRef, getTabProps: getLibraryTabProps } = useRovingTablist(
    activeTab === "library" ? 0 : 1
  );
  const bulkSubmittingRef = useRef<boolean>(false);
  const [tabIndicator, setTabIndicator] = useState<{ left: number; width: number } | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const wasModalOpenRef = useRef<boolean>(false);
  const [editingItem, setEditingItem] = useState<EvidenceItem | null>(null);

  useEffect(() => {
    const wasOpen = wasModalOpenRef.current;
    wasModalOpenRef.current = isModalOpen;
    if (wasOpen && !isModalOpen) {
      const target =
        modalOpenerRef.current && modalOpenerRef.current.isConnected
          ? modalOpenerRef.current
          : addEvidenceBtnRef.current;
      if (target && target.isConnected) {
        target.focus({ preventScroll: true });
      }
    }
  }, [isModalOpen]);

  // Form State
  const [formData, setFormData] = useState<EvidenceFormData>(() =>
    createInitialEvidenceFormData()
  );

  const fetchAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchSessionUser(), fetchDemoConfig()])
      .then(([user, demoConfig]) => {
        if (cancelled) return;
        setAccountScope({
          userId: user?.id ?? null,
          demoMode: demoConfig?.demoMode === true,
          scopeResolved: true,
        });
      })
      .catch(() => {
        if (!cancelled) {
          setAccountScope({ userId: null, demoMode: false, scopeResolved: true });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const tailorReturnContext = useMemo(
    () => parseTailorReturnContext(searchParams, { scope: accountScope }),
    [searchParams, accountScope]
  );

  const fetchItems = useCallback(async () => {
    fetchAbortRef.current?.abort();
    const controller = new AbortController();
    fetchAbortRef.current = controller;

    try {
      setIsLoading(true);
      const demoConfig = await fetchDemoConfig();
      if (controller.signal.aborted) return;
      let loadedItems: EvidenceItem[] = [];
      let nextCounts: {
        verified: number;
        draft: number;
        archived: number;
        active: number;
        total: number;
      } | null = null;
      const matchesStatus = (status: string, filter: string) =>
        filter === "all"
          ? true
          : filter === "active"
            ? status !== "archived"
            : status === filter;
      const tallyCounts = (list: EvidenceItem[]) => {
        const verified = list.filter((i) => i.status === "verified").length;
        const draft = list.filter((i) => i.status === "draft").length;
        const archived = list.filter((i) => i.status === "archived").length;
        return { verified, draft, archived, active: verified + draft, total: list.length };
      };

      if (demoConfig.demoMode) {
        initializeDemoSamples();
        const localItems = readGuestEvidenceFromStorage();
        nextCounts = tallyCounts(localItems);
        loadedItems = localItems.filter((item) => matchesStatus(item.status, filterStatus));
      } else {
        const url = filterStatus === "all" ? "/api/evidence" : `/api/evidence?status=${filterStatus}`;
        const res = await fetch(url, { signal: controller.signal });
        const { ok, data: json, error } = await readApiResponse<{
          success?: boolean;
          data?: EvidenceItem[];
          counts?: {
            verified: number;
            draft: number;
            archived: number;
            active: number;
            total: number;
          };
        }>(res, "Failed to fetch evidence items.");
        if (controller.signal.aborted) return;
        if (!ok || !json?.success) {
          throw new Error(error || "Failed to fetch evidence items.");
        }
        loadedItems = json.data || [];
        if (json.counts) {
          nextCounts = { ...json.counts };
        }
        const guestItems = readGuestEvidenceFromStorage();
        if (guestItems.length > 0) {
          const existingIds = new Set(loadedItems.map((i) => i.id));
          const extraGuests = guestItems.filter((item) => !existingIds.has(item.id));
          if (extraGuests.length > 0 && nextCounts) {
            const guestCounts = tallyCounts(extraGuests);
            nextCounts = {
              verified: nextCounts.verified + guestCounts.verified,
              draft: nextCounts.draft + guestCounts.draft,
              archived: nextCounts.archived + guestCounts.archived,
              active: nextCounts.active + guestCounts.active,
              total: nextCounts.total + guestCounts.total,
            };
          } else if (!nextCounts) {
            nextCounts = tallyCounts([...loadedItems, ...extraGuests]);
          }
          loadedItems = [
            ...loadedItems,
            ...extraGuests.filter((item) => matchesStatus(item.status, filterStatus)),
          ];
        } else if (!nextCounts && (filterStatus === "all" || filterStatus === "active")) {
          nextCounts = tallyCounts(loadedItems);
        }
      }

      // Annotate potential duplicate items for the Review Queue unless already dismissed
      let reviewedSet = new Set<string>();
      try {
        const rawReviewed = typeof window !== "undefined" ? localStorage.getItem("rf_reviewed_duplicates") : null;
        if (rawReviewed) {
          reviewedSet = new Set(JSON.parse(rawReviewed));
        }
      } catch {}

      const earlierByKey = new Map<string, EvidenceItem>();
      const annotated = loadedItems.map((item) => {
        const key = `${item.title.trim().toLowerCase()}||${(item.organization || "").trim().toLowerCase()}`;
        const earlierMatch = earlierByKey.get(key);
        if (!earlierMatch) {
          earlierByKey.set(key, item);
        }
        if (reviewedSet.has(item.id)) return item;
        if (item.needsReview) return item;
        if (earlierMatch) {
          return {
            ...item,
            needsReview: true,
            duplicateTargetId: earlierMatch.id,
            exactTitleOrgMatch: true,
            candidateBullet: item.bullets?.[0]?.text || item.verifiedSummary,
            existingBullet: earlierMatch.bullets?.[0]?.text || earlierMatch.verifiedSummary,
          };
        }
        return item;
      });

      if (controller.signal.aborted) return;
      setItems(annotated);
      if (nextCounts) {
        setStatusCounts(nextCounts);
        setUnfilteredTotal(nextCounts.total);
      } else if (filterStatus === "all" || filterStatus === "active") {
        setUnfilteredTotal(annotated.length);
      } else if (annotated.length > 0) {
        setUnfilteredTotal((prev) => Math.max(prev ?? 0, annotated.length));
      }
      // Expand first item by default while preserving existing expanded items
      if (annotated.length > 0) {
        setExpandedIds((prev) => ({
          ...prev,
          [annotated[0].id]: true,
        }));
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      console.error("Failed to fetch evidence items:", err);
      setNotification({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to fetch evidence items.",
      });
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, [filterStatus]);

  useEffect(() => {
    void fetchItems();
    return () => {
      fetchAbortRef.current?.abort();
    };
  }, [fetchItems]);

  useEffect(() => {
    const container = tabListRef.current;
    if (!container) return;
    const activeEl = container.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!activeEl) return;
    setTabIndicator({ left: activeEl.offsetLeft, width: activeEl.offsetWidth });
  }, [activeTab, items, tabListRef]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const query = searchQuery.toLowerCase();
    return items.filter((item) => {
      const matchTitle = item.title.toLowerCase().includes(query);
      const matchOrg = item.organization?.toLowerCase().includes(query) ?? false;
      const matchSummary = item.verifiedSummary.toLowerCase().includes(query);
      const matchTags = item.tags.some((t) => t.toLowerCase().includes(query));
      return matchTitle || matchOrg || matchSummary || matchTags;
    });
  }, [items, searchQuery]);

  const reviewItems = useMemo(
    () => items.filter((item) => item.needsReview),
    [items]
  );

  const clearSelection = useCallback((announcement?: string) => {
    setSelectedIds((prev) => {
      if (prev.length === 0) return prev;
      if (announcement) setSelectionAnnouncement(announcement);
      return [];
    });
    setBulkMoreOpen(false);
  }, []);

  const handleSearchQueryChange = (nextQuery: string) => {
    setSearchQuery(nextQuery);
    clearSelection("Selection cleared because the search filter changed.");
  };

  const handleFilterStatusChange = (nextStatus: string) => {
    setFilterStatus(nextStatus);
    clearSelection("Selection cleared because the status filter changed.");
  };

  const handleTabChange = (nextTab: "library" | "review") => {
    setActiveTab(nextTab);
    setOpenItemMenuId(null);
    clearSelection("Selection cleared because the active view changed.");
  };

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedFilteredCount = useMemo(
    () => filteredItems.filter((item) => selectedIdSet.has(item.id)).length,
    [filteredItems, selectedIdSet]
  );
  const allFilteredSelected =
    filteredItems.length > 0 && selectedFilteredCount === filteredItems.length;
  const someFilteredSelected =
    selectedFilteredCount > 0 && !allFilteredSelected;

  const selectedItems = useMemo(
    () => items.filter((item) => selectedIdSet.has(item.id)),
    [items, selectedIdSet]
  );

  const eligibleToVerifyCount = useMemo(
    () =>
      selectedItems.filter(
        (item) =>
          item.status !== "archived" &&
          (item.status !== "verified" ||
            (item.bullets || []).some((b) => !b.verified))
      ).length,
    [selectedItems]
  );

  const eligibleToArchiveCount = useMemo(
    () => selectedItems.filter((item) => item.status !== "archived").length,
    [selectedItems]
  );

  const selectedArchivedCount = useMemo(
    () => selectedItems.filter((item) => item.status === "archived").length,
    [selectedItems]
  );

  const toggleItemSelected = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      if (checked) {
        return prev.includes(id) ? prev : [...prev, id];
      }
      return prev.filter((entry) => entry !== id);
    });
  };

  const toggleSelectAllFiltered = (checked: boolean) => {
    if (checked) {
      setSelectedIds(filteredItems.map((item) => item.id));
    } else {
      setSelectedIds([]);
      setBulkMoreOpen(false);
    }
  };

  useEffect(() => {
    if (!openItemMenuId && !bulkMoreOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenItemMenuId(null);
        setBulkMoreOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [openItemMenuId, bulkMoreOpen]);

  const openCreateModal = (opener?: HTMLElement | null) => {
    modalOpenerRef.current =
      opener instanceof HTMLElement
        ? opener
        : document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
    setEditingItem(null);
    setFormData(createInitialEvidenceFormData());
    setIsModalOpen(true);
  };

  const openEditModal = (item: EvidenceItem, opener?: HTMLElement | null) => {
    modalOpenerRef.current =
      opener instanceof HTMLElement
        ? opener
        : document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
    setEditingItem(item);
    setFormData(createInitialEvidenceFormData(item));
    setIsModalOpen(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const tags = formData.tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      const bullets = formData.bulletsInput
        .map((b) => b.trim())
        .filter((b) => b.length > 0)
        .map((text) => ({ text, verified: formData.status === "verified" }));

      const payload = {
        type: formData.type,
        title: formData.title,
        organization: formData.organization || undefined,
        dates: formData.dates || undefined,
        verifiedSummary: formData.verifiedSummary,
        tags,
        status: formData.status,
        bullets,
      };

      const demoConfig = await fetchDemoConfig();

      if (editingItem) {
        if (demoConfig.demoMode || isLocalEvidenceId(editingItem.id)) {
          const updatedLocalItem: EvidenceItem = {
            ...editingItem,
            type: payload.type,
            title: payload.title,
            organization: payload.organization || null,
            dates: payload.dates || null,
            verifiedSummary: payload.verifiedSummary,
            tags: payload.tags,
            status: payload.status,
            bullets: payload.bullets.map((b, idx) => ({
              id: editingItem.bullets?.[idx]?.id || `b-${idx}-${Date.now()}`,
              text: b.text,
              technologies: editingItem.bullets?.[idx]?.technologies || [],
              roleAffinity: editingItem.bullets?.[idx]?.roleAffinity || [],
              verified: b.verified,
            })),
            updatedAt: new Date().toISOString(),
          };
          const existing = readGuestEvidenceFromStorage();
          const hasExisting = existing.some((item) => item.id === editingItem.id);
          const nextStored = hasExisting
            ? existing.map((item) => (item.id === editingItem.id ? updatedLocalItem : item))
            : [updatedLocalItem, ...existing];
          writeGuestEvidenceToStorage(nextStored);
          await fetchItems();
          setIsModalOpen(false);
          setNotification({
            type: "success",
            message: `Updated "${formData.title}" in local workspace.`,
          });
          return;
        }

        const res = await fetch(`/api/evidence/${editingItem.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const { ok, error } = await readApiResponse(res, "Failed to update evidence item.");
        if (ok) {
          setIsModalOpen(false);
          await fetchItems();
          setNotification({
            type: "success",
            message: `Updated "${formData.title}" successfully.`,
          });
        } else {
          setNotification({
            type: "error",
            message: error || "Failed to update evidence item.",
          });
        }
      } else {
        const buildGuestItem = (): EvidenceItem => ({
          id: `guest-evi-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          userId: "guest",
          type: payload.type,
          title: payload.title,
          organization: payload.organization || null,
          dates: payload.dates || null,
          verifiedSummary: payload.verifiedSummary,
          tags: payload.tags,
          status: payload.status,
          bullets: payload.bullets.map((b, idx) => ({
            id: `b-${idx}-${Date.now()}`,
            evidenceItemId: "",
            text: b.text,
            technologies: [],
            roleAffinity: [],
            verified: b.verified,
            orderIndex: idx,
          })),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        if (demoConfig.demoMode) {
          const guestItem = buildGuestItem();
          writeGuestEvidenceToStorage([guestItem, ...readGuestEvidenceFromStorage()]);
          setItems((prev) => [guestItem, ...prev]);
          setIsModalOpen(false);
          setNotification({
            type: "success",
            message: `Created evidence item "${formData.title}" in local workspace.`,
          });
          return;
        }

        const res = await fetch("/api/evidence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const { ok, status, data: json, error } = await readApiResponse<{ code?: string }>(
          res,
          "Failed to save evidence item."
        );
        if (ok) {
          setIsModalOpen(false);
          await fetchItems();
          setNotification({
            type: "success",
            message: `Created evidence item "${formData.title}".`,
          });
        } else if (status === 401 || json?.code === "GUEST_READ_ONLY") {
          const guestItem = buildGuestItem();
          writeGuestEvidenceToStorage([guestItem, ...readGuestEvidenceFromStorage()]);
          setItems((prev) => [guestItem, ...prev]);
          setIsModalOpen(false);
          setNotification({
            type: "success",
            message: `Created evidence item "${formData.title}" in local workspace.`,
          });
        } else {
          setNotification({
            type: "error",
            message: error || "Failed to save evidence item.",
          });
        }
      }
    } catch (err) {
      console.error("Failed to save evidence item:", err);
      setNotification({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to save evidence item.",
      });
    }
  };

  const handleVerifyItem = async (item: EvidenceItem) => {
    try {
      const demoConfig = await fetchDemoConfig();
      if (demoConfig.demoMode || isLocalEvidenceId(item.id)) {
        const verifiedItem: EvidenceItem = {
          ...item,
          status: "verified",
          bullets: (item.bullets || []).map((b) => ({ ...b, verified: true })),
          updatedAt: new Date().toISOString(),
        };
        const existing = readGuestEvidenceFromStorage();
        const hasExisting = existing.some((entry) => entry.id === item.id);
        const nextStored = hasExisting
          ? existing.map((entry) => (entry.id === item.id ? verifiedItem : entry))
          : [verifiedItem, ...existing];
        writeGuestEvidenceToStorage(nextStored);
        invalidateDependentEvidenceState();
        await fetchItems();
        setNotification({
          type: "success",
          message: `Verified "${item.title}" in local workspace.`,
        });
        return;
      }

      const res = await fetch(`/api/evidence/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "verified" }),
      });
      const { ok, error } = await readApiResponse(res, "Failed to verify evidence item.");
      if (ok) {
        invalidateDependentEvidenceState();
        await fetchItems();
        setNotification({
          type: "success",
          message: `Verified "${item.title}" successfully.`,
        });
      } else {
        setNotification({
          type: "error",
          message: error || "Failed to verify evidence item.",
        });
      }
    } catch (err) {
      console.error("Failed to verify item:", err);
      setNotification({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to verify evidence item.",
      });
    }
  };

  const handleArchiveItem = async (id: string) => {
    setOpenItemMenuId(null);
    const targetItem = items.find((entry) => entry.id === id);
    const previousStatus: "verified" | "draft" =
      targetItem?.status === "verified" ? "verified" : "draft";

    try {
      const demoConfig = await fetchDemoConfig();
      if (demoConfig.demoMode || isLocalEvidenceId(id)) {
        const stored = readGuestEvidenceFromStorage();
        const sourceList = stored.some((entry) => entry.id === id)
          ? stored
          : targetItem
            ? [targetItem, ...stored]
            : stored;
        const { nextItems, undoEntries } = archiveEvidenceItemsLocally(
          sourceList,
          [id]
        );
        writeGuestEvidenceToStorage(nextItems);
        invalidateDependentEvidenceState();
        await fetchItems();
        setSelectedIds((prev) => prev.filter((entry) => entry !== id));
        setNotification({
          type: "success",
          message: `"${targetItem?.title || "Item"}" moved to Archived.`,
          undoArchive: undoEntries,
        });
        return;
      }

      const res = await fetch(`/api/evidence/${id}`, {
        method: "DELETE",
      });
      const { ok, data: json, error } = await readApiResponse<{
        success?: boolean;
        data?: { updatedAt?: string; previousStatus?: string };
      }>(res, "Failed to archive evidence item.");
      if (ok) {
        invalidateDependentEvidenceState();
        await fetchItems();
        setSelectedIds((prev) => prev.filter((entry) => entry !== id));
        const restoredStatus: "verified" | "draft" =
          json?.data?.previousStatus === "verified"
            ? "verified"
            : previousStatus;
        setNotification({
          type: "success",
          message: `"${targetItem?.title || "Item"}" moved to Archived.`,
          undoArchive: json?.data?.updatedAt
            ? [
                {
                  id,
                  title: targetItem?.title || "Item",
                  previousStatus: restoredStatus,
                  updatedAt: json.data.updatedAt,
                },
              ]
            : undefined,
        });
      } else {
        setNotification({
          type: "error",
          message: error || "Failed to archive evidence item.",
        });
      }
    } catch (err) {
      console.error("Failed to archive item:", err);
      setNotification({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to archive evidence item.",
      });
    }
  };

  const handleRestoreItem = async (
    item: EvidenceItem,
    restoreStatus: "verified" | "draft" = "draft"
  ) => {
    setOpenItemMenuId(null);
    if (bulkSubmittingRef.current) return;
    bulkSubmittingRef.current = true;
    setIsBulkSubmitting(true);

    try {
      const demoConfig = await fetchDemoConfig();
      if (demoConfig.demoMode || isLocalEvidenceId(item.id)) {
        const { nextItems, results } = restoreEvidenceItemsLocally(
          readGuestEvidenceFromStorage(),
          [
            {
              id: item.id,
              restoreStatus,
              expectedUpdatedAt: item.updatedAt,
            },
          ]
        );
        const outcome = results[0]?.outcome;
        if (outcome === "conflict") {
          setNotification({
            type: "error",
            message: results[0]?.reason || "Newer edits prevented restore.",
          });
          return;
        }
        writeGuestEvidenceToStorage(nextItems);
        invalidateDependentEvidenceState();
        await fetchItems();
        setNotification({
          type: "success",
          message: `Restored "${item.title}" to ${restoreStatus}.`,
        });
        return;
      }

      const res = await fetch(`/api/evidence/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: restoreStatus,
          expectedUpdatedAt: item.updatedAt,
        }),
      });
      const { ok, error } = await readApiResponse(
        res,
        "Failed to restore evidence item."
      );
      if (ok) {
        invalidateDependentEvidenceState();
        await fetchItems();
        setNotification({
          type: "success",
          message: `Restored "${item.title}" to ${restoreStatus}.`,
        });
      } else {
        setNotification({
          type: "error",
          message: error || "Failed to restore evidence item.",
        });
      }
    } catch (err) {
      setNotification({
        type: "error",
        message:
          err instanceof Error ? err.message : "Failed to restore evidence item.",
      });
    } finally {
      bulkSubmittingRef.current = false;
      setIsBulkSubmitting(false);
    }
  };

  const handleUndoArchive = async (entries: UndoArchiveEntry[]) => {
    if (entries.length === 0 || bulkSubmittingRef.current) return;
    bulkSubmittingRef.current = true;
    setIsBulkSubmitting(true);

    try {
      const demoConfig = await fetchDemoConfig();
      const localEntries = entries.filter(
        (entry) => demoConfig.demoMode || isLocalEvidenceId(entry.id)
      );
      const serverEntries = entries.filter(
        (entry) => !demoConfig.demoMode && !isLocalEvidenceId(entry.id)
      );

      let restoredCount = 0;
      let conflictCount = 0;

      if (localEntries.length > 0) {
        const { nextItems, results } = restoreEvidenceItemsLocally(
          readGuestEvidenceFromStorage(),
          localEntries.map((entry) => ({
            id: entry.id,
            restoreStatus: entry.previousStatus,
            expectedUpdatedAt: entry.updatedAt,
          }))
        );
        const localSucceeded = results.filter((r) => r.outcome === "succeeded").length;
        conflictCount += results.filter((r) => r.outcome === "conflict").length;
        restoredCount += localSucceeded;
        if (localSucceeded > 0) {
          writeGuestEvidenceToStorage(nextItems);
        }
      }

      if (serverEntries.length > 0) {
        const res = await fetch("/api/evidence/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "restore",
            ids: serverEntries.map((e) => e.id),
            items: serverEntries.map((e) => ({
              id: e.id,
              restoreStatus: e.previousStatus,
              expectedUpdatedAt: e.updatedAt,
            })),
          }),
        });
        const { ok, data: json, error } = await readApiResponse<{
          success?: boolean;
          data?: {
            summary?: { succeeded: number; conflict: number };
          };
        }>(res, "Failed to undo archive.");
        if (!ok || !json?.success) {
          setNotification({
            type: "error",
            message: error || "Failed to undo archive.",
          });
          return;
        }
        restoredCount += json.data?.summary?.succeeded ?? 0;
        conflictCount += json.data?.summary?.conflict ?? 0;
      }

      if (restoredCount > 0) {
        invalidateDependentEvidenceState();
        await fetchItems();
      }

      if (conflictCount > 0) {
        setNotification({
          type: "error",
          message:
            restoredCount > 0
              ? `Restored ${restoredCount} item(s), but ${conflictCount} had newer edits and were left untouched.`
              : `Could not undo archive for ${conflictCount} item(s) because newer edits were saved.`,
        });
      } else if (restoredCount > 0) {
        setNotification({
          type: "success",
          message: `Undid archive for ${restoredCount} item${restoredCount === 1 ? "" : "s"}.`,
        });
      } else {
        setNotification({
          type: "error",
          message: "No items were eligible to undo.",
        });
      }
    } catch (err) {
      setNotification({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to undo archive.",
      });
    } finally {
      bulkSubmittingRef.current = false;
      setIsBulkSubmitting(false);
    }
  };

  const handleBulkAction = async (
    action: "verify" | "archive" | "restore"
  ) => {
    if (selectedItems.length === 0 || bulkSubmittingRef.current) return;
    bulkSubmittingRef.current = true;
    setIsBulkSubmitting(true);
    setBulkMoreOpen(false);

    try {
      const demoConfig = await fetchDemoConfig();
      const localTargets = selectedItems.filter(
        (item) => demoConfig.demoMode || isLocalEvidenceId(item.id)
      );
      const serverTargets = selectedItems.filter(
        (item) => !demoConfig.demoMode && !isLocalEvidenceId(item.id)
      );

      let succeededCount = 0;
      let skippedCount = 0;
      const failedIds: string[] = [];
      const undoEntries: UndoArchiveEntry[] = [];
      const failureReasons: string[] = [];

      if (localTargets.length > 0) {
        const stored = readGuestEvidenceFromStorage();
        const storedIds = new Set(stored.map((s) => s.id));
        const mergedLocal = [
          ...stored,
          ...localTargets.filter((t) => !storedIds.has(t.id)),
        ];
        const targetIds = localTargets.map((t) => t.id);

        if (action === "verify") {
          const { nextItems, results } = verifyEvidenceItemsLocally(
            mergedLocal,
            targetIds
          );
          const okCount = results.filter((r) => r.outcome === "succeeded").length;
          succeededCount += okCount;
          skippedCount += results.filter((r) => r.outcome === "skipped").length;
          if (okCount > 0) writeGuestEvidenceToStorage(nextItems);
        } else if (action === "archive") {
          const { nextItems, results, undoEntries: localUndo } =
            archiveEvidenceItemsLocally(mergedLocal, targetIds);
          const okCount = results.filter((r) => r.outcome === "succeeded").length;
          succeededCount += okCount;
          skippedCount += results.filter((r) => r.outcome === "skipped").length;
          undoEntries.push(...localUndo);
          if (okCount > 0) writeGuestEvidenceToStorage(nextItems);
        } else {
          const { nextItems, results } = restoreEvidenceItemsLocally(
            mergedLocal,
            localTargets.map((item) => ({
              id: item.id,
              restoreStatus: "draft",
              expectedUpdatedAt: item.updatedAt,
            }))
          );
          const okCount = results.filter((r) => r.outcome === "succeeded").length;
          succeededCount += okCount;
          skippedCount += results.filter((r) => r.outcome === "skipped").length;
          for (const resItem of results) {
            if (resItem.outcome === "conflict") {
              failedIds.push(resItem.id);
              if (resItem.reason) failureReasons.push(resItem.reason);
            }
          }
          if (okCount > 0) writeGuestEvidenceToStorage(nextItems);
        }
      }

      if (serverTargets.length > 0) {
        const res = await fetch("/api/evidence/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            ids: serverTargets.map((item) => item.id),
            items: serverTargets.map((item) => ({
              id: item.id,
              ...(action === "restore" ? { restoreStatus: "draft" as const } : {}),
              ...(item.updatedAt ? { expectedUpdatedAt: item.updatedAt } : {}),
            })),
          }),
        });
        const { ok, data: json, error } = await readApiResponse<{
          success?: boolean;
          data?: {
            results?: Array<{
              id: string;
              title?: string;
              outcome: "succeeded" | "skipped" | "conflict" | "blocked";
              reason?: string;
              previousStatus?: string;
              updatedAt?: string;
            }>;
          };
        }>(res, `Failed to ${action} selected items.`);

        if (!ok || !json?.success || !json.data?.results) {
          failedIds.push(...serverTargets.map((t) => t.id));
          failureReasons.push(error || `Failed to ${action} selected items.`);
        } else {
          for (const row of json.data.results) {
            if (row.outcome === "succeeded") {
              succeededCount += 1;
              if (action === "archive" && row.updatedAt) {
                undoEntries.push({
                  id: row.id,
                  title: row.title || "Item",
                  previousStatus:
                    row.previousStatus === "verified" ? "verified" : "draft",
                  updatedAt: row.updatedAt,
                });
              }
            } else if (row.outcome === "skipped") {
              skippedCount += 1;
            } else {
              failedIds.push(row.id);
              if (row.reason) failureReasons.push(row.reason);
            }
          }
        }
      }

      if (succeededCount > 0) {
        invalidateDependentEvidenceState();
        await fetchItems();
      }

      // Retain failed/conflicted items in selection so the user can retry cleanly.
      setSelectedIds(failedIds);

      if (failedIds.length > 0 || succeededCount === 0) {
        const actionLabel =
          action === "verify"
            ? "verified"
            : action === "archive"
              ? "archived"
              : "restored";
        setNotification({
          type: "error",
          message:
            succeededCount > 0
              ? `${succeededCount} ${actionLabel}, ${failedIds.length} failed (${failureReasons[0] || "conflict detected"}). Failed items remain selected.`
              : failureReasons[0] ||
                (skippedCount > 0
                  ? `No selected items were eligible to ${action}.`
                  : `Failed to ${action} selected items.`),
        });
      } else {
        const verb =
          action === "verify"
            ? "Verified"
            : action === "archive"
              ? "Archived"
              : "Restored";
        setNotification({
          type: "success",
          message: `${verb} ${succeededCount} item${succeededCount === 1 ? "" : "s"}${skippedCount > 0 ? ` (${skippedCount} skipped)` : ""}.`,
          undoArchive:
            action === "archive" && undoEntries.length > 0
              ? undoEntries
              : undefined,
        });
      }
    } catch (err) {
      setNotification({
        type: "error",
        message:
          err instanceof Error ? err.message : `Failed to ${action} items.`,
      });
    } finally {
      bulkSubmittingRef.current = false;
      setIsBulkSubmitting(false);
    }
  };

  const handleRequestPermanentDelete = async (targets: EvidenceItem[]) => {
    setOpenItemMenuId(null);
    setBulkMoreOpen(false);
    if (targets.length === 0 || bulkSubmittingRef.current) return;

    try {
      const demoConfig = await fetchDemoConfig();
      const localTargets = targets.filter(
        (item) => demoConfig.demoMode || isLocalEvidenceId(item.id)
      );
      const serverTargets = targets.filter(
        (item) => !demoConfig.demoMode && !isLocalEvidenceId(item.id)
      );

      const eligibleItems: EvidenceItem[] = [...localTargets];
      const blockedItems: Array<{
        id: string;
        title: string;
        reason: string;
        citationCount?: number;
      }> = [];

      if (serverTargets.length > 0) {
        const res = await fetch("/api/evidence/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "preflight_delete",
            ids: serverTargets.map((t) => t.id),
          }),
        });
        const { ok, data: json, error } = await readApiResponse<{
          success?: boolean;
          data?: {
            results?: Array<{
              id: string;
              title?: string;
              outcome: "succeeded" | "skipped" | "conflict" | "blocked";
              reason?: string;
              citationCount?: number;
            }>;
          };
        }>(res, "Failed to verify citation references before deletion.");

        if (!ok || !json?.success || !json.data?.results) {
          setNotification({
            type: "error",
            message:
              error || "Failed to check citation references before deletion.",
          });
          return;
        }

        const serverById = new Map(serverTargets.map((item) => [item.id, item]));
        for (const row of json.data.results) {
          const item = serverById.get(row.id);
          if (!item) continue;
          if (row.outcome === "blocked") {
            blockedItems.push({
              id: row.id,
              title: row.title || item.title,
              reason:
                row.reason ||
                "Cited by a saved resume patch and cannot be permanently deleted.",
              citationCount: row.citationCount,
            });
          } else if (row.outcome === "succeeded") {
            eligibleItems.push(item);
          }
        }
      }

      setDeleteDialogState({
        open: true,
        eligibleItems,
        blockedItems,
        isDeleting: false,
      });
    } catch (err) {
      setNotification({
        type: "error",
        message:
          err instanceof Error
            ? err.message
            : "Failed to check citation references before deletion.",
      });
    }
  };

  const handleConfirmPermanentDelete = async () => {
    const { eligibleItems, blockedItems } = deleteDialogState;
    if (eligibleItems.length === 0) {
      setDeleteDialogState((prev) => ({ ...prev, open: false }));
      return;
    }
    if (bulkSubmittingRef.current) return;
    bulkSubmittingRef.current = true;
    setIsBulkSubmitting(true);
    setDeleteDialogState((prev) => ({ ...prev, isDeleting: true }));

    try {
      const demoConfig = await fetchDemoConfig();
      const localTargets = eligibleItems.filter(
        (item) => demoConfig.demoMode || isLocalEvidenceId(item.id)
      );
      const serverTargets = eligibleItems.filter(
        (item) => !demoConfig.demoMode && !isLocalEvidenceId(item.id)
      );

      let deletedCount = 0;
      const failedIds: string[] = blockedItems.map((b) => b.id);
      const failureReasons: string[] = [];

      if (localTargets.length > 0) {
        const localSet = new Set(localTargets.map((i) => i.id));
        const remaining = readGuestEvidenceFromStorage().filter(
          (entry) => !localSet.has(entry.id)
        );
        writeGuestEvidenceToStorage(remaining);
        deletedCount += localTargets.length;
      }

      if (serverTargets.length === 1) {
        const target = serverTargets[0];
        const res = await fetch(`/api/evidence/${target.id}?mode=purge`, {
          method: "DELETE",
        });
        const { ok, error } = await readApiResponse(
          res,
          `Failed to delete "${target.title}".`
        );
        if (ok) {
          deletedCount += 1;
        } else {
          failedIds.push(target.id);
          failureReasons.push(error || `Failed to delete "${target.title}".`);
        }
      } else if (serverTargets.length > 1) {
        const res = await fetch("/api/evidence/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "delete",
            ids: serverTargets.map((t) => t.id),
          }),
        });
        const { ok, data: json, error } = await readApiResponse<{
          success?: boolean;
          data?: {
            results?: Array<{
              id: string;
              outcome: "succeeded" | "skipped" | "conflict" | "blocked";
              reason?: string;
            }>;
          };
        }>(res, "Failed to permanently delete evidence items.");
        if (!ok || !json?.success || !json.data?.results) {
          failedIds.push(...serverTargets.map((t) => t.id));
          failureReasons.push(
            error || "Failed to permanently delete evidence items."
          );
        } else {
          for (const row of json.data.results) {
            if (row.outcome === "succeeded") {
              deletedCount += 1;
            } else if (row.outcome !== "skipped") {
              failedIds.push(row.id);
              if (row.reason) failureReasons.push(row.reason);
            }
          }
        }
      }

      if (deletedCount > 0) {
        invalidateDependentEvidenceState();
        await fetchItems();
      }

      const deletedSet = new Set(
        eligibleItems
          .map((item) => item.id)
          .filter((id) => !failedIds.includes(id))
      );
      setSelectedIds((prev) => prev.filter((id) => !deletedSet.has(id)));
      setDeleteDialogState({
        open: false,
        eligibleItems: [],
        blockedItems: [],
        isDeleting: false,
      });

      if (failureReasons.length > 0 || deletedCount === 0) {
        setNotification({
          type: "error",
          message:
            deletedCount > 0
              ? `Permanently deleted ${deletedCount} item(s), but ${failureReasons.length} could not be deleted: ${failureReasons[0]}`
              : failureReasons[0] || "No items were permanently deleted.",
        });
      } else {
        setNotification({
          type: "success",
          message: `Permanently deleted ${deletedCount} item${deletedCount === 1 ? "" : "s"}${blockedItems.length > 0 ? ` (${blockedItems.length} cited item${blockedItems.length === 1 ? "" : "s"} kept)` : ""}.`,
        });
      }
    } catch (err) {
      setDeleteDialogState((prev) => ({ ...prev, isDeleting: false, open: false }));
      setNotification({
        type: "error",
        message:
          err instanceof Error
            ? err.message
            : "Failed to permanently delete evidence items.",
      });
    } finally {
      bulkSubmittingRef.current = false;
      setIsBulkSubmitting(false);
    }
  };

  const handlePdfIngestComplete = async (items: PdfEvidenceSaveItem[]) => {
    setNotification(null);
    const { demoMode } = await fetchDemoConfig();
    const failed: PdfEvidenceSaveItem[] = [];

    for (const item of items) {
      try {
        if (!demoMode) {
          const response = await fetch("/api/evidence", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(item),
          });
          const { ok, data } = await readApiResponse<{ success?: boolean }>(response);
          if (ok && data?.success) continue;
          if (response.status !== 401 || accountScope.userId || accountScope.scopeResolved === false) {
            failed.push(item);
            continue;
          }
        }

        const stored = JSON.parse(localStorage.getItem("resumeforge_guest_evidence") ?? "[]");
        if (!Array.isArray(stored)) throw new Error("Invalid local evidence storage.");
        const { importId, ...payload } = item;
        const id = `guest-evi-${importId}`;
        if (stored.some((entry) => entry?.id === id)) continue;
        const now = new Date().toISOString();
        const guestItem = {
          ...payload,
          id,
          userId: "guest",
          createdAt: now,
          updatedAt: now,
          bullets: item.bullets.map((bullet, index) => ({
            ...bullet,
            id: `${id}-bullet-${index}`,
            orderIndex: index,
          })),
        };
        localStorage.setItem("resumeforge_guest_evidence", JSON.stringify([guestItem, ...stored]));
      } catch {
        failed.push(item);
      }
    }

    const savedCount = items.length - failed.length;
    const draftCount = items.filter((item) => item.status === "draft").length - failed.filter((item) => item.status === "draft").length;
    if (savedCount > 0) await fetchItems();
    if (failed.length === 0 && savedCount > 0) {
      setNotification({
        type: "success",
        message:
          draftCount > 0
            ? `Added ${savedCount} evidence item${savedCount === 1 ? "" : "s"} (${draftCount} draft — review & verify before tailoring).`
            : `Added ${savedCount} evidence item${savedCount === 1 ? "" : "s"} to Evidence Bank.`,
      });
    }

    return failed;
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setNotification(null);

    try {
      const text = await file.text();
      const rawData = JSON.parse(text);
      const itemsToImport = Array.isArray(rawData) ? rawData : [rawData];

      let successCount = 0;
      let failCount = 0;
      const guestItemsToImport: EvidenceItem[] = [];
      const demoConfig = await fetchDemoConfig();

      for (const rawItem of itemsToImport) {
        if (!rawItem.title || !rawItem.verifiedSummary) {
          failCount++;
          continue;
        }

        const normalizedBullets: Bullet[] = Array.isArray(rawItem.bullets)
          ? rawItem.bullets.map((b: string | Bullet) =>
              typeof b === "string" ? { text: b, verified: true } : b
            )
          : [];
        const payload = {
          type: rawItem.type || "experience",
          title: rawItem.title,
          organization: rawItem.organization || undefined,
          dates: rawItem.dates || undefined,
          verifiedSummary: rawItem.verifiedSummary,
          tags: Array.isArray(rawItem.tags) ? rawItem.tags : [],
          status: rawItem.status || "verified",
          bullets: normalizedBullets,
        };

        const toGuestItem = (): EvidenceItem => ({
          id: `guest-evi-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          userId: "guest",
          type: payload.type,
          title: payload.title,
          organization: payload.organization || null,
          dates: payload.dates || null,
          verifiedSummary: payload.verifiedSummary,
          tags: payload.tags,
          status: payload.status,
          bullets: payload.bullets.map((b, idx) => ({
            id: `b-${idx}-${Date.now()}`,
            evidenceItemId: "",
            text: b.text,
            technologies: [],
            roleAffinity: [],
            verified: b.verified,
            orderIndex: idx,
          })),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        if (demoConfig.demoMode) {
          guestItemsToImport.push(toGuestItem());
          successCount++;
          continue;
        }

        const res = await fetch("/api/evidence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          successCount++;
        } else if (res.status === 401) {
          guestItemsToImport.push(toGuestItem());
          successCount++;
        } else {
          failCount++;
        }
      }

      if (guestItemsToImport.length > 0) {
        writeGuestEvidenceToStorage([...guestItemsToImport, ...readGuestEvidenceFromStorage()]);
        setItems((prev) => [...guestItemsToImport, ...prev]);
      }

      await fetchItems();

      if (successCount > 0) {
        setNotification({
          type: "success",
          message: `Successfully imported ${successCount} evidence item${
            successCount === 1 ? "" : "s"
          }${failCount > 0 ? ` (${failCount} skipped/invalid)` : ""}.`,
        });
      } else {
        setNotification({
          type: "error",
          message: "No valid evidence items found in imported JSON file.",
        });
      }
    } catch (err) {
      console.error("Failed to parse or import JSON:", err);
      setNotification({
        type: "error",
        message: "Invalid JSON format. Please upload a valid evidence JSON file.",
      });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <AppShell variant="library">
      {/* Main Content Area with Header Margin Clearance matching preview (1).webp */}
      <div
        className={`mx-auto max-w-5xl w-full px-4 sm:px-6 pt-6 sm:pt-8 ${
          isSelectMode && selectedIds.length > 0 ? "pb-32 sm:pb-24" : "pb-16"
        } flex-1 flex flex-col gap-6 sm:gap-8`}
      >
        <div className="sr-only" aria-live="polite" data-testid="selection-announcement">
          {selectionAnnouncement}
        </div>
        {/* Page Title Header */}
        <div className="space-y-6">
          <PageHeader
            title="Evidence Bank"
            actions={
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                {tailorReturnContext ? (
                  <Link
                    href={tailorReturnContext.href}
                    data-testid="library-back-to-tailor-link"
                    className="flex min-h-11 sm:min-h-9 items-center gap-1.5 rounded-[6px] border border-hairline bg-elevated px-3.5 py-1.5 text-body-dense font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    <ArrowLeft className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                    <span>{tailorReturnContext.label}</span>
                  </Link>
                ) : null}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileImport}
                  accept=".json"
                  tabIndex={-1}
                  aria-hidden="true"
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={isImporting}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex min-h-11 sm:min-h-9 items-center gap-2 rounded-[6px] border border-hairline bg-elevated px-3.5 py-1.5 text-xs font-mono text-text-secondary transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50"
                >
                  {isImporting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" aria-hidden />
                  ) : (
                    <Upload className="h-3.5 w-3.5 text-primary" aria-hidden />
                  )}
                  Import JSON
                </button>
                <button
                  ref={addEvidenceBtnRef}
                  type="button"
                  data-testid="add-evidence-item-btn"
                  onClick={(e) => openCreateModal(e.currentTarget)}
                  className="flex min-h-11 sm:min-h-9 items-center gap-1.5 rounded-[6px] bg-primary px-3.5 py-1.5 text-xs font-bold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                  Add Evidence Item
                </button>
              </div>
            }
          />
          <BulkPdfDropzone onComplete={handlePdfIngestComplete} />
        </div>

        {/* Toast Notification Banner */}
        {notification && (
          <div
            role="status"
            data-testid="evidence-notification"
            className={`p-3.5 rounded-lg border flex flex-wrap items-center justify-between gap-2 text-xs font-medium transition-colors duration-150 ease-out motion-reduce:transition-none ${
              notification.type === "success"
                ? "bg-status-success/15 border-status-success/35 text-status-success-soft"
                : "bg-status-danger/10 border-status-danger/30 text-status-danger"
            }`}
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {notification.type === "success" ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-status-success" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0" />
              )}
              <span className="break-words">{notification.message}</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {notification.undoArchive && notification.undoArchive.length > 0 && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isBulkSubmitting}
                  data-testid="undo-archive-btn"
                  onClick={() => void handleUndoArchive(notification.undoArchive!)}
                  className="min-h-11 sm:min-h-7 h-auto sm:h-7 px-2.5 text-xs font-mono border-status-success/40 bg-status-success/15 text-status-success-soft hover:bg-status-success/25"
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Undo
                </Button>
              )}
              <button
                type="button"
                aria-label="Dismiss notification"
                onClick={() => setNotification(null)}
                className="inline-flex min-h-11 min-w-11 items-center justify-center text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div
          ref={tabListRef}
          role="tablist"
          aria-label="Evidence views"
          className="relative flex border-b border-hairline"
        >
          <span
            aria-hidden="true"
            data-testid="library-tab-indicator"
            className="pointer-events-none absolute bottom-0 left-0 h-[2px] w-px origin-left rounded-full ombre-bar transition-transform duration-200 ease-out motion-reduce:transition-none"
            style={
              tabIndicator
                ? { transform: `translateX(${tabIndicator.left}px) scaleX(${tabIndicator.width})`, opacity: 1 }
                : { opacity: 0 }
            }
          />
          <button
            type="button"
            role="tab"
            {...getLibraryTabProps(0)}
            aria-selected={activeTab === "library"}
            onClick={() => handleTabChange("library")}
            className={`min-h-11 px-4 py-2 text-sm font-semibold transition-colors ${activeTab === "library" ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
          >
            Library
          </button>
          <button
            type="button"
            role="tab"
            {...getLibraryTabProps(1)}
            aria-selected={activeTab === "review"}
            onClick={() => handleTabChange("review")}
            className={`min-h-11 px-4 py-2 text-sm font-semibold transition-colors ${activeTab === "review" ? "text-primary" : "text-muted-foreground hover:text-foreground"} flex items-center gap-2`}
          >
            Review Queue
            {reviewItems.length > 0 && (
              <span className="bg-primary text-primary-foreground text-xs font-bold px-1.5 py-0.5 rounded-full tabular-nums">
                {reviewItems.length}
              </span>
            )}
          </button>
        </div>

        {activeTab === "library" ? (
        <>
        {/* Search Input Bar + Status Select Dropdown + Select Toggle + Item Count Bar (hidden when unfiltered bank is empty) */}
        {(isLoading ||
          (filterStatus === "all" ? items.length : unfilteredTotal ?? items.length) > 0 ||
          filterStatus !== "all" ||
          Boolean(searchQuery.trim())) && (
        <div className="flex flex-col gap-3 rounded-xl border glass-bar px-4 py-3">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
            {/* Search Input Box */}
            <div className="relative flex-1 w-full max-w-md">
              <label htmlFor="evidence-search" className="sr-only">
                Search evidence by title, org, summary, or tags
              </label>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
              <input
                id="evidence-search"
                type="search"
                name="evidence-search"
                autoComplete="off"
                value={searchQuery}
                onChange={(e) => handleSearchQueryChange(e.target.value)}
                placeholder="Search evidence…"
                className="w-full h-11 pl-9 pr-4 rounded-[6px] bg-inset border border-hairline text-foreground placeholder:text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring text-xs font-mono"
              />
            </div>

            {/* Status Dropdown + Select Toggle + Item Counter */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto justify-between sm:justify-end">
              <div className="flex items-center gap-2 min-w-0 shrink-0">
                <span className="sr-only sm:not-sr-only shrink-0 text-xs font-mono text-muted-foreground">Status:</span>
                <select
                  value={filterStatus}
                  onChange={(e) => handleFilterStatusChange(e.target.value)}
                  data-testid="evidence-status-filter"
                  aria-label="Filter evidence by status"
                  className="h-11 sm:h-9 min-w-[8.75rem] w-auto max-w-full whitespace-nowrap bg-inset border border-hairline text-foreground rounded-[6px] px-2.5 pr-7 py-0 leading-normal text-xs font-mono outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="active">Active (Verified &amp; Draft)</option>
                  <option value="all">All statuses</option>
                  <option value="verified">Verified Only</option>
                  <option value="draft">Draft Only</option>
                  <option value="archived">Archived Only</option>
                </select>
              </div>

              <Button
                type="button"
                variant={isSelectMode ? "default" : "outline"}
                size="sm"
                data-testid="toggle-select-mode-btn"
                aria-pressed={isSelectMode}
                onClick={() => {
                  if (isSelectMode) {
                    setIsSelectMode(false);
                    clearSelection();
                  } else {
                    setIsSelectMode(true);
                  }
                }}
                className="min-h-11 sm:min-h-8 h-auto sm:h-8 gap-1.5 text-xs font-mono"
              >
                <CheckSquare className="h-3.5 w-3.5" />
                {isSelectMode ? "Done" : "Select"}
              </Button>

              <span
                data-testid="evidence-count-summary"
                className="shrink-0 text-xs font-mono tabular-nums text-muted-foreground"
              >
                {filteredItems.length} {filteredItems.length === 1 ? "item" : "items"}
                {statusCounts && (statusCounts.verified > 0 || statusCounts.draft > 0)
                  ? ` (${statusCounts.verified} verified${statusCounts.draft > 0 ? ` · ${statusCounts.draft} draft` : ""})`
                  : ""}
              </span>
            </div>
          </div>

          {isSelectMode && filteredItems.length > 0 && (
            <div
              data-testid="select-all-bar"
              className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-2.5 text-xs font-mono transition-opacity duration-150 ease-out motion-reduce:transition-none"
            >
              <div className="flex items-center gap-2.5">
                <div className="relative inline-flex items-center">
                  <Checkbox
                    id="select-all-filtered"
                    data-testid="select-all-filtered-checkbox"
                    checked={
                      allFilteredSelected
                        ? true
                        : someFilteredSelected
                          ? "indeterminate"
                          : false
                    }
                    onCheckedChange={(checked) =>
                      toggleSelectAllFiltered(checked === true)
                    }
                    className={`transition-colors duration-100 ease-out motion-reduce:transition-none ${
                      someFilteredSelected && !allFilteredSelected
                        ? "[&>span]:opacity-0"
                        : ""
                    }`}
                  />
                  {someFilteredSelected && !allFilteredSelected && (
                    <Minus
                      aria-hidden="true"
                      className="pointer-events-none absolute left-0.5 top-0.5 h-3 w-3 text-primary-foreground"
                    />
                  )}
                </div>
                <label
                  htmlFor="select-all-filtered"
                  className="cursor-pointer select-none text-text-secondary hover:text-foreground"
                >
                  Select all {filteredItems.length} filtered {filteredItems.length === 1 ? "item" : "items"}
                </label>
              </div>
              {selectedIds.length > 0 && (
                <button
                  type="button"
                  data-testid="select-all-clear-btn"
                  onClick={() => clearSelection("Selection cleared.")}
                  className="text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
                >
                  Clear ({selectedIds.length})
                </button>
              )}
            </div>
          )}
        </div>
        )}

        {/* Evidence Items List matching preview (1).webp */}
        {isLoading ? (
          <div className="grid gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="rounded-xl surface-raised edge-glow p-5 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
                    <div className="space-y-2 flex-1 min-w-0">
                      <Skeleton className="h-4 w-52 max-w-full" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                  </div>
                  <Skeleton className="h-5 w-20 rounded-md shrink-0" />
                </div>
                <div className="space-y-2 pl-12">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-11/12" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
                <div className="flex flex-wrap gap-2 pl-12">
                  <Skeleton className="h-5 w-16 rounded-[6px]" />
                  <Skeleton className="h-5 w-20 rounded-[6px]" />
                  <Skeleton className="h-5 w-14 rounded-[6px]" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="rounded-xl border-dashed surface-raised p-12 text-center">
            <FileJson className="mx-auto h-8 w-8 text-muted-foreground mb-2" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-foreground">No evidence items found</h2>
            <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
              {searchQuery
                ? `No evidence items matching search "${searchQuery}".`
                : filterStatus === "all"
                  ? "Add your first evidence item or drop a PDF resume above to get started."
                  : `No evidence items matching status filter "${filterStatus}".`}
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredItems.map((item) => {
              const isExpanded = expandedIds[item.id] ?? false;
              const isSelected = selectedIdSet.has(item.id);
              const isArchived = item.status === "archived";
              const isItemMenuOpen = openItemMenuId === item.id;
              const typeLower = (item.type || "").toLowerCase();
              const isEducation = typeLower === "education" || typeLower === "award";
              const isSkill = typeLower === "skill" || typeLower === "metric";
              const typeBadgeClass = isEducation
                ? "bg-signal/10 border-signal/35 text-signal"
                : isSkill
                  ? "bg-ember/10 border-ember/35 text-ember"
                  : "bg-primary/10 border-primary/35 text-primary";
              const typeEdgeClass = isEducation
                ? "border-l-[3px] border-l-signal hover:border-l-signal"
                : isSkill
                  ? "border-l-[3px] border-l-ember hover:border-l-ember"
                  : "border-l-[3px] border-l-primary hover:border-l-primary";
              return (
                <div
                  key={item.id}
                  data-testid="evidence-item-card"
                  className={`rounded-xl surface-raised card-lift ${typeEdgeClass} ${
                    isSelected ? "ring-1 ring-primary/60" : ""
                  } ${isArchived ? "opacity-85" : ""} p-5 overflow-visible transition-colors duration-150 ease-out motion-reduce:transition-none [content-visibility:auto] [contain-intrinsic-size:auto_180px]`}
                >
                  {/* Card Header Row */}
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                    <div className="flex items-start gap-2 sm:gap-3 min-w-0 flex-1">
                      {isSelectMode && (
                        <div className="flex items-center pt-0.5 shrink-0">
                          <label
                            htmlFor={`select-evidence-${item.id}`}
                            className="sr-only"
                          >
                            Select {item.title}
                          </label>
                          <Checkbox
                            id={`select-evidence-${item.id}`}
                            data-testid={`select-evidence-${item.id}`}
                            checked={isSelected}
                            onCheckedChange={(checked) =>
                              toggleItemSelected(item.id, checked === true)
                            }
                            className="transition-colors duration-100 ease-out motion-reduce:transition-none"
                          />
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => toggleExpand(item.id)}
                        aria-expanded={isExpanded}
                        aria-label={isExpanded ? `Collapse ${item.title}` : `Expand ${item.title}`}
                        className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center -ml-2 -mt-2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                          <span className={`rounded-[5px] border px-2 py-0.5 text-xs font-mono font-bold uppercase tracking-wider ${typeBadgeClass}`}>
                            {item.type}
                          </span>
                          <h2 className="text-base font-bold text-foreground tracking-tight break-words">
                            {item.title}
                            {item.organization &&
                            item.type !== "skill" &&
                            !item.title.trim().toLowerCase().endsWith(item.organization.trim().toLowerCase())
                              ? ` @ ${item.organization}`
                              : ""}
                          </h2>
                        </div>
                        <p className="mt-2 text-sm text-text-secondary leading-relaxed max-w-3xl break-words">
                          {item.verifiedSummary}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 sm:shrink-0">
                      <span
                        className={`rounded-[5px] px-2.5 py-0.5 text-xs font-mono font-bold uppercase tracking-wider ${
                          item.status === "verified"
                            ? "bg-status-success/10 border border-status-success/35 text-status-success"
                            : "bg-inset border border-hairline text-muted-foreground"
                        }`}
                      >
                        {item.status === "verified"
                          ? "✓ VERIFIED"
                          : isArchived
                            ? "ARCHIVED"
                            : item.status}
                      </span>
                      {item.status !== "verified" && !isArchived && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          data-testid="verify-evidence-btn"
                          onClick={() => void handleVerifyItem(item)}
                          className="min-h-11 sm:min-h-8 h-auto sm:h-8 gap-1.5 border-status-success/35 bg-status-success/10 px-2.5 text-xs font-mono font-semibold text-status-success hover:bg-status-success/20 hover:text-status-success"
                          aria-label={`Verify ${item.title}`}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Verify
                        </Button>
                      )}
                      {isArchived && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isBulkSubmitting}
                          data-testid={`restore-evidence-btn-${item.id}`}
                          onClick={() => void handleRestoreItem(item, "draft")}
                          className="min-h-11 sm:min-h-8 h-auto sm:h-8 gap-1.5 border-hairline bg-inset px-2.5 text-xs font-mono font-semibold text-foreground hover:bg-elevated"
                          aria-label={`Restore ${item.title}`}
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Restore
                        </Button>
                      )}
                      {item.dates && (
                        <span className="text-xs font-mono text-muted-foreground">
                          {item.dates}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={(e) => openEditModal(item, e.currentTarget)}
                        className="ml-1 inline-flex min-h-11 min-w-11 items-center justify-center rounded-[6px] p-2 text-muted-foreground transition-colors hover:bg-elevated hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        title="Edit Item"
                        aria-label="Edit Item"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      {!isArchived && (
                        <button
                          type="button"
                          onClick={() => void handleArchiveItem(item.id)}
                          className="text-muted-foreground hover:text-status-danger p-2 rounded-[6px] hover:bg-elevated transition-colors min-h-11 min-w-11 inline-flex items-center justify-center"
                          title="Archive Item"
                          aria-label="Archive Item"
                        >
                          <Archive className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <DropdownMenu
                        open={isItemMenuOpen}
                        onOpenChange={(nextOpen) =>
                          setOpenItemMenuId(nextOpen ? item.id : null)
                        }
                      >
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            aria-label={`More actions for ${item.title}`}
                            data-testid={`item-more-btn-${item.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-muted-foreground hover:text-foreground p-2 rounded-[6px] hover:bg-elevated transition-colors min-h-11 min-w-11 inline-flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                          >
                            <MoreVertical className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          aria-label={`Actions for ${item.title}`}
                          onClick={(e) => e.stopPropagation()}
                          className="min-w-48 rounded-lg border-hairline bg-panel p-1 text-foreground shadow-xl"
                        >
                          {isArchived ? (
                            <DropdownMenuItem
                              onSelect={() => void handleRestoreItem(item, "draft")}
                              className="flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-xs text-foreground focus:bg-elevated focus:text-foreground"
                            >
                              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                              Restore to Draft
                            </DropdownMenuItem>
                          ) : null}
                          <DropdownMenuItem
                            data-testid={`item-delete-permanently-${item.id}`}
                            onSelect={() => void handleRequestPermanentDelete([item])}
                            className="flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-xs text-status-danger focus:bg-status-danger/10 focus:text-status-danger"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            Delete permanently…
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {/* Tag Pills Row */}
                  {item.tags && item.tags.length > 0 && (
                    <div className="mt-4 flex flex-wrap items-center gap-2 pl-0 sm:pl-7">
                      {item.tags.map((t, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1.5 rounded-[6px] bg-inset border border-hairline px-2.5 py-1 text-xs font-mono text-text-secondary"
                        >
                          {hasBrandIcon(t) && <BrandIcon name={t} className="h-3 w-3 shrink-0" />}
                          <span>{t}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Expanded Bullets List */}
                  {isExpanded && item.bullets && item.bullets.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-hairline pl-7">
                      <ul className="space-y-2 text-xs text-text-secondary list-disc pl-4 font-sans">
                        {item.bullets.map((b, idx) => (
                          <li key={b.id || idx} className="leading-relaxed">
                            {b.text}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        </>
        ) : (
          <div className="grid gap-4" data-testid="duplicate-review-queue">
            {reviewItems.length === 0 ? (
              <div className="rounded-xl border-dashed surface-raised text-center p-10 text-muted-foreground text-xs font-mono">
                No duplicate or overlapping evidence items need review.
              </div>
            ) : (
              reviewItems.map((item) => {
                const similarityScore = item.similarityScore;
                const hasNumericScore =
                  typeof similarityScore === "number" && Number.isFinite(similarityScore);
                const matchedTarget = item.duplicateTargetId
                  ? items.find((i) => i.id === item.duplicateTargetId)
                  : undefined;
                const isExactTitleOrgMatch =
                  Boolean(item.exactTitleOrgMatch) ||
                  Boolean(
                    matchedTarget &&
                      matchedTarget.title.trim().toLowerCase() === item.title.trim().toLowerCase() &&
                      (matchedTarget.organization || "").trim().toLowerCase() ===
                        (item.organization || "").trim().toLowerCase()
                  );

                return (
                  <div
                    key={item.id}
                    data-testid={`duplicate-review-card-${item.id}`}
                    className="rounded-xl surface-raised card-lift p-5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                      <h3 className="text-base font-bold text-foreground break-words">
                        Review Potential Duplicate · {item.title}
                      </h3>
                      <span className="text-xs font-mono text-muted-foreground">
                        {item.organization || "Personal"}
                      </span>
                    </div>
                    <div className="flex flex-col md:flex-row gap-4 mb-4">
                      <div className="flex-1 p-4 rounded-lg bg-inset border border-hairline">
                        <div className="text-xs text-primary mb-1 font-mono uppercase">
                          Candidate Bullet
                        </div>
                        <p className="text-sm text-text-secondary leading-relaxed">
                          {item.candidateBullet || item.verifiedSummary || "N/A"}
                        </p>
                      </div>
                      <div className="flex items-center justify-center px-2">
                        <div className="text-center">
                          {hasNumericScore ? (
                            <>
                              <div className="text-ember font-bold text-lg font-mono tabular-nums">
                                {Math.round(similarityScore * 100)}%
                              </div>
                              <div className="text-xs text-muted-foreground uppercase font-mono">
                                Similarity
                              </div>
                            </>
                          ) : (
                            <div className="text-xs text-muted-foreground font-mono max-w-44">
                              {isExactTitleOrgMatch
                                ? "Exact match: same title and organization"
                                : "Potential duplicate"}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex-1 p-4 rounded-lg bg-inset border border-hairline">
                        <div className="text-xs text-signal mb-1 font-mono uppercase">
                          Existing Bullet
                        </div>
                        <p className="text-sm text-text-secondary leading-relaxed">
                          {item.existingBullet || "N/A"}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button
                        type="button"
                        data-testid={`keep-both-btn-${item.id}`}
                        onClick={async () => {
                          try {
                            const raw = localStorage.getItem("rf_reviewed_duplicates");
                            const list: string[] = raw ? JSON.parse(raw) : [];
                            localStorage.setItem(
                              "rf_reviewed_duplicates",
                              JSON.stringify(Array.from(new Set([...list, item.id])))
                            );
                          } catch {}
                          const demoConfig = await fetchDemoConfig();
                          const isLocalItem = demoConfig.demoMode || isLocalEvidenceId(item.id);
                          if (!isLocalItem) {
                            if (item.status !== "verified") {
                              try {
                                const res = await fetch(`/api/evidence/${item.id}`, {
                                  method: "PUT",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ status: "verified" }),
                                });
                                if (!res.ok) {
                                  const errMsg = await parseApiError(
                                    res,
                                    `Failed to verify "${item.title}".`
                                  );
                                  setNotification({ type: "error", message: errMsg });
                                  return;
                                }
                              } catch {
                                setNotification({
                                  type: "error",
                                  message: `Network error verifying "${item.title}".`,
                                });
                                return;
                              }
                            }
                          } else {
                            const list = readGuestEvidenceFromStorage();
                            writeGuestEvidenceToStorage(
                              list.map((g) =>
                                g.id === item.id ? { ...g, status: "verified", needsReview: false } : g
                              )
                            );
                          }
                          setItems((prev) =>
                            prev.map((i) =>
                              i.id === item.id ? { ...i, needsReview: false, status: "verified" } : i
                            )
                          );
                          setNotification({
                            type: "success",
                            message: `Kept both "${item.title}" entries as distinct verified items.`,
                          });
                        }}
                        variant="outline"
                        className="border-hairline bg-inset text-text-secondary hover:text-foreground text-xs"
                      >
                        Keep Both
                      </Button>
                      <Button
                        type="button"
                        data-testid={`merge-duplicate-btn-${item.id}`}
                        onClick={async () => {
                          const target = items.find((i) => i.id === item.duplicateTargetId);
                          if (!target) {
                            setNotification({
                              type: "error",
                              message: "Could not locate primary target item for merge.",
                            });
                            return;
                          }
                          const mergedTags = Array.from(
                            new Set([...(target.tags || []), ...(item.tags || [])])
                          );
                          const existingTexts = new Set(
                            (target.bullets || []).map((b) => b.text.trim().toLowerCase())
                          );
                          const mergedBullets = [
                            ...(target.bullets || []).map((b) => ({
                              text: b.text,
                              verified: true,
                            })),
                            ...(item.bullets || [])
                              .filter((b) => !existingTexts.has(b.text.trim().toLowerCase()))
                              .map((b) => ({ text: b.text, verified: true })),
                          ];

                          const demoConfig = await fetchDemoConfig();
                          const isTargetLocal = demoConfig.demoMode || isLocalEvidenceId(target.id);
                          const isItemLocal = demoConfig.demoMode || isLocalEvidenceId(item.id);

                          if (!isTargetLocal) {
                            const updateRes = await fetch(`/api/evidence/${target.id}`, {
                              method: "PUT",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                tags: mergedTags,
                                bullets: mergedBullets,
                                status: "verified",
                              }),
                            }).catch(() => null);
                            if (!updateRes || !updateRes.ok) {
                              const errMsg = updateRes
                                ? await parseApiError(
                                    updateRes,
                                    `Failed to merge into "${target.title}". Duplicate was preserved.`
                                  )
                                : `Failed to merge into "${target.title}". Duplicate was preserved.`;
                              setNotification({
                                type: "error",
                                message: errMsg,
                              });
                              return;
                            }
                          } else {
                            const list = readGuestEvidenceFromStorage();
                            const updatedGuestList = list.map((g) =>
                              g.id === target.id
                                ? {
                                    ...g,
                                    tags: mergedTags,
                                    status: "verified" as const,
                                    bullets: mergedBullets.map((b, idx) => ({
                                      id: `b-${idx}-${Date.now()}`,
                                      evidenceItemId: target.id,
                                      text: b.text,
                                      technologies: [],
                                      roleAffinity: [],
                                      verified: true,
                                      orderIndex: idx,
                                    })),
                                  }
                                : g
                            );
                            writeGuestEvidenceToStorage(updatedGuestList);
                          }

                          if (!isItemLocal) {
                            const delRes = await fetch(`/api/evidence/${item.id}`, {
                              method: "DELETE",
                            }).catch(() => null);
                            if (!delRes || !delRes.ok) {
                              const errMsg = delRes
                                ? await parseApiError(
                                    delRes,
                                    `Merged into "${target.title}", but failed to remove duplicate item.`
                                  )
                                : `Merged into "${target.title}", but failed to remove duplicate item.`;
                              await fetchItems();
                              setNotification({
                                type: "error",
                                message: errMsg,
                              });
                              return;
                            }
                          } else {
                            const list = readGuestEvidenceFromStorage();
                            writeGuestEvidenceToStorage(list.filter((g) => g.id !== item.id));
                          }
                          await fetchItems();
                          setNotification({
                            type: "success",
                            message: `Merged "${item.title}" bullets into primary Evidence Bank record.`,
                          });
                        }}
                        className="bg-primary text-primary-foreground font-bold text-xs hover:opacity-90"
                      >
                        Merge
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeTab === "library" && isSelectMode && selectedIds.length > 0 && (
          <div
            role="region"
            aria-label="Bulk evidence actions"
            data-testid="evidence-bulk-toolbar"
            className="sticky bottom-4 z-30 rounded-xl border border-hairline bg-panel/95 backdrop-blur-md p-3 shadow-2xl transition-[opacity,transform] duration-150 ease-out motion-reduce:transition-none animate-in fade-in slide-in-from-bottom-2 motion-reduce:animate-none"
          >
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <span className="text-xs font-mono font-semibold text-foreground tabular-nums">
                {selectedIds.length} selected
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={eligibleToVerifyCount === 0 || isBulkSubmitting}
                  data-testid="bulk-verify-btn"
                  onClick={() => void handleBulkAction("verify")}
                  className="min-h-10 sm:min-h-8 gap-1.5 border-status-success/35 bg-status-success/10 text-xs font-mono text-status-success-soft hover:bg-status-success/20 disabled:opacity-50"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Verify eligible ({eligibleToVerifyCount})
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={eligibleToArchiveCount === 0 || isBulkSubmitting}
                  data-testid="bulk-archive-btn"
                  onClick={() => void handleBulkAction("archive")}
                  className="min-h-10 sm:min-h-8 gap-1.5 border-hairline bg-inset text-xs font-mono text-foreground hover:bg-elevated disabled:opacity-50"
                >
                  <Archive className="h-3.5 w-3.5" />
                  Archive
                </Button>
                <DropdownMenu open={bulkMoreOpen} onOpenChange={setBulkMoreOpen}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={isBulkSubmitting}
                      data-testid="bulk-more-btn"
                      className="min-h-10 sm:min-h-8 gap-1 border-hairline bg-inset text-xs font-mono text-foreground hover:bg-elevated"
                    >
                      More
                      <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    side="top"
                    align="end"
                    aria-label="More bulk evidence actions"
                    className="min-w-52 rounded-lg border-hairline bg-panel p-1 text-foreground shadow-xl"
                  >
                    {selectedArchivedCount > 0 && (
                      <DropdownMenuItem
                        data-testid="bulk-restore-btn"
                        onSelect={() => void handleBulkAction("restore")}
                        className="flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-xs text-foreground focus:bg-elevated focus:text-foreground"
                      >
                        <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                        Restore selected ({selectedArchivedCount})
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      data-testid="bulk-delete-permanently-btn"
                      onSelect={() => void handleRequestPermanentDelete(selectedItems)}
                      className="flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-xs text-status-danger focus:bg-status-danger/10 focus:text-status-danger"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      Delete permanently…
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={isBulkSubmitting}
                  data-testid="bulk-clear-btn"
                  onClick={() => clearSelection("Selection cleared.")}
                  className="min-h-10 sm:min-h-8 text-xs font-mono text-muted-foreground hover:text-foreground"
                >
                  Clear
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Permanent Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogState.open}
        onOpenChange={(open) =>
          setDeleteDialogState((prev) => ({ ...prev, open }))
        }
        tone={deleteDialogState.eligibleItems.length > 0 ? "destructive" : "default"}
        isConfirming={deleteDialogState.isDeleting}
        dialogTestId="permanent-delete-dialog"
        confirmTestId="confirm-permanent-delete-btn"
        cancelTestId="cancel-permanent-delete-btn"
        title={
          deleteDialogState.eligibleItems.length === 0
            ? "Cannot permanently delete cited evidence"
            : deleteDialogState.blockedItems.length > 0
              ? `Permanently delete ${deleteDialogState.eligibleItems.length} eligible item${deleteDialogState.eligibleItems.length === 1 ? "" : "s"}?`
              : deleteDialogState.eligibleItems.length === 1
                ? "Delete evidence item permanently?"
                : `Permanently delete ${deleteDialogState.eligibleItems.length} evidence items?`
        }
        description={
          deleteDialogState.eligibleItems.length === 0
            ? `Permanent deletion is blocked because the selected evidence is cited by saved resume patches: ${deleteDialogState.blockedItems.map((b) => `${b.title} (${b.reason})`).join("; ")}. Archive them instead to preserve citation history.`
            : deleteDialogState.blockedItems.length > 0
              ? `Will permanently delete ${deleteDialogState.eligibleItems.length} unreferenced item(s): ${deleteDialogState.eligibleItems.map((item) => item.title).join(", ")}. Blocked by patch citations and left untouched (${deleteDialogState.blockedItems.length}): ${deleteDialogState.blockedItems.map((b) => `${b.title} — ${b.reason}`).join("; ")}.`
              : `This will permanently delete ${deleteDialogState.eligibleItems.length === 1 ? `"${deleteDialogState.eligibleItems[0]?.title}"` : `${deleteDialogState.eligibleItems.length} evidence items`} and cannot be undone.`
        }
        confirmLabel={
          deleteDialogState.eligibleItems.length === 0
            ? "Close"
            : deleteDialogState.blockedItems.length > 0
              ? `Delete ${deleteDialogState.eligibleItems.length} eligible`
              : "Delete permanently"
        }
        cancelLabel={deleteDialogState.eligibleItems.length === 0 ? "Dismiss" : "Cancel"}
        onConfirm={() => {
          void handleConfirmPermanentDelete();
        }}
      />

      {/* Modal Dialog for Create/Edit */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent
          className="max-w-lg max-h-[90dvh] overflow-y-auto overscroll-contain border-hairline bg-panel p-4 sm:p-6"
          onCloseAutoFocus={(event) => {
            const target =
              modalOpenerRef.current && modalOpenerRef.current.isConnected
                ? modalOpenerRef.current
                : addEvidenceBtnRef.current;
            modalOpenerRef.current = null;
            if (target && target.isConnected) {
              event.preventDefault();
              target.focus({ preventScroll: true });
              requestAnimationFrame(() => {
                if (target.isConnected) {
                  target.focus({ preventScroll: true });
                }
              });
            }
          }}
        >
          <DialogHeader className="text-left">
            <DialogTitle className="text-base font-bold text-foreground">
              {editingItem ? "Edit Evidence Item" : "Create Evidence Item"}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Add or update verified experience, project, or skill evidence.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveItem} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="evidence-item-type" className="block text-xs font-mono text-on-surface-variant mb-1">
                  Type
                </label>
                <select
                  id="evidence-item-type"
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="min-h-10 sm:min-h-0 w-full rounded-[6px] border border-control/70 bg-inset px-3 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
                >
                  <option value="experience">Experience</option>
                  <option value="project">Project</option>
                  <option value="skill">Skill</option>
                  <option value="education">Education</option>
                  <option value="award">Award</option>
                  <option value="metric">Metric</option>
                </select>
              </div>

              <div>
                <label htmlFor="evidence-item-status" className="block text-xs font-mono text-on-surface-variant mb-1">
                  Status
                </label>
                <select
                  id="evidence-item-status"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="min-h-10 sm:min-h-0 w-full rounded-[6px] border border-control/70 bg-inset px-3 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
                >
                  <option value="draft">Draft</option>
                  <option value="verified">Verified</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="evidence-item-title" className="block text-xs font-mono text-on-surface-variant mb-1">
                Title
              </label>
              <input
                id="evidence-item-title"
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="min-h-10 sm:min-h-0 w-full rounded-[6px] border border-control/70 bg-inset px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
                placeholder="e.g. Software Engineer Intern"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="evidence-item-org" className="block text-xs font-mono text-on-surface-variant mb-1">
                  Organization
                </label>
                <input
                  id="evidence-item-org"
                  type="text"
                  value={formData.organization}
                  onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                  className="min-h-10 sm:min-h-0 w-full rounded-[6px] border border-control/70 bg-inset px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
                  placeholder="e.g. Stripe"
                />
              </div>

              <div>
                <label htmlFor="evidence-item-dates" className="block text-xs font-mono text-on-surface-variant mb-1">
                  Dates
                </label>
                <input
                  id="evidence-item-dates"
                  type="text"
                  value={formData.dates}
                  onChange={(e) => setFormData({ ...formData, dates: e.target.value })}
                  className="min-h-10 sm:min-h-0 w-full rounded-[6px] border border-control/70 bg-inset px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
                  placeholder="e.g. Jun 29, 2023"
                />
              </div>
            </div>

            <div>
              <label htmlFor="evidence-item-summary" className="block text-xs font-mono text-on-surface-variant mb-1">
                Verified Summary
              </label>
              <textarea
                id="evidence-item-summary"
                required
                rows={3}
                value={formData.verifiedSummary}
                onChange={(e) => setFormData({ ...formData, verifiedSummary: e.target.value })}
                className="w-full rounded-[6px] border border-control/70 bg-inset px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
                placeholder="Detailed summary of verified accomplishment claim..."
              />
            </div>

            <div>
              <label htmlFor="evidence-item-tags" className="block text-xs font-mono text-on-surface-variant mb-1">
                Tags (Comma-separated)
              </label>
              <input
                id="evidence-item-tags"
                type="text"
                value={formData.tagsInput}
                onChange={(e) => setFormData({ ...formData, tagsInput: e.target.value })}
                className="w-full rounded-[6px] border border-control/70 bg-inset px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-panel font-mono"
                placeholder="TypeScript, React, Node.js"
              />
            </div>

            <div>
              <label htmlFor="evidence-item-bullets" className="block text-xs font-mono text-on-surface-variant mb-1">
                Bullets (One per line)
              </label>
              <textarea
                id="evidence-item-bullets"
                rows={3}
                value={formData.bulletsInput.join("\n")}
                onChange={(e) => setFormData({ ...formData, bulletsInput: e.target.value.split("\n") })}
                className="w-full rounded-[6px] border border-control/70 bg-inset px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-panel font-mono"
                placeholder="Developed high-throughput API endpoints..."
              />
            </div>

            <DialogFooter className="pt-3 border-t border-hairline gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsModalOpen(false)}
                className="border-control/70 bg-inset text-on-surface-variant hover:text-foreground text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="bg-primary text-primary-foreground font-semibold text-xs hover:opacity-90"
              >
                Save Item
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
