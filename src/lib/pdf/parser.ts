// Compatible with both pdf-parse v1 function & pdf-parse v2 PDFParse class
const pdfParseModule = require("pdf-parse");

export interface ParsedPdfResult {
  text: string;
  numpages: number;
  info?: Record<string, unknown>;
}

interface PdfPage {
  text?: string;
}

/**
 * Parses raw text from a PDF file buffer across pdf-parse v1 & v2 versions.
 */
export async function parsePdfBuffer(buffer: Buffer): Promise<ParsedPdfResult> {
  try {
    // 1. Try pdf-parse v2 PDFParse class interface
    if (pdfParseModule.PDFParse) {
      const parser = new pdfParseModule.PDFParse({ data: buffer });
      const textResult = await parser.getText();
      const rawText =
        typeof textResult === "string"
          ? textResult
          : textResult?.text || (textResult?.pages ? textResult.pages.map((p: PdfPage) => p.text || "").join("\n") : "");

      return {
        text: rawText || "",
        numpages: textResult?.total || 1,
        info: {},
      };
    }

    // 2. Try pdf-parse v1 function interface
    if (typeof pdfParseModule === "function") {
      const data = await pdfParseModule(buffer);
      return {
        text: data.text || "",
        numpages: data.numpages || 1,
        info: data.info || {},
      };
    }

    // 3. Try default property
    if (typeof pdfParseModule.default === "function") {
      const data = await pdfParseModule.default(buffer);
      return {
        text: data.text || "",
        numpages: data.numpages || 1,
        info: data.info || {},
      };
    }

    throw new Error("Invalid pdf-parse module structure");
  } catch (err) {
    console.error("parsePdfBuffer error:", err);
    throw new Error(`Failed to parse PDF document: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Converts extracted PDF text into clean Typst markup format for Master Resume rendering.
 */
export function convertTextToTypst(rawText: string, fileName?: string): string {
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

  return `= ${sanitizeForTypst(titleLine)}

#v(4pt)
#line(length: 100%, stroke: 0.5pt + rgb("#CBD5E1"))
#v(6pt)

${bodyContent}
`;
}
