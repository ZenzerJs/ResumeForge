"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Edit2,
  Archive,
  Loader2,
  Tag,
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
import { Skeleton } from "@/components/ui/skeleton";

export interface Bullet {
  id?: string;
  text: string;
  technologies?: string[];
  roleAffinity?: string[];
  verified?: boolean;
}

export interface EvidenceItem {
  id: string;
  type: string;
  title: string;
  organization?: string | null;
  dates?: string | null;
  verifiedSummary: string;
  tags: string[];
  status: string;
  createdAt: string;
  bullets: Bullet[];
}

export function LibraryWorkspace() {
  const [items, setItems] = useState<EvidenceItem[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const fetchItems = useCallback(async () => {
    try {
      setIsLoading(true);
      const url =
        filterStatus === "all"
          ? "/api/evidence"
          : `/api/evidence?status=${filterStatus}`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.success) {
        setItems(json.data);
        // Expand first item by default
        if (json.data.length > 0) {
          setExpandedIds({ [json.data[0].id]: true });
        }
      }
    } catch (err) {
      console.error("Failed to fetch evidence items:", err);
    } finally {
      setIsLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredItems = items.filter((item) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const matchTitle = item.title.toLowerCase().includes(query);
    const matchOrg = item.organization?.toLowerCase().includes(query) ?? false;
    const matchSummary = item.verifiedSummary.toLowerCase().includes(query);
    const matchTags = item.tags.some((t) => t.toLowerCase().includes(query));
    return matchTitle || matchOrg || matchSummary || matchTags;
  });

  const openCreateModal = () => {
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

  const openEditModal = (item: EvidenceItem) => {
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
        .map((text) => ({ text, verified: true }));

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

      if (editingItem) {
        const res = await fetch(`/api/evidence/${editingItem.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          setIsModalOpen(false);
          fetchItems();
          setNotification({
            type: "success",
            message: `Updated "${formData.title}" successfully.`,
          });
        }
      } else {
        const res = await fetch("/api/evidence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          setIsModalOpen(false);
          fetchItems();
          setNotification({
            type: "success",
            message: `Created evidence item "${formData.title}".`,
          });
        } else {
          const json = await res.json().catch(() => ({}));
          setNotification({
            type: "error",
            message: json.error || "Failed to save evidence item.",
          });
        }
      }
    } catch (err) {
      console.error("Failed to save evidence item:", err);
      setNotification({
        type: "error",
        message: "Failed to save evidence item.",
      });
    }
  };

  const handleArchiveItem = async (id: string) => {
    try {
      const res = await fetch(`/api/evidence/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchItems();
        setNotification({
          type: "success",
          message: "Item archived successfully.",
        });
      }
    } catch (err) {
      console.error("Failed to archive item:", err);
    }
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

      for (const rawItem of itemsToImport) {
        if (!rawItem.title || !rawItem.verifiedSummary) {
          failCount++;
          continue;
        }

        const payload = {
          type: rawItem.type || "experience",
          title: rawItem.title,
          organization: rawItem.organization || undefined,
          dates: rawItem.dates || undefined,
          verifiedSummary: rawItem.verifiedSummary,
          tags: Array.isArray(rawItem.tags) ? rawItem.tags : [],
          status: rawItem.status || "verified",
          bullets: Array.isArray(rawItem.bullets)
            ? rawItem.bullets.map((b: string | Bullet) =>
                typeof b === "string" ? { text: b, verified: true } : b
              )
            : [],
        };

        const res = await fetch("/api/evidence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          successCount++;
        } else {
          failCount++;
        }
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
            className="flex items-center gap-2 px-3.5 py-1.5 rounded border border-slate-700 bg-slate-800/80 text-xs font-mono text-slate-300 hover:bg-slate-700/80 transition-colors"
          >
            {isImporting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5 text-slate-300" />
            )}
            Import JSON
          </button>
          <button
            type="button"
            onClick={openCreateModal}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded border border-[#ff8c00]/40 bg-[#ff8c00]/10 text-[#ff8c00] hover:bg-[#ff8c00]/20 font-bold text-xs transition-colors"
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
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-[-0.03em]">
            Verified Evidence Bank Inventory
          </h1>
        </div>

        {/* Toast Notification Banner */}
        <AnimatePresence>
          {notification && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`p-3.5 rounded-lg border flex items-center justify-between text-xs font-medium ${
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
                className="inline-flex min-h-11 min-w-11 items-center justify-center text-slate-400 hover:text-white focus-visible:ring-2 focus-visible:ring-amber-500/60"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Search Input Bar + Status Select Dropdown + Item Count Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Search Input Box */}
          <div className="relative flex-1 w-full max-w-md">
            <label htmlFor="evidence-search" className="sr-only">
              Search evidence by title, org, summary, or tags
            </label>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" aria-hidden />
            <input
              id="evidence-search"
              type="search"
              name="evidence-search"
              autoComplete="off"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search evidence by title, org, summary, or tags…"
              className="w-full h-11 pl-9 pr-4 rounded bg-white text-slate-900 text-xs font-mono placeholder:text-slate-500 outline-none focus-visible:ring-2 focus-visible:ring-[#ff8c00]"
            />
          </div>

          {/* Status Dropdown + Item Counter */}
          <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-slate-400">Status:</span>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                data-testid="evidence-status-filter"
                aria-label="Filter evidence by status"
                className="bg-[#121929] border border-slate-700 text-slate-200 rounded px-3 py-1.5 text-xs font-mono outline-none focus-visible:ring-2 focus-visible:ring-[#ff8c00]"
              >
                <option value="all">All, Verified, Draft, Archived</option>
                <option value="verified">Verified Only</option>
                <option value="draft">Draft Only</option>
                <option value="archived">Archived Only</option>
              </select>
            </div>

            <span className="text-xs font-mono text-slate-400">
              {filteredItems.length} items
            </span>
          </div>
        </div>

        {/* Evidence Items List matching preview (1).webp */}
        {isLoading ? (
          <div className="grid gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="rounded-xl border border-slate-800 bg-[#121929] p-5">
                <Skeleton className="h-4 w-48 mb-3" />
                <Skeleton className="h-3 w-full mb-2" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-800 bg-[#121929]/50 p-12 text-center">
            <FileJson className="mx-auto h-8 w-8 text-slate-600 mb-2" />
            <h3 className="text-sm font-semibold text-slate-300">No evidence items found</h3>
            <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
              {searchQuery
                ? `No evidence items matching search "${searchQuery}".`
                : `No evidence items matching status filter "${filterStatus}".`}
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredItems.map((item) => {
              const isExpanded = expandedIds[item.id] ?? false;
              return (
                <div
                  key={item.id}
                  data-testid="evidence-item-card"
                  className="rounded-xl border border-slate-800 bg-[#121929]/90 hover:border-slate-700 transition-colors p-5 overflow-hidden"
                >
                  {/* Card Header Row */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        onClick={() => toggleExpand(item.id)}
                        className="text-slate-400 hover:text-white mt-1 transition-colors"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>

                      <div>
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="rounded bg-[#172033] border border-slate-700 px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                            {item.type}
                          </span>
                          <h2 className="text-base font-bold text-white tracking-tight">
                            {item.title}
                            {item.organization ? ` @ ${item.organization}` : ""}
                          </h2>
                        </div>
                        <p className="mt-2 text-xs text-slate-300 leading-relaxed max-w-3xl">
                          {item.verifiedSummary}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span
                        className={`rounded px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider ${
                          item.status === "verified"
                            ? "bg-[#062c24] border border-[#065f46] text-[#34d399]"
                            : "bg-[#172033] border border-slate-700 text-slate-400"
                        }`}
                      >
                        {item.status === "verified" ? "✓ VERIFIED" : item.status}
                      </span>
                      {item.dates && (
                        <span className="text-xs font-mono text-slate-400">
                          {item.dates}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => openEditModal(item)}
                        className="text-slate-500 hover:text-white p-2 rounded hover:bg-slate-800 transition-colors ml-1 min-h-11 min-w-11 inline-flex items-center justify-center"
                        title="Edit Item"
                        aria-label="Edit Item"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleArchiveItem(item.id)}
                        className="text-slate-500 hover:text-red-300 p-2 rounded hover:bg-slate-800 transition-colors min-h-11 min-w-11 inline-flex items-center justify-center"
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
                          className="rounded bg-[#172033] border border-slate-700 px-2.5 py-1 text-[11px] font-mono text-slate-300"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Expanded Bullets List */}
                  <AnimatePresence>
                    {isExpanded && item.bullets && item.bullets.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-4 pt-4 border-t border-slate-800/80 pl-7"
                      >
                        <ul className="space-y-2 text-xs text-slate-300 list-disc pl-4 font-sans">
                          {item.bullets.map((b, idx) => (
                            <li key={b.id || idx} className="leading-relaxed">
                              {b.text}
                            </li>
                          ))}
                        </ul>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Dialog for Create/Edit */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-xl border border-slate-800 bg-[#121929] p-6 shadow-2xl">
            <h2 className="text-base font-bold text-white mb-4">
              {editingItem ? "Edit Evidence Item" : "Create Evidence Item"}
            </h2>

            <form onSubmit={handleSaveItem} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-slate-300 mb-1">Type</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full rounded border border-slate-800 bg-[#0b1326] px-3 py-1.5 text-xs text-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-[#ff8c00]"
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
                <label className="block text-xs font-mono text-slate-300 mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full rounded border border-slate-800 bg-[#0b1326] px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-600 outline-none focus-visible:ring-2 focus-visible:ring-[#ff8c00]"
                  placeholder="e.g. Software Engineer Intern"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">Organization</label>
                  <input
                    type="text"
                    value={formData.organization}
                    onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                    className="w-full rounded border border-slate-800 bg-[#0b1326] px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-600 outline-none focus-visible:ring-2 focus-visible:ring-[#ff8c00]"
                    placeholder="e.g. Stripe"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">Dates</label>
                  <input
                    type="text"
                    value={formData.dates}
                    onChange={(e) => setFormData({ ...formData, dates: e.target.value })}
                    className="w-full rounded border border-slate-800 bg-[#0b1326] px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-600 outline-none focus-visible:ring-2 focus-visible:ring-[#ff8c00]"
                    placeholder="e.g. Jun 29, 2023"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-300 mb-1">Verified Summary</label>
                <textarea
                  required
                  rows={3}
                  value={formData.verifiedSummary}
                  onChange={(e) => setFormData({ ...formData, verifiedSummary: e.target.value })}
                  className="w-full rounded border border-slate-800 bg-[#0b1326] px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-600 outline-none focus-visible:ring-2 focus-visible:ring-[#ff8c00]"
                  placeholder="Detailed summary of verified accomplishment claim..."
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-300 mb-1">Tags (Comma-separated)</label>
                <input
                  type="text"
                  value={formData.tagsInput}
                  onChange={(e) => setFormData({ ...formData, tagsInput: e.target.value })}
                  className="w-full rounded border border-slate-800 bg-[#0b1326] px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-600 outline-none focus-visible:ring-2 focus-visible:ring-[#ff8c00] font-mono"
                  placeholder="TypeScript, React, Node.js"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-300 mb-1">Bullets (One per line)</label>
                <textarea
                  rows={3}
                  value={formData.bulletsInput.join("\n")}
                  onChange={(e) => setFormData({ ...formData, bulletsInput: e.target.value.split("\n") })}
                  className="w-full rounded border border-slate-800 bg-[#0b1326] px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-600 outline-none focus-visible:ring-2 focus-visible:ring-[#ff8c00] font-mono"
                  placeholder="Developed high-throughput API endpoints..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsModalOpen(false)}
                  className="border-slate-800 bg-[#0b1326] text-slate-400 hover:text-white text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="bg-[#ff8c00] text-black font-bold text-xs"
                >
                  Save Item
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
