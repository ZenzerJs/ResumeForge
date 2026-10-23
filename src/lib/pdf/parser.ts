// Compatible with both pdf-parse v1 function & pdf-parse v2 PDFParse class
const pdfParseModule = require("pdf-parse");
import { normalizeSectionTitle, canonicalSectionRank } from "@/lib/typst/section-order";

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
    let rawText = "";
    let numpages = 1;
    let info: Record<string, unknown> = {};

    if (pdfParseModule?.PDFParse) {
      const parser = new pdfParseModule.PDFParse({ data: buffer, disableWorker: true, pagerender });
      const textResult = await parser.getText();
      rawText =
        typeof textResult === "string"
          ? textResult
          : textResult?.text ||
            (textResult?.pages ? textResult.pages.map((p: PdfPage) => p.text || "").join("\n") : "");
      numpages = textResult?.total || 1;
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
    .replace(/\r\n/g, "\n")
    .replace(/([a-zA-Z])-\n\s*([a-z])/g, "$1$2")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const lines = dehyphenated.split("\n").map((l) => l.trim()).filter(Boolean);
  const titleLine = lines[0] || fileName || "Imported Resume";
  const restLines = lines.slice(1);

  const sanitizeForTypst = (text: string) =>
    text
      .replace(/\\/g, "\\\\")
      .replace(/#/g, "\\#")
      .replace(/\$/g, "\\$")
      .replace(/@/g, "\\@");

  const escapeTypstStr = (text: string) =>
    sanitizeForTypst(text).replace(/"/g, '\\"');

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

  // 3. Drop raw contact line from preamble when renderedLinks is emitted
  const isContactLine = (line: string) =>
    /@|linkedin|github|portfolio|https?:\/\/|\(\d{3}\)|\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/i.test(line) ||
    (line.includes("|") && /\b(canada|usa|ontario|ca|ny|tx|wa|remote)\b/i.test(line));

  const filteredPreamble =
    links.length > 0 ? preamble.filter((l) => !isContactLine(l)) : preamble;

  sections.sort((a, b) => {
    const diff = canonicalSectionRank(a.title) - canonicalSectionRank(b.title);
    return diff;
  });

  // 1. Support "-", "–", "—" in formatBodyLine
  const formatBodyLine = (line: string) => {
    if (BULLET_LINE_REGEX.test(line)) {
      const bulletText = line.replace(BULLET_LINE_REGEX, "");
      return `- ${sanitizeForTypst(bulletText)}`;
    }
    return sanitizeForTypst(line);
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
          out.push(`- ${sanitizeForTypst(b)}`);
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

      const bulletLines = entry.bullets.map((b) => `    - ${sanitizeForTypst(b)}`).join("\n");
      const detailsPart = bulletLines ? `\n  details: [\n${bulletLines}\n  ]` : "";

      out.push(
        `#entry(\n  title: "${escapeTypstStr(title)}",\n  role: "${escapeTypstStr(role)}",\n  location: "${escapeTypstStr(location)}",\n  date: "${escapeTypstStr(date)}",${detailsPart}\n)`
      );
    }

    return out;
  };

  const bodyContent = [
    ...filteredPreamble.map(formatBodyLine),
    ...sections.flatMap((sec) => [
      `\n== ${sanitizeForTypst(sec.title)}\n`,
      ...formatStructuredSection(sec),
    ]),
  ].join("\n");

  const renderedLinks =
    links.length > 0
      ? "\n#v(2pt)\n" +
        links
          .map((l) => `#link("${l.url}")[${sanitizeForTypst(l.label || l.url)}]`)
          .join(" #sym.dot ") +
        "\n"
      : "";

  return `#let entry(
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

= ${sanitizeForTypst(titleLine)}
${renderedLinks}
#v(4pt)
#line(length: 100%, stroke: 0.5pt + rgb("#CBD5E1"))
#v(6pt)

${bodyContent}
`;
}
