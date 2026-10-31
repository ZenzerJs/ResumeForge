import { z } from "zod";
import { createInlineRenderer, type InlineLink } from "./inline-content";
import { renderPreviousResumeDocument } from "./resume-document-v2-previous";
import { renderLegacyResumeDocument } from "./resume-document-v2-legacy";

export const SourceSpanSchema = z.object({ start: z.number().int().nonnegative(), end: z.number().int().nonnegative() }).strict();
export const BlockKindSchema = z.enum(["name", "contact", "section", "paragraph", "bullet", "entry-title", "entry-role", "entry-location", "entry-date", "skill"]);
export const AssignmentSchema = z.array(z.object({ kind: BlockKindSchema, span: SourceSpanSchema }).strict());
const BlockSchema = z.object({ kind: BlockKindSchema, span: SourceSpanSchema, text: z.string(), unassigned: z.boolean() }).strict();
const SectionSchema = z.object({ heading: BlockSchema, blocks: z.array(BlockSchema) }).strict();
const RawDocumentSchema = z.object({ version: z.literal(2), source: z.string(), header: z.array(BlockSchema), sections: z.array(SectionSchema), issues: z.array(z.string()), paper: z.enum(["us-letter", "a4"]) }).strict();
function splitsSurrogate(source: string, offset: number) {
  if (offset <= 0 || offset >= source.length) return false;
  const before = source.charCodeAt(offset - 1), after = source.charCodeAt(offset);
  return before >= 0xd800 && before <= 0xdbff && after >= 0xdc00 && after <= 0xdfff;
}
export const ResumeDocumentSchema = RawDocumentSchema.superRefine((doc, ctx) => {
  if (!doc.source.trim()) ctx.addIssue({ code: "custom", message: "Resume source must contain text" });
  const blocks = [...doc.header, ...doc.sections.flatMap((s) => [s.heading, ...s.blocks])].sort((a, b) => a.span.start - b.span.start);
  let end = 0;
  for (const block of blocks) {
    const { start, end: next } = block.span;
    if (start < end || next <= start || next > doc.source.length || splitsSurrogate(doc.source, start) || splitsSurrogate(doc.source, next) || doc.source.slice(start, next) !== block.text) {
      ctx.addIssue({ code: "custom", message: "Block does not match its ordered source span" });
    }
    end = next;
  }
  for (const section of doc.sections) if (section.heading.kind !== "section") ctx.addIssue({ code: "custom", message: "Invalid section heading" });
  // Every non-whitespace character must be represented, including unknown blocks.
  let cursor = 0;
  for (const block of blocks) {
    if (/\S/.test(doc.source.slice(cursor, block.span.start))) ctx.addIssue({ code: "custom", message: "Unrepresented source text" });
    cursor = block.span.end;
  }
  if (/\S/.test(doc.source.slice(cursor))) ctx.addIssue({ code: "custom", message: "Unrepresented source text" });
});
export type ResumeDocument = z.infer<typeof ResumeDocumentSchema>;
export type ResumeAssignment = z.infer<typeof AssignmentSchema>[number];

/** AI is permitted to assign source spans only; it cannot supply resume text. */
export function validateAssignments(source: string, input: unknown) {
  const assignments = AssignmentSchema.parse(input);
  const sorted = [...assignments].sort((a, b) => a.span.start - b.span.start);
  let end = 0;
  for (const { span } of sorted) {
    if (span.start < end || span.end <= span.start || span.end > source.length || splitsSurrogate(source, span.start) || splitsSurrogate(source, span.end)) throw new Error("Invalid or overlapping source span");
    end = span.end;
  }
  return sorted;
}

export function buildResumeDocument(source: string, input: unknown = [], paper: "us-letter" | "a4" = "us-letter"): ResumeDocument {
  if (!source.trim()) throw new Error("Resume source must contain text");
  const assignments = validateAssignments(source, input);
  const blocks: z.infer<typeof BlockSchema>[] = [];
  let cursor = 0;
  const addUnassigned = (start: number, end: number) => {
    const chunk = source.slice(start, end);
    const line = /[^\r\n]+/g;
    let match: RegExpExecArray | null;
    while ((match = line.exec(chunk))) {
      if (!match[0].trim()) continue;
      const span = { start: start + match.index, end: start + match.index + match[0].length };
      blocks.push({ kind: "paragraph", span, text: match[0], unassigned: true });
    }
  };
  for (const { kind, span } of assignments) {
    addUnassigned(cursor, span.start);
    blocks.push({ kind, span, text: source.slice(span.start, span.end), unassigned: false });
    cursor = span.end;
  }
  addUnassigned(cursor, source.length);
  const header: z.infer<typeof BlockSchema>[] = [];
  const sections: z.infer<typeof SectionSchema>[] = [];
  for (const block of blocks) {
    if (block.kind === "section") sections.push({ heading: block, blocks: [] });
    else if (sections.length) sections[sections.length - 1].blocks.push(block);
    else header.push(block);
  }
  return ResumeDocumentSchema.parse({ version: 2, source, header, sections, paper, issues: blocks.some((b) => b.unassigned) ? ["Some source text could not be classified. Review it before final export."] : [] });
}

export function typstString(value: string) { return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r/g, "\\r").replace(/\n/g, "\\n")}"`; }
export function typstContent(value: string) { return value.replace(/([\\#\[\]*_@$<>`~\/=+^-])/g, "\\$1").replace(/^(\s*\d+)\./gm, "$1\\."); }
export function isResumeLayoutV2Enabled() { return process.env.NEXT_PUBLIC_RESUME_LAYOUT_V2 === "true"; }
export type LayoutProfile = "comfortable" | "balanced" | "compact";
export function renderResumeDocument(input: ResumeDocument, profile: LayoutProfile = "comfortable", links: InlineLink[] = []) {
  const doc = ResumeDocumentSchema.parse(input);
  const inline = createInlineRenderer(links, doc.source);
  const spacing = {
    comfortable: { margin: "(x: 0.65in, y: 0.6in)", size: "10.5pt", list: "0.45em", section: "0.4em", sectionTop: "0.35em", row: "3.75pt", blockAbove: "0.35em", blockBelow: "0.15em" },
    balanced: { margin: "(x: 0.55in, y: 0.55in)", size: "10.5pt", list: "0.35em", section: "0.22em", sectionTop: "0.2em", row: "3.75pt", blockAbove: "0.35em", blockBelow: "0.15em" },
    compact: { margin: "(x: 0.5in, y: 0.5in)", size: "10pt", list: "0.35em", section: "0.12em", sectionTop: "0.1em", row: "3.75pt", blockAbove: "0.35em", blockBelow: "0.15em" },
  }[profile];
  const gap = { comfortable: "0.55em", balanced: "0.35em", compact: "0.35em" }[profile];
  const renderBlocks = (blocks: z.infer<typeof BlockSchema>[]) => {
    const out: string[] = [];
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      if (block.kind === "entry-title") {
        const fields: Record<string, typeof block> = { "entry-title": block };
        while (i + 1 < blocks.length && ["entry-role", "entry-location", "entry-date"].includes(blocks[i + 1].kind)) {
          const next = blocks[i + 1];
          if (fields[next.kind] !== undefined) break;
          i++; fields[next.kind] = next;
        }
        const field = (kind: string) => fields[kind] ? `[${inline.render(fields[kind].text, [], fields[kind].span.start)}]` : `[]`;
        out.push(`#entry(title: ${field("entry-title")}, role: ${field("entry-role")}, location: ${field("entry-location")}, date: ${field("entry-date")})`);
      } else if (block.kind === "name") out.push(`#align(center)[#text(size: 21pt, weight: "bold")[${inline.render(block.text)}]]`);
      else if (block.kind === "contact") {
        const contacts = [block];
        while (i + 1 < blocks.length && blocks[i + 1].kind === "contact") contacts.push(blocks[++i]);
        const seenContacts = new Set<string>();
        const items = contacts.flatMap((contact) => contact.text.split(/\s*[|\u2022\u00b7]\s*/).filter(Boolean).map((text) => {
          const matching = links.filter((link) => {
            if (link.label === text || link.url === text) return true;
            try {
              const url = new URL(link.url);
              return ["http:", "https:"].includes(url.protocol) && `${url.host}${url.pathname}${url.search}${url.hash}`.replace(/\/$/, "") === text.replace(/\/$/, "");
            } catch { return false; }
          });
          const candidate = matching.length === 1 ? matching[0].url : /^(?:https?:\/\/|mailto:)/i.test(text) ? text : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text) ? `mailto:${text}` : /^(?:linkedin\.com\/in\/|github\.com\/|gitlab\.com\/)/i.test(text) ? `https://${text}` : null;
          let key: string | null = null;
          if (candidate) try { key = new URL(candidate).href.replace(/\/$/, ""); } catch { /* Preserve unrecognized text. */ }
          if (key && seenContacts.has(key)) return "";
          if (key) seenContacts.add(key);
          const rendered = inline.render(text);
          return text.length <= 45 ? `#box[${rendered}]` : rendered;
        })).filter(Boolean);
        out.push(`#align(center)[#text(size: 10pt)[${items.join(" #sym.dot ")}]]`);
      }
      else if (block.kind === "skill") {
        const text = block.text.replace(/\s*\r?\n\s*/g, " ");
        const colon = text.indexOf(":");
        const content = colon > 0
          ? `#strong[${inline.render(text.slice(0, colon + 1))}]${inline.render(text.slice(colon + 1))}`
          : inline.render(text);
        out.push(`#block(above: ${spacing.blockAbove}, below: ${spacing.blockBelow})[${content}]`);
      }
      else if (block.kind === "bullet") {
        const prefix = block.text.match(/^\s*[-–—•*▪|]\s+/)?.[0].length || 0;
        out.push(`- ${inline.render(block.text.slice(prefix), [], block.span.start + prefix).replace(/\s*\r?\n\s*/g, " ")}`);
      }
      else out.push(`#block(above: ${spacing.blockAbove}, below: ${spacing.blockBelow})[${inline.render(block.text, [], block.span.start)}]`);
    }
    return out.join("\n");
  };
  const header = renderBlocks(doc.header);
  const sections = doc.sections.map((s) => `#section(${typstString(s.heading.text)})\n${renderBlocks(s.blocks)}`).join("\n");
  const unresolved = inline.renderRemaining();

  const canonicalLinks = links.map(({ url, label, page, span }) => ({ url, label, page, span }));
  const metadata = btoa(Array.from(new TextEncoder().encode(JSON.stringify({ document: doc, links: canonicalLinks })), (byte) => String.fromCharCode(byte)).join(""));
  const linksMetadata = btoa(Array.from(new TextEncoder().encode(JSON.stringify(canonicalLinks)), (byte) => String.fromCharCode(byte)).join(""));
  return `// ResumeForge layout v2\n// profile: ${profile}\n// renderer-revision: 2\n${doc.issues.length || inline.issues.length || unresolved.length ? "// @layout-v2-review-required\n" : ""}${unresolved.length ? "// @layout-v2-link-placement-required\n" : ""}#set page(paper: ${typstString(doc.paper)}, margin: ${spacing.margin})\n#set text(font: "Libertinus Serif", size: ${spacing.size})\n#set par(leading: ${gap})\n#set list(marker: [•], indent: 0.2em, body-indent: 0.5em, spacing: ${spacing.list})\n#let section(title) = block(sticky: true, below: ${spacing.section})[#v(${spacing.sectionTop})#text(size: 11pt, weight: "bold")[#title]\n#line(length: 100%, stroke: 0.5pt + rgb("#777777"))]\n#let entry(title: [], role: [], location: [], date: []) = block(sticky: true, breakable: false)[#grid(columns: (1fr, auto), row-gutter: ${spacing.row}, [#strong(title)], [#align(right)[#location]], ..(if role != [] or date != [] { ([#emph(role)], [#align(right)[#date]]) } else { () }))]\n${header}\n${sections}\n// @resume-links-v2 ${linksMetadata}\n// @resume-document-v2 ${metadata}\n`;
}
export interface LayoutMeasurement {
  source: string;
  pages: number;
}

/** The measured source and explicit decisions are invalidated by any edit. */
export function assertLayoutExportReady(source: string, measurement?: LayoutMeasurement | null, twoPageApproval?: string | null, reviewApproval?: string | null) {
  if (!source.includes("// ResumeForge layout v2")) return;
  if (!measurement || measurement.source !== source || !Number.isInteger(measurement.pages) || measurement.pages < 1) throw new Error("Wait for the current document to compile and measure before export.");
  if (source.includes("// @layout-v2-link-placement-required")) throw new Error("Place the unresolved PDF links in Visual Form before final export.");
  if (source.includes("// @layout-v2-review-required") && reviewApproval !== source) throw new Error("Review the unclassified imported content before final export.");
  if (measurement.pages > 2) throw new Error("This resume exceeds two pages. Review content before export.");
  if (measurement.pages === 2 && twoPageApproval !== source) throw new Error("Choose Use two pages before exporting this document.");
}

/** Reparse managed source only if metadata regenerates the current visible source exactly.
 * This invalidates metadata immediately after any direct or patch edit. */
export function parseManagedResume(source: string): { document: ResumeDocument; profile: LayoutProfile; links: InlineLink[]; prefix: string } | null {
  const marker = source.indexOf("// ResumeForge layout v2\n");
  if (marker < 0) return null;
  const prefix = source.slice(0, marker);
  if (prefix.split(/\r?\n/).some((line) => line.trim() && !line.trim().startsWith("//"))) return null;
  const managed = source.slice(marker);
  const metadata = managed.match(/^\/\/ @resume-document-v2 (.+)$/m);
  const profile = managed.match(/^\/\/ profile: (comfortable|balanced|compact)$/m)?.[1] as LayoutProfile | undefined;
  if (!metadata || !profile) return null;
  try {
    const raw = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(metadata[1]), (char) => char.charCodeAt(0))));
    const parsed = z.object({ document: ResumeDocumentSchema, links: z.array(z.object({ url: z.string(), label: z.string().optional(), page: z.number().optional(), span: SourceSpanSchema.optional() }).strict()) }).strict().parse(raw);
    // Preserve the serialized property order when checking exact canonical regeneration.
    parsed.links = raw.links;
    if (renderResumeDocument(parsed.document, profile, parsed.links) !== managed && renderLegacyResumeDocument(parsed.document, profile, parsed.links) !== managed && renderPreviousResumeDocument(parsed.document, profile, parsed.links) !== managed) return null;
    return { ...parsed, profile, prefix };
  } catch { return null; }
}

/** Replaces one exact source span and shifts every following span, without touching other text. */
export function updateResumeBlock(doc: ResumeDocument, target: { start: number; end: number }, text: string): ResumeDocument {
  const validated = ResumeDocumentSchema.parse(doc);
  if (!text) throw new Error("A source block cannot be empty.");
  const copy = structuredClone(validated);
  const blocks = [...copy.header, ...copy.sections.flatMap((section) => [section.heading, ...section.blocks])];
  const match = blocks.find((block) => block.span.start === target.start && block.span.end === target.end);
  if (!match) throw new Error("Source block no longer exists.");
  const delta = text.length - (target.end - target.start);
  copy.source = copy.source.slice(0, target.start) + text + copy.source.slice(target.end);
  match.text = text;
  match.span.end = target.start + text.length;
  for (const block of blocks) if (block !== match && block.span.start >= target.end) { block.span.start += delta; block.span.end += delta; }
  return ResumeDocumentSchema.parse(copy);
}
