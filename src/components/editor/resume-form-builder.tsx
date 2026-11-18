"use client";

import React, { useState, useEffect, useId, useRef, useCallback } from "react";
import {
  User,
  Briefcase,
  GraduationCap,
  FolderKanban,
  Wrench,
  SlidersHorizontal,
  Plus,
  Trash2,
  Sparkles,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Undo2,
} from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  createBlankResumeTypst,
  isResumeSourceSafeForForm,
  legacyFormToResumeDocument,
  makeEntryId,
  parseTypstToStructuredModel,
  serializeStructuredModelToTypst,
  type ResumeEntryItem,
  type ResumeSkillGroup,
  type StructuredResumeModel,
} from "@/lib/editor/mode-utils";

export type { ResumeEntryItem, ResumeSkillGroup, StructuredResumeModel };
export {
  createBlankResumeTypst,
  isResumeSourceSafeForForm,
  legacyFormToResumeDocument,
  parseTypstToStructuredModel,
  serializeStructuredModelToTypst,
};

interface ResumeFormBuilderProps {
  value: string;
  onChange: (newTypst: string) => void;
}

export function ResumeFormBuilder({ value, onChange }: ResumeFormBuilderProps) {
  const formId = useId();
  const [model, setModel] = useState<StructuredResumeModel>(() =>
    parseTypstToStructuredModel(value)
  );
  const [activeSection, setActiveSection] = useState<
    "contact" | "experience" | "education" | "projects" | "skills"
  >("contact");
  const [mobileFormattingOpen, setMobileFormattingOpen] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const sectionTabsRef = useRef<HTMLDivElement>(null);
  const lastCommittedValueRef = useRef<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<
    | { kind: "entry"; listKey: "experience" | "education" | "projects"; id: string; label: string }
    | { kind: "bullet"; listKey: "experience" | "education" | "projects"; id: string; bulletIdx: number; label: string }
    | { kind: "skill"; id: string; label: string }
    | null
  >(null);
  const [undoDeleteState, setUndoDeleteState] = useState<{ label: string; previousModel: StructuredResumeModel } | null>(null);

  const updateSectionTabOverflow = useCallback(() => {
    const el = sectionTabsRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(maxScroll - el.scrollLeft > 2);
  }, []);

  useEffect(() => {
    updateSectionTabOverflow();
    const el = sectionTabsRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => updateSectionTabOverflow());
    observer.observe(el);
    return () => observer.disconnect();
  }, [
    updateSectionTabOverflow,
    model.experience.length,
    model.education.length,
    model.projects.length,
    model.skills.length,
  ]);

  // Re-sync if external source changes substantially (e.g. template reset or AI patch applied)
  useEffect(() => {
    if (!value) return;
    if (lastCommittedValueRef.current !== null && lastCommittedValueRef.current === value) {
      return;
    }
    lastCommittedValueRef.current = null;
    setModel((prev) => {
      const currentSerialized = serializeStructuredModelToTypst(prev);
      if (currentSerialized.trim() === value.trim()) return prev;
      return parseTypstToStructuredModel(value);
    });
  }, [value]);

  const safeToEdit =
    (lastCommittedValueRef.current !== null && lastCommittedValueRef.current === value) ||
    isResumeSourceSafeForForm(value);
  const commitModel = (next: StructuredResumeModel) => {
    if (!safeToEdit) return;
    const nextTypst = serializeStructuredModelToTypst(next);
    lastCommittedValueRef.current = nextTypst;
    setModel(next);
    onChange(nextTypst);
  };

  const updateEntryField = (
    listKey: "experience" | "education" | "projects",
    id: string,
    field: keyof Omit<ResumeEntryItem, "id" | "bullets">,
    val: string
  ) => {
    const nextList = model[listKey].map((item) =>
      item.id === id ? { ...item, [field]: val } : item
    );
    commitModel({ ...model, [listKey]: nextList });
  };

  const updateEntryBullet = (
    listKey: "experience" | "education" | "projects",
    id: string,
    bulletIdx: number,
    val: string
  ) => {
    const nextList = model[listKey].map((item) => {
      if (item.id !== id) return item;
      const nextBullets = [...item.bullets];
      nextBullets[bulletIdx] = val;
      return { ...item, bullets: nextBullets };
    });
    commitModel({ ...model, [listKey]: nextList });
  };

  const addEntryBullet = (listKey: "experience" | "education" | "projects", id: string) => {
    const nextList = model[listKey].map((item) =>
      item.id === id ? { ...item, bullets: [...item.bullets, ""] } : item
    );
    commitModel({ ...model, [listKey]: nextList });
  };

  const removeEntryBullet = (
    listKey: "experience" | "education" | "projects",
    id: string,
    bulletIdx: number
  ) => {
    setUndoDeleteState({ label: `bullet ${bulletIdx + 1}`, previousModel: model });
    const nextList = model[listKey].map((item) => {
      if (item.id !== id) return item;
      const nextBullets = item.bullets.filter((_, idx) => idx !== bulletIdx);
      return { ...item, bullets: nextBullets.length > 0 ? nextBullets : [""] };
    });
    commitModel({ ...model, [listKey]: nextList });
  };

  const addEntry = (listKey: "experience" | "education" | "projects") => {
    const newItem: ResumeEntryItem = {
      id: makeEntryId(listKey, model[listKey].length),
      title: "",
      role: "",
      location: "",
      date: "",
      bullets: [""],
    };
    commitModel({ ...model, [listKey]: [...model[listKey], newItem] });
  };

  const removeEntry = (listKey: "experience" | "education" | "projects", id: string, label: string) => {
    setUndoDeleteState({ label, previousModel: model });
    const nextList = model[listKey].filter((item) => item.id !== id);
    commitModel({ ...model, [listKey]: nextList });
  };

  const removeSkillCategory = (id: string, label: string) => {
    setUndoDeleteState({ label, previousModel: model });
    const next = model.skills.filter((s) => s.id !== id);
    commitModel({ ...model, skills: next });
  };

  const confirmPendingDelete = () => {
    if (!pendingDelete) return;
    if (pendingDelete.kind === "entry") {
      removeEntry(pendingDelete.listKey, pendingDelete.id, pendingDelete.label);
    } else if (pendingDelete.kind === "bullet") {
      removeEntryBullet(pendingDelete.listKey, pendingDelete.id, pendingDelete.bulletIdx);
    } else if (pendingDelete.kind === "skill") {
      removeSkillCategory(pendingDelete.id, pendingDelete.label);
    }
    setPendingDelete(null);
  };

  if (!safeToEdit) return (
    <div data-testid="resume-form-builder-unavailable" className="p-6 text-sm text-foreground" role="status">
      This source cannot be safely edited in the form without losing content. Use Typst Code to edit it.
    </div>
  );

  return (
    <div
      data-testid="resume-form-builder"
      className="flex h-full flex-col overflow-hidden bg-panel text-foreground"
    >
      {/* Formatting Quick Controls Bar (compact disclosure on <sm, inline on >=sm) */}
      <div className="border-b border-outline/70 bg-canvas px-3 py-1.5 sm:px-4 sm:py-2 text-xs">
        <button
          type="button"
          onClick={() => setMobileFormattingOpen((prev) => !prev)}
          aria-expanded={mobileFormattingOpen}
          aria-controls={`${formId}-formatting-controls`}
          data-testid="form-builder-formatting-toggle"
          className="flex w-full items-center justify-between gap-2 py-0.5 text-xs font-semibold text-text-secondary sm:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
        >
          <span className="inline-flex items-center gap-1.5">
            <SlidersHorizontal className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            <span>Formatting</span>
            <span className="font-mono text-text-muted font-normal">
              ({model.fontSize} · {model.marginPreset})
            </span>
          </span>
          <ChevronDown
            className={`h-3.5 w-3.5 text-text-muted transition-transform ${
              mobileFormattingOpen ? "rotate-180" : ""
            }`}
            aria-hidden="true"
          />
        </button>

        <div
          id={`${formId}-formatting-controls`}
          className={`${
            mobileFormattingOpen ? "flex pt-2" : "hidden"
          } sm:flex sm:pt-0 flex-wrap items-center justify-between gap-2`}
        >
          <div className="hidden sm:flex items-center gap-2 text-text-secondary font-semibold">
            <SlidersHorizontal className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            <span>Formatting:</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs text-text-muted font-mono">
              <span>Font Size</span>
              <select
                value={model.fontSize}
                onChange={(e) =>
                  commitModel({
                    ...model,
                    fontSize: e.target.value as StructuredResumeModel["fontSize"],
                  })
                }
                data-testid="form-builder-font-size"
                className="rounded border border-outline/70 bg-inset px-2 py-0.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="8.5pt">8.5 pt (Dense)</option>
                <option value="9pt">9.0 pt (Default)</option>
                <option value="9.5pt">9.5 pt (Readable)</option>
                <option value="10pt">10.0 pt (Large)</option>
                <option value="10.5pt">10.5 pt (Executive)</option>
              </select>
            </label>

            <label className="flex items-center gap-1.5 text-xs text-text-muted font-mono">
              <span>Margins</span>
              <select
                value={model.marginPreset}
                onChange={(e) =>
                  commitModel({
                    ...model,
                    marginPreset: e.target.value as StructuredResumeModel["marginPreset"],
                  })
                }
                data-testid="form-builder-margins"
                className="rounded border border-outline/70 bg-inset px-2 py-0.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="compact">Compact (1.0 cm)</option>
                <option value="balanced">Balanced (1.25 cm)</option>
                <option value="spacious">Spacious (1.5 cm)</option>
              </select>
            </label>
          </div>
        </div>
      </div>

      {/* Section Navigation Pills + Horizontal Scroll Indicator */}
      <div className="relative border-b border-outline/70 bg-panel">
        {canScrollLeft && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 z-10 flex w-6 items-center justify-start bg-gradient-to-r from-panel via-panel/90 to-transparent pl-1 text-text-muted"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </div>
        )}
        <div
          ref={sectionTabsRef}
          onScroll={updateSectionTabOverflow}
          role="tablist"
          aria-label="Resume sections"
          className="flex items-center gap-1 overflow-x-auto px-2.5 py-1.5"
        >
          {[
            { id: "contact", label: "Contact", title: "Contact & Summary", count: null, icon: User },
            { id: "experience", label: "Experience", title: "Experience", count: model.experience.length, icon: Briefcase },
            { id: "education", label: "Education", title: "Education", count: model.education.length, icon: GraduationCap },
            { id: "projects", label: "Projects", title: "Projects", count: model.projects.length, icon: FolderKanban },
            { id: "skills", label: "Skills", title: "Skills", count: model.skills.length, icon: Wrench },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeSection === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                title={tab.title}
                onClick={() => setActiveSection(tab.id as typeof activeSection)}
                data-testid={`form-builder-tab-${tab.id}`}
                className={`flex shrink-0 items-center gap-1 whitespace-nowrap rounded px-2 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  active
                    ? "bg-primary/15 border border-primary/50 text-primary"
                    : "border border-transparent text-text-secondary hover:bg-elevated hover:text-foreground"
                }`}
              >
                <Icon className="hidden 2xl:inline h-3 w-3 shrink-0" aria-hidden="true" />
                <span>{tab.label}</span>
                {tab.count !== null && (
                  <span className="font-mono text-xs tabular-nums opacity-75">{tab.count}</span>
                )}
              </button>
            );
          })}
        </div>
        {canScrollRight && (
          <div
            aria-hidden="true"
            data-testid="section-tabs-scroll-indicator"
            className="pointer-events-none absolute inset-y-0 right-0 z-10 flex w-7 items-center justify-end bg-gradient-to-l from-panel via-panel/90 to-transparent pr-1 text-text-muted"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </div>
        )}
      </div>

      {/* Form Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {undoDeleteState && (
          <div
            role="status"
            aria-live="polite"
            data-testid="form-builder-undo-banner"
            className="flex items-center justify-between gap-2 rounded-[8px] border border-primary/40 bg-primary/10 px-3 py-2 text-xs text-foreground"
          >
            <span>Removed {undoDeleteState.label}.</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  commitModel(undoDeleteState.previousModel);
                  setUndoDeleteState(null);
                }}
                data-testid="form-builder-undo-delete-btn"
                className="inline-flex items-center gap-1 rounded bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Undo2 className="h-3 w-3" aria-hidden="true" />
                Undo
              </button>
              <button
                type="button"
                onClick={() => setUndoDeleteState(null)}
                className="text-xs text-text-secondary hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
        {activeSection === "contact" && (
          <div className="space-y-4" data-testid="form-section-contact">
            <div className="rounded-[10px] border border-outline/70 bg-canvas/50 p-4 space-y-3">
              <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-primary">
                Candidate Header &amp; Contact Info
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor={`${formId}-fullname`} className="block text-xs font-mono text-text-muted mb-1">Full Name</label>
                  <input
                    id={`${formId}-fullname`}
                    name="fullName"
                    type="text"
                    autoComplete="name"
                    value={model.fullName}
                    onChange={(e) => commitModel({ ...model, fullName: e.target.value })}
                    data-testid="form-input-fullname"
                    className="w-full rounded border border-outline/70 bg-inset px-2.5 py-1.5 text-xs text-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  />
                </div>
                <div>
                  <label htmlFor={`${formId}-location`} className="block text-xs font-mono text-text-muted mb-1">Location</label>
                  <input
                    id={`${formId}-location`}
                    name="location"
                    type="text"
                    autoComplete="address-level2"
                    value={model.location}
                    onChange={(e) => commitModel({ ...model, location: e.target.value })}
                    data-testid="form-input-location"
                    className="w-full rounded border border-outline/70 bg-inset px-2.5 py-1.5 text-xs text-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  />
                </div>
                <div>
                  <label htmlFor={`${formId}-email`} className="block text-xs font-mono text-text-muted mb-1">Email</label>
                  <input
                    id={`${formId}-email`}
                    name="email"
                    type="email"
                    autoComplete="email"
                    spellCheck={false}
                    value={model.email}
                    onChange={(e) => commitModel({ ...model, email: e.target.value })}
                    data-testid="form-input-email"
                    className="w-full rounded border border-outline/70 bg-inset px-2.5 py-1.5 text-xs text-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  />
                </div>
                <div>
                  <label htmlFor={`${formId}-phone`} className="block text-xs font-mono text-text-muted mb-1">Phone</label>
                  <input
                    id={`${formId}-phone`}
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    spellCheck={false}
                    value={model.phone}
                    onChange={(e) => commitModel({ ...model, phone: e.target.value })}
                    data-testid="form-input-phone"
                    className="w-full rounded border border-outline/70 bg-inset px-2.5 py-1.5 text-xs text-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  />
                </div>
                <div>
                  <label htmlFor={`${formId}-github`} className="block text-xs font-mono text-text-muted mb-1">GitHub URL</label>
                  <input
                    id={`${formId}-github`}
                    name="github"
                    type="url"
                    autoComplete="url"
                    spellCheck={false}
                    value={model.github}
                    onChange={(e) => commitModel({ ...model, github: e.target.value })}
                    className="w-full rounded border border-outline/70 bg-inset px-2.5 py-1.5 text-xs text-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  />
                </div>
                <div>
                  <label htmlFor={`${formId}-linkedin`} className="block text-xs font-mono text-text-muted mb-1">LinkedIn URL</label>
                  <input
                    id={`${formId}-linkedin`}
                    name="linkedin"
                    type="url"
                    autoComplete="url"
                    spellCheck={false}
                    value={model.linkedin}
                    onChange={(e) => commitModel({ ...model, linkedin: e.target.value })}
                    className="w-full rounded border border-outline/70 bg-inset px-2.5 py-1.5 text-xs text-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-[10px] border border-outline/70 bg-canvas/50 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor={`${formId}-summary`} className="text-xs font-mono font-semibold uppercase tracking-wider text-primary">
                  Professional Summary (Optional)
                </label>
                <span className="text-xs font-mono text-text-muted">Renders above Experience</span>
              </div>
              <textarea
                id={`${formId}-summary`}
                rows={3}
                value={model.summary}
                onChange={(e) => commitModel({ ...model, summary: e.target.value })}
                placeholder="e.g. Senior Full-Stack Engineer with 5+ years building distributed cloud systems..."
                data-testid="form-input-summary"
                className="w-full rounded border border-outline/70 bg-inset p-2.5 text-xs text-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background leading-relaxed"
              />
            </div>
          </div>
        )}

        {(activeSection === "experience" ||
          activeSection === "education" ||
          activeSection === "projects") && (
          <div className="space-y-4" data-testid={`form-section-${activeSection}`}>
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-primary">
                {activeSection === "experience"
                  ? "Work Experience"
                  : activeSection === "education"
                  ? "Education"
                  : "Projects"}
              </h3>
              <button
                type="button"
                onClick={() => addEntry(activeSection)}
                data-testid={`add-${activeSection}-entry-btn`}
                className="flex items-center gap-1 rounded bg-primary px-2.5 py-1 text-xs font-mono font-semibold text-primary-foreground hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                Add{" "}
                {activeSection === "experience"
                  ? "Role"
                  : activeSection === "education"
                  ? "School"
                  : "Project"}
              </button>
            </div>

            {model[activeSection].map((entry, idx) => (
              <div
                key={entry.id}
                className="rounded-[10px] border border-outline/70 bg-canvas/50 p-4 space-y-3"
              >
                <div className="flex items-center justify-between border-b border-outline/60 pb-2">
                  <span className="font-mono text-xs font-semibold text-text-secondary">
                    #{idx + 1} · {entry.title || "Untitled"}
                  </span>
                  {model[activeSection].length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setPendingDelete({
                          kind: "entry",
                          listKey: activeSection,
                          id: entry.id,
                          label: entry.title || `${activeSection} entry #${idx + 1}`,
                        })
                      }
                      aria-label={`Remove ${entry.title || `entry ${idx + 1}`}`}
                      className="text-text-muted hover:text-status-danger transition-colors p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                      title="Remove entry"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label htmlFor={`${formId}-${activeSection}-${idx}-title`} className="block text-xs font-mono text-text-muted mb-1">
                      {activeSection === "education"
                        ? "University / Institution"
                        : activeSection === "projects"
                        ? "Project Title"
                        : "Company / Organization"}
                    </label>
                    <input
                      id={`${formId}-${activeSection}-${idx}-title`}
                      name={`${activeSection}-${idx}-title`}
                      type="text"
                      autoComplete={activeSection === "experience" || activeSection === "education" ? "organization" : "off"}
                      value={entry.title}
                      onChange={(e) =>
                        updateEntryField(activeSection, entry.id, "title", e.target.value)
                      }
                      className="w-full rounded border border-outline/70 bg-inset px-2.5 py-1.5 text-xs text-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    />
                  </div>
                  <div>
                    <label htmlFor={`${formId}-${activeSection}-${idx}-role`} className="block text-xs font-mono text-text-muted mb-1">
                      {activeSection === "education" ? "Degree / Program" : "Role / Title"}
                    </label>
                    <input
                      id={`${formId}-${activeSection}-${idx}-role`}
                      name={`${activeSection}-${idx}-role`}
                      type="text"
                      autoComplete={activeSection === "experience" ? "organization-title" : "off"}
                      value={entry.role}
                      onChange={(e) =>
                        updateEntryField(activeSection, entry.id, "role", e.target.value)
                      }
                      className="w-full rounded border border-outline/70 bg-inset px-2.5 py-1.5 text-xs text-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    />
                  </div>
                  <div>
                    <label htmlFor={`${formId}-${activeSection}-${idx}-location`} className="block text-xs font-mono text-text-muted mb-1">
                      Location
                    </label>
                    <input
                      id={`${formId}-${activeSection}-${idx}-location`}
                      name={`${activeSection}-${idx}-location`}
                      type="text"
                      autoComplete="off"
                      value={entry.location}
                      onChange={(e) =>
                        updateEntryField(activeSection, entry.id, "location", e.target.value)
                      }
                      className="w-full rounded border border-outline/70 bg-inset px-2.5 py-1.5 text-xs text-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    />
                  </div>
                  <div>
                    <label htmlFor={`${formId}-${activeSection}-${idx}-date`} className="block text-xs font-mono text-text-muted mb-1">
                      Date Range
                    </label>
                    <input
                      id={`${formId}-${activeSection}-${idx}-date`}
                      name={`${activeSection}-${idx}-date`}
                      type="text"
                      autoComplete="off"
                      spellCheck={false}
                      value={entry.date}
                      onChange={(e) =>
                        updateEntryField(activeSection, entry.id, "date", e.target.value)
                      }
                      className="w-full rounded border border-outline/70 bg-inset px-2.5 py-1.5 text-xs text-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    />
                  </div>
                </div>

                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono uppercase tracking-wider text-text-muted">
                      Impact Bullets ({entry.bullets.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => addEntryBullet(activeSection, entry.id)}
                      className="text-xs font-mono text-primary hover:underline flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                    >
                      <Plus className="h-3 w-3" aria-hidden="true" /> Add Bullet
                    </button>
                  </div>
                  {entry.bullets.map((bullet, bIdx) => (
                    <div key={bIdx} className="flex items-start gap-2">
                      <span className="mt-2 text-xs text-primary" aria-hidden="true">•</span>
                      <label htmlFor={`${formId}-${activeSection}-${idx}-bullet-${bIdx}`} className="sr-only">
                        {`${entry.title || `Entry ${idx + 1}`} bullet ${bIdx + 1}`}
                      </label>
                      <textarea
                        id={`${formId}-${activeSection}-${idx}-bullet-${bIdx}`}
                        rows={2}
                        value={bullet}
                        onChange={(e) =>
                          updateEntryBullet(activeSection, entry.id, bIdx, e.target.value)
                        }
                        className="flex-1 rounded border border-outline/70 bg-inset p-2 text-xs text-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background leading-relaxed"
                      />
                      {entry.bullets.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setPendingDelete({
                              kind: "bullet",
                              listKey: activeSection,
                              id: entry.id,
                              bulletIdx: bIdx,
                              label: `bullet ${bIdx + 1} from ${entry.title || `entry ${idx + 1}`}`,
                            })
                          }
                          aria-label={`Delete bullet ${bIdx + 1} from ${entry.title || `entry ${idx + 1}`}`}
                          className="mt-1.5 text-text-muted hover:text-status-danger transition-colors p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                          title="Delete bullet"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeSection === "skills" && (
          <div className="space-y-4" data-testid="form-section-skills">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-primary">
                Skills &amp; Technical Inventory
              </h3>
              <button
                type="button"
                onClick={() =>
                  commitModel({
                    ...model,
                    skills: [
                      ...model.skills,
                      {
                        id: makeEntryId("skill", model.skills.length),
                        category: "Additional Skills",
                        items: "",
                      },
                    ],
                  })
                }
                data-testid="add-skill-category-btn"
                className="flex items-center gap-1 rounded bg-primary px-2.5 py-1 text-xs font-mono font-semibold text-primary-foreground hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                Add Category
              </button>
            </div>

            <div className="space-y-3">
              {model.skills.map((skill, sIdx) => (
                <div
                  key={skill.id}
                  className="rounded-[10px] border border-outline/70 bg-canvas/50 p-3 flex flex-col sm:flex-row items-start sm:items-center gap-2.5"
                >
                  <label htmlFor={`${formId}-skill-${sIdx}-category`} className="sr-only">
                    {`Skill category ${sIdx + 1}`}
                  </label>
                  <input
                    id={`${formId}-skill-${sIdx}-category`}
                    name={`skill-${sIdx}-category`}
                    type="text"
                    autoComplete="off"
                    value={skill.category}
                    onChange={(e) => {
                      const next = model.skills.map((s) =>
                        s.id === skill.id ? { ...s, category: e.target.value } : s
                      );
                      commitModel({ ...model, skills: next });
                    }}
                    placeholder="Category (e.g. Languages)"
                    className="w-full sm:w-44 shrink-0 rounded border border-outline/70 bg-inset px-2.5 py-1.5 text-xs font-semibold text-primary focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  />
                  <label htmlFor={`${formId}-skill-${sIdx}-items`} className="sr-only">
                    {`Skills for ${skill.category || `category ${sIdx + 1}`}`}
                  </label>
                  <input
                    id={`${formId}-skill-${sIdx}-items`}
                    name={`skill-${sIdx}-items`}
                    type="text"
                    autoComplete="off"
                    value={skill.items}
                    onChange={(e) => {
                      const next = model.skills.map((s) =>
                        s.id === skill.id ? { ...s, items: e.target.value } : s
                      );
                      commitModel({ ...model, skills: next });
                    }}
                    placeholder="Comma-separated skills (e.g. TypeScript, Python, Go, PostgreSQL)"
                    className="flex-1 w-full rounded border border-outline/70 bg-inset px-2.5 py-1.5 text-xs text-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  />
                  {model.skills.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setPendingDelete({
                          kind: "skill",
                          id: skill.id,
                          label: skill.category || `skill category ${sIdx + 1}`,
                        })
                      }
                      aria-label={`Remove skill category ${skill.category || sIdx + 1}`}
                      className="text-text-muted hover:text-status-danger transition-colors p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                      title="Remove skill category"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title={
          pendingDelete?.kind === "bullet"
            ? "Delete Bullet"
            : pendingDelete?.kind === "skill"
            ? "Remove Skill Category"
            : "Remove Entry"
        }
        description={
          pendingDelete ? `Remove ${pendingDelete.label}? You can undo this immediately after.` : ""
        }
        confirmLabel="Remove"
        tone="destructive"
        dialogTestId="form-builder-delete-confirm-modal"
        confirmTestId="confirm-form-builder-delete-btn"
        cancelTestId="cancel-form-builder-delete-btn"
        onConfirm={confirmPendingDelete}
      />

      {/* Footer Sync Indicator */}
      <div className="flex items-center justify-between border-t border-outline/70 bg-canvas px-4 py-2 text-xs text-text-muted font-mono">
        <span className="flex items-center gap-1.5 text-status-success-soft">
          <Sparkles className="h-3 w-3" aria-hidden="true" />
          Live-synced with Typst WASM Preview
        </span>
        <span>Switch to Typst Code anytime for advanced layout control</span>
      </div>
    </div>
  );
}
