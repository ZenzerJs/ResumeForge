"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import { Undo2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { InlineLink } from "@/lib/typst/inline-content";
import {
  isSchemaRequiredBlockKind,
  parseManagedResume,
  removeResumeBlockWithRange,
  renderResumeDocument,
  updateResumeBlock,
  type LayoutProfile,
  type ResumeDocument,
} from "@/lib/typst/resume-document";

type Preset = "student" | "professional" | "research";
const ranks: Record<Preset, string[]> = {
  student: ["education", "experience", "project", "skill"],
  professional: ["summary", "experience", "skill", "education", "project"],
  research: ["education", "research", "publication"],
};

export function presetSectionOrder<T extends { heading: { text: string } }>(sections: T[], preset: Preset): T[] {
  const order = ranks[preset];
  const rank = (title: string) => {
    const index = order.findIndex((word) => title.toLowerCase().includes(word));
    return index < 0 ? order.length : index;
  };
  return [...sections].sort((a, b) => rank(a.heading.text) - rank(b.heading.text));
}

type ResumeBlock = ResumeDocument["header"][number];

export interface ManagedFieldDescriptor {
  key: string;
  spanKey: string;
  block: ResumeBlock;
  label: string;
  required: boolean;
  removable: boolean;
  sectionIndex?: number;
}

export interface ManagedResumeParsed {
  document: ResumeDocument;
  profile: LayoutProfile;
  links: InlineLink[];
  prefix: string;
}

function spanKeyOf(span: { start: number; end: number }): string {
  return `${span.start}:${span.end}`;
}

function classifyContactItem(item: string, links: InlineLink[]): string {
  const trimmed = item.trim();
  if (!trimmed) return "Contact item";
  if (/^(?:mailto:)?[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(trimmed)) return "Email";
  if (/(?:^https?:\/\/)?(?:www\.)?github\.com\//i.test(trimmed)) return "GitHub";
  if (/(?:^https?:\/\/)?(?:www\.)?linkedin\.com\//i.test(trimmed)) return "LinkedIn";
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length >= 7 && /^\+?\s*[\d(][\d\s().-]{5,}\d$/.test(trimmed)) {
    return "Phone";
  }
  const matchesKnownLink = links.some((link) => {
    if (link.label === trimmed || link.url === trimmed) return true;
    try {
      const url = new URL(link.url);
      return (
        ["http:", "https:"].includes(url.protocol) &&
        `${url.host}${url.pathname}${url.search}${url.hash}`.replace(/\/$/, "") === trimmed.replace(/\/$/, "")
      );
    } catch {
      return false;
    }
  });
  if (
    matchesKnownLink ||
    /^https?:\/\//i.test(trimmed) ||
    /\//i.test(trimmed) ||
    /^[^\s]+\.(?:com|org|net|io|dev|test|edu|me|co|ai|app)\b/i.test(trimmed) ||
    /^(?:Portfolio|Website|Blog|Live Demo|GitLab)$/i.test(trimmed)
  ) {
    return "Website";
  }
  if (!/\d{3,}/.test(trimmed) && !/[|•·@]/.test(trimmed)) {
    return "Location";
  }
  return "Contact";
}

function disambiguateLabels(entries: { baseLabel: string }[]): string[] {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    counts.set(entry.baseLabel, (counts.get(entry.baseLabel) ?? 0) + 1);
  }
  const seen = new Map<string, number>();
  return entries.map((entry) => {
    const total = counts.get(entry.baseLabel) ?? 0;
    if (total <= 1) return entry.baseLabel;
    const nextIndex = (seen.get(entry.baseLabel) ?? 0) + 1;
    seen.set(entry.baseLabel, nextIndex);
    return `${entry.baseLabel} ${nextIndex}`;
  });
}

export function buildManagedFormFields(
  doc: ResumeDocument,
  links: InlineLink[] = []
): {
  headerFields: ManagedFieldDescriptor[];
  sectionGroups: {
    sectionIndex: number;
    headingField: ManagedFieldDescriptor;
    blockFields: ManagedFieldDescriptor[];
  }[];
} {
  const totalBlocks =
    doc.header.length + doc.sections.reduce((total, section) => total + 1 + section.blocks.length, 0);

  const headerBases = doc.header.map((block) => {
    if (block.kind === "name") {
      return { baseLabel: `Full name${block.unassigned ? " · review" : ""}` };
    }
    if (block.kind === "contact") {
      const parts = block.text.split(/\s*[|\u2022\u00b7]\s*/).filter(Boolean);
      if (parts.length > 1) {
        const roles = parts.map((part) => classifyContactItem(part, links));
        return {
          baseLabel: `Contact line (${roles.join(", ")}): ${block.text}${block.unassigned ? " · review" : ""}`,
        };
      }
      const role = classifyContactItem(block.text, links);
      return { baseLabel: `${role}${block.unassigned ? " · review" : ""}` };
    }
    return {
      baseLabel: `Header ${block.kind.replace(/-/g, " ")}${block.unassigned ? " · review" : ""}`,
    };
  });
  const headerLabels = disambiguateLabels(headerBases);

  const headerFields: ManagedFieldDescriptor[] = doc.header.map((block, index) => {
    const required = isSchemaRequiredBlockKind(block.kind) || totalBlocks <= 1;
    return {
      key: `header-${index}`,
      spanKey: spanKeyOf(block.span),
      block,
      label: headerLabels[index],
      required,
      removable: !required,
    };
  });

  const sectionHeadingCounts = new Map<string, number>();
  for (const section of doc.sections) {
    const title = section.heading.text.trim();
    sectionHeadingCounts.set(title, (sectionHeadingCounts.get(title) ?? 0) + 1);
  }
  const sectionHeadingSeen = new Map<string, number>();

  const sectionGroups = doc.sections.map((section, sectionIndex) => {
    const title = section.heading.text.trim() || `Section ${sectionIndex + 1}`;
    const totalSameTitle = sectionHeadingCounts.get(title) ?? 0;
    const occ = (sectionHeadingSeen.get(title) ?? 0) + 1;
    sectionHeadingSeen.set(title, occ);
    const sectionContext = totalSameTitle > 1 ? `${title} #${occ}` : title;

    const headingLabel =
      doc.sections.length === 1
        ? `Section heading (${sectionContext})`
        : `Section ${sectionIndex + 1} heading (${sectionContext})`;

    const headingField: ManagedFieldDescriptor = {
      key: `heading-${sectionIndex}`,
      spanKey: spanKeyOf(section.heading.span),
      block: section.heading,
      label: headingLabel,
      required: true,
      removable: false,
      sectionIndex,
    };

    // Pre-scan entries in this section so title/role context is available for every entry field and bullet.
    interface EntryMeta {
      titleIndex: number;
      entryNumber: number;
      titleText: string;
      roleText?: string;
    }
    const entryMetaByTitleIndex = new Map<number, EntryMeta>();
    let entryCount = 0;
    for (let i = 0; i < section.blocks.length; i++) {
      const b = section.blocks[i];
      if (b.kind === "entry-title") {
        entryCount += 1;
        let roleText: string | undefined;
        const seenKinds = new Set<string>();
        for (let j = i + 1; j < section.blocks.length; j++) {
          const next = section.blocks[j];
          if (!["entry-role", "entry-location", "entry-date"].includes(next.kind)) break;
          if (seenKinds.has(next.kind)) break;
          seenKinds.add(next.kind);
          if (next.kind === "entry-role") roleText = next.text;
        }
        entryMetaByTitleIndex.set(i, {
          titleIndex: i,
          entryNumber: entryCount,
          titleText: b.text.trim() || `Entry ${entryCount}`,
          roleText: roleText?.trim() || undefined,
        });
      }
    }

    const titleRoleKeyCounts = new Map<string, number>();
    const titleKeyCounts = new Map<string, number>();
    for (const meta of entryMetaByTitleIndex.values()) {
      titleKeyCounts.set(meta.titleText, (titleKeyCounts.get(meta.titleText) ?? 0) + 1);
      const combo = `${meta.titleText}::${meta.roleText ?? ""}`;
      titleRoleKeyCounts.set(combo, (titleRoleKeyCounts.get(combo) ?? 0) + 1);
    }

    let activeEntry: EntryMeta | null = null;
    let activeEntryBulletCount = 0;
    let sectionBulletCount = 0;
    let skillCount = 0;
    let paragraphCount = 0;

    const rawSectionLabels: { baseLabel: string; block: ResumeBlock; blockIndex: number }[] = [];

    for (let blockIndex = 0; blockIndex < section.blocks.length; blockIndex++) {
      const block = section.blocks[blockIndex];
      const reviewSuffix = block.unassigned ? " · review" : "";

      if (block.kind === "entry-title") {
        activeEntry = entryMetaByTitleIndex.get(blockIndex) ?? null;
        activeEntryBulletCount = 0;
        const suffix = activeEntry?.roleText ? ` (${activeEntry.titleText} — ${activeEntry.roleText})` : ` (${activeEntry?.titleText ?? block.text})`;
        rawSectionLabels.push({
          baseLabel: `${sectionContext} · Entry ${activeEntry?.entryNumber ?? 1} title${suffix}${reviewSuffix}`,
          block,
          blockIndex,
        });
        continue;
      }

      const entryTitleContext = activeEntry
        ? (titleKeyCounts.get(activeEntry.titleText) ?? 0) > 1
          ? `${activeEntry.titleText} (#${activeEntry.entryNumber})`
          : activeEntry.titleText
        : null;

      const entryFullContext = activeEntry
        ? (() => {
            const combo = `${activeEntry.titleText}::${activeEntry.roleText ?? ""}`;
            const base = activeEntry.roleText
              ? `${activeEntry.titleText} — ${activeEntry.roleText}`
              : activeEntry.titleText;
            return (titleRoleKeyCounts.get(combo) ?? 0) > 1 ? `${base} (#${activeEntry.entryNumber})` : base;
          })()
        : null;

      if (block.kind === "entry-role") {
        rawSectionLabels.push({
          baseLabel: `${sectionContext} · ${entryTitleContext ?? "Entry"} · Role${reviewSuffix}`,
          block,
          blockIndex,
        });
      } else if (block.kind === "entry-location") {
        rawSectionLabels.push({
          baseLabel: `${sectionContext} · ${entryFullContext ?? "Entry"} · Location${reviewSuffix}`,
          block,
          blockIndex,
        });
      } else if (block.kind === "entry-date") {
        rawSectionLabels.push({
          baseLabel: `${sectionContext} · ${entryFullContext ?? "Entry"} · Dates${reviewSuffix}`,
          block,
          blockIndex,
        });
      } else if (block.kind === "bullet") {
        if (activeEntry) {
          activeEntryBulletCount += 1;
          rawSectionLabels.push({
            baseLabel: `${sectionContext} · ${entryFullContext} · Bullet ${activeEntryBulletCount}${reviewSuffix}`,
            block,
            blockIndex,
          });
        } else {
          sectionBulletCount += 1;
          rawSectionLabels.push({
            baseLabel: `${sectionContext} · Bullet ${sectionBulletCount}${reviewSuffix}`,
            block,
            blockIndex,
          });
        }
      } else if (block.kind === "skill") {
        skillCount += 1;
        const colon = block.text.indexOf(":");
        const category = colon > 0 ? block.text.slice(0, colon).trim() : "";
        rawSectionLabels.push({
          baseLabel: `${sectionContext} · Skill ${skillCount}${category ? ` (${category})` : ""}${reviewSuffix}`,
          block,
          blockIndex,
        });
      } else {
        paragraphCount += 1;
        const prefix = entryFullContext ? `${sectionContext} · ${entryFullContext}` : sectionContext;
        rawSectionLabels.push({
          baseLabel: `${prefix} · Paragraph ${paragraphCount}${reviewSuffix}`,
          block,
          blockIndex,
        });
      }
    }

    const resolvedLabels = disambiguateLabels(rawSectionLabels);
    const blockFields: ManagedFieldDescriptor[] = rawSectionLabels.map(({ block, blockIndex }, i) => {
      const required = isSchemaRequiredBlockKind(block.kind) || totalBlocks <= 1;
      return {
        key: `block-${sectionIndex}-${blockIndex}`,
        spanKey: spanKeyOf(block.span),
        block,
        label: resolvedLabels[i],
        required,
        removable: !required,
        sectionIndex,
      };
    });

    return {
      sectionIndex,
      headingField,
      blockFields,
    };
  });

  return { headerFields, sectionGroups };
}

function adjustLinksAfterEdit(
  links: InlineLink[],
  editedSpan: { start: number; end: number },
  delta: number
): InlineLink[] {
  return links.map((link) => {
    if (!link.span) return link;
    if (link.span.end <= editedSpan.start) return link;
    if (link.span.start >= editedSpan.end) {
      return {
        ...link,
        span: {
          start: link.span.start + delta,
          end: link.span.end + delta,
        },
      };
    }
    const { span: _span, ...rest } = link;
    return rest;
  });
}

function adjustLinksAfterRemoval(
  links: InlineLink[],
  removedRange: { start: number; end: number }
): InlineLink[] {
  const removedLen = removedRange.end - removedRange.start;
  return links.map((link) => {
    if (!link.span) return link;
    if (link.span.end <= removedRange.start) return link;
    if (link.span.start >= removedRange.end) {
      return {
        ...link,
        span: {
          start: link.span.start - removedLen,
          end: link.span.end - removedLen,
        },
      };
    }
    const { span: _span, ...rest } = link;
    return rest;
  });
}

export type ManagedBlurResult =
  | { status: "unchanged" }
  | {
      status: "invalid";
      draftValue: string;
      error: string;
    }
  | {
      status: "committed";
      nextSource: string;
      delta: number;
    };

export function commitManagedFieldBlur(params: {
  managed: ManagedResumeParsed;
  field: ManagedFieldDescriptor;
  rawValue: string;
}): ManagedBlurResult {
  const { managed, field, rawValue } = params;
  const { block } = field;

  if (!rawValue.trim()) {
    return {
      status: "invalid",
      draftValue: rawValue,
      error: field.required
        ? `${field.label} is required and cannot be empty.`
        : `${field.label} cannot be saved blank. Enter text or use Remove to delete this field.`,
    };
  }

  if (rawValue === block.text) {
    return { status: "unchanged" };
  }

  try {
    const nextDoc = updateResumeBlock(managed.document, block.span, rawValue);
    const delta = rawValue.length - (block.span.end - block.span.start);
    const nextLinks = adjustLinksAfterEdit(managed.links, block.span, delta);
    const nextSource = managed.prefix + renderResumeDocument(nextDoc, managed.profile, nextLinks);
    return {
      status: "committed",
      nextSource,
      delta,
    };
  } catch (err) {
    return {
      status: "invalid",
      draftValue: rawValue,
      error: err instanceof Error ? err.message : `Could not update ${field.label}.`,
    };
  }
}

export type ManagedRemovalResult =
  | {
      status: "removed";
      nextSource: string;
      removedRange: { start: number; end: number };
    }
  | {
      status: "error";
      error: string;
    };

export function removeManagedFieldBlock(params: {
  managed: ManagedResumeParsed;
  field: ManagedFieldDescriptor;
}): ManagedRemovalResult {
  const { managed, field } = params;
  if (!field.removable) {
    return {
      status: "error",
      error: `${field.label} is required and cannot be removed.`,
    };
  }

  try {
    const { document: nextDoc, removedRange } = removeResumeBlockWithRange(
      managed.document,
      field.block.span
    );
    const nextLinks = adjustLinksAfterRemoval(managed.links, removedRange);
    const nextSource = managed.prefix + renderResumeDocument(nextDoc, managed.profile, nextLinks);
    return {
      status: "removed",
      nextSource,
      removedRange,
    };
  } catch (err) {
    return {
      status: "error",
      error: err instanceof Error ? err.message : `Could not remove ${field.label}.`,
    };
  }
}

function remapSpanRecord(
  record: Record<string, string>,
  targetSpanKey: string,
  boundary: number,
  delta: number
): Record<string, string> {
  const next: Record<string, string> = {};
  for (const [key, val] of Object.entries(record)) {
    if (key === targetSpanKey) continue;
    const [rawStart, rawEnd] = key.split(":");
    const start = Number(rawStart);
    const end = Number(rawEnd);
    if (Number.isInteger(start) && Number.isInteger(end) && start >= boundary) {
      next[`${start + delta}:${end + delta}`] = val;
    } else {
      next[key] = val;
    }
  }
  return next;
}

const SINGLE_LINE_BLOCK_KINDS = new Set([
  "name",
  "contact",
  "entry-title",
  "entry-role",
  "entry-location",
  "entry-date",
]);
const LIVE_COMMIT_DEBOUNCE_MS = 200;

export function ManagedResumeForm({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const baseId = useId();
  const [preset, setPreset] = useState<Preset>("professional");
  const [pendingPresetApply, setPendingPresetApply] = useState<{
    preset: Preset;
    sourceSnapshot: string;
  } | null>(null);
  const [pendingRemoveField, setPendingRemoveField] = useState<ManagedFieldDescriptor | null>(null);
  const [undoRemoveState, setUndoRemoveState] = useState<{
    label: string;
    previousSource: string;
  } | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const lastCommittedValueRef = useRef<string | null>(null);
  const valueRef = useRef<string>(value);
  valueRef.current = value;
  const liveDebounceTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const timers = liveDebounceTimersRef.current;
    return () => {
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
    };
  }, []);

  useEffect(() => {
    if (lastCommittedValueRef.current !== null && lastCommittedValueRef.current === value) {
      return;
    }
    lastCommittedValueRef.current = null;
    setDrafts({});
    setErrors({});
  }, [value]);

  const managed = parseManagedResume(value);
  if (!managed) {
    return (
      <div role="status" className="p-6 text-sm text-foreground">
        This source has changed outside the form. Use Typst Code to preserve those changes.
      </div>
    );
  }

  const { document: doc, profile, links, prefix } = managed;
  const { headerFields, sectionGroups } = buildManagedFormFields(doc, links);

  const occurrences = (labels: string[]) => {
    const result: { start: number; end: number; context: string; label: string }[] = [];
    const visit = (blocks: typeof doc.header, section: string) => {
      let entry = section;
      for (const block of blocks) {
        if (block.kind === "entry-title") entry = block.text;
        for (const label of labels) {
          let offset = 0;
          while ((offset = block.text.indexOf(label, offset)) >= 0) {
            const start = block.span.start + offset;
            result.push({
              start,
              end: start + label.length,
              label,
              context: `${section} · ${entry} · ${block.text}`,
            });
            offset += label.length;
          }
        }
      }
    };
    visit(doc.header, "Header");
    doc.sections.forEach((section) => visit(section.blocks, section.heading.text));
    return result;
  };

  const applyPreset = () => {
    setPendingPresetApply({ preset, sourceSnapshot: value });
  };

  const clearDebounceTimer = (fieldKey: string) => {
    const existing = liveDebounceTimersRef.current.get(fieldKey);
    if (existing) {
      clearTimeout(existing);
      liveDebounceTimersRef.current.delete(fieldKey);
    }
  };

  const scheduleLiveFieldCommit = (fieldKey: string, nextVal: string) => {
    clearDebounceTimer(fieldKey);
    if (!nextVal.trim()) return;
    const timer = setTimeout(() => {
      liveDebounceTimersRef.current.delete(fieldKey);
      const latestSource = valueRef.current;
      const latestManaged = parseManagedResume(latestSource);
      if (!latestManaged) return;
      const latestFields = buildManagedFormFields(latestManaged.document, latestManaged.links);
      const allFields = [
        ...latestFields.headerFields,
        ...latestFields.sectionGroups.flatMap((g) => [g.headingField, ...g.blockFields]),
      ];
      const latestField = allFields.find((f) => f.key === fieldKey);
      if (!latestField) return;
      const outcome = commitManagedFieldBlur({
        managed: latestManaged,
        field: latestField,
        rawValue: nextVal,
      });
      if (outcome.status !== "committed") return;
      lastCommittedValueRef.current = outcome.nextSource;
      setDrafts((prev) => remapSpanRecord(prev, latestField.spanKey, latestField.block.span.end, outcome.delta));
      setErrors((prev) => remapSpanRecord(prev, latestField.spanKey, latestField.block.span.end, outcome.delta));
      onChange(outcome.nextSource);
    }, LIVE_COMMIT_DEBOUNCE_MS);
    liveDebounceTimersRef.current.set(fieldKey, timer);
  };

  const handleFieldBlur = (field: ManagedFieldDescriptor, rawValue: string) => {
    clearDebounceTimer(field.key);
    const outcome = commitManagedFieldBlur({ managed, field, rawValue });
    if (outcome.status === "unchanged") {
      setDrafts((prev) => {
        if (!(field.spanKey in prev)) return prev;
        const copy = { ...prev };
        delete copy[field.spanKey];
        return copy;
      });
      setErrors((prev) => {
        if (!(field.spanKey in prev)) return prev;
        const copy = { ...prev };
        delete copy[field.spanKey];
        return copy;
      });
      return;
    }

    if (outcome.status === "invalid") {
      setDrafts((prev) => ({ ...prev, [field.spanKey]: outcome.draftValue }));
      setErrors((prev) => ({ ...prev, [field.spanKey]: outcome.error }));
      return;
    }

    lastCommittedValueRef.current = outcome.nextSource;
    setDrafts((prev) => remapSpanRecord(prev, field.spanKey, field.block.span.end, outcome.delta));
    setErrors((prev) => remapSpanRecord(prev, field.spanKey, field.block.span.end, outcome.delta));
    onChange(outcome.nextSource);
  };

  const handleRemoveField = (field: ManagedFieldDescriptor) => {
    clearDebounceTimer(field.key);
    const previousSource = value;
    const outcome = removeManagedFieldBlock({ managed, field });
    if (outcome.status === "error") {
      setErrors((prev) => ({ ...prev, [field.spanKey]: outcome.error }));
      return;
    }
    const removedDelta = -(outcome.removedRange.end - outcome.removedRange.start);
    lastCommittedValueRef.current = outcome.nextSource;
    setUndoRemoveState({ label: field.label, previousSource });
    setDrafts((prev) => remapSpanRecord(prev, field.spanKey, outcome.removedRange.end, removedDelta));
    setErrors((prev) => remapSpanRecord(prev, field.spanKey, outcome.removedRange.end, removedDelta));
    onChange(outcome.nextSource);
  };

  const renderField = (field: ManagedFieldDescriptor) => {
    const inputId = `${baseId}-${field.key}`;
    const errorId = `${inputId}-error`;
    const currentValue = field.spanKey in drafts ? drafts[field.spanKey] : field.block.text;
    const errorMessage = errors[field.spanKey];
    const isSingleLine = SINGLE_LINE_BLOCK_KINDS.has(field.block.kind);
    const sharedControlClass = `w-full rounded border px-3 py-2 text-sm text-foreground bg-inset transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
      errorMessage
        ? "border-status-danger focus-visible:border-status-danger"
        : "border-outline/70 focus-visible:border-ring"
    }`;

    const handleControlChange = (nextVal: string) => {
      setDrafts((prev) => ({ ...prev, [field.spanKey]: nextVal }));
      if (nextVal.trim() && errors[field.spanKey]) {
        setErrors((prev) => {
          const copy = { ...prev };
          delete copy[field.spanKey];
          return copy;
        });
      }
      scheduleLiveFieldCommit(field.key, nextVal);
    };

    return (
      <div key={field.key} className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor={inputId} className="text-xs font-medium text-text-secondary">
            {field.label}
          </label>
          {field.removable && (
            <button
              type="button"
              onClick={() => setPendingRemoveField(field)}
              aria-label={`Remove ${field.label}`}
              data-testid={`remove-${field.key}`}
              className="inline-flex min-h-7 shrink-0 items-center rounded border border-outline/70 bg-elevated px-2 py-0.5 text-xs font-medium text-text-secondary hover:border-status-danger/60 hover:text-status-danger transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Remove
            </button>
          )}
        </div>
        {isSingleLine ? (
          <input
            id={inputId}
            name={field.key}
            type="text"
            value={currentValue}
            onChange={(event) => handleControlChange(event.currentTarget.value)}
            onBlur={(event) => handleFieldBlur(field, event.currentTarget.value)}
            aria-invalid={errorMessage ? "true" : undefined}
            aria-describedby={errorMessage ? errorId : undefined}
            className={sharedControlClass}
          />
        ) : (
          <textarea
            id={inputId}
            name={field.key}
            value={currentValue}
            onChange={(event) => handleControlChange(event.currentTarget.value)}
            onBlur={(event) => handleFieldBlur(field, event.currentTarget.value)}
            aria-invalid={errorMessage ? "true" : undefined}
            aria-describedby={errorMessage ? errorId : undefined}
            rows={currentValue.length > 100 ? 3 : 1}
            className={sharedControlClass}
          />
        )}
        {errorMessage && (
          <p
            id={errorId}
            role="alert"
            data-testid={`error-${field.key}`}
            className="text-xs font-medium text-status-danger"
          >
            {errorMessage}
          </p>
        )}
      </div>
    );
  };

  const scrollToSection = (elementId: string) => {
    const target = document.getElementById(elementId);
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div data-testid="managed-resume-form" className="h-full space-y-5 overflow-auto bg-panel p-4 text-foreground">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="resume-preset" className="text-xs text-text-secondary">
          Section order
        </label>
        <select
          id="resume-preset"
          name="resumePreset"
          value={preset}
          onChange={(event) => setPreset(event.target.value as Preset)}
          className="rounded border border-outline/70 bg-inset p-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <option value="student">Student</option>
          <option value="professional">Professional</option>
          <option value="research">Research</option>
        </select>
        <button
          type="button"
          onClick={applyPreset}
          className="rounded bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Apply to draft
        </button>
      </div>

      {/* Section Jump Pills */}
      <nav
        aria-label="Jump to resume section"
        data-testid="managed-form-section-pills"
        className="flex flex-wrap items-center gap-1.5"
      >
        <button
          type="button"
          onClick={() => scrollToSection(`${baseId}-section-header`)}
          className="rounded-full border border-outline/70 bg-inset px-2.5 py-1 text-xs font-medium text-text-secondary transition-colors hover:bg-elevated hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Header
        </button>
        {sectionGroups.map(({ sectionIndex, headingField }) => (
          <button
            key={`jump-${sectionIndex}`}
            type="button"
            onClick={() => scrollToSection(`${baseId}-section-${sectionIndex}`)}
            className="rounded-full border border-outline/70 bg-inset px-2.5 py-1 text-xs font-medium text-text-secondary transition-colors hover:bg-elevated hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {headingField.block.text.trim() || `Section ${sectionIndex + 1}`}
          </button>
        ))}
      </nav>

      {undoRemoveState && (
        <div
          role="status"
          aria-live="polite"
          data-testid="managed-remove-undo-banner"
          className="flex items-center justify-between gap-2 rounded-[8px] border border-primary/40 bg-primary/10 px-3 py-2 text-xs text-foreground"
        >
          <span>Removed {undoRemoveState.label}.</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                lastCommittedValueRef.current = undoRemoveState.previousSource;
                onChange(undoRemoveState.previousSource);
                setUndoRemoveState(null);
              }}
              data-testid="managed-remove-undo-btn"
              className="inline-flex items-center gap-1 rounded bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Undo2 className="h-3 w-3" aria-hidden="true" />
              Undo
            </button>
            <button
              type="button"
              onClick={() => setUndoRemoveState(null)}
              className="text-xs text-text-secondary hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <p className="text-sm text-text-muted">
        Changes update your preview automatically as you type. Use Remove to delete optional fields or bullets, or Typst Source for custom edits.
      </p>
      {links.length > 0 && (
        <section className="space-y-3 border-t border-outline/60 pt-4" aria-label="PDF link placement">
          <h2 className="text-sm font-semibold text-foreground">PDF link placement</h2>
          <p className="text-sm text-text-secondary">
            Choose the matching text for each destination when needed. Editing a block clears placement choices inside that block so they can be reviewed again.
          </p>
          {links.map((link, index) => {
            const choices = occurrences([
              ...new Set([link.label || link.url, "GitHub", "Live Demo", "Portfolio", "Website"]),
            ]);
            const selectId = `${baseId}-link-placement-${index}`;
            return (
              <div key={`${index}-${link.url}`} className="space-y-1 text-xs text-text-secondary">
                <label htmlFor={selectId} className="block break-all">
                  Placement for {link.label || "link"}: {link.url}
                </label>
                <select
                  id={selectId}
                  name={`linkPlacement-${index}`}
                  data-testid={`link-placement-${index}`}
                  value={link.span ? `${link.span.start}:${link.span.end}` : ""}
                  onChange={(event) => {
                    const selected = choices.find(
                      (choice) => `${choice.start}:${choice.end}` === event.currentTarget.value
                    );
                    const updated = links.map((item, i) => {
                      if (i !== index) return item;
                      const { span: _span, ...rest } = item;
                      return selected
                        ? { ...rest, label: selected.label, span: { start: selected.start, end: selected.end } }
                        : rest;
                    });
                    const nextSource = prefix + renderResumeDocument(doc, profile, updated);
                    lastCommittedValueRef.current = nextSource;
                    onChange(nextSource);
                  }}
                  className="w-full rounded border border-outline/70 bg-inset p-2 text-sm text-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <option value="">Unassigned / automatic when unambiguous</option>
                  {choices.map((choice) => (
                    <option
                      key={`${choice.start}:${choice.end}`}
                      value={`${choice.start}:${choice.end}`}
                      disabled={links.some(
                        (other, i) =>
                          i !== index &&
                          other.span?.start === choice.start &&
                          other.span.end === choice.end &&
                          other.url !== link.url
                      )}
                    >
                      {choice.label} — {choice.context}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
        </section>
      )}
      <div id={`${baseId}-section-header`} className="space-y-3 border-t border-outline/60 pt-4 scroll-mt-4">
        {headerFields.map((field) => renderField(field))}
      </div>
      {sectionGroups.map(({ sectionIndex, headingField, blockFields }) => (
        <section
          key={`section-${sectionIndex}`}
          id={`${baseId}-section-${sectionIndex}`}
          className="space-y-3 border-t border-outline/60 pt-4 scroll-mt-4"
        >
          {renderField(headingField)}
          {blockFields.map((field) => renderField(field))}
        </section>
      ))}
      <ConfirmDialog
        open={Boolean(pendingRemoveField)}
        onOpenChange={(open) => {
          if (!open) setPendingRemoveField(null);
        }}
        title="Remove Resume Field"
        description={
          pendingRemoveField
            ? `Remove "${pendingRemoveField.label}"? You can undo this immediately after.`
            : ""
        }
        confirmLabel="Remove"
        tone="destructive"
        dialogTestId="managed-remove-confirm-modal"
        confirmTestId="confirm-managed-remove-btn"
        cancelTestId="cancel-managed-remove-btn"
        onConfirm={() => {
          if (!pendingRemoveField) return;
          handleRemoveField(pendingRemoveField);
          setPendingRemoveField(null);
        }}
      />
      <ConfirmDialog
        open={Boolean(pendingPresetApply)}
        onOpenChange={(open) => {
          if (!open) setPendingPresetApply(null);
        }}
        title="Apply Section Order Preset"
        description={
          pendingPresetApply ? `Apply the ${pendingPresetApply.preset} section order to this draft?` : ""
        }
        confirmLabel="Apply Preset"
        dialogTestId="apply-preset-confirm-modal"
        confirmTestId="confirm-apply-preset-btn"
        cancelTestId="cancel-apply-preset-btn"
        onConfirm={() => {
          if (!pendingPresetApply) return;
          const latest = parseManagedResume(value);
          if (!latest || pendingPresetApply.sourceSnapshot !== value) {
            setPendingPresetApply(null);
            return;
          }
          const nextSource =
            latest.prefix +
            renderResumeDocument(
              {
                ...latest.document,
                sections: presetSectionOrder(latest.document.sections, pendingPresetApply.preset),
              },
              latest.profile,
              latest.links
            );
          lastCommittedValueRef.current = nextSource;
          setDrafts({});
          setErrors({});
          onChange(nextSource);
          setPendingPresetApply(null);
        }}
      />
    </div>
  );
}
