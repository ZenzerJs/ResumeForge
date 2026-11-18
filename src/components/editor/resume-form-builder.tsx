"use client";

import React, { useState, useEffect, useId, useRef, useCallback } from "react";
import { buildResumeDocument, typstContent, typstString, type ResumeAssignment } from "@/lib/typst/resume-document";
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
} from "lucide-react";

export interface ResumeEntryItem {
  id: string;
  title: string;
  role: string;
  location: string;
  date: string;
  bullets: string[];
}

export interface ResumeSkillGroup {
  id: string;
  category: string;
  items: string;
}

export interface StructuredResumeModel {
  fontSize: "8.5pt" | "9pt" | "9.5pt" | "10pt" | "10.5pt";
  marginPreset: "compact" | "balanced" | "spacious";
  fullName: string;
  location: string;
  email: string;
  phone: string;
  github: string;
  linkedin: string;
  summary: string;
  experience: ResumeEntryItem[];
  education: ResumeEntryItem[];
  projects: ResumeEntryItem[];
  skills: ResumeSkillGroup[];
}

function decodeTypstContent(value: string): string {
  return value.replace(/\\([\\#\[\]*_@$<>`~\/=+^.-])/g, "$1");
}

function unescapeTypstString(value: string): string {
  return value
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");
}

interface TypstCallMatch {
  fnName: string;
  argsBody: string;
  start: number;
  end: number;
}

function extractBalancedCallArgs(source: string, fnNames: string[]): TypstCallMatch[] {
  const results: TypstCallMatch[] = [];
  const namePattern = fnNames.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const regex = new RegExp(`#(${namePattern})\\s*\\(`, "g");
  let match: RegExpExecArray | null;

  while ((match = regex.exec(source)) !== null) {
    const start = match.index;
    const openParenIdx = source.indexOf("(", start);
    if (openParenIdx === -1) continue;

    // Skip matches inside line comments
    const lineStart = source.lastIndexOf("\n", start) + 1;
    const linePrefix = source.slice(lineStart, start);
    if (linePrefix.includes("//")) continue;

    let i = openParenIdx + 1;
    let parenDepth = 1;
    let bracketDepth = 0;
    let inString = false;
    let escaped = false;

    while (i < source.length && parenDepth > 0) {
      const ch = source[i];
      if (escaped) {
        escaped = false;
        i++;
        continue;
      }
      if (inString) {
        if (ch === "\\") {
          escaped = true;
        } else if (ch === '"') {
          inString = false;
        }
        i++;
        continue;
      }
      if (ch === '"') {
        inString = true;
      } else if (ch === "[") {
        bracketDepth++;
      } else if (ch === "]") {
        if (bracketDepth > 0) bracketDepth--;
      } else if (ch === "(" && bracketDepth === 0) {
        parenDepth++;
      } else if (ch === ")" && bracketDepth === 0) {
        parenDepth--;
        if (parenDepth === 0) break;
      }
      i++;
    }

    if (parenDepth === 0) {
      results.push({
        fnName: match[1],
        argsBody: source.slice(openParenIdx + 1, i),
        start,
        end: i + 1,
      });
      regex.lastIndex = i + 1;
    }
  }

  return results;
}

interface ParsedTypstArg {
  raw: string;
  kind: "string" | "block" | "bare";
  value: string;
}

function parseNamedTypstArgs(argsBody: string): Record<string, ParsedTypstArg> {
  const args: Record<string, ParsedTypstArg> = {};
  let i = 0;
  const len = argsBody.length;

  while (i < len) {
    while (i < len && /[\s,]/.test(argsBody[i])) i++;
    if (i >= len) break;

    if (argsBody.slice(i, i + 2) === "//") {
      const nl = argsBody.indexOf("\n", i);
      i = nl === -1 ? len : nl + 1;
      continue;
    }

    const keyMatch = argsBody.slice(i).match(/^([a-zA-Z_][a-zA-Z0-9_-]*)\s*:/);
    if (!keyMatch) {
      i++;
      continue;
    }

    const key = keyMatch[1];
    i += keyMatch[0].length;
    while (i < len && /\s/.test(argsBody[i])) i++;
    if (i >= len) break;

    const startCh = argsBody[i];
    if (startCh === '"') {
      const valStart = i + 1;
      i++;
      let escaped = false;
      while (i < len) {
        const ch = argsBody[i];
        if (escaped) {
          escaped = false;
        } else if (ch === "\\") {
          escaped = true;
        } else if (ch === '"') {
          break;
        }
        i++;
      }
      const raw = argsBody.slice(valStart, i);
      if (i < len && argsBody[i] === '"') i++;
      args[key] = { raw, kind: "string", value: unescapeTypstString(raw) };
    } else if (startCh === "[") {
      const valStart = i + 1;
      i++;
      let depth = 1;
      let inStr = false;
      let escaped = false;
      while (i < len && depth > 0) {
        const ch = argsBody[i];
        if (escaped) {
          escaped = false;
        } else if (inStr) {
          if (ch === "\\") escaped = true;
          else if (ch === '"') inStr = false;
        } else if (ch === '"') {
          inStr = true;
        } else if (ch === "[") {
          depth++;
        } else if (ch === "]") {
          depth--;
          if (depth === 0) break;
        }
        i++;
      }
      const raw = argsBody.slice(valStart, i);
      if (i < len && argsBody[i] === "]") i++;
      args[key] = { raw, kind: "block", value: decodeTypstContent(raw.trim()) };
    } else {
      const valStart = i;
      let depth = 0;
      let inStr = false;
      let escaped = false;
      while (i < len) {
        const ch = argsBody[i];
        if (escaped) {
          escaped = false;
        } else if (inStr) {
          if (ch === "\\") escaped = true;
          else if (ch === '"') inStr = false;
        } else if (ch === '"') {
          inStr = true;
        } else if (ch === "(" || ch === "[") {
          depth++;
        } else if (ch === ")" || ch === "]") {
          if (depth > 0) depth--;
        } else if (ch === "," && depth === 0) {
          break;
        }
        i++;
      }
      const raw = argsBody.slice(valStart, i).trim();
      args[key] = { raw, kind: "bare", value: raw === "none" ? "" : decodeTypstContent(raw) };
    }
  }

  return args;
}

function formatProjectLinks(linksArg?: ParsedTypstArg): string {
  if (!linksArg) return "";
  const raw = linksArg.raw.trim();
  if (!raw || raw === "none") return "";
  const linkMatches = Array.from(raw.matchAll(/#link\(\s*"((?:[^"\\]|\\.)*)"\s*\)\[([^\]]*)\]/g));
  if (linkMatches.length > 0) {
    return linkMatches
      .map((m) => {
        const url = unescapeTypstString(m[1]);
        const label = decodeTypstContent(m[2].trim());
        if (!label || label === url || url.endsWith(label)) return url;
        return `${label}: ${url}`;
      })
      .join(" | ");
  }
  return decodeTypstContent(raw);
}

function extractBulletsFromDetails(detailsRaw: string): string[] {
  const lines = detailsRaw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const bulletLines = lines.filter((l) => l.startsWith("- "));
  if (bulletLines.length > 0) {
    return bulletLines.map((l) => decodeTypstContent(l.replace(/^-\s+/, "").trim()));
  }
  return lines
    .filter((l) => !l.startsWith("//"))
    .map((l) => decodeTypstContent(l));
}

function makeId(prefix: string, idx: number): string {
  return `${prefix}-${idx}-${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Parse a Typst resume string into a StructuredResumeModel so non-technical users
 * can edit Contact, Summary, Experience, Education, Projects, Skills, and Formatting
 * via standard form inputs.
 */
export function parseTypstToStructuredModel(source: string): StructuredResumeModel {
  const sizeMatch = source.match(/size:\s*(8\.5pt|9pt|9\.5pt|10pt|10\.5pt)/);
  const fontSize = (sizeMatch?.[1] as StructuredResumeModel["fontSize"]) || "9pt";

  let marginPreset: StructuredResumeModel["marginPreset"] = "balanced";
  if (source.includes("x: 1cm") || source.includes("x: 1.0cm") || source.includes("0.4in")) {
    marginPreset = "compact";
  } else if (source.includes("x: 1.5cm") || source.includes("0.6in")) {
    marginPreset = "spacious";
  }

  const headerStart = source.indexOf("// HEADER");
  const headerSearchOffset = headerStart >= 0 ? headerStart : 0;
  const firstSectionMatch = source
    .slice(headerSearchOffset)
    .match(/(?:\/\/\s*(?:SUMMARY|EXPERIENCE|EDUCATION|PROJECTS|SKILLS)\b|#section\(|^==\s)/m);
  const headerBlock =
    firstSectionMatch?.index !== undefined
      ? source.slice(headerSearchOffset, headerSearchOffset + firstSectionMatch.index)
      : source.slice(headerSearchOffset);

  // Name extraction — use balanced call parsing so nested rgb(...) inside #text(...) works
  // without spanning across #show heading rules
  let fullName = "";
  const textCalls = extractBalancedCallArgs(headerBlock, ["text"]);
  for (const call of textCalls) {
    if (!/size:\s*(?:1[4-9]|2[0-9])pt\b/.test(call.argsBody)) continue;
    const afterParen = headerBlock.slice(call.end);
    const wsMatch = afterParen.match(/^\s*/);
    const bracketOffset = call.end + (wsMatch ? wsMatch[0].length : 0);
    if (headerBlock[bracketOffset] !== "[") continue;
    let depth = 1;
    let idx = bracketOffset + 1;
    while (idx < headerBlock.length && depth > 0) {
      if (headerBlock[idx] === "\\") {
        idx += 2;
        continue;
      }
      if (headerBlock[idx] === "[") depth++;
      else if (headerBlock[idx] === "]") depth--;
      if (depth === 0) break;
      idx++;
    }
    if (depth === 0) {
      fullName = decodeTypstContent(headerBlock.slice(bracketOffset + 1, idx).trim());
      break;
    }
  }
  if (!fullName) {
    const headingMatch = headerBlock.match(/^=\s+(.+)$/m);
    if (headingMatch?.[1]) {
      fullName = decodeTypstContent(headingMatch[1].trim());
    }
  }

  const emailMatch = headerBlock.match(/mailto:([^\s"\]]+)/) || headerBlock.match(/([\w.+-]+@[\w-]+\.[\w.-]+)/);
  const email = emailMatch?.[1]?.replace(/\\@/g, "@") || "";

  const githubMatch = headerBlock.match(/github\.com\/([A-Za-z0-9_.-]+)/i);
  const github = githubMatch?.[1] ? `github.com/${githubMatch[1]}` : "";

  const linkedinMatch = headerBlock.match(/linkedin\.com\/in\/([A-Za-z0-9_.-]+)/i);
  const linkedin = linkedinMatch?.[1] ? `linkedin.com/in/${linkedinMatch[1]}` : "";

  let location = "";
  let phone = "";
  const contactLineMatch =
    headerBlock.match(/#text\([^\n]*?size:\s*9pt[^\n]*?\)\[\r?\n([\s\S]*?)\r?\n\s*\]/) ||
    headerBlock.match(/#text\([^\n]*?size:\s*9pt[^\n]*?\)\[([^\r\n]*)\]/);
  if (contactLineMatch?.[1]) {
    const contactParts = contactLineMatch[1]
      .split(/\s*#sym\.dot\s*/)
      .map((part) => part.trim())
      .filter(Boolean);
    for (const part of contactParts) {
      if (part.startsWith("#link(")) continue;
      const isPhonePart =
        part.replace(/\D/g, "").length >= 7 &&
        /^(?:\\?\+?\s*[\d(][\d\s().\\-]{5,}\d)$/.test(part);
      if (!phone && isPhonePart) {
        phone = decodeTypstContent(part);
      } else if (!location && !part.includes("#")) {
        location = decodeTypstContent(part);
      }
    }
  } else {
    const phoneMatch =
      headerBlock.match(/#sym\.dot\s*(\\?\+?[\d\s().\\-]{7,25})\s*#sym\.dot/) ||
      headerBlock.match(/(\\?\+?\d[\d\s().\\-]{7,}\d)/);
    phone = decodeTypstContent(phoneMatch?.[1]?.trim() || "");

    const locMatch =
      headerBlock.match(/#text\([^\n]*?size:\s*9pt[^\n]*?\)\[\s*([^#\n]+?)\s*#sym\.dot/) ||
      headerBlock.match(/\[\s*([^#\n\[\]]+?)\s*#sym\.dot/);
    if (locMatch?.[1]) {
      location = decodeTypstContent(locMatch[1].trim());
    }
  }

  // Helper to parse #entry, #resume-entry, #project-entry, or bold-pair entries
  const parseEntriesInBlock = (block: string, prefix: string): ResumeEntryItem[] => {
    const items: ResumeEntryItem[] = [];
    const calls = extractBalancedCallArgs(block, ["entry", "resume-entry", "project-entry"]);
    let idx = 0;

    for (const call of calls) {
      const args = parseNamedTypstArgs(call.argsBody);
      const title = args.title?.value ?? "";
      const role =
        call.fnName === "project-entry"
          ? args.stack?.value || args.role?.value || ""
          : args.role?.value || args.subtitle?.value || "";
      const loc =
        call.fnName === "project-entry"
          ? args.location?.value || formatProjectLinks(args.links)
          : args.location?.value ?? "";
      const date = args.date?.value ?? "";
      const detailsRaw = args.details?.raw ?? "";
      const bullets = extractBulletsFromDetails(detailsRaw);

      if (title || role || loc || date || bullets.length > 0) {
        items.push({
          id: makeId(prefix, idx++),
          title,
          role,
          location: loc,
          date,
          bullets: bullets.length > 0 ? bullets : [""],
        });
      }
    }

    if (items.length === 0) {
      const lines = block.split("\n");
      let current: ResumeEntryItem | null = null;
      for (const rawLine of lines) {
        const line = rawLine.trim();
        const boldPair = line.match(/^\*([^*]+)\*\s*(?:--|—|-)\s*\*([^*]+)\*(?:\s*\(([^)]+)\))?/);
        if (boldPair) {
          if (current) items.push(current);
          current = {
            id: makeId(prefix, idx++),
            title: boldPair[1].trim(),
            role: boldPair[2].trim(),
            location: "",
            date: boldPair[3]?.trim() || "",
            bullets: [],
          };
          continue;
        }
        if (current && line.startsWith("- ")) {
          current.bullets.push(decodeTypstContent(line.replace(/^-\s+/, "").trim()));
        }
      }
      if (current) {
        if (current.bullets.length === 0) current.bullets.push("");
        items.push(current);
      }
    }

    return items;
  };

  const parseSkillLineText = (clean: string, sIdx: number): ResumeSkillGroup => {
    const catMatch =
      clean.match(/^\*([^*]+)\*:\s*(.*)$/) ||
      clean.match(/^\*([^*:]+):?\*\s*(.*)$/) ||
      clean.match(/^([^:]+):\s*(.*)$/);
    if (catMatch) {
      return {
        id: makeId("skill", sIdx),
        category: decodeTypstContent(catMatch[1].replace(/^\*+|\*+$/g, "").replace(/:$/, "").trim()),
        items: decodeTypstContent(catMatch[2].trim()),
      };
    }
    return {
      id: makeId("skill", sIdx),
      category: "",
      items: decodeTypstContent(clean),
    };
  };

  // Locate sections
  const sectionSplits = source.split(/#section\("([^"]+)"\)|^==\s+(.+)$/gm);
  let summary = "";
  let experience: ResumeEntryItem[] = [];
  let education: ResumeEntryItem[] = [];
  let projects: ResumeEntryItem[] = [];
  let skills: ResumeSkillGroup[] = [];

  for (let i = 1; i < sectionSplits.length; i += 3) {
    const secName = decodeTypstContent(sectionSplits[i] || sectionSplits[i + 1] || "")
      .trim()
      .toLowerCase();
    const secContent = sectionSplits[i + 2] || "";

    if (secName.includes("summary") || secName.includes("profile")) {
      summary = decodeTypstContent(
        secContent
          .replace(/\/\/.*$/gm, "")
          .trim()
      );
    } else if (secName.includes("experience") || secName.includes("work")) {
      experience = parseEntriesInBlock(secContent, "exp");
    } else if (secName.includes("education")) {
      education = parseEntriesInBlock(secContent, "edu");
    } else if (secName.includes("project")) {
      projects = parseEntriesInBlock(secContent, "proj");
    } else if (secName.includes("skill")) {
      const skillCalls = extractBalancedCallArgs(secContent, ["skill-line"]);
      if (skillCalls.length > 0) {
        skills = skillCalls
          .map((call, sIdx) => {
            const args = parseNamedTypstArgs(call.argsBody);
            return {
              id: makeId("skill", sIdx),
              category: (args.category?.value ?? "").trim(),
              items: (args.items?.value ?? "").trim(),
            };
          })
          .filter((s) => s.category || s.items);
      }

      const skillBulletLines = secContent
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.startsWith("- "));
      if (skillBulletLines.length > 0) {
        skills = [
          ...skills,
          ...skillBulletLines.map((line, sIdx) =>
            parseSkillLineText(line.replace(/^-\s+/, ""), skills.length + sIdx)
          ),
        ];
      }

      if (skills.length === 0) {
        const plainSkillLines = secContent
          .split("\n")
          .map((l) => l.trim())
          .filter(
            (l) =>
              Boolean(l) &&
              !l.startsWith("//") &&
              !l.startsWith("#") &&
              !l.startsWith("details:") &&
              l !== "[" &&
              l !== "]" &&
              l !== ")"
          );
        skills = plainSkillLines.map((line, sIdx) => parseSkillLineText(line, sIdx));
      }
    }
  }

  return {
    fontSize,
    marginPreset,
    fullName,
    location,
    email,
    phone,
    github,
    linkedin,
    summary,
    experience,
    education,
    projects,
    skills,
  };
}

function escapeTypstString(val: string): string {
  return val.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * Serialize a StructuredResumeModel back into clean, canonical Typst source code.
 */
export function serializeStructuredModelToTypst(model: StructuredResumeModel): string {
  const marginMap: Record<StructuredResumeModel["marginPreset"], string> = {
    compact: "(x: 1.0cm, y: 0.95cm)",
    balanced: "(x: 1.25cm, y: 1.1cm)",
    spacious: "(x: 1.5cm, y: 1.3cm)",
  };

  const escapedEmailDisplay = typstContent(model.email);
  const githubClean = model.github.replace(/^https?:\/\//, "");
  const linkedinClean = model.linkedin.replace(/^https?:\/\//, "");

  const renderEntryList = (entries: ResumeEntryItem[]) =>
    entries
      .map((entry) => {
        const bulletLines = entry.bullets
          .map((b) => b.trim())
          .filter(Boolean)
          .map((b) => `    - ${typstContent(b)}`)
          .join("\n");
        return `#entry(
  title: "${escapeTypstString(entry.title)}",
  role: "${escapeTypstString(entry.role)}",
  location: "${escapeTypstString(entry.location)}",
  date: "${escapeTypstString(entry.date)}",
  details: [
${bulletLines}
  ]
)`;
      })
      .join("\n\n");

  const skillLines = model.skills
    .filter((s) => s.category.trim() || s.items.trim())
    .map((s) => `    - *${typstContent(s.category.trim())}:* ${typstContent(s.items.trim())}`)
    .join("\n");

  const summaryBlock = model.summary.trim()
    ? `\n// SUMMARY\n#section("Summary")\n${typstContent(model.summary.trim())}\n`
    : "";

  return `// ResumeForge Canonical Resume Template (Typst)

#set page(
  paper: "us-letter",
  margin: ${marginMap[model.marginPreset]},
)

#set text(
  font: "Liberation Sans",
  size: ${model.fontSize},
  fill: rgb("#1c1e20"),
)

#set par(justify: true, leading: 0.48em)

#show link: set text(fill: rgb("#1155CC"))

#let section(title) = {
  v(0.4em)
  text(size: 10pt, weight: "bold", tracking: 0.05em, upper(title))
  v(-0.4em)
  line(length: 100%, stroke: 0.5pt + rgb("#9CA3AF"))
  v(0.15em)
}

#let entry(
  title: "",
  role: "",
  location: "",
  date: "",
  details: [],
) = {
  block(width: 100%, breakable: false)[
    #grid(
      columns: (1fr, auto),
      align: (left, right),
      [
        #if title != "" [*#title*]
        #if role != "" [
          #if title != "" [ | ]
          #emph(role)
        ]
      ],
      [
        #if location != "" [
          #location
          #if date != "" [ | ]
        ]
        #if date != "" [*#date*]
      ]
    )
    #v(-0.35em)
    #details
  ]
}

#set list(
  marker: [•],
  spacing: 0.4em,
  indent: 0em,
  body-indent: 0.4em,
)

// HEADER
#align(center)[
  #text(size: 18pt, weight: "bold", fill: rgb("#1c1e20"))[${typstContent(model.fullName)}] \\
  #v(2pt)
  #text(size: 9pt, fill: rgb("#475569"))[
    ${[model.location && typstContent(model.location), model.email && `#link(${typstString(`mailto:${model.email}`)})[${escapedEmailDisplay}]`, model.phone && typstContent(model.phone), githubClean && `#link(${typstString(`https://${githubClean}`)})[${typstContent(githubClean)}]`, linkedinClean && `#link(${typstString(`https://${linkedinClean}`)})[${typstContent(linkedinClean)}]`].filter(Boolean).join(" #sym.dot ")}
  ]
]
${summaryBlock}
// EXPERIENCE
#section("Experience")

${renderEntryList(model.experience)}

// EDUCATION
#section("Education")

${renderEntryList(model.education)}

// PROJECTS
#section("Projects")

${renderEntryList(model.projects)}

// SKILLS
#section("Skills")
#entry(
  details: [
${skillLines}
  ]
)
`;
}

/** Convert an already verified legacy form model to the source-backed layout. */
export function legacyFormToResumeDocument(model: StructuredResumeModel) {
  let source = "";
  const assignments: ResumeAssignment[] = [];
  const add = (kind: ResumeAssignment["kind"], text: string) => {
    if (!text.trim()) return;
    if (source) source += "\n";
    const start = source.length;
    source += text;
    assignments.push({ kind, span: { start, end: source.length } });
  };
  add("name", model.fullName);
  for (const contact of [model.location, model.email, model.phone, model.github, model.linkedin]) add("contact", contact);
  if (model.summary) { add("section", "Summary"); add("paragraph", model.summary); }
  for (const [title, entries] of [["Experience", model.experience], ["Education", model.education], ["Projects", model.projects]] as const) {
    if (!entries.length) continue;
    add("section", title);
    for (const entry of entries) {
      add("entry-title", entry.title); add("entry-role", entry.role); add("entry-location", entry.location); add("entry-date", entry.date);
      for (const bullet of entry.bullets) add("bullet", bullet);
    }
  }
  if (model.skills.length) {
    add("section", "Skills");
    for (const skill of model.skills) add("skill", [skill.category, skill.items].filter(Boolean).join(": "));
  }
  return buildResumeDocument(source, assignments);
}

interface ResumeFormBuilderProps {
  value: string;
  onChange: (newTypst: string) => void;
}

export function createBlankResumeTypst(): string {
  return serializeStructuredModelToTypst({
    fontSize: "9pt",
    marginPreset: "balanced",
    fullName: "",
    location: "",
    email: "",
    phone: "",
    github: "",
    linkedin: "",
    summary: "",
    experience: [],
    education: [],
    projects: [],
    skills: [],
  });
}

const ALLOWED_TEMPLATE_HELPERS = new Set([
  "section",
  "entry",
  "resume-entry",
  "project-entry",
  "skill-line",
]);

function stripMatchedRanges(text: string, ranges: Array<{ start: number; end: number }>): string {
  if (ranges.length === 0) return text;
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  let out = "";
  let cursor = 0;
  for (const r of sorted) {
    if (r.start > cursor) out += text.slice(cursor, r.start);
    if (r.end > cursor) cursor = r.end;
  }
  if (cursor < text.length) out += text.slice(cursor);
  return out;
}

export function isResumeSourceSafeForForm(source: string): boolean {
  if (!source || !source.trim()) return false;
  if (/^\s*\/\/\s*@resumeforge-patched:/m.test(source)) return false;
  if (source.includes("// ResumeForge layout v2")) return false;

  const normalizeForSafeCheck = (src: string) =>
    src
      .replace(
        /^\/\/ (?:Link styling matching LaTeX linkblue \(#1155CC\)|Section heading helper|Header\/entry helper for aligned roles & dates|Compact list styling)\r?\n/gm,
        ""
      )
      .replace(/rgb\("#111827"\)/gi, 'rgb("#1c1e20")')
      .replace(/\\([/+-])/g, "$1")
      .replace(/[ \t]+$/gm, "")
      .replace(/[ \t]+\]/g, "]")
      .replace(/\[[ \t]+/g, "[")
      .replace(/[ \t]+#sym\.dot[ \t]+/g, " #sym.dot ")
      .replace(/([^\\])[ \t]+"/g, '$1"')
      .trim();

  const parsed = parseTypstToStructuredModel(source);

  if (
    normalizeForSafeCheck(serializeStructuredModelToTypst(parsed)) ===
    normalizeForSafeCheck(source)
  ) {
    return true;
  }

  // Path 2: Structural safety check for AI-converted (pdf-prompt) & `== Section` resumes
  const letRegex = /(?:^|\n)\s*#let\s+([a-zA-Z_][a-zA-Z0-9_-]*)/g;
  let letMatch: RegExpExecArray | null;
  while ((letMatch = letRegex.exec(source)) !== null) {
    if (!ALLOWED_TEMPLATE_HELPERS.has(letMatch[1])) {
      return false;
    }
  }

  if (/#(?:table|image|figure|columns|include|import|footnote|cite|bibliography|outline|raw)\b/.test(source)) {
    return false;
  }

  const sectionSplits = source.split(/#section\("([^"]+)"\)|^==\s+(.+)$/gm);
  if (sectionSplits.length < 4) {
    return false;
  }

  if (!parsed.fullName.trim()) {
    return false;
  }

  let hasAnyContent = Boolean(parsed.summary.trim());

  for (let i = 1; i < sectionSplits.length; i += 3) {
    const rawName = decodeTypstContent(sectionSplits[i] || sectionSplits[i + 1] || "")
      .trim()
      .toLowerCase();
    const secContent = sectionSplits[i + 2] || "";
    const nonCommentContent = secContent.replace(/\/\/.*$/gm, "").trim();

    if (rawName.includes("summary") || rawName.includes("profile")) {
      if (/#(?:grid|entry|resume-entry|project-entry|skill-line)\s*\(/.test(nonCommentContent)) {
        return false;
      }
      continue;
    }

    if (
      rawName.includes("experience") ||
      rawName.includes("work") ||
      rawName.includes("education") ||
      rawName.includes("project")
    ) {
      if (/#grid\s*\(/.test(nonCommentContent)) return false;
      const calls = extractBalancedCallArgs(secContent, ["entry", "resume-entry", "project-entry"]);
      if (calls.length > 0) {
        const leftover = stripMatchedRanges(secContent, calls)
          .replace(/\/\/.*$/gm, "")
          .trim();
        if (leftover.length > 0) return false;
        hasAnyContent = true;
      } else if (nonCommentContent.length > 0) {
        const lines = nonCommentContent.split("\n").map((l) => l.trim()).filter(Boolean);
        let sawBoldPair = false;
        for (const line of lines) {
          if (/^\*([^*]+)\*\s*(?:--|—|-)\s*\*([^*]+)\*(?:\s*\(([^)]+)\))?/.test(line)) {
            sawBoldPair = true;
            continue;
          }
          if (sawBoldPair && line.startsWith("- ")) continue;
          return false;
        }
        if (sawBoldPair) hasAnyContent = true;
      }
      continue;
    }

    if (rawName.includes("skill")) {
      if (/#grid\s*\(/.test(nonCommentContent)) return false;
      const calls = extractBalancedCallArgs(secContent, ["skill-line", "entry"]);
      if (calls.length > 0) {
        const leftover = stripMatchedRanges(secContent, calls)
          .replace(/\/\/.*$/gm, "")
          .trim();
        if (leftover.length > 0) return false;
        hasAnyContent = true;
      } else if (nonCommentContent.length > 0) {
        if (parsed.skills.length === 0) return false;
        hasAnyContent = true;
      }
      continue;
    }

    // Unrecognized section would be dropped by StructuredResumeModel
    return false;
  }

  return (
    hasAnyContent &&
    (parsed.summary.length > 0 ||
      parsed.experience.length > 0 ||
      parsed.education.length > 0 ||
      parsed.projects.length > 0 ||
      parsed.skills.length > 0)
  );
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
    const nextList = model[listKey].map((item) => {
      if (item.id !== id) return item;
      const nextBullets = item.bullets.filter((_, idx) => idx !== bulletIdx);
      return { ...item, bullets: nextBullets.length > 0 ? nextBullets : [""] };
    });
    commitModel({ ...model, [listKey]: nextList });
  };

  const addEntry = (listKey: "experience" | "education" | "projects") => {
    const newItem: ResumeEntryItem = {
      id: makeId(listKey, model[listKey].length),
      title: "",
      role: "",
      location: "",
      date: "",
      bullets: [""],
    };
    commitModel({ ...model, [listKey]: [...model[listKey], newItem] });
  };

  const removeEntry = (listKey: "experience" | "education" | "projects", id: string) => {
    const nextList = model[listKey].filter((item) => item.id !== id);
    commitModel({ ...model, [listKey]: nextList });
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
                className={`flex shrink-0 items-center gap-1 whitespace-nowrap rounded px-2 py-1 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
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
                    type="text"
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
                    type="text"
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
                    type="email"
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
                    type="text"
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
                    type="text"
                    value={model.github}
                    onChange={(e) => commitModel({ ...model, github: e.target.value })}
                    className="w-full rounded border border-outline/70 bg-inset px-2.5 py-1.5 text-xs text-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  />
                </div>
                <div>
                  <label htmlFor={`${formId}-linkedin`} className="block text-xs font-mono text-text-muted mb-1">LinkedIn URL</label>
                  <input
                    id={`${formId}-linkedin`}
                    type="text"
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
                className="flex items-center gap-1 rounded bg-primary px-2.5 py-1 text-xs font-mono font-semibold text-primary-foreground hover:bg-primary/90 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Plus className="h-3.5 w-3.5" />
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
                      onClick={() => removeEntry(activeSection, entry.id)}
                      className="text-text-muted hover:text-status-danger transition p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                      title="Remove entry"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
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
                      type="text"
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
                      type="text"
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
                      type="text"
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
                      type="text"
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
                      <Plus className="h-3 w-3" /> Add Bullet
                    </button>
                  </div>
                  {entry.bullets.map((bullet, bIdx) => (
                    <div key={bIdx} className="flex items-start gap-2">
                      <span className="mt-2 text-xs text-primary">•</span>
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
                          onClick={() => removeEntryBullet(activeSection, entry.id, bIdx)}
                          className="mt-1.5 text-text-muted hover:text-status-danger p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                          title="Delete bullet"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
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
                        id: makeId("skill", model.skills.length),
                        category: "Additional Skills",
                        items: "",
                      },
                    ],
                  })
                }
                data-testid="add-skill-category-btn"
                className="flex items-center gap-1 rounded bg-primary px-2.5 py-1 text-xs font-mono font-semibold text-primary-foreground hover:bg-primary/90 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Plus className="h-3.5 w-3.5" />
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
                    type="text"
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
                    type="text"
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
                      onClick={() => {
                        const next = model.skills.filter((s) => s.id !== skill.id);
                        commitModel({ ...model, skills: next });
                      }}
                      className="text-text-muted hover:text-status-danger p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                      title="Remove skill category"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

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
