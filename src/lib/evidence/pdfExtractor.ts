import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/workers/pdf.worker.min.mjs';
}

export function cleanLigatures(text: string): string {
  return text
    .replace(/\b([a-zA-Z]+)\s+(fi|fl|ff|ffi|ffl)\s+(?!and\b|the\b|in\b|at\b|to\b|or\b|of\b|for\b|with\b|on\b|by\b|as\b)([a-zA-Z]{1,4})\b/gi, "$1$2$3")
    .replace(/\b([a-zA-Z]{1,2})\s+(fi|fl|ff|ffi|ffl)\s+([a-zA-Z]+)\b/gi, "$1$2$3")
    .replace(/\b([a-zA-Z]+)\s+(fi|fl|ff|ffi|ffl)\b/gi, "$1$2")
    .replace(/\b(fi|fl|ff|ffi|ffl)\s+([a-zA-Z]+)\b/gi, "$1$2");
}

export interface ExtractedPdfEvidence {
  sourceDoc: string;
  pages: Array<{ pageNumber: number; text: string }>;
  sections: {
    experience: string[];
    projects: string[];
    education: string[];
    certifications: string[];
    skills: string[];
    uncategorized: string[];
  };
  extractedTechnologies: string[];
  impactMetrics: string[];
}

import { COMMON_TECH_CATALOG, extractTechnologies } from './tech-extractor';
export { COMMON_TECH_CATALOG, extractTechnologies };

export function extractMetrics(text: string): string[] {
  const metrics = new Set<string>();

  // 1. Percentages: e.g. "45%", "+35%", "99.9%"
  const percentRegex = /(?:\+\s*)?\b\d+(?:\.\d+)?%/g;
  let match;
  while ((match = percentRegex.exec(text)) !== null) {
    metrics.add(match[0].trim());
  }

  // 2. Units with optional scale: e.g. "50k events/sec", "100k req/sec", "1M+ users", "40+ packages", "50ms"
  const unitRegex = /\b\d+(?:[\.,]\d+)?\s*(?:k|K|M|B)?\+?\s*(?:events?\/sec|req(?:uests?)?\/sec|RPS|queries(?:\/sec)?|users?|stars?|packages?|pts?|points?|ms|sec|min|hrs?|hours?)\b/gi;
  while ((match = unitRegex.exec(text)) !== null) {
    metrics.add(match[0].trim());
  }

  // 3. Multipliers: e.g. "2x", "10x", "3.5x"
  const multRegex = /\b\d+(?:\.\d+)?x\b/gi;
  while ((match = multRegex.exec(text)) !== null) {
    metrics.add(match[0].trim());
  }

  // 4. Currency: e.g. "$1.2M", "$500k", "$10M+"
  const currRegex = /(?:[\$€£]\s*\d+(?:[\.,]\d+)?\s*(?:[kKMB]|million|billion)?(?:\+)?)/g;
  while ((match = currRegex.exec(text)) !== null) {
    metrics.add(match[0].trim());
  }

  // 5. Standalone scaled counts: e.g. "50k", "10M+" (if not already part of a unit)
  const scaleRegex = /\b\d+(?:[\.,]\d+)?\s*[kKMB]\+?\b/g;
  while ((match = scaleRegex.exec(text)) !== null) {
    const val = match[0].trim();
    if (!Array.from(metrics).some(m => m.includes(val))) {
      metrics.add(val);
    }
  }

  // 6. Large formatted numbers: e.g. "50,000", "1,000+"
  const numRegex = /\b\d{1,3}(?:,\d{3})+(?:\+)?\b/g;
  while ((match = numRegex.exec(text)) !== null) {
    metrics.add(match[0].trim());
  }

  return Array.from(metrics);
}

const SECTION_SYNONYMS: Record<keyof ExtractedPdfEvidence["sections"], string[]> = {
  experience: [
    "EXPERIENCE",
    "WORK EXPERIENCE",
    "EMPLOYMENT HISTORY",
    "PROFESSIONAL EXPERIENCE",
    "PROFESSIONAL BACKGROUND",
    "RELEVANT EXPERIENCE",
    "EMPLOYMENT",
    "WORK HISTORY",
    "EXPERIENCE & HIGHLIGHTS",
    "CAREER HISTORY",
    "PROFESSIONAL EMPLOYMENT",
  ],
  projects: [
    "PROJECTS",
    "PERSONAL PROJECTS",
    "TECHNICAL PROJECTS",
    "ACADEMIC PROJECTS",
    "KEY PROJECTS",
    "FEATURED PROJECTS",
    "SELECTED PROJECTS",
    "SOFTWARE PROJECTS",
    "OPEN SOURCE PROJECTS",
    "SIGNIFICANT PROJECTS",
  ],
  skills: [
    "SKILLS",
    "TECHNICAL SKILLS",
    "COMPETENCIES",
    "TECHNICAL COMPETENCIES",
    "SKILLS MATRIX",
    "TECHNICAL SKILLS MATRIX",
    "CORE COMPETENCIES",
    "SKILLS & TECHNOLOGIES",
    "SKILLS AND TECHNOLOGIES",
    "TECHNICAL PROFICIENCIES",
    "AREAS OF EXPERTISE",
    "TECHNOLOGIES",
    "TECH STACK",
    "TECHNICAL EXPERTISE",
    "TOOLING & TECHNOLOGIES",
  ],
  education: [
    "EDUCATION",
    "ACADEMIC BACKGROUND",
    "EDUCATION & TRAINING",
    "EDUCATION AND TRAINING",
    "ACADEMIC HISTORY",
    "EDUCATION & CREDENTIALS",
    "EDUCATION AND CREDENTIALS",
    "ACADEMIC CREDENTIALS",
    "ACADEMICS",
  ],
  certifications: [
    "CERTIFICATIONS",
    "COURSES",
    "CERTIFICATIONS & CREDENTIALS",
    "CERTIFICATIONS AND CREDENTIALS",
    "LICENSES & CERTIFICATIONS",
    "LICENSES AND CERTIFICATIONS",
    "CERTIFICATES",
    "CREDENTIALS",
    "AWARDS & CERTIFICATIONS",
  ],
  uncategorized: [
    "SUMMARY",
    "EXECUTIVE SUMMARY",
    "PROFESSIONAL SUMMARY",
    "ABOUT",
    "ABOUT ME",
    "PROFILE",
    "PERSONAL PROFILE",
    "CAREER OBJECTIVE",
    "OBJECTIVE",
    "CONTACT",
    "CONTACT INFORMATION",
    "PUBLICATIONS",
    "REFERENCES",
    "VOLUNTEERING",
    "VOLUNTEER EXPERIENCE",
    "AFFILIATIONS",
    "ADDITIONAL INFORMATION",
  ],
};

function normalizeSectionHeading(line: string): string {
  return line
    .replace(/^[#\s•\-\*]+/, "")
    .replace(/^\d+(\.\d+)*[\.\:\)\-]?\s*/, "")
    .replace(/^[IVXLCDM]+[\.\:\)\-]\s*/i, "")
    .replace(/\s*[\(\[].*$/, "")
    .replace(/[:\-\—\–\s]+$/, "")
    .trim()
    .toUpperCase();
}

export function detectSectionHeading(line: string): keyof ExtractedPdfEvidence["sections"] | null {
  const trimmed = line.trim();
  if (/^[•\-\*\u2022\u2023\u25E6]/.test(trimmed)) return null;
  if (/[.,;?!]$/.test(trimmed)) return null;
  if (/^(?:EXP|PRJ)-[A-Za-z0-9_-]/i.test(trimmed)) return null;
  if (trimmed.length > 80) return null;

  const unnumbered = trimmed.replace(/^\s*(?:##\s*)?\d+\.\s*/, "");
  const headingTextBeforeParen = unnumbered.replace(/\s*[\(\[].*$/, "").trim();
  const isMajorNumbered =
    /^\s*(?:##\s*)?\d+\.\s+/.test(trimmed) &&
    headingTextBeforeParen.length >= 3 &&
    headingTextBeforeParen.length <= 60 &&
    /^[A-Z0-9\s/&–—\-]+$/.test(headingTextBeforeParen) &&
    !/\b(?:for|each|with|the|and|from|read|pull|pick|open|close|respect|never|body|output|hard)\b/i.test(
      headingTextBeforeParen
    );

  const norm = normalizeSectionHeading(trimmed);
  if (!norm || norm.length < 3) return null;

  for (const [sec, aliases] of Object.entries(SECTION_SYNONYMS) as Array<[keyof ExtractedPdfEvidence["sections"], string[]]>) {
    if (aliases.includes(norm)) {
      return sec;
    }
  }

  // Regex fallbacks for variations
  if (/^(?:PROFESSIONAL\s+|WORK\s+|RELEVANT\s+)?EXPERIENCE$/i.test(norm)) return "experience";
  if (/^(?:TECHNICAL\s+|PERSONAL\s+|ACADEMIC\s+|KEY\s+)?PROJECTS$/i.test(norm)) return "projects";
  if (/^(?:TECHNICAL\s+|CORE\s+)?(?:SKILLS|COMPETENCIES)(?:\s+MATRIX)?$/i.test(norm)) return "skills";
  if (/^(?:EDUCATION|ACADEMIC\s+(?:BACKGROUND|HISTORY))$/i.test(norm)) return "education";
  if (/^(?:LICENSES\s+(&|AND)\s+)?CERTIFICATIONS|CERTIFICATES$/i.test(norm)) return "certifications";
  if (/^(?:EXECUTIVE\s+|PROFESSIONAL\s+)?SUMMARY|PROFILE|OBJECTIVE$/i.test(norm)) return "uncategorized";

  if (isMajorNumbered) return "uncategorized";

  return null;
}

export async function extractPdfEvidence(buffer: ArrayBuffer, filename: string): Promise<ExtractedPdfEvidence> {
  const result: ExtractedPdfEvidence = {
    sourceDoc: filename,
    pages: [],
    sections: { experience: [], projects: [], education: [], certifications: [], skills: [], uncategorized: [] },
    extractedTechnologies: [],
    impactMetrics: [],
  };

  const uint8Array = new Uint8Array(buffer);
  
  const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
  let pdfDocument;
  try {
    pdfDocument = await loadingTask.promise;
    
    const pageCharCounts: number[] = [];
    
    for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
      const page = await pdfDocument.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      // Filter out rotated tokens (transform[1] !== 0 || transform[2] !== 0)
      const validItems = textContent.items.filter((item: any) => {
        if (item.transform && (item.transform[1] !== 0 || item.transform[2] !== 0)) {
          return false;
        }
        return true;
      }) as any[];
      
      // Vertical Band & Column Gutter detection
      
      // Calculate median char width
      let charWidths: number[] = [];
      validItems.forEach((item: any) => {
        if (item.str.length > 0) {
          charWidths.push(item.width / item.str.length);
        }
      });
      charWidths.sort((a, b) => a - b);
      const medianCharWidth = charWidths.length > 0 ? charWidths[Math.floor(charWidths.length / 2)] : 1;

      // Group items into lines
      validItems.sort((a: any, b: any) => b.transform[5] - a.transform[5] || a.transform[4] - b.transform[4]);
      
      const linesData: { y: number, items: any[], gutters: number[] }[] = [];
      let currentLine: any[] = [];
      let currentY = validItems.length > 0 ? validItems[0].transform[5] : 0;
      
      validItems.forEach((item: any) => {
        if (Math.abs(item.transform[5] - currentY) > 5) {
          if (currentLine.length > 0) linesData.push({ y: currentY, items: currentLine, gutters: [] });
          currentLine = [item];
          currentY = item.transform[5];
        } else {
          currentLine.push(item);
        }
      });
      if (currentLine.length > 0) linesData.push({ y: currentY, items: currentLine, gutters: [] });

      // Find gutters for each line
      linesData.forEach(line => {
        line.items.sort((a: any, b: any) => a.transform[4] - b.transform[4]);
        for (let i = 0; i < line.items.length - 1; i++) {
          const item1 = line.items[i];
          const item2 = line.items[i+1];
          const gap = item2.transform[4] - (item1.transform[4] + item1.width);
          if (gap > 4 * medianCharWidth) {
            line.gutters.push(item1.transform[4] + item1.width + gap / 2);
          }
        }
      });

      // Robust multi-column detection: require at least 35% of page lines (min 8) to share a clear gutter
      const allGutters = linesData.flatMap(l => l.gutters);
      let commonGutterX: number | null = null;
      const minMatchingLines = Math.max(8, Math.floor(linesData.length * 0.35));
      for (const gx of allGutters) {
        const matchingLines = linesData.filter(l => l.gutters.some(g => Math.abs(g - gx) < 20));
        if (matchingLines.length >= minMatchingLines) {
          commonGutterX = gx;
          break;
        }
      }

      const pageLines: string[] = [];
      let pageChars = 0;

      if (commonGutterX !== null) {
        // Multi-column detected: Emit left column lines completely, then right column lines
        const leftLines: string[] = [];
        const rightLines: string[] = [];
        linesData.forEach(line => {
          const leftItems = line.items.filter(item => item.transform[4] < commonGutterX!);
          const rightItems = line.items.filter(item => item.transform[4] >= commonGutterX!);

          if (leftItems.length > 0) {
            const str = cleanLigatures(leftItems.map(i => i.str).join(' ').replace(/\s+/g, ' ').trim());
            if (str.length > 0) leftLines.push(str);
          }
          if (rightItems.length > 0) {
            const str = cleanLigatures(rightItems.map(i => i.str).join(' ').replace(/\s+/g, ' ').trim());
            if (str.length > 0) rightLines.push(str);
          }
        });
        pageLines.push(...leftLines, ...rightLines);
      } else {
        // Full-width banner slices without interior gutters
        linesData.forEach(line => {
          if (line.items.length > 0) {
            const lineStr = cleanLigatures(line.items.map(i => i.str).join(' ').replace(/\s+/g, ' ').trim());
            if (lineStr.length > 0) {
              pageLines.push(lineStr);
            }
          }
        });
      }

      validItems.forEach((item: any) => {
        pageChars += item.str ? item.str.length : 0;
      });
      
      const pageText = pageLines.join('\n');
      pageCharCounts.push(pageChars);
      result.pages.push({ pageNumber: pageNum, text: pageText.trim() });
    }
    
    // Scanned document check
    if (pdfDocument.numPages > 0 && pageCharCounts.every(c => c < 50)) {
      throw new Error("Scanned document skipped: No selectable text layer found.");
    }
    
    // Section Heading Normalization
    const lines = result.pages.flatMap(p => p.text.split('\n'));
    let currentSection: keyof typeof result.sections | null = null;

    for (let i = 0; i < lines.length; i++) {
      const rawLine = lines[i];
      const line = rawLine.trim();
      if (!line) continue;
      
      const detected = detectSectionHeading(line);
      if (detected) {
        currentSection = detected;
        // Check if next line is a wrapped parenthetical continuation of the heading (e.g. "every entry is evidence-backed)")
        if (line.includes("(") && !line.includes(")") && i + 1 < lines.length) {
          const nextTrimmed = lines[i + 1].trim();
          if (nextTrimmed.endsWith(")") && !nextTrimmed.includes(":")) {
            i++; // skip subtitle line
          }
        }
      } else {
        if (!currentSection) {
          currentSection = 'uncategorized';
        }
        result.sections[currentSection].push(line);
      }
    }

    const fullDocText = result.pages.map(p => p.text).join('\n');
    result.extractedTechnologies = extractTechnologies(fullDocText, result.sections.skills);
    result.impactMetrics = extractMetrics(fullDocText);
    
  } finally {
    if (pdfDocument && typeof (pdfDocument as any).destroy === 'function') {
      await (pdfDocument as any).destroy();
    } else if (loadingTask && typeof (loadingTask as any).destroy === 'function') {
      await (loadingTask as any).destroy();
    }
  }

  return result;
}
