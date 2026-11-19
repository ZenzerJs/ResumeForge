import { parseManagedResume } from "@/lib/typst/resume-document";
import { z } from "zod";

export interface ExportResumeSections {
  candidateName: string;
  contactLine: string;
  sections: { title: string; lines: string[] }[];
}

/** Format a link for plaintext ATS export, returning a clean bare URL/email without noisy label wrapping. */
export function formatPlaintextLink(url: string, label?: string): string {
  const trimmedUrl = url.trim();
  const cleanUrl = trimmedUrl.replace(/^mailto:/i, "");
  if (cleanUrl) return cleanUrl;
  return label?.trim() ?? "";
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
        result += formatPlaintextLink(url, label);
        i += end + 1; continue;
      }
      const symMap: [string, string][] = [
        ["#sym.dot", "•"],
        ["#sym.bullet", "•"],
        ["#sym.dash.en", "–"],
        ["#sym.dash.em", "—"],
        ["#sym.arrow.r", "->"],
      ];
      const sym = symMap.find(([prefix]) => input.startsWith(prefix, i));
      if (sym) { result += sym[1]; i += sym[0].length; continue; }

      if (input.startsWith("#skill-line(", i)) {
        const openParen = i + "#skill-line".length;
        const closeParen = findBalancedEnd(input, openParen, "(", ")");
        if (closeParen < 0) throw new Error("Cannot export incomplete content in the edited resume.");
        const argsBody = input.slice(openParen + 1, closeParen);
        const categoryMatch = argsBody.match(/category\s*:\s*(?:"((?:\\.|[^"\\])*)"|\[([^\]]*)\])/);
        const itemsMatch = argsBody.match(/items\s*:\s*(?:"((?:\\.|[^"\\])*)"|\[([^\]]*)\])/);
        const category = categoryMatch ? (categoryMatch[1] !== undefined ? JSON.parse(`"${categoryMatch[1]}"`) : decodeInline(categoryMatch[2])) : "";
        const items = itemsMatch ? (itemsMatch[1] !== undefined ? JSON.parse(`"${itemsMatch[1]}"`) : decodeInline(itemsMatch[2])) : "";
        result += category && items ? `${category}: ${items}` : [category, items].filter(Boolean).join(" ");
        i = closeParen + 1; continue;
      }

      const spacingMatch = input.slice(i).match(/^#(?:v|h|line)\(/);
      if (spacingMatch) {
        const openParen = i + spacingMatch[0].length - 1;
        const closeParen = findBalancedEnd(input, openParen, "(", ")");
        if (closeParen < 0) throw new Error("Cannot export incomplete content in the edited resume.");
        i = closeParen + 1; continue;
      }

      const wrapperMatch = input.slice(i).match(/^#(block|strong|emph|box|text|align|pad|upper|lower)\b/);
      if (wrapperMatch) {
        let cursor = i + wrapperMatch[0].length;
        while (cursor < input.length && (input[cursor] === " " || input[cursor] === "\t")) cursor++;
        if (input[cursor] === "(") {
          const closeParen = findBalancedEnd(input, cursor, "(", ")");
          if (closeParen < 0) throw new Error("Cannot export incomplete content in the edited resume.");
          cursor = closeParen + 1;
          while (cursor < input.length && /\s/.test(input[cursor])) cursor++;
        }
        if (input[cursor] === "[") {
          const end = closingBracket(input, cursor + 1);
          result += decodeInline(input.slice(cursor + 1, end));
          i = end + 1; continue;
        }
      }

      if (input[i] === "#" || input[i] === "[" || input[i] === "]") throw new Error("Cannot export unsupported Typst in the edited resume.");
      if (input[i] !== "*" && input[i] !== "_") result += input[i];
      i++;
    }
    return result;
  };
  const logicalLines: string[] = [];
  let pending = "";
  let parenDepth = 0;
  let bracketDepth = 0;
  let inString = false;
  for (const raw of lines.slice(entryDefinition + 1)) {
    const trimmed = raw.trim();
    if (!pending && (!trimmed || trimmed.startsWith("//"))) continue;
    const segment = pending ? raw : trimmed;
    pending = pending ? `${pending}\n${raw}` : trimmed;
    for (let j = 0; j < segment.length; j++) {
      const ch = segment[j];
      if (ch === "\\" && j + 1 < segment.length) { j++; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === "(") parenDepth++;
      else if (ch === ")") parenDepth = Math.max(0, parenDepth - 1);
      else if (ch === "[") bracketDepth++;
      else if (ch === "]") bracketDepth = Math.max(0, bracketDepth - 1);
    }
    if (!inString && parenDepth === 0 && bracketDepth === 0) {
      logicalLines.push(pending.trim());
      pending = "";
    }
  }
  if (pending.trim()) logicalLines.push(pending.trim());

  for (const line of logicalLines) {
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
    const decodedLines = content.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (current) current.lines.push(...decodedLines); else header.push(...decodedLines);
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

const PLACEHOLDER_CANDIDATE_NAMES = new Set([
  "candidate",
  "candidate resume",
  "candidate name",
  "your name",
]);

function isValidExtractedCandidateName(candidate: string): boolean {
  const clean = candidate.replace(/\\+/g, "").trim();
  if (clean.length < 2 || clean.length > 60) return false;
  if (PLACEHOLDER_CANDIDATE_NAMES.has(clean.toLowerCase())) return false;
  if (/@|https?:\/\/|mailto:|\d{3}[-.)]\s*\d{3}|[|·•]/.test(clean)) return false;
  if (/^(experience|work history|education|projects|skills|technical skills|summary|certifications|awards)$/i.test(clean)) {
    return false;
  }
  return true;
}

function findBalancedEnd(source: string, openIdx: number, openCh: string, closeCh: string): number {
  let depth = 0;
  let inString = false;
  for (let i = openIdx; i < source.length; i++) {
    const ch = source[i];
    if (ch === "\\" && i + 1 < source.length) {
      i++;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === openCh) depth++;
    else if (ch === closeCh && --depth === 0) return i;
  }
  return -1;
}

function extractProminentTextCall(line: string): string | null {
  let idx = 0;
  while ((idx = line.indexOf("#text(", idx)) >= 0) {
    const openParen = idx + "#text".length;
    const closeParen = findBalancedEnd(line, openParen, "(", ")");
    if (closeParen < 0) break;
    const args = line.slice(openParen + 1, closeParen);
    const isProminent =
      /weight\s*:\s*"bold"/.test(args) || /size\s*:\s*(?:1[4-9]|[23]\d)pt/.test(args);
    let cursor = closeParen + 1;
    while (cursor < line.length && (line[cursor] === " " || line[cursor] === "\t")) cursor++;
    if (isProminent && line[cursor] === "[") {
      const closeBracket = findBalancedEnd(line, cursor, "[", "]");
      if (closeBracket > cursor) {
        return line.slice(cursor + 1, closeBracket);
      }
    }
    idx = closeParen + 1;
  }
  return null;
}

function stripInlineTypstForName(raw: string): string {
  return raw
    .replace(/#(?:strong|emph|box|upper|lower)\s*\[([^\]]*)\]/g, "$1")
    .replace(/#text\([^)]*\)\s*\[([^\]]*)\]/g, "$1")
    .replace(/[*_`\\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extracts the candidate's display name from a managed or unmanaged Typst resume source.
 * Returns null when only placeholders or non-name headings are present.
 */
export function extractCandidateNameFromTypst(typstSource?: string | null): string | null {
  if (!typstSource || !typstSource.trim()) return null;

  try {
    const managed = managedResumeExport(typstSource);
    if (managed?.sections.candidateName && isValidExtractedCandidateName(managed.sections.candidateName)) {
      return managed.sections.candidateName.trim();
    }
  } catch {
    // Fall through to unmanaged Typst header parsing
  }

  const lines = typstSource
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/(?<!:)\s+\/\/.*$/gm, "")
    .split(/\r?\n/);

  let inPreambleBlock = false;
  let preambleDepth = 0;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (inPreambleBlock) {
      for (const ch of line) {
        if (ch === "(" || ch === "[" || ch === "{") preambleDepth++;
        else if (ch === ")" || ch === "]" || ch === "}") preambleDepth = Math.max(0, preambleDepth - 1);
      }
      if (preambleDepth === 0) inPreambleBlock = false;
      continue;
    }

    if (/^#(let|set|show|import)\b/.test(line)) {
      for (const ch of line) {
        if (ch === "(" || ch === "[" || ch === "{") preambleDepth++;
        else if (ch === ")" || ch === "]" || ch === "}") preambleDepth = Math.max(0, preambleDepth - 1);
      }
      if (preambleDepth > 0) inPreambleBlock = true;
      continue;
    }

    const headerMacroMatch = line.match(/^#resume-header\b.*\bname\s*:\s*(?:"([^"]+)"|\[([^\]]+)\])/);
    if (headerMacroMatch) {
      const candidate = stripInlineTypstForName(headerMacroMatch[1] || headerMacroMatch[2] || "");
      if (isValidExtractedCandidateName(candidate)) return candidate;
    }

    const prominentText = extractProminentTextCall(line);
    if (prominentText) {
      const candidate = stripInlineTypstForName(prominentText);
      if (isValidExtractedCandidateName(candidate)) return candidate;
    }

    const h1Match = line.match(/^=\s+(.+)$/);
    if (h1Match) {
      const candidate = stripInlineTypstForName(h1Match[1]);
      if (isValidExtractedCandidateName(candidate)) return candidate;
    }

    const headingMatch = line.match(/^#heading(?:\([^)]*\))?\s*\[([^\]]+)\]$/);
    if (headingMatch) {
      const candidate = stripInlineTypstForName(headingMatch[1]);
      if (isValidExtractedCandidateName(candidate)) return candidate;
    }

    if (/^(==+|#(?:resume-)?section\b)/.test(line)) {
      break;
    }

    if (!line.startsWith("#")) {
      const candidate = stripInlineTypstForName(line);
      if (isValidExtractedCandidateName(candidate)) return candidate;
    }
  }

  return null;
}

/**
 * Replaces a trailing placeholder "Candidate" signature with the resolved candidate name.
 */
export function replacePlaceholderSignature(text: string, candidateName?: string | null): string {
  const cleanName = candidateName?.trim();
  if (!cleanName || PLACEHOLDER_CANDIDATE_NAMES.has(cleanName.toLowerCase())) return text;
  return text.replace(
    /((?:^|\n)[ \t]*(?:Sincerely|Best regards|Kind regards|Warm regards|Regards|Respectfully|Best|Warmly|Thank you|Yours truly),?[ \t]*\r?\n[ \t]*)(?:\[(?:Candidate(?:\s+Name)?|Your\s+Name)\]|Candidate(?:\s+Name)?|Your\s+Name)(?=[ \t]*(?:\r?\n|$))/gi,
    (_m, prefix: string) => `${prefix}${cleanName}`
  );
}
