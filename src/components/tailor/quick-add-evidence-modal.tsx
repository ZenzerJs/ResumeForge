"use client";

import React, { useEffect, useState } from "react";
import { X, Plus, Loader2, Database } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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

  useEffect(() => {
    if (isOpen) {
      setTitle(initialSkill ? `${initialSkill} Experience` : "");
      setError(null);
    }
  }, [isOpen, initialSkill]);

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
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        hideCloseButton
        data-testid="quick-add-evidence-modal"
        className="max-w-lg max-h-[90dvh] overflow-y-auto overscroll-contain border-hairline bg-panel p-6"
      >
        <div className="flex items-start justify-between gap-4 border-b border-hairline pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-[6px] bg-primary/15 text-primary">
              <Database className="h-4 w-4" aria-hidden />
            </div>
            <DialogHeader className="text-left">
              <DialogTitle className="text-sm font-bold text-foreground">
                Add Evidence for &ldquo;{initialSkill}&rdquo;
              </DialogTitle>
              <DialogDescription className="text-[11px] text-muted-foreground">
                Close the gap by recording your project or work experience
              </DialogDescription>
            </DialogHeader>
          </div>

          <DialogClose asChild>
            <button
              type="button"
              data-testid="close-add-evidence-btn"
              className="rounded-[6px] p-1 text-muted-foreground hover:bg-elevated hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
              aria-label="Close modal"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </DialogClose>
        </div>

        <form onSubmit={handleSave} className="space-y-4 text-xs">
          {error && (
            <div role="alert" className="rounded-[6px] border border-status-danger/40 bg-status-danger/15 p-3 text-status-danger">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="evidence-title" className="block text-on-surface-variant mb-1 font-medium">
              Experience / Project Title *
            </label>
            <input
              id="evidence-title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Distributed Task Queue in Go"
              className="h-10 w-full rounded-[6px] border border-control/70 bg-inset px-3 text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
              data-testid="quick-evidence-title-input"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="evidence-org" className="block text-on-surface-variant mb-1 font-medium">
                Organization / Context (Optional)
              </label>
              <input
                id="evidence-org"
                type="text"
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                placeholder="e.g. Personal Project, Acme Corp"
                className="h-10 w-full rounded-[6px] border border-control/70 bg-inset px-3 text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
              />
            </div>

            <div>
              <label htmlFor="evidence-category" className="block text-on-surface-variant mb-1 font-medium">
                Category
              </label>
              <select
                id="evidence-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="h-10 w-full rounded-[6px] border border-control/70 bg-inset px-3 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-panel cursor-pointer"
              >
                <option value="PROJECT">Project</option>
                <option value="WORK">Work Experience</option>
                <option value="SKILL">Technical Skill</option>
                <option value="EDUCATION">Education / Cert</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="evidence-bullet" className="block text-on-surface-variant mb-1 font-medium">
              Verified Achievement Bullet Point
            </label>
            <textarea
              id="evidence-bullet"
              rows={3}
              value={bulletPoint}
              onChange={(e) => setBulletPoint(e.target.value)}
              placeholder={`e.g. Architected high-throughput services using ${initialSkill}, reducing latency by 45%.`}
              className="w-full rounded-[6px] border border-control/70 bg-inset p-3 text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
              data-testid="quick-evidence-bullet-input"
            />
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-hairline pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-[6px] border border-control/70 bg-elevated px-3 py-1.5 text-xs text-on-surface-variant hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              data-testid="quick-evidence-submit-btn"
              className="inline-flex items-center gap-1.5 rounded-[6px] bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
            >
              {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Plus className="h-3.5 w-3.5" aria-hidden />}
              Save &amp; Resolve Gap
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
