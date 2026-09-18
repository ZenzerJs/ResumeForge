import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Packer,
  BorderStyle,
  convertInchesToTwip,
} from "docx";
import { ResumeFacts } from "@/lib/facts/types";

export interface DocxExportOptions {
  facts?: ResumeFacts;
  title?: string;
}

interface ParsedResumeSection {
  title: string;
  lines: string[];
}

/**
 * Cleanly strips Typst formatting syntax from a string.
 */
function cleanTypstText(text: string): string {
  return text
    .replace(/^[-*•]\s+/, "")
    .replace(/#link\("([^"]+)"\)\[([^\]]+)\]/g, "$2 ($1)")
    .replace(/#link\("([^"]+)"\)/g, "$1")
    .replace(/#strong\[([^\]]+)\]/g, "$1")
    .replace(/#emph\[([^\]]+)\]/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/#resume-entry\s*\([^)]*\)/g, "")
    .replace(/#resume-header\s*\([^)]*\)/g, "")
    .replace(/#heading\s*\([^)]*\)/g, "")
    .replace(/#line\s*\([^)]*\)/g, "")
    .replace(/#v\s*\([^)]*\)/g, "")
    .replace(/#h\s*\([^)]*\)/g, "")
    .replace(/#align\s*\([^)]*\)\[([^\]]*)\]/g, "$1")
    .replace(/\\/g, "")
    .trim();
}

/**
 * Parses Typst source into linear structured sections.
 */
function parseTypstToSections(source: string): {
  candidateName: string;
  contactLine: string;
  sections: ParsedResumeSection[];
} {
  const lines = source.split("\n");
  let candidateName = "Candidate Resume";
  let contactLine = "";
  const sections: ParsedResumeSection[] = [];
  let currentSection: ParsedResumeSection | null = null;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine || rawLine.startsWith("//") || rawLine.startsWith("#set") || rawLine.startsWith("#show")) {
      continue;
    }

    // Check for candidate name
    if (
      rawLine.startsWith("= ") ||
      rawLine.includes("#resume-header") ||
      (i < 5 && /^[A-Z][a-z]+ [A-Z][a-z]+/.test(cleanTypstText(rawLine)) && !rawLine.includes(":"))
    ) {
      if (candidateName === "Candidate Resume") {
        const cleaned = cleanTypstText(rawLine.replace(/^=\s*/, ""));
        if (cleaned && cleaned.length < 50) {
          candidateName = cleaned;
          continue;
        }
      }
    }

    // Check for contact details line
    if (/@|github\.com|linkedin\.com|\(\d{3}\)|\d{3}-\d{3}-\d{4}/.test(rawLine) && !currentSection) {
      contactLine = cleanTypstText(rawLine);
      continue;
    }

    // Check for section header (== Experience, #section("Experience"), *EXPERIENCE*, etc.)
    const isSectionHeader =
      rawLine.startsWith("==") ||
      rawLine.startsWith("#section") ||
      rawLine.startsWith("#resume-section") ||
      (/^(=+)\s+/i.test(rawLine) && !rawLine.startsWith("= ")) ||
      /^(EXPERIENCE|EDUCATION|PROJECTS|SKILLS|TECHNICAL SKILLS|SUMMARY|WORK EXPERIENCE)$/i.test(
        cleanTypstText(rawLine)
      );

    if (isSectionHeader) {
      const titleMatch = cleanTypstText(rawLine.replace(/^=+\s*/, ""));
      if (titleMatch) {
        currentSection = { title: titleMatch.toUpperCase(), lines: [] };
        sections.push(currentSection);
        continue;
      }
    }

    if (currentSection) {
      const cleaned = cleanTypstText(rawLine);
      if (cleaned) {
        currentSection.lines.push(cleaned);
      }
    }
  }

  return { candidateName, contactLine, sections };
}

/**
 * Generates an ATS-compliant single-column DOCX document Buffer.
 */
export async function generateAtsDocx(
  typstSource: string,
  options?: DocxExportOptions
): Promise<Uint8Array> {
  const { candidateName, contactLine, sections } = parseTypstToSections(typstSource);

  const docChildren: Paragraph[] = [];

  // 1. Candidate Name (Heading 1)
  docChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 120 },
      children: [
        new TextRun({
          text: candidateName,
          bold: true,
          size: 32, // 16pt
          font: "Calibri",
          color: "111827",
        }),
      ],
    })
  );

  // 2. Contact Information Line
  if (contactLine) {
    docChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 240 },
        children: [
          new TextRun({
            text: contactLine,
            size: 20, // 10pt
            font: "Calibri",
            color: "4B5563",
          }),
        ],
      })
    );
  }

  // 3. Sections
  for (const section of sections) {
    // Section Title (Heading 2 with bottom border)
    docChildren.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 240, after: 120 },
        border: {
          bottom: {
            color: "9CA3AF",
            space: 4,
            style: BorderStyle.SINGLE,
            size: 6,
          },
        },
        children: [
          new TextRun({
            text: section.title,
            bold: true,
            size: 24, // 12pt
            font: "Calibri",
            color: "1F2937",
          }),
        ],
      })
    );

    // Section Content Lines
    for (const line of section.lines) {
      const isBullet = /^[•\-*]/.test(line) || section.title.includes("EXPERIENCE") || section.title.includes("PROJECT");

      if (isBullet && !line.includes("|") && line.length > 30) {
        docChildren.push(
          new Paragraph({
            bullet: { level: 0 },
            spacing: { before: 60, after: 60 },
            children: [
              new TextRun({
                text: line,
                size: 20, // 10pt
                font: "Calibri",
                color: "374151",
              }),
            ],
          })
        );
      } else {
        // Regular line / Subheader (e.g. Company | Title | Date)
        const isHeaderLine = line.includes("|") || line.includes("–") || line.includes(" - ");
        docChildren.push(
          new Paragraph({
            spacing: { before: isHeaderLine ? 120 : 60, after: 60 },
            children: [
              new TextRun({
                text: line,
                bold: isHeaderLine,
                size: 21, // 10.5pt
                font: "Calibri",
                color: isHeaderLine ? "111827" : "374151",
              }),
            ],
          })
        );
      }
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(0.6),
              bottom: convertInchesToTwip(0.6),
              left: convertInchesToTwip(0.65),
              right: convertInchesToTwip(0.65),
            },
          },
        },
        children: docChildren,
      },
    ],
  });

  if (typeof (Packer as any).toBuffer === "function") {
    const buf = await (Packer as any).toBuffer(doc);
    return new Uint8Array(buf);
  }
  const blob = await Packer.toBlob(doc);
  const arrayBuffer = await blob.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}
