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

/**
 * Converts extracted PDF text and link metadata into Typst markup with
 * canonical section order: Experience → Education → Projects → Skills → other.
 */
export function convertTextToTypst(
  rawText: string,
  fileName?: string,
  links: ExtractedPdfLink[] = []
): string {
  const cleanText = rawText
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const lines = cleanText.split("\n").map((l) => l.trim()).filter(Boolean);
  const titleLine = lines[0] || fileName || "Imported Resume";
  const restLines = lines.slice(1);

  const sanitizeForTypst = (text: string) =>
    text
      .replace(/\\/g, "\\\\")
      .replace(/#/g, "\\#")
      .replace(/\$/g, "\\$")
      .replace(/@/g, "\\@");

  const isSectionHeader = (line: string) =>
    line.length < 40 &&
    !line.endsWith(".") &&
    !line.endsWith(",") &&
    (line === line.toUpperCase() || /^[A-Z][a-zA-Z\s&/]{2,35}$/.test(line));

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

  const formatBodyLine = (line: string) => {
    if (/^[-•*▪|]\s*/.test(line)) {
      const bulletText = line.replace(/^[-•*▪|]\s*/, "");
      return `- ${sanitizeForTypst(bulletText)}`;
    }
    return sanitizeForTypst(line);
  };

  const bodyContent = [
    ...preamble.map(formatBodyLine),
    ...sections.flatMap((sec) => [
      `\n== ${sanitizeForTypst(sec.title)}\n`,
      ...sec.lines.map(formatBodyLine),
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

  return `= ${sanitizeForTypst(titleLine)}
${renderedLinks}
#v(4pt)
#line(length: 100%, stroke: 0.5pt + rgb("#CBD5E1"))
#v(6pt)

${bodyContent}
`;
}
