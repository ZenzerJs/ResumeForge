// Compatible with both pdf-parse v1 function & pdf-parse v2 PDFParse class
import { normalizeSectionTitle, canonicalSectionRank } from "@/lib/typst/section-order";
import { safeDestination } from "@/lib/typst/inline-content";
import { typstContent, typstString } from "@/lib/typst/resume-document";

type Matrix2D = [number, number, number, number, number, number];

function readMatrixTuple(init?: string | number[]): Matrix2D {
  if (Array.isArray(init) && init.length >= 6) {
    return [
      Number(init[0]) || 0,
      Number(init[1]) || 0,
      Number(init[2]) || 0,
      Number(init[3]) || 0,
      Number(init[4]) || 0,
      Number(init[5]) || 0,
    ];
  }
  return [1, 0, 0, 1, 0, 0];
}

class ServerDOMMatrix {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;

  constructor(init?: string | number[]) {
    const [a, b, c, d, e, f] = readMatrixTuple(init);
    this.a = a;
    this.b = b;
    this.c = c;
    this.d = d;
    this.e = e;
    this.f = f;
  }

  get m11() { return this.a; }
  get m12() { return this.b; }
  get m21() { return this.c; }
  get m22() { return this.d; }
  get m41() { return this.e; }
  get m42() { return this.f; }
  get is2D() { return true; }
  get isIdentity() {
    return this.a === 1 && this.b === 0 && this.c === 0 && this.d === 1 && this.e === 0 && this.f === 0;
  }

  static fromMatrix(other?: Partial<ServerDOMMatrix>): ServerDOMMatrix {
    return new ServerDOMMatrix(
      other ? [other.a ?? 1, other.b ?? 0, other.c ?? 0, other.d ?? 1, other.e ?? 0, other.f ?? 0] : undefined
    );
  }

  multiplySelf(other: Partial<ServerDOMMatrix>): this {
    const a2 = other.a ?? 1;
    const b2 = other.b ?? 0;
    const c2 = other.c ?? 0;
    const d2 = other.d ?? 1;
    const e2 = other.e ?? 0;
    const f2 = other.f ?? 0;
    const a1 = this.a, b1 = this.b, c1 = this.c, d1 = this.d, e1 = this.e, f1 = this.f;
    this.a = a1 * a2 + c1 * b2;
    this.b = b1 * a2 + d1 * b2;
    this.c = a1 * c2 + c1 * d2;
    this.d = b1 * c2 + d1 * d2;
    this.e = a1 * e2 + c1 * f2 + e1;
    this.f = b1 * e2 + d1 * f2 + f1;
    return this;
  }

  multiply(other: Partial<ServerDOMMatrix>): ServerDOMMatrix {
    return ServerDOMMatrix.fromMatrix(this).multiplySelf(other);
  }

  preMultiplySelf(other: Partial<ServerDOMMatrix>): this {
    const res = ServerDOMMatrix.fromMatrix(other).multiplySelf(this);
    this.a = res.a; this.b = res.b; this.c = res.c; this.d = res.d; this.e = res.e; this.f = res.f;
    return this;
  }

  translateSelf(tx = 0, ty = 0): this {
    return this.multiplySelf({ a: 1, b: 0, c: 0, d: 1, e: tx, f: ty });
  }

  translate(tx = 0, ty = 0): ServerDOMMatrix {
    return ServerDOMMatrix.fromMatrix(this).translateSelf(tx, ty);
  }

  scaleSelf(scaleX = 1, scaleY = scaleX): this {
    return this.multiplySelf({ a: scaleX, b: 0, c: 0, d: scaleY, e: 0, f: 0 });
  }

  scale(scaleX = 1, scaleY = scaleX): ServerDOMMatrix {
    return ServerDOMMatrix.fromMatrix(this).scaleSelf(scaleX, scaleY);
  }

  invertSelf(): this {
    const det = this.a * this.d - this.b * this.c;
    if (!det) {
      this.a = NaN; this.b = NaN; this.c = NaN; this.d = NaN; this.e = NaN; this.f = NaN;
      return this;
    }
    const { a, b, c, d, e, f } = this;
    this.a = d / det;
    this.b = -b / det;
    this.c = -c / det;
    this.d = a / det;
    this.e = (c * f - d * e) / det;
    this.f = (b * e - a * f) / det;
    return this;
  }

  inverse(): ServerDOMMatrix {
    return ServerDOMMatrix.fromMatrix(this).invertSelf();
  }

  transformPoint(point?: { x?: number; y?: number }) {
    const x = point?.x ?? 0;
    const y = point?.y ?? 0;
    return {
      x: this.a * x + this.c * y + this.e,
      y: this.b * x + this.d * y + this.f,
      z: 0,
      w: 1,
    };
  }
}

class ServerImageData {
  width: number;
  height: number;
  data: Uint8ClampedArray;
  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.data = new Uint8ClampedArray(width * height * 4);
  }
}

class ServerPath2D {}

/**
 * Polyfills browser canvas geometry globals missing in Node/serverless runtimes
 * (e.g. Vercel without native @napi-rs/canvas) before loading pdf-parse / pdfjs.
 */
export function ensurePdfJsNodeGlobals(): void {
  const g = globalThis as Record<string, unknown>;
  if (typeof g.DOMMatrix === "undefined") {
    g.DOMMatrix = ServerDOMMatrix;
  }
  if (typeof g.ImageData === "undefined") {
    g.ImageData = ServerImageData;
  }
  if (typeof g.Path2D === "undefined") {
    g.Path2D = ServerPath2D;
  }
}

let cachedPdfParseModule: any = null;

function getPdfParseModule() {
  ensurePdfJsNodeGlobals();
  if (!cachedPdfParseModule) {
    cachedPdfParseModule = require("pdf-parse");
    if (typeof cachedPdfParseModule?.PDFParse?.setWorker === "function") {
      try {
        // Inline the pdfjs worker as a data URI so serverless bundles (e.g. Vercel)
        // don't fail resolving the default "./pdf.worker.mjs" path at runtime.
        const workerMod = require("pdf-parse/worker");
        if (typeof workerMod?.getData === "function") {
          cachedPdfParseModule.PDFParse.setWorker(workerMod.getData());
        }
      } catch {
        // Ignore if pdf-parse/worker is unavailable (e.g. pdf-parse v1)
      }
    }
  }
  return cachedPdfParseModule;
}

export interface ExtractedPdfLink {
  label?: string;
  url: string;
  page?: number;
}

export interface ParsedPdfResult {
  text: string;
  links: ExtractedPdfLink[];
  numpages: number;
  info?: Record<string, unknown>;
}

interface PdfPage {
  text?: string;
}

function inferLinkLabel(url: string, existing?: string): string | undefined {
  if (existing?.trim()) return existing.trim();
  const lower = url.toLowerCase();
  if (lower.startsWith("mailto:")) return url.replace(/^mailto:/i, "");
  if (lower.includes("linkedin.com")) return "LinkedIn";
  if (lower.includes("github.com")) return "GitHub";
  if (lower.includes("gitlab.com")) return "GitLab";
  if (lower.includes("portfolio") || lower.includes("vercel.app") || lower.includes("netlify.app")) {
    return "Portfolio";
  }
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

function pushUniqueLink(links: ExtractedPdfLink[], url: string, label?: string, page?: number) {
  const cleanUrl = url.trim().replace(/[.,;)\]]+$/, "");
  if (!cleanUrl) return;
  if (links.some((l) => l.url.toLowerCase() === cleanUrl.toLowerCase())) return;
  links.push({
    url: cleanUrl,
    label: inferLinkLabel(cleanUrl, label),
    page,
  });
}

/**
 * Parses raw text and hyperlink annotations from a PDF file buffer across pdf-parse v1 & v2 versions.
 * Disables worker threads (disableWorker: true) for Next.js bundler compatibility.
 */
export async function parsePdfBuffer(buffer: Buffer): Promise<ParsedPdfResult> {
  const extractedLinks: ExtractedPdfLink[] = [];

  const pagerender = async (pageData: any) => {
    let text = "";
    try {
      const textContent = await pageData.getTextContent({
        normalizeWhitespace: false,
        disableCombineTextItems: false,
      });
      if (textContent?.items) {
        text = textContent.items.map((item: any) => item.str).join(" ");
      }
    } catch {
      // ignore text error
    }

    try {
      const annotations = await pageData.getAnnotations();
      if (Array.isArray(annotations)) {
        for (const annot of annotations) {
          const rawUrl =
            annot.url ||
            annot.unsafeUrl ||
            (annot.action && (annot.action.url || annot.action.uri)) ||
            annot.dest;
          if (rawUrl && typeof rawUrl === "string") {
            pushUniqueLink(
              extractedLinks,
              rawUrl,
              annot.title || annot.contents || undefined,
              (pageData.pageIndex ?? 0) + 1
            );
          }
        }
      }
    } catch {
      // ignore annotation error
    }

    return text;
  };

  try {
    const pdfParseModule = getPdfParseModule();
    let rawText = "";
    let numpages = 1;
    let info: Record<string, unknown> = {};

    if (pdfParseModule?.PDFParse) {
      const parser = new pdfParseModule.PDFParse({ data: buffer, disableWorker: true });
      try {
        const textResult = await parser.getText({ parseHyperlinks: false });
        rawText =
          typeof textResult === "string"
            ? textResult
            : textResult?.text ||
              (textResult?.pages ? textResult.pages.map((p: PdfPage) => p.text || "").join("\n") : "");
        numpages = textResult?.total || 1;
        const pdfInfo = await parser.getInfo({ parsePageInfo: true });
        info = pdfInfo.info || {};
        for (const page of pdfInfo.pages || []) {
          for (const link of page.links || []) {
            if (typeof link.url === "string") pushUniqueLink(extractedLinks, link.url, link.text, page.pageNumber);
          }
        }
      } finally {
        await parser.destroy();
      }
    } else if (typeof pdfParseModule === "function") {
      const data = await pdfParseModule(buffer, { pagerender });
      rawText = data.text || "";
      numpages = data.numpages || 1;
      info = data.info || {};
    } else if (typeof pdfParseModule?.default === "function") {
      const data = await pdfParseModule.default(buffer, { pagerender });
      rawText = data.text || "";
      numpages = data.numpages || 1;
      info = data.info || {};
    } else {
      throw new Error("Could not initialize pdf-parse module");
    }

    const cleanText = (rawText || "").replace(/--\s*\d+\s*of\s*\d+\s*--/g, "").trim();

    // Visible http(s) URLs
    const textUrls = cleanText.match(/https?:\/\/[^\s<>()"']+/gi) || [];
    for (const rawUrl of textUrls) {
      pushUniqueLink(extractedLinks, rawUrl);
    }

    // Protocol-less LinkedIn / GitHub / common portfolio hosts
    const bareProfiles =
      cleanText.match(
        /(?:linkedin\.com\/in\/[A-Za-z0-9_-]+|github\.com\/[A-Za-z0-9_-]+|gitlab\.com\/[A-Za-z0-9_-]+)(?:\/[^\s<>()"']*)?/gi
      ) || [];
    for (const profile of bareProfiles) {
      pushUniqueLink(extractedLinks, `https://${profile.replace(/^https?:\/\//i, "")}`);
    }

    // Email addresses → mailto links
    const emails =
      cleanText.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || [];
    for (const email of emails) {
      pushUniqueLink(extractedLinks, `mailto:${email}`, email);
    }

    return {
      text: cleanText,
      links: extractedLinks,
      numpages,
      info,
    };
  } catch (err) {
    console.error("parsePdfBuffer error:", err);
    throw new Error(
      `Failed to parse PDF document: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

const SECTION_HEADER_WHITELIST = new Set([
  "experience",
  "work experience",
  "professional experience",
  "employment",
  "work history",
  "education",
  "academic",
  "academics",
  "projects",
  "personal projects",
  "selected projects",
  "side projects",
  "technical projects",
  "skills",
  "technical skills",
  "technologies",
  "tech stack",
  "tools & technologies",
  "skills & technologies",
  "summary",
  "professional summary",
  "executive summary",
  "profile",
  "certifications",
  "awards",
  "honors & awards",
  "leadership",
  "volunteer",
  "volunteering",
  "publications",
]);

const BULLET_LINE_REGEX = /^[-–—•*▪|]\s+/;

/** Conservative V2 fallback: classify only obvious lines, retaining uncertain text. */
export function classifyPdfTextFallback(rawText: string) {
  const assignments: import("@/lib/typst/resume-document").ResumeAssignment[] = [];
  const lines = /[^\r\n]+/g;
  let match: RegExpExecArray | null;
  let first = true;
  let inSection = false;
  let inSkills = false;
  let inProjects = false;
  let expectRole = false;
  while ((match = lines.exec(rawText))) {
    const line = match[0];
    const trimmed = line.trim();
    if (!trimmed) continue;
    const start = match.index + line.indexOf(trimmed);
    const span = { start, end: start + trimmed.length };
    const isSection = SECTION_HEADER_WHITELIST.has(trimmed.toLowerCase().replace(/\s+/g, " ")) ||
      (trimmed.length < 40 && /^[A-Z][A-Z &/]+$/.test(trimmed));
    const isCategory = /^[A-Za-z0-9\s&/+_-]{2,40}:\s*\S/.test(trimmed);
    const followingLines = rawText.slice(match.index + line.length).split(/\r?\n/).filter((s) => s.trim());
    const following = followingLines[0] || "";
    const isProjectTitle = inProjects && /\|\s*(?:GitHub|Live Demo)\b/i.test(trimmed) && BULLET_LINE_REGEX.test(following.trim());
    const previous = assignments[assignments.length - 1];
    const gap = previous ? rawText.slice(previous.span.end, start) : "";
    if (previous && (previous.kind === "bullet" || (previous.kind === "skill" && inSkills)) &&
        /^[ \t]*\r?\n[ \t]*$/.test(gap) && !isSection && !isCategory && !BULLET_LINE_REGEX.test(trimmed) &&
        !TRAILING_DATE_REGEX.test(trimmed) && !TRAILING_LOCATION_REGEX.test(trimmed) && !isProjectTitle &&
        (/^[a-z0-9(,]/.test(trimmed) || (!TRAILING_DATE_REGEX.test(following) && (previous.kind === "skill" ? /,\s*$/.test(rawText.slice(previous.span.start, previous.span.end)) : !/[.!?]\s*$/.test(rawText.slice(previous.span.start, previous.span.end)))))) {
      previous.span.end = span.end;
      continue;
    }
    if (first) {
      assignments.push({ kind: "name", span });
      first = false;
    } else if (isSection) {
      assignments.push({ kind: "section", span });
      inSection = true;
      inSkills = /^(skills|technical skills|technologies|tech stack|tools & technologies|skills & technologies)$/i.test(trimmed);
      inProjects = /^(projects|personal projects|selected projects|side projects|technical projects)$/i.test(trimmed);
    } else if (BULLET_LINE_REGEX.test(trimmed)) {
      assignments.push({ kind: "bullet", span });
    } else if (inSkills && isCategory) {
      assignments.push({ kind: "skill", span });
    } else if (expectRole) {
      const date = trimmed.match(TRAILING_DATE_REGEX);
      if (date && date.index !== undefined && date.index > 0) {
        assignments.push({ kind: "entry-role", span: { start, end: start + date.index } });
        const dateStart = start + date.index + date[0].indexOf(date[1]);
        assignments.push({ kind: "entry-date", span: { start: dateStart, end: dateStart + date[1].length } });
      }
      else if (inProjects && BULLET_LINE_REGEX.test(following.trim())) {
        assignments.push({ kind: "entry-role", span });
      }
      expectRole = false;
    } else if (inProjects && TRAILING_DATE_REGEX.test(trimmed) && BULLET_LINE_REGEX.test((followingLines[1] || "").trim())) {
      const date = trimmed.match(TRAILING_DATE_REGEX)!;
      if (date.index !== undefined && date.index > 0) {
        assignments.push({ kind: "entry-title", span: { start, end: start + date.index } });
        const dateStart = start + date.index + date[0].indexOf(date[1]);
        assignments.push({ kind: "entry-date", span: { start: dateStart, end: dateStart + date[1].length } });
        expectRole = true;
      }
    } else if (isProjectTitle) {
      assignments.push({ kind: "entry-title", span });
    } else if (inSection && TRAILING_DATE_REGEX.test(following)) {
      const location = trimmed.match(TRAILING_LOCATION_REGEX);
      if (location && location.index !== undefined && location.index > 0) {
        assignments.push({ kind: "entry-title", span: { start, end: start + location.index } });
        const locationStart = start + location.index + location[0].indexOf(location[1]);
        assignments.push({ kind: "entry-location", span: { start: locationStart, end: locationStart + location[1].length } });
      } else {
        assignments.push({ kind: "entry-title", span });
      }
      expectRole = true;
    } else if (!inSection && (/@|https?:\/\/|linkedin\.com|github\.com|\b\d{3}[-. )]\d{3}/i.test(trimmed) || /^(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s]*)?$/i.test(trimmed))) {
      assignments.push({ kind: "contact", span });
    }
  }
  return assignments;
}

const TRAILING_DATE_REGEX =
  /\s+((?:Expected\s+|Graduated\s+)?(?:(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+\d{4}|\d{1,2}\/\d{4}|\d{4})(?:\s*(?:[-–—‒]|to)\s*(?:(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+\d{4}|\d{1,2}\/\d{4}|\d{4}|Present|Current|Now))?)$/i;

const TRAILING_LOCATION_REGEX =
  /\s+((?:Remote|Hybrid|(?:(?:San|Los|New|St\.?|Saint|Fort|Mount|North|South|East|West|Port|Grand|Salt\s+Lake)\s+)?[A-Z][a-zA-Z.'-]+(?:\s+(?:Falls|Park|Beach|City|Springs|Hills|Valley|Bay|View|Heights|Harbor|Creek))?,\s*(?:[A-Z]{2}|Canada|Ontario|USA|UK))(?:\s*\((?:Remote|Hybrid|On-site)\))?)$/;

function mergeWrappedSectionLines(rawLines: string[]): string[] {
  const out: string[] = [];
  for (const line of rawLines) {
    if (BULLET_LINE_REGEX.test(line)) {
      out.push(line);
      continue;
    }
    if (out.length > 0 && BULLET_LINE_REGEX.test(out[out.length - 1])) {
      const prev = out[out.length - 1];
      const prevComplete = /[.!?]\s*$/.test(prev);
      const startsLowerOrPunct = /^[a-z0-9(,]/.test(line);
      const hasTrailingDate = TRAILING_DATE_REGEX.test(line);
      const hasTrailingLoc = TRAILING_LOCATION_REGEX.test(line);
      const isSkillCategory = /^[A-Za-z0-9\s&/+_-]{2,30}:\s+\S/.test(line);

      if (!hasTrailingDate && !hasTrailingLoc && !isSkillCategory && (startsLowerOrPunct || !prevComplete)) {
        out[out.length - 1] = `${prev} ${line}`;
        continue;
      }
    }
    out.push(line);
  }
  return out;
}

/**
 * Converts extracted PDF text and link metadata into Typst markup with
 * canonical section order: Experience → Education → Projects → Skills → other.
 */
export function convertTextToTypst(
  rawText: string,
  fileName?: string,
  links: ExtractedPdfLink[] = []
): string {
  // 4. Rejoin hyphenated line wraps ("idempo-\ntent" -> "idempotent")
  const dehyphenated = rawText
    .replace(/\r\n?/g, "\n")
    .replace(/([a-zA-Z])-\n\s*([a-z])/g, "$1$2")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const lines = dehyphenated.split("\n").map((l) => l.trim()).filter(Boolean);
  const titleLine = lines[0] || fileName || "Imported Resume";
  const restLines = lines.slice(1);

  // 2. Whitelist known section names or ALL-CAPS lines so entry headers like "Career Education Council Remote" are never promoted
  const isSectionHeader = (line: string) => {
    if (line.length >= 40 || line.endsWith(".") || line.endsWith(",") || BULLET_LINE_REGEX.test(line)) {
      return false;
    }
    const normalizedKey = line.toLowerCase().replace(/\s+/g, " ").trim();
    if (SECTION_HEADER_WHITELIST.has(normalizedKey)) {
      return true;
    }
    return /[A-Z]{2,}/.test(line) && line === line.toUpperCase() && !/\d{4}/.test(line);
  };

  type SectionBucket = { title: string; lines: string[] };
  const preamble: string[] = [];
  const sections: SectionBucket[] = [];
  let current: SectionBucket | null = null;

  for (const line of restLines) {
    if (isSectionHeader(line)) {
      current = { title: normalizeSectionTitle(line), lines: [] };
      sections.push(current);
      continue;
    }
    if (current) {
      current.lines.push(line);
    } else {
      preamble.push(line);
    }
  }

  sections.sort((a, b) => {
    const diff = canonicalSectionRank(a.title) - canonicalSectionRank(b.title);
    return diff;
  });

  // 1. Support "-", "–", "—" in formatBodyLine
  const formatBodyLine = (line: string) => {
    if (BULLET_LINE_REGEX.test(line)) {
      const bulletText = line.replace(BULLET_LINE_REGEX, "");
      return `- ${typstContent(bulletText)}`;
    }
    return typstContent(line);
  };

  // 5. Emit `#entry(title:, role:, location:, date:, details:)` in Experience/Projects/Education
  const formatStructuredSection = (sec: SectionBucket): string[] => {
    const mergedLines = mergeWrappedSectionLines(sec.lines);
    const kind = sec.title.toLowerCase();
    if (kind !== "experience" && kind !== "education" && kind !== "projects") {
      return mergedLines.map(formatBodyLine);
    }

    type EntryDraft = {
      headerLines: string[];
      bullets: string[];
    };

    const entries: EntryDraft[] = [];
    let currentEntry: EntryDraft | null = null;

    for (const line of mergedLines) {
      if (BULLET_LINE_REGEX.test(line)) {
        if (!currentEntry) {
          currentEntry = { headerLines: [], bullets: [] };
          entries.push(currentEntry);
        }
        currentEntry.bullets.push(line.replace(BULLET_LINE_REGEX, ""));
      } else {
        if (!currentEntry || currentEntry.bullets.length > 0) {
          currentEntry = { headerLines: [line], bullets: [] };
          entries.push(currentEntry);
        } else {
          currentEntry.headerLines.push(line);
        }
      }
    }

    // If no structured headers with dates/roles were detected, fall back to plain formatted lines
    const hasStructuredEntry = entries.some(
      (e) =>
        e.headerLines.length > 0 &&
        (e.bullets.length > 0 || e.headerLines.some((h) => TRAILING_DATE_REGEX.test(h)))
    );
    if (!hasStructuredEntry) {
      return mergedLines.map(formatBodyLine);
    }

    const out: string[] = [];
    for (const entry of entries) {
      if (entry.headerLines.length === 0) {
        for (const b of entry.bullets) {
          out.push(`- ${typstContent(b)}`);
        }
        continue;
      }

      let title = "";
      let role = "";
      let location = "";
      let date = "";

      const remainingHeaders: string[] = [];
      for (const hLine of entry.headerLines) {
        let work = hLine.trim();
        const dateMatch = work.match(TRAILING_DATE_REGEX);
        if (dateMatch && !date) {
          date = dateMatch[1].trim();
          work = work.slice(0, dateMatch.index).trim();
        }
        const locMatch = work.match(TRAILING_LOCATION_REGEX);
        if (locMatch && !location) {
          location = locMatch[1].trim();
          work = work.slice(0, locMatch.index).trim();
        }
        work = work.replace(/[|—–-]\s*$/, "").trim();
        if (work) remainingHeaders.push(work);
      }

      if (remainingHeaders.length >= 2) {
        title = remainingHeaders[0];
        role = remainingHeaders.slice(1).join(" — ");
      } else if (remainingHeaders.length === 1) {
        const single = remainingHeaders[0];
        const atParts = single.split(/\s+at\s+/i);
        if (atParts.length === 2) {
          role = atParts[0].trim();
          title = atParts[1].trim();
        } else {
          const dashParts = single.split(/\s+(?:—|–|\|)\s+/);
          if (dashParts.length >= 2) {
            title = dashParts[0].trim();
            role = dashParts.slice(1).join(" | ").trim();
          } else {
            title = single;
          }
        }
      }

      const bulletLines = entry.bullets.map((b) => `    - ${typstContent(b)}`).join("\n");
      const detailsPart = bulletLines ? `\n  details: [\n${bulletLines}\n  ]` : "";

      out.push(
        `#entry(\n  title: ${typstString(title)},\n  role: ${typstString(role)},\n  location: ${typstString(location)},\n  date: ${typstString(date)},${detailsPart}\n)`
      );
    }

    return out;
  };

  const bodyContent = [
    ...preamble.map(formatBodyLine),
    ...sections.flatMap((sec) => [
      `\n== ${typstContent(sec.title)}\n`,
      ...formatStructuredSection(sec),
    ]),
  ].join("\n");

  const seenDestinations = new Set<string>();
  const renderedLinkItems: string[] = [];
  for (const l of links) {
    if (!l.url) continue;
    const safeUrl = safeDestination(l.url);
    const label = typstContent(l.label || l.url);
    if (!safeUrl) {
      if (label) renderedLinkItems.push(label);
      continue;
    }
    const key = safeUrl.toLowerCase();
    if (seenDestinations.has(key)) continue;
    seenDestinations.add(key);
    renderedLinkItems.push(`#link(${typstString(safeUrl)})[${label}]`);
  }

  const renderedLinks =
    renderedLinkItems.length > 0
      ? `\n#v(2pt)\n${renderedLinkItems.join(" #sym.dot ")}\n`
      : "";

  return `#set page(paper: "us-letter", margin: (x: 1.5cm, y: 1.35cm))
#set text(font: "Liberation Sans", size: 9.5pt, fill: rgb("#111827"))
#set par(leading: 0.55em)
#set list(marker: [•], spacing: 0.28em, indent: 0em, body-indent: 0.45em)
#show heading.where(level: 1): it => align(center, text(size: 19pt, weight: "bold", it.body))
#show heading.where(level: 2): it => block(width: 100%, above: 0.85em, below: 0.35em)[
  #text(size: 10pt, weight: "bold", tracking: 0.04em, upper(it.body))
  #v(-0.35em)
  #line(length: 100%, stroke: 0.5pt + rgb("#9CA3AF"))
]
#show link: set text(fill: rgb("#1155CC"))

#let entry(
  title: "",
  role: "",
  location: "",
  date: "",
  details: [],
) = {
  block(width: 100%, breakable: false, below: 0.45em, above: 0.55em)[
    #grid(
      columns: (1fr, auto),
      row-gutter: 0.28em,
      align: (left, right),
      [*#title*], [#location],
      [#emph(role)], [#emph(date)],
    )
    #v(-0.35em)
    #details
  ]
}

= ${typstContent(titleLine)}
${renderedLinks}
#v(3pt)

${bodyContent}
`;
}
