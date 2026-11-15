"use client";

import React, { useEffect, useState } from "react";
import { X, Plus, Loader2, Database } from "lucide-react";
import { fetchDemoConfig } from "@/components/auth/session-user";
import { readApiResponse } from "@/lib/api-error";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const CATEGORY_TO_TYPE: Record<string, "experience" | "project" | "skill" | "education"> = {
  PROJECT: "project",
  WORK: "experience",
  SKILL: "skill",
  EDUCATION: "education",
};

export function buildQuickAddEvidencePayload(input: {
  title: string;
  organization?: string;
  category: string;
  bulletPoint?: string;
  initialSkill?: string;
}) {
  const trimmedTitle = input.title.trim();
  const evidenceType = CATEGORY_TO_TYPE[input.category] ?? "project";
  const trimmedOrg = (input.organization || "").trim();
  const trimmedBullet = (input.bulletPoint || "").trim();
  const trimmedSkill = (input.initialSkill || "").trim();
  const verifiedSummary =
    trimmedBullet ||
    (trimmedOrg ? `${trimmedTitle} at ${trimmedOrg}` : trimmedTitle) ||
    (trimmedSkill ? `Evidence for ${trimmedSkill}` : "Added evidence item");

  const tags = Array.from(
    new Set([trimmedSkill.toLowerCase(), evidenceType].filter(Boolean))
  );

  const bullets = trimmedBullet
    ? [
        {
          text: trimmedBullet,
          technologies: trimmedSkill ? [trimmedSkill] : [],
          roleAffinity: [] as string[],
          verified: false,
          orderIndex: 0,
        },
      ]
    : undefined;

  return {
    type: evidenceType,
    title: trimmedTitle,
    organization: trimmedOrg || undefined,
    verifiedSummary,
    status: "draft" as const,
    tags,
    bullets,
  };
}

function appendGuestEvidenceItem(item: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  try {
    const stored = localStorage.getItem("resumeforge_guest_evidence");
    const parsed = stored ? JSON.parse(stored) : [];
    const existing = Array.isArray(parsed) ? parsed : [];
    localStorage.setItem("resumeforge_guest_evidence", JSON.stringify([item, ...existing]));
  } catch {
    localStorage.setItem("resumeforge_guest_evidence", JSON.stringify([item]));
  }
}

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
      setOrganization("");
      setBulletPoint("");
      setCategory("PROJECT");
      setError(null);
    }
  }, [isOpen, initialSkill]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("Please provide a title or project name");
      return;
    }

    try {
      setIsSaving(true);
      setError(null);

      const payload = buildQuickAddEvidencePayload({
        title: trimmedTitle,
        organization,
        category,
        bulletPoint,
        initialSkill,
      });

      const buildGuestItem = () => ({
        id: `guest-evi-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        userId: "guest",
        type: payload.type,
        title: payload.title,
        organization: payload.organization || null,
        dates: null,
        verifiedSummary: payload.verifiedSummary,
        tags: payload.tags,
        status: payload.status,
        bullets: payload.bullets
          ? payload.bullets.map((b, idx) => ({
              id: `b-${idx}-${Date.now()}`,
              text: b.text,
              technologies: b.technologies,
              roleAffinity: b.roleAffinity,
              verified: b.verified,
              orderIndex: idx,
            }))
          : [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const demoConfig = await fetchDemoConfig();
      if (demoConfig?.demoMode) {
        appendGuestEvidenceItem(buildGuestItem());
        onEvidenceCreated();
        onClose();
        return;
      }

      const res = await fetch("/api/evidence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const { ok, status, data: json, error: apiError } = await readApiResponse<{
        success?: boolean;
        code?: string;
        data?: { id?: string };
      }>(res, "Failed to create evidence item");

      if (!ok) {
        if (status === 401 || json?.code === "GUEST_READ_ONLY") {
          appendGuestEvidenceItem(buildGuestItem());
          onEvidenceCreated();
          onClose();
          return;
        }
        throw new Error(apiError || "Failed to create evidence item");
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
