"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/design-system/app-shell";
import { fetchDemoConfig } from "@/components/auth/session-user";
import { BrandIcon, hasBrandIcon } from "@/components/design-system/brand-icon";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import type { ExtractedPdfEvidence } from "@/lib/evidence/pdfExtractor";
import { convertExtractedPdfToEvidenceItems } from "@/lib/evidence/evidence-transform";
import { initializeDemoSamples } from "@/lib/demo-client";
import { parseApiError, readApiResponse } from "@/lib/api-error";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  similarityScore?: number;
  candidateBullet?: string;
  existingBullet?: string;
}

export function isLocalEvidenceId(id: string): boolean {
  return id.startsWith("guest-") || id.startsWith("demo-sample-");
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
  const [items, setItems] = useState<EvidenceItem[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"library" | "review">("library");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const modalOpenerRef = useRef<HTMLElement | null>(null);
  const tabListRef = useRef<HTMLDivElement>(null);
  const [tabIndicator, setTabIndicator] = useState<{ left: number; width: number } | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<EvidenceItem | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    type: "experience",
    title: "",
    organization: "",
    dates: "",
    verifiedSummary: "",
    tagsInput: "",
    status: "verified",
    bulletsInput: [""],
  });

  const fetchAbortRef = useRef<AbortController | null>(null);

  const fetchItems = useCallback(async () => {
    fetchAbortRef.current?.abort();
    const controller = new AbortController();
    fetchAbortRef.current = controller;

    try {
      setIsLoading(true);
      const demoConfig = await fetchDemoConfig();
      if (controller.signal.aborted) return;
      let loadedItems: EvidenceItem[] = [];
      if (demoConfig.demoMode) {
        initializeDemoSamples();
        const localItems = readGuestEvidenceFromStorage();
        loadedItems = filterStatus === "all" ? localItems : localItems.filter((item) => item.status === filterStatus);
      } else {
        const url = filterStatus === "all" ? "/api/evidence" : `/api/evidence?status=${filterStatus}`;
        const res = await fetch(url, { signal: controller.signal });
        const { ok, data: json, error } = await readApiResponse<{
          success?: boolean;
          data?: EvidenceItem[];
        }>(res, "Failed to fetch evidence items.");
        if (controller.signal.aborted) return;
        if (!ok || !json?.success) {
          throw new Error(error || "Failed to fetch evidence items.");
        }
        loadedItems = json.data || [];
        const guestItems = readGuestEvidenceFromStorage();
        if (guestItems.length > 0) {
          const existingIds = new Set(loadedItems.map((i) => i.id));
          loadedItems = [
            ...loadedItems,
            ...guestItems.filter(
              (item) =>
                !existingIds.has(item.id) &&
                (filterStatus === "all" || item.status === filterStatus)
            ),
          ];
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

      const annotated = loadedItems.map((item, idx) => {
        if (reviewedSet.has(item.id)) return item;
        if (item.needsReview) return item;
        const normTitle = item.title.trim().toLowerCase();
        const earlierMatch = loadedItems.slice(0, idx).find((prev) => {
          const prevTitle = prev.title.trim().toLowerCase();
          return (
            prevTitle === normTitle &&
            (prev.organization || "").trim().toLowerCase() === (item.organization || "").trim().toLowerCase()
          );
        });
        if (earlierMatch) {
          return {
            ...item,
            needsReview: true,
            duplicateTargetId: earlierMatch.id,
            similarityScore: 0.88,
            candidateBullet: item.bullets?.[0]?.text || item.verifiedSummary,
            existingBullet: earlierMatch.bullets?.[0]?.text || earlierMatch.verifiedSummary,
          };
        }
        return item;
      });

      if (controller.signal.aborted) return;
      setItems(annotated);
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
  }, [activeTab, items]);

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

  const openCreateModal = (opener?: HTMLElement | null) => {
    modalOpenerRef.current =
      opener instanceof HTMLElement
        ? opener
        : document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
    setEditingItem(null);
    setFormData({
      type: "experience",
      title: "",
      organization: "",
      dates: "",
      verifiedSummary: "",
      tagsInput: "",
      status: "verified",
      bulletsInput: [""],
    });
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
    setFormData({
      type: item.type,
      title: item.title,
      organization: item.organization || "",
      dates: item.dates || "",
      verifiedSummary: item.verifiedSummary,
      tagsInput: (item.tags || []).join(", "),
      status: item.status,
      bulletsInput: (item.bullets || []).map((b) => b.text),
    });
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
    try {
      const demoConfig = await fetchDemoConfig();
      if (demoConfig.demoMode || isLocalEvidenceId(id)) {
        const filtered = readGuestEvidenceFromStorage().filter((item) => item.id !== id);
        writeGuestEvidenceToStorage(filtered);
        setItems((prev) => prev.filter((item) => item.id !== id));
        setNotification({
          type: "success",
          message: "Item archived successfully.",
        });
        return;
      }

      const res = await fetch(`/api/evidence/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await fetchItems();
        setNotification({
          type: "success",
          message: "Item archived successfully.",
        });
      } else {
        const errorMessage = await parseApiError(res, "Failed to archive evidence item.");
        setNotification({
          type: "error",
          message: errorMessage,
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

  const handlePdfIngestComplete = async (extractedItems: ExtractedPdfEvidence[]) => {
    let createdCount = 0;
    const guestItemsToAdd: EvidenceItem[] = [];
    const demoConfig = await fetchDemoConfig();

    for (const extracted of extractedItems) {
      const itemsToCreate = convertExtractedPdfToEvidenceItems(extracted);

      for (const itemPayload of itemsToCreate) {
        const toGuestItem = (): EvidenceItem => ({
          id: `guest-evi-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          userId: "guest",
          type: itemPayload.type,
          title: itemPayload.title,
          organization: itemPayload.organization || null,
          dates: itemPayload.dates || null,
          verifiedSummary: itemPayload.verifiedSummary,
          tags: itemPayload.tags || [],
          status: itemPayload.status || "verified",
          bullets: (itemPayload.bullets || []).map((b, idx) => ({
            id: `b-${idx}-${Date.now()}`,
            evidenceItemId: "",
            text: b.text,
            technologies: [],
            roleAffinity: [],
            verified: b.verified ?? true,
            orderIndex: idx,
          })),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        if (demoConfig.demoMode) {
          guestItemsToAdd.push(toGuestItem());
          continue;
        }

        try {
          const res = await fetch("/api/evidence", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(itemPayload),
          });

          if (res.ok) {
            createdCount++;
          } else {
            guestItemsToAdd.push(toGuestItem());
          }
        } catch (err) {
          console.error("Failed to save extracted evidence item:", err);
        }
      }
    }

    if (guestItemsToAdd.length > 0) {
      writeGuestEvidenceToStorage([...guestItemsToAdd, ...readGuestEvidenceFromStorage()]);
      setItems((prev) => [...guestItemsToAdd, ...prev]);
      createdCount += guestItemsToAdd.length;
    }

    await fetchItems();

    if (createdCount > 0) {
      setNotification({
        type: "success",
        message: `Successfully indexed and added ${createdCount} evidence item${createdCount === 1 ? "" : "s"} to Evidence Bank.`,
      });
    } else {
      setNotification({
        type: "error",
        message: "No evidence items could be extracted from the uploaded document.",
      });
    }

    return createdCount;
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
    <AppShell
      variant="library"
      actions={
        <div className="flex items-center gap-3">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileImport}
            accept=".json"
            className="hidden"
          />
          <button
            type="button"
            disabled={isImporting}
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-[6px] border border-hairline bg-elevated text-xs font-mono text-text-secondary hover:bg-muted hover:text-foreground transition-colors"
          >
            {isImporting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            ) : (
              <Upload className="h-3.5 w-3.5 text-primary" />
            )}
            Import JSON
          </button>
          <button
            type="button"
            onClick={(e) => openCreateModal(e.currentTarget)}
            className="flex items-center gap-1.5 rounded-[6px] border border-primary/40 bg-primary/10 px-3.5 py-1.5 text-xs font-bold text-primary transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Evidence Item
          </button>
        </div>
      }
    >
      {/* Main Content Area with Header Margin Clearance matching preview (1).webp */}
      <div className="mx-auto max-w-5xl w-full px-6 pt-8 pb-16 flex-1 flex flex-col gap-8">
        {/* Page Title Header */}
        <div className="space-y-6">
          <div className="enter-once rounded-xl surface-raised edge-glow p-5 sm:p-6">
            <div className="border-l-2 border-primary pl-3 sm:pl-4">
              <h1 className="text-3xl font-bold text-foreground tracking-[-0.03em]">
                Verified Evidence Bank Inventory
              </h1>
            </div>
          </div>
          <BulkPdfDropzone onComplete={handlePdfIngestComplete} />
        </div>

        {/* Toast Notification Banner */}
        {notification && (
          <div
            className={`p-3.5 rounded-lg border flex items-center justify-between text-xs font-medium transition-all duration-150 ease-out ${
              notification.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : "bg-red-500/10 border-red-500/30 text-red-400"
            }`}
          >
            <div className="flex items-center gap-2">
              {notification.type === "success" ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <span>{notification.message}</span>
            </div>
            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() => setNotification(null)}
              className="inline-flex min-h-11 min-w-11 items-center justify-center text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
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
            aria-selected={activeTab === "library"}
            onClick={() => setActiveTab("library")}
            className={`px-4 py-2 text-sm font-semibold transition-colors ${activeTab === "library" ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
          >
            Library
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "review"}
            onClick={() => setActiveTab("review")}
            className={`px-4 py-2 text-sm font-semibold transition-colors ${activeTab === "review" ? "text-primary" : "text-muted-foreground hover:text-foreground"} flex items-center gap-2`}
          >
            Review Queue
            {reviewItems.length > 0 && (
              <span className="bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full tabular-nums">
                {reviewItems.length}
              </span>
            )}
          </button>
        </div>

        {activeTab === "library" ? (
        <>
        {/* Search Input Bar + Status Select Dropdown + Item Count Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-xl border glass-bar px-4 py-3">
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
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search evidence by title, org, summary, or tags…"
              className="w-full h-11 pl-9 pr-4 rounded-[6px] bg-inset border border-hairline text-foreground placeholder:text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring text-xs font-mono"
            />
          </div>

          {/* Status Dropdown + Item Counter */}
          <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-muted-foreground">Status:</span>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                data-testid="evidence-status-filter"
                aria-label="Filter evidence by status"
                className="bg-inset border border-hairline text-foreground rounded-[6px] px-3 py-1.5 text-xs font-mono outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="all">All, Verified, Draft, Archived</option>
                <option value="verified">Verified Only</option>
                <option value="draft">Draft Only</option>
                <option value="archived">Archived Only</option>
              </select>
            </div>

            <span className="text-xs font-mono tabular-nums text-muted-foreground">
              {filteredItems.length} items
            </span>
          </div>
        </div>

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
            <FileJson className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
            <h3 className="text-sm font-semibold text-foreground">No evidence items found</h3>
            <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
              {searchQuery
                ? `No evidence items matching search "${searchQuery}".`
                : `No evidence items matching status filter "${filterStatus}".`}
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredItems.map((item) => {
              const isExpanded = expandedIds[item.id] ?? false;
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
                  className={`rounded-xl surface-raised card-lift ${typeEdgeClass} p-5 overflow-hidden`}
                >
                  {/* Card Header Row */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        onClick={() => toggleExpand(item.id)}
                        className="text-muted-foreground hover:text-foreground mt-1 transition-colors"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>

                      <div>
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className={`rounded-[5px] border px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider ${typeBadgeClass}`}>
                            {item.type}
                          </span>
                          <h2 className="text-base font-bold text-foreground tracking-tight">
                            {item.title}
                            {item.organization ? ` @ ${item.organization}` : ""}
                          </h2>
                        </div>
                        <p className="mt-2 text-xs text-text-secondary leading-relaxed max-w-3xl">
                          {item.verifiedSummary}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span
                        className={`rounded-[5px] px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider ${
                          item.status === "verified"
                            ? "bg-status-success/10 border border-status-success/35 text-status-success"
                            : "bg-inset border border-hairline text-muted-foreground"
                        }`}
                      >
                        {item.status === "verified" ? "✓ VERIFIED" : item.status}
                      </span>
                      {item.status !== "verified" && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          data-testid="verify-evidence-btn"
                          onClick={() => void handleVerifyItem(item)}
                          className="h-8 gap-1.5 border-status-success/35 bg-status-success/10 px-2.5 text-[11px] font-mono font-semibold text-status-success hover:bg-status-success/20 hover:text-status-success"
                          aria-label={`Verify ${item.title}`}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Verify
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
                      <button
                        type="button"
                        onClick={() => void handleArchiveItem(item.id)}
                        className="text-muted-foreground hover:text-status-danger p-2 rounded-[6px] hover:bg-elevated transition-colors min-h-11 min-w-11 inline-flex items-center justify-center"
                        title="Archive Item"
                        aria-label="Archive Item"
                      >
                        <Archive className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Tag Pills Row */}
                  {item.tags && item.tags.length > 0 && (
                    <div className="mt-4 flex flex-wrap items-center gap-2 pl-7">
                      {item.tags.map((t, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1.5 rounded-[6px] bg-inset border border-hairline px-2.5 py-1 text-[11px] font-mono text-text-secondary"
                        >
                          {hasBrandIcon(t) && <BrandIcon name={t} className="h-3 w-3 shrink-0" />}
                          <span>{t}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Expanded Bullets List */}
                  {isExpanded && item.bullets && item.bullets.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-hairline pl-7 transition-all duration-150 ease-out">
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
              reviewItems.map((item) => (
                  <div
                    key={item.id}
                    data-testid={`duplicate-review-card-${item.id}`}
                    className="rounded-xl surface-raised card-lift p-5"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-base font-bold text-foreground">
                        Review Potential Duplicate · {item.title}
                      </h3>
                      <span className="text-xs font-mono text-muted-foreground">
                        {item.organization || "Personal"}
                      </span>
                    </div>
                    <div className="flex flex-col md:flex-row gap-4 mb-4">
                      <div className="flex-1 p-4 rounded-lg bg-inset border border-hairline">
                        <div className="text-[11px] text-primary mb-1 font-mono uppercase">
                          Candidate Bullet
                        </div>
                        <p className="text-xs text-text-secondary leading-relaxed">
                          {item.candidateBullet || item.verifiedSummary || "N/A"}
                        </p>
                      </div>
                      <div className="flex items-center justify-center px-2">
                        <div className="text-center">
                          <div className="text-ember font-bold text-lg font-mono tabular-nums">
                            {Math.round((item.similarityScore || 0.75) * 100)}%
                          </div>
                          <div className="text-[10px] text-muted-foreground uppercase font-mono">
                            Similarity
                          </div>
                        </div>
                      </div>
                      <div className="flex-1 p-4 rounded-lg bg-inset border border-hairline">
                        <div className="text-[11px] text-signal mb-1 font-mono uppercase">
                          Existing Bullet
                        </div>
                        <p className="text-xs text-text-secondary leading-relaxed">
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
                ))
            )}
          </div>
        )}
      </div>

      {/* Modal Dialog for Create/Edit */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent
          className="max-w-lg max-h-[90dvh] overflow-y-auto overscroll-contain border-hairline bg-panel p-6"
          onCloseAutoFocus={(event) => {
            const opener = modalOpenerRef.current;
            modalOpenerRef.current = null;
            if (opener && opener.isConnected) {
              event.preventDefault();
              opener.focus();
            }
          }}
        >
          <DialogHeader className="text-left">
            <DialogTitle className="text-base font-bold text-foreground">
              {editingItem ? "Edit Evidence Item" : "Create Evidence Item"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Add or update verified experience, project, or skill evidence.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveItem} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="evidence-item-type" className="block text-xs font-mono text-on-surface-variant mb-1">
                  Type
                </label>
                <select
                  id="evidence-item-type"
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full rounded-[6px] border border-control/70 bg-inset px-3 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
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
                  className="w-full rounded-[6px] border border-control/70 bg-inset px-3 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
                >
                  <option value="verified">Verified</option>
                  <option value="draft">Draft</option>
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
                className="w-full rounded-[6px] border border-control/70 bg-inset px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
                placeholder="e.g. Software Engineer Intern"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="evidence-item-org" className="block text-xs font-mono text-on-surface-variant mb-1">
                  Organization
                </label>
                <input
                  id="evidence-item-org"
                  type="text"
                  value={formData.organization}
                  onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                  className="w-full rounded-[6px] border border-control/70 bg-inset px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
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
                  className="w-full rounded-[6px] border border-control/70 bg-inset px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
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
