import * as pdfjsLib from 'pdfjs-dist';

if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/workers/pdf.worker.min.mjs';
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
      
      let pageText = '';
      let pageChars = 0;
      
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
          if (gap > 2 * medianCharWidth) {
            line.gutters.push(item1.transform[4] + item1.width + gap / 2);
          }
        }
      });

      // Simple heuristic for >= 3 consecutive lines with overlapping gutters
      // To emit left column before right column, if a gutter is consistent, we partition the items.
      // For simplicity in this implementation, we just split the page items into a left column and right column 
      // if we detect a persistent gutter (a gap present in >= 3 lines at roughly the same X coordinate).
      const allGutters = linesData.flatMap(l => l.gutters);
      let commonGutterX: number | null = null;
      for (const gx of allGutters) {
        const matchingLines = linesData.filter(l => l.gutters.some(g => Math.abs(g - gx) < 20));
        if (matchingLines.length >= 3) {
          commonGutterX = gx;
          break;
        }
      }

      const orderedItems: any[] = [];
      if (commonGutterX !== null) {
        // Multi-column detected: Emit left column completely, then right column
        const leftItems: any[] = [];
        const rightItems: any[] = [];
        linesData.forEach(line => {
          line.items.forEach(item => {
            if (item.transform[4] < commonGutterX!) leftItems.push(item);
            else rightItems.push(item);
          });
        });
        orderedItems.push(...leftItems, ...rightItems);
      } else {
        // Full-width banner slices without interior gutters
        linesData.forEach(line => {
          orderedItems.push(...line.items);
        });
      }

      orderedItems.forEach((item: any) => {
        pageText += item.str + ' ';
        pageChars += item.str.length;
      });
      
      pageCharCounts.push(pageChars);
      result.pages.push({ pageNumber: pageNum, text: pageText.trim() });
    }
    
    // Scanned document check
    if (pdfDocument.numPages > 0 && pageCharCounts.every(c => c < 50)) {
      throw new Error("Scanned document skipped: No selectable text layer found.");
    }
    
    // Section Heading Normalization
    const lines = result.pages.map(p => p.text).join('\n').split('\n');
    let currentSection: keyof typeof result.sections | null = null;
    
    const synonyms = {
      experience: ["EXPERIENCE", "WORK EXPERIENCE", "EMPLOYMENT HISTORY", "PROFESSIONAL EXPERIENCE", "PROFESSIONAL BACKGROUND"],
      projects: ["PROJECTS", "PERSONAL PROJECTS"],
      skills: ["SKILLS", "TECHNICAL SKILLS", "COMPETENCIES", "TECHNICAL COMPETENCIES"],
      education: ["EDUCATION", "ACADEMIC BACKGROUND"],
      certifications: ["CERTIFICATIONS", "COURSES"]
    };

    for (let line of lines) {
      line = line.trim();
      if (!line) continue;
      
      const upperLine = line.toUpperCase();
      let matched = false;
      
      for (const [key, aliases] of Object.entries(synonyms)) {
        if (aliases.includes(upperLine)) {
          currentSection = key as keyof typeof result.sections;
          matched = true;
          break;
        }
      }
      
      if (!matched && !currentSection) {
        currentSection = 'uncategorized';
      }

      if (!matched && currentSection) {
        result.sections[currentSection].push(line);
      }
    }
    
  } finally {
    if (pdfDocument && typeof (pdfDocument as any).destroy === 'function') {
      await (pdfDocument as any).destroy();
    } else if (loadingTask && typeof (loadingTask as any).destroy === 'function') {
      await (loadingTask as any).destroy();
    }
  }

  return result;
}
