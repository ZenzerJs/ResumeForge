"use client";

import React, { useState } from "react";
import { X, Plus, Sparkles, Loader2, Database, Check } from "lucide-react";

interface QuickAddEvidenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSkill: string;
  onEvidenceCreated: () => void;
}

export function QuickAddEvidenceModal({
  isOpen,
  onClose,
  initialSkill,
  onEvidenceCreated,
}: QuickAddEvidenceModalProps) {
  const [title, setTitle] = useState(initialSkill ? `${initialSkill} Experience` : "");
  const [organization, setOrganization] = useState("");
  const [bulletPoint, setBulletPoint] = useState("");
  const [category, setCategory] = useState("PROJECT");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Please provide a title or project name");
      return;
    }

    try {
      setIsSaving(true);
      setError(null);

      // Create evidence item
      const res = await fetch("/api/evidence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          organization: organization.trim() || undefined,
          category,
          status: "DRAFT",
          tags: [initialSkill.toLowerCase(), category.toLowerCase()],
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Failed to create evidence item");
      }

      const itemId = json.data.id;

      // If bullet point provided, add it
      if (bulletPoint.trim() && itemId) {
        await fetch(`/api/evidence/${itemId}/bullets`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: bulletPoint.trim(),
            status: "DRAFT",
          }),
        });
      }

      onEvidenceCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save evidence");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
      data-testid="quick-add-evidence-modal"
    >
      <div className="relative w-full max-w-lg rounded-xl border border-slate-700 bg-[#0b1326] p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
              <Database className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">
                Add Evidence for &ldquo;{initialSkill}&rdquo;
              </h2>
              <p className="text-[11px] text-slate-400">
                Close the gap by recording your project or work experience
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            data-testid="close-add-evidence-btn"
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
            aria-label="Close modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="mt-4 space-y-4 text-xs">
          {error && (
            <div className="rounded-lg border border-red-800 bg-red-950/80 p-3 text-red-300">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="evidence-title" className="block text-slate-300 mb-1 font-medium">
              Experience / Project Title *
            </label>
            <input
              id="evidence-title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Distributed Task Queue in Go"
              className="h-10 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-slate-200 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
              data-testid="quick-evidence-title-input"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="evidence-org" className="block text-slate-300 mb-1 font-medium">
                Organization / Context (Optional)
              </label>
              <input
                id="evidence-org"
                type="text"
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                placeholder="e.g. Personal Project, Acme Corp"
                className="h-10 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-slate-200 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="evidence-category" className="block text-slate-300 mb-1 font-medium">
                Category
              </label>
              <select
                id="evidence-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="h-10 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-slate-200 focus:border-amber-500 focus:outline-none cursor-pointer"
              >
                <option value="PROJECT">Project</option>
                <option value="WORK">Work Experience</option>
                <option value="SKILL">Technical Skill</option>
                <option value="EDUCATION">Education / Cert</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="evidence-bullet" className="block text-slate-300 mb-1 font-medium">
              Verified Achievement Bullet Point
            </label>
            <textarea
              id="evidence-bullet"
              rows={3}
              value={bulletPoint}
              onChange={(e) => setBulletPoint(e.target.value)}
              placeholder={`e.g. Architected high-throughput services using ${initialSkill}, reducing latency by 45%.`}
              className="w-full rounded-md border border-slate-700 bg-slate-900 p-3 text-slate-200 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
              data-testid="quick-evidence-bullet-input"
            />
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-800 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              data-testid="quick-evidence-submit-btn"
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-1.5 text-xs font-semibold text-slate-950 hover:bg-amber-400 disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Save & Resolve Gap
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
