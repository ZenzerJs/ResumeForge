import { parseManagedResume } from "@/lib/typst/resume-document";
import { z } from "zod";

export interface ExportResumeSections {
  candidateName: string;
  contactLine: string;
  sections: { title: string; lines: string[] }[];
}

/** Parse the renderer's visible output, never its stale metadata, after direct edits. */
function visibleManagedExport(source: string): { text: string; sections: ExportResumeSections } {
  const lines = source.split(/\r?\n/);
  const entryDefinition = lines.findIndex((line) => line.startsWith('#let entry(title:'));
  if (entryDefinition < 0) throw new Error("Cannot export this edited managed resume: its layout is not recognized.");
  const sections: ExportResumeSections = { candidateName: "Candidate Resume", contactLine: "", sections: [] };
  const header: string[] = [];
  const renderedDestinations = new Set<string>();
  let current: ExportResumeSections["sections"][number] | undefined;
  const stringToken = '"(?:\\\\.|[^"\\\\])*"';
  const sectionPattern = new RegExp(`^#section\\((${stringToken})\\)$`);
  const entryPattern = new RegExp(`^#entry\\(title: (${stringToken}), role: (${stringToken}), location: (${stringToken}), date: (${stringToken})\\)$`);
  const closingBracket = (input: string, start: number): number => {
    let depth = 1;
    for (let i = start; i < input.length; i++) {
      if (input[i] === "\\") { i++; continue; }
      if (input[i] === "[") depth++;
      else if (input[i] === "]" && --depth === 0) return i;
    }
    throw new Error("Cannot export incomplete content in the edited resume.");
  };
  const decodeInline = (input: string): string => {
    let result = "";
    for (let i = 0; i < input.length;) {
      if (input[i] === "\\" && i + 1 < input.length) { result += input[i + 1]; i += 2; continue; }
      if (input.startsWith('#link(', i)) {
        const rest = input.slice(i);
        const match = rest.match(/^#link\(("(?:\\.|[^"\\])*")\)\[/);
        if (!match) throw new Error("Cannot export an unsupported link in the edited resume.");
        const end = closingBracket(rest, match[0].length);
        const label = decodeInline(rest.slice(match[0].length, end));
        const url = JSON.parse(match[1]) as string;
        renderedDestinations.add(url);
        result += label === url ? label : `${label} (${url})`;
        i += end + 1; continue;
      }
      const block = /^#block\(above: \d+(?:\.\d+)?(?:pt|em), below: \d+(?:\.\d+)?(?:pt|em)\)\[/.test(input.slice(i));
      if (input.startsWith('#strong[', i) || input.startsWith('#emph[', i) || input.startsWith('#box[', i) || block) {
        const start = input.indexOf("[", i) + 1;
        const end = closingBracket(input, start);
        result += decodeInline(input.slice(start, end)); i = end + 1; continue;
      }
      if (input.startsWith("#sym.dot", i)) { result += "•"; i += "#sym.dot".length; continue; }
      if (input[i] === "#" || input[i] === "[" || input[i] === "]") throw new Error("Cannot export unsupported Typst in the edited resume.");
      if (input[i] !== "*" && input[i] !== "_") result += input[i];
      i++;
    }
    return result;
  };
  for (const raw of lines.slice(entryDefinition + 1)) {
    const line = raw.trim();
    if (!line || line.startsWith("//")) continue;
    const heading = line.match(sectionPattern);
    if (heading) { current = { title: JSON.parse(heading[1]), lines: [] }; sections.sections.push(current); continue; }
    const entry = line.match(entryPattern);
    if (entry) {
      if (!current) throw new Error("Cannot export an entry outside a section in the edited resume.");
      current.lines.push([entry[1], entry[3], entry[2], entry[4]].map((field) => JSON.parse(field) as string).filter(Boolean).join(" | "));
      continue;
    }
    if (line.startsWith("#entry(title: [")) {
      const fields: string[] = [];
      let rest = line.slice("#entry(".length);
      for (const key of ["title", "role", "location", "date"]) {
        const prefix = `${key}: [`;
        if (!rest.startsWith(prefix)) throw new Error("Cannot export an unsupported entry in the edited resume.");
        const end = closingBracket(rest, prefix.length);
        fields.push(decodeInline(rest.slice(prefix.length, end)));
        rest = rest.slice(end + 1);
        if (key !== "date") {
          if (!rest.startsWith(", ")) throw new Error("Cannot export an unsupported entry in the edited resume.");
          rest = rest.slice(2);
        }
      }
      if (rest !== ")" || !current) throw new Error("Cannot export an unsupported entry in the edited resume.");
      current.lines.push([fields[0], fields[2], fields[1], fields[3]].filter(Boolean).join(" | "));
      continue;
    }
    const name = line.match(/^#align\(center\)\[#text\(size: 21pt, weight: "bold"\)\[(.*)\]\]$/);
    const contact = line.match(/^#align\(center\)\[#text\(size: 10pt\)\[(.*)\]\]$/);
    if (name) { sections.candidateName = decodeInline(name[1]); continue; }
    if (contact) { header.push(decodeInline(contact[1])); continue; }
    const content = decodeInline(line);
    if (current) current.lines.push(content); else header.push(content);
  }
  // This independent source comment contains link destinations only. Never recover
  // candidate text from stale document metadata after a patch or code edit.
  const linkComments = [...source.matchAll(/^\/\/ @resume-links-v2 ([A-Za-z0-9+/=]+)$/gm)];
  if (source.includes("// @resume-links-v2 ")) {
    if (linkComments.length !== 1) throw new Error("Cannot export malformed PDF link data in the edited resume.");
    const links = z.array(z.object({
      url: z.string().refine((value) => { try { return ["http:", "https:", "mailto:"].includes(new URL(value).protocol); } catch { return false; } }),
      label: z.string().optional(), page: z.number().int().positive().optional(),
      span: z.object({ start: z.number().int().nonnegative(), end: z.number().int().nonnegative() }).strict().optional(),
    }).strict()).parse(JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(linkComments[0][1]), (char) => char.charCodeAt(0)))));
    for (const link of links) {
      if (renderedDestinations.has(link.url)) continue;
      renderedDestinations.add(link.url);
      header.push(link.label ? `${link.label}: ${link.url}` : link.url);
    }
  }
  sections.contactLine = header.join(" | ");
  const text = [sections.candidateName, sections.contactLine, ...sections.sections.flatMap((section) => [section.title, ...section.lines])].filter(Boolean).join("\n");
  return { text, sections };
}

/** Use embedded data only after it exactly regenerates the current managed source. */
export function managedResumeExport(source: string): { text: string; sections: ExportResumeSections } | null {
  const managed = parseManagedResume(source);
  if (!managed) return source.includes("// ResumeForge layout v2") ? visibleManagedExport(source) : null;
  const { document, links } = managed;
  const name = document.header.find((block) => block.kind === "name");
  const header = document.header.filter((block) => block !== name).map((block) => block.text.trim()).filter(Boolean);
  const seen = new Set<string>();
  const extraLinks = links.filter((link) => {
    const key = link.url.toLowerCase();
    if (seen.has(key) || document.source.includes(link.url)) return false;
    seen.add(key);
    return true;
  }).map((link) => link.label && !document.source.includes(link.label) ? `${link.label}: ${link.url}` : link.url);
  const sections: ExportResumeSections = {
    candidateName: name?.text.trim() || "Candidate Resume",
    contactLine: [...header, ...extraLinks].join(" | "),
    sections: document.sections.map((section) => ({ title: section.heading.text.trim(), lines: section.blocks.map((block) => block.text.trim()).filter(Boolean) })),
  };
  const textFor = (blocks: typeof document.header) => {
    let result = "";
    let previousEnd: number | undefined;
    for (const block of blocks) {
      const gap = previousEnd === undefined ? "" : document.source.slice(previousEnd, block.span.start);
      result += previousEnd === undefined ? "" : /^\s*$/.test(gap) ? gap : "\n";
      result += block.text;
      previousEnd = block.span.end;
    }
    return result.trim();
  };
  const parts = [textFor(document.header), ...document.sections.map((section) => textFor([section.heading, ...section.blocks])), ...extraLinks];
  return { text: parts.filter(Boolean).join("\n"), sections };
}
