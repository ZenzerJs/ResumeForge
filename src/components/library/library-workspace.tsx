"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Edit2,
  Archive,
  FileText,
  Loader2,
  Tag,
  Upload,
  Search,
  CheckCircle2,
  AlertCircle,
  X,
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
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // File input ref for JSON import
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

  // Client-side search filtering
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

  // JSON File Import Handler
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
        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileImport}
            accept=".json"
            className="hidden"
            data-testid="evidence-import-input"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isImporting}
            onClick={() => fileInputRef.current?.click()}
            className="gap-1.5 text-xs font-semibold border-slate-700 bg-slate-900/80 hover:bg-slate-800 text-slate-200"
            data-testid="evidence-import-btn"
          >
            {isImporting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5 text-emerald-400" />
            )}
            Import JSON
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={openCreateModal}
            className="gap-1.5 text-xs font-semibold shadow-sm"
            style={{ background: "linear-gradient(135deg, #F59E0B, #D97706)", color: "#0A0E17" }}
            data-testid="add-evidence-btn"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Evidence Item
          </Button>
        </div>
      }
    >

      {/* Main Content Area */}
      <main className="mx-auto max-w-6xl w-full p-4 md:p-8 flex-1 flex flex-col gap-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              <FileJson className="h-5 w-5 text-emerald-400" />
              Verified Evidence Bank
            </h1>
            <p className="text-xs mt-0.5 font-mono" style={{ color: "#4B5A7A" }}>
              Career achievements, verified bullets, and skill inventory
            </p>
          </div>
        </div>

        {/* Notification Toast Banner */}
        <AnimatePresence>
          {notification && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`p-3 rounded-md border flex items-center justify-between text-xs font-medium ${
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
                onClick={() => setNotification(null)}
                className="hover:opacity-80 transition-opacity"
              >
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Toolbar: Search Input + Status Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-xl bg-slate-900/80 border border-slate-800 shadow-sm">
          {/* Search Bar Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search evidence by title, org, summary, or tags..."
              className="w-full h-8 pl-9 pr-3 rounded-md bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
              data-testid="evidence-search-input"
            />
          </div>

          {/* Status Filters */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <span className="text-xs font-mono text-slate-500 mr-1">Status:</span>
            {["all", "verified", "draft", "archived"].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setFilterStatus(st)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors font-mono ${
                  filterStatus === st
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-950 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700"
                }`}
              >
                {st}
              </button>
            ))}

            <span className="text-xs text-slate-500 font-mono ml-2">
              {filteredItems.length} item{filteredItems.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>

        {/* List of Evidence Items */}
        {isLoading ? (
          <div className="grid gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="rounded-lg border p-5" style={{ borderColor: "#1E2536", backgroundColor: "#111622" }}>
                <Skeleton className="h-4 w-48 mb-3" />
                <Skeleton className="h-3 w-full mb-2" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-xl border border-dashed border-slate-800 bg-slate-900/40 p-12 text-center"
          >
            <FileText className="mx-auto h-8 w-8 text-slate-600 mb-2" />
            <h3 className="text-sm font-semibold text-slate-300">No evidence items found</h3>
            <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
              {searchQuery
                ? `No evidence items matching search "${searchQuery}".`
                : `No evidence items matching status filter "${filterStatus}".`}
            </p>
            <div className="mt-4 flex items-center justify-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="border-slate-700 bg-slate-800 text-slate-200 text-xs gap-1.5"
              >
                <Upload className="h-3.5 w-3.5 text-emerald-400" />
                Import JSON
              </Button>
              <Button
                size="sm"
                onClick={openCreateModal}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Item
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.div layout className="grid gap-3">
            <AnimatePresence>
              {filteredItems.map((item) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  whileHover={{ y: -1 }}
                  transition={{ duration: 0.2 }}
                  className="rounded-lg border border-slate-800 bg-slate-900/80 p-5 shadow-sm hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider text-indigo-400 border border-slate-700">
                          {item.type}
                        </span>
                        <h2 className="text-base font-bold text-white tracking-tight">{item.title}</h2>
                        {item.organization && (
                          <span className="text-xs text-slate-400 font-medium">@ {item.organization}</span>
                        )}
                      </div>

                      {item.dates && (
                        <p className="mt-1 text-xs text-slate-500 font-mono">{item.dates}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-mono font-medium capitalize border ${
                          item.status === "verified"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                            : item.status === "archived"
                            ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                            : "bg-slate-800 text-slate-400 border-slate-700"
                        }`}
                      >
                        {item.status}
                      </span>

                      <button
                        type="button"
                        onClick={() => openEditModal(item)}
                        className="rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                        title="Edit Item"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>

                      {item.status !== "archived" && (
                        <button
                          type="button"
                          onClick={() => handleArchiveItem(item.id)}
                          className="rounded-md p-1.5 text-slate-400 hover:bg-amber-500/10 hover:text-amber-400 transition-colors"
                          title="Archive Item"
                        >
                          <Archive className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <p className="mt-3 text-xs leading-relaxed text-slate-300 bg-slate-950 p-3 rounded-lg border border-slate-800/80 font-sans">
                    {item.verifiedSummary}
                  </p>

                  {/* Bullets List */}
                  {item.bullets && item.bullets.length > 0 && (
                    <ul className="mt-3 space-y-1.5 pl-4 text-xs text-slate-400 list-disc font-sans">
                      {item.bullets.map((b, idx) => (
                        <li key={b.id || idx} className="leading-relaxed">
                          {b.text}
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* Tags */}
                  {item.tags && item.tags.length > 0 && (
                    <div className="mt-4 flex flex-wrap items-center gap-1.5">
                      <Tag className="h-3 w-3 text-slate-500" />
                      {item.tags.map((t, idx) => (
                        <span
                          key={idx}
                          className="rounded bg-indigo-500/10 px-2 py-0.5 text-[10px] font-mono font-medium text-indigo-300 border border-indigo-500/20"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </main>

      {/* Modal Dialog for Create/Edit */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
              <FileText className="h-4 w-4 text-indigo-400" />
              {editingItem ? "Edit Evidence Item" : "Create Evidence Item"}
            </h2>

            <form onSubmit={handleSaveItem} className="space-y-4">
              <div>
                <label className="block text-xs font-mono font-medium text-slate-300 mb-1">Type</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
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
                <label className="block text-xs font-mono font-medium text-slate-300 mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
                  placeholder="e.g. Software Engineer Intern"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono font-medium text-slate-300 mb-1">Organization</label>
                  <input
                    type="text"
                    value={formData.organization}
                    onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                    className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
                    placeholder="e.g. Stripe"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono font-medium text-slate-300 mb-1">Dates</label>
                  <input
                    type="text"
                    value={formData.dates}
                    onChange={(e) => setFormData({ ...formData, dates: e.target.value })}
                    className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
                    placeholder="e.g. 2024 – Present"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono font-medium text-slate-300 mb-1">Verified Summary</label>
                <textarea
                  required
                  rows={3}
                  value={formData.verifiedSummary}
                  onChange={(e) => setFormData({ ...formData, verifiedSummary: e.target.value })}
                  className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 font-sans"
                  placeholder="Detailed summary of verified accomplishment claim..."
                />
              </div>

              <div>
                <label className="block text-xs font-mono font-medium text-slate-300 mb-1">Tags (Comma-separated)</label>
                <input
                  type="text"
                  value={formData.tagsInput}
                  onChange={(e) => setFormData({ ...formData, tagsInput: e.target.value })}
                  className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
                  placeholder="TypeScript, React, Node.js"
                />
              </div>

              <div>
                <label className="block text-xs font-mono font-medium text-slate-300 mb-1">Bullets (One per line)</label>
                <textarea
                  rows={3}
                  value={formData.bulletsInput.join("\n")}
                  onChange={(e) => setFormData({ ...formData, bulletsInput: e.target.value.split("\n") })}
                  className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
                  placeholder="Developed high-throughput API endpoints..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsModalOpen(false)}
                  className="border-slate-800 bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium shadow-sm"
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
