// Compatible with both pdf-parse v1 function & pdf-parse v2 PDFParse class
const pdfParseModule = require("pdf-parse");

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

/**
 * Parses raw text and hyperlink annotations from a PDF file buffer across pdf-parse v1 & v2 versions.
 * Disables worker threads (disableWorker: true) for Next.js bundler compatibility.
 */
export async function parsePdfBuffer(buffer: Buffer): Promise<ParsedPdfResult> {
  const extractedLinks: ExtractedPdfLink[] = [];

  const pagerender = async (pageData: any) => {
    let text = "";
    try {
      const textContent = await pageData.getTextContent({ normalizeWhitespace: false, disableCombineTextItems: false });
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
          const rawUrl = annot.url || annot.unsafeUrl || (annot.action && annot.action.url);
          if (rawUrl && typeof rawUrl === "string") {
            const cleanUrl = rawUrl.trim();
            if (cleanUrl && !extractedLinks.some((l) => l.url === cleanUrl)) {
              extractedLinks.push({
                url: cleanUrl,
                label: annot.title || undefined,
                page: (pageData.pageIndex ?? 0) + 1,
              });
            }
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

    // 1. Try pdf-parse v2 PDFParse class interface with disableWorker: true
    if (pdfParseModule?.PDFParse) {
      const parser = new pdfParseModule.PDFParse({ data: buffer, disableWorker: true, pagerender });
      const textResult = await parser.getText();
      rawText =
        typeof textResult === "string"
          ? textResult
          : textResult?.text || (textResult?.pages ? textResult.pages.map((p: PdfPage) => p.text || "").join("\n") : "");
      numpages = textResult?.total || 1;
    } else if (typeof pdfParseModule === "function") {
      // 2. Try pdf-parse v1 function interface
      const data = await pdfParseModule(buffer, { pagerender });
      rawText = data.text || "";
      numpages = data.numpages || 1;
      info = data.info || {};
    } else if (typeof pdfParseModule?.default === "function") {
      // 3. Try default property function
      const data = await pdfParseModule.default(buffer, { pagerender });
      rawText = data.text || "";
      numpages = data.numpages || 1;
      info = data.info || {};
    } else {
      throw new Error("Could not initialize pdf-parse module");
    }

    // Strip page marker footers like "-- 1 of 1 --" added by pdf-parse v2
    const cleanText = (rawText || "").replace(/--\s*\d+\s*of\s*\d+\s*--/g, "").trim();

    // Regex fallback for visible HTTP/HTTPS URLs in extracted text
    const textUrls = cleanText.match(/https?:\/\/[^\s<>()"']+/g) || [];
    for (const rawUrl of textUrls) {
      const cleanUrl = rawUrl.replace(/[.,;)]+$/, "");
      if (cleanUrl && !extractedLinks.some((l) => l.url === cleanUrl)) {
        extractedLinks.push({ url: cleanUrl });
      }
    }

    return {
      text: cleanText,
      links: extractedLinks,
      numpages,
      info,
    };
  } catch (err) {
    console.error("parsePdfBuffer error:", err);
    throw new Error(`Failed to parse PDF document: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Converts extracted PDF text and link metadata into clean Typst markup format for Master Resume rendering.
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

  // Helper to escape Typst special syntax characters in raw body text
  const sanitizeForTypst = (text: string) => {
    return text
      .replace(/\\/g, "\\\\")
      .replace(/#/g, "\\#")
      .replace(/\$/g, "\\$")
      .replace(/@/g, "\\@");
  };

  const bodyContent = restLines
    .map((line) => {
      // Check if line looks like a section header (short line, uppercase or title case, no ending punctuation)
      if (
        line.length < 40 &&
        !line.endsWith(".") &&
        !line.endsWith(",") &&
        (line === line.toUpperCase() || /^[A-Z][a-zA-Z\s]{2,30}$/.test(line))
      ) {
        return `\n== ${sanitizeForTypst(line)}\n`;
      }
      // Check if line looks like a bullet
      if (/^[-•*▪|]\s*/.test(line)) {
        const bulletText = line.replace(/^[-•*▪|]\s*/, "");
        return `- ${sanitizeForTypst(bulletText)}`;
      }
      return sanitizeForTypst(line);
    })
    .join("\n");

  const renderedLinks = links.length > 0
    ? "\n#v(2pt)\n" + links.map((l) => `#link("${l.url}")[${l.label || l.url}]`).join(" #sym.dot ") + "\n"
    : "";

  return `= ${sanitizeForTypst(titleLine)}
${renderedLinks}
#v(4pt)
#line(length: 100%, stroke: 0.5pt + rgb("#CBD5E1"))
#v(6pt)

${bodyContent}
`;
}
