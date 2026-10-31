"use client";

import React, { useState } from "react";
import { parseManagedResume, renderResumeDocument, updateResumeBlock } from "@/lib/typst/resume-document";

type Preset = "student" | "professional" | "research";
const ranks: Record<Preset, string[]> = {
  student: ["education", "experience", "project", "skill"],
  professional: ["summary", "experience", "skill", "education", "project"],
  research: ["education", "research", "publication"],
};

export function presetSectionOrder<T extends { heading: { text: string } }>(sections: T[], preset: Preset): T[] {
  const order = ranks[preset];
  const rank = (title: string) => { const index = order.findIndex((word) => title.toLowerCase().includes(word)); return index < 0 ? order.length : index; };
  return [...sections].sort((a, b) => rank(a.heading.text) - rank(b.heading.text));
}

export function ManagedResumeForm({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [preset, setPreset] = useState<Preset>("professional");
  const managed = parseManagedResume(value);
  if (!managed) return <div role="status" className="p-6 text-sm text-slate-200">This source has changed outside the form. Use Typst Code to preserve those changes.</div>;
  const { document: doc, profile, links, prefix } = managed;
  const commit = (next: typeof doc) => onChange(prefix + renderResumeDocument(next, profile, links));
  const edit = (span: { start: number; end: number }, text: string) => {
    if (text && text !== doc.source.slice(span.start, span.end)) {
      const next = updateResumeBlock(doc, span, text);
      // A text edit can move or change a label; require a fresh placement decision.
      onChange(prefix + renderResumeDocument(next, profile, links.map(({ span: _span, ...link }) => link)));
    }
  };
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
            result.push({ start, end: start + label.length, label, context: `${section} · ${entry} · ${block.text}` });
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
    if (!window.confirm(`Apply the ${preset} section order to this draft?`)) return;
    commit({ ...doc, sections: presetSectionOrder(doc.sections, preset) });
  };
  const field = (block: typeof doc.header[number], key: string) => (
    <label key={key} className="block space-y-1 text-xs text-slate-300">
      <span className="capitalize">{block.kind.replace(/-/g, " ")}{block.unassigned ? " · review" : ""}</span>
      <textarea defaultValue={block.text} key={`${key}:${block.text}`} onBlur={(event) => edit(block.span, event.currentTarget.value)} rows={block.text.length > 100 ? 3 : 1} className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-amber-400 focus:outline-none" />
    </label>
  );
  return <div data-testid="managed-resume-form" className="h-full space-y-5 overflow-auto bg-slate-900 p-4 text-slate-100">
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor="resume-preset" className="text-xs text-slate-300">Section order</label>
      <select id="resume-preset" value={preset} onChange={(event) => setPreset(event.target.value as Preset)} className="rounded border border-slate-700 bg-slate-950 p-2 text-xs">
        <option value="student">Student</option><option value="professional">Professional</option><option value="research">Research</option>
      </select>
      <button type="button" onClick={applyPreset} className="rounded bg-amber-500 px-3 py-2 text-xs font-semibold text-slate-950">Apply to draft</button>
    </div>
    <p className="text-xs text-slate-400">Changes apply when you leave a field. Use Typst Code for unsupported source changes.</p>
    {links.length > 0 && <section className="space-y-3 rounded border border-slate-700 p-3" aria-label="PDF link placement">
      <h2 className="text-sm font-semibold">PDF link placement</h2>
      <p className="text-xs text-slate-300">Choose the matching text for each destination when needed. Editing resume text clears placement choices so they can be reviewed again.</p>
      {links.map((link, index) => {
        const choices = occurrences([...new Set([link.label || link.url, "GitHub", "Live Demo", "Portfolio", "Website"])]);
        return <label key={`${index}-${link.url}`} className="block space-y-1 text-xs text-slate-300">
          <span className="block break-all">{link.label || "Link"}: {link.url}</span>
          <select data-testid={`link-placement-${index}`} aria-label={`Placement for ${link.label || "link"}: ${link.url}`} value={link.span ? `${link.span.start}:${link.span.end}` : ""} onChange={(event) => {
            const selected = choices.find((choice) => `${choice.start}:${choice.end}` === event.currentTarget.value);
            const updated = links.map((item, i) => {
              if (i !== index) return item;
              const { span: _span, ...rest } = item;
              return selected ? { ...rest, label: selected.label, span: { start: selected.start, end: selected.end } } : rest;
            });
            onChange(prefix + renderResumeDocument(doc, profile, updated));
          }} className="w-full rounded border border-slate-700 bg-slate-950 p-2 text-sm text-slate-100 focus:border-amber-400 focus:outline-none">
            <option value="">Unassigned / automatic when unambiguous</option>
            {choices.map((choice) => <option key={`${choice.start}:${choice.end}`} value={`${choice.start}:${choice.end}`} disabled={links.some((other, i) => i !== index && other.span?.start === choice.start && other.span.end === choice.end && other.url !== link.url)}>{choice.label} — {choice.context}</option>)}
          </select>
        </label>;
      })}
    </section>}
    <div className="space-y-3">{doc.header.map((block, index) => field(block, `header-${index}`))}</div>
    {doc.sections.map((section, index) => <section key={`section-${index}`} className="space-y-3 rounded border border-slate-700 p-3">
      {field(section.heading, `heading-${index}`)}
      {section.blocks.map((block, blockIndex) => field(block, `block-${index}-${blockIndex}`))}
    </section>)}
  </div>;
}
