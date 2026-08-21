export type JobDescriptionSectionKind =
  | "ABOUT_COMPANY"
  | "ROLE_SUMMARY"
  | "RESPONSIBILITIES"
  | "REQUIRED"
  | "PREFERRED"
  | "COMPENSATION"
  | "BENEFITS"
  | "OTHER";

export interface JobDescriptionSection {
  id: string;
  kind: JobDescriptionSectionKind;
  heading: string;
  markdown: string;
  sourceStart: number;
  sourceEnd: number;
}

export type RequirementCategory =
  | "SKILL"
  | "EXPERIENCE"
  | "EDUCATION"
  | "CERTIFICATION"
  | "DOMAIN";

export type RequirementPriority = "REQUIRED" | "PREFERRED" | "UNKNOWN";

export type RequirementConfidence = "EXPLICIT" | "USER_ADDED" | "INFERRED";

export interface ProvenanceRequirement {
  id: string;
  label: string;
  category: RequirementCategory;
  priority: RequirementPriority;
  sourceQuote: string;
  sourceSectionId: string;
  sourceStart: number;
  sourceEnd: number;
  confidence: RequirementConfidence;
}

export type SourceKind = "GREENHOUSE" | "LEVER" | "ASHBY" | "JSON_LD" | "HTML" | "PASTED";

export interface JobDescriptionDocument {
  sourceUrl?: string;
  sourceKind: SourceKind;
  acquiredAt: string;
  contentHash: string;
  rawText: string;
  normalizedMarkdown: string;
  sections: JobDescriptionSection[];
  requirements: ProvenanceRequirement[];
  diagnostics: {
    status: "VERIFIED_ATS" | "STRUCTURED_PAGE" | "PARTIAL_EXTRACTION" | "USER_PASTED";
    warnings: string[];
  };
}

export interface ParseJobDescriptionOptions {
  text?: string;
  html?: string;
  sourceUrl?: string;
  sourceKind?: SourceKind | string;
  rawJson?: any;
}

/**
 * Classifies section headings using deterministic alias dictionaries.
 */
export function classifySectionHeading(heading: string): JobDescriptionSectionKind {
  const norm = heading.toLowerCase().trim();
  if (
    norm.includes("about the company") ||
    norm.includes("about us") ||
    norm.includes("who we are") ||
    norm.includes("company overview") ||
    norm.includes("our mission")
  ) {
    return "ABOUT_COMPANY";
  }
  if (
    norm.includes("about the role") ||
    norm.includes("role summary") ||
    norm.includes("position overview") ||
    norm.includes("what to expect") ||
    norm.includes("job description") ||
    norm.includes("summary") ||
    norm === "the role"
  ) {
    return "ROLE_SUMMARY";
  }
  if (
    norm.includes("responsibilities") ||
    norm.includes("what you'll do") ||
    norm.includes("what you will do") ||
    norm.includes("what you'll be doing") ||
    norm.includes("key responsibilities") ||
    norm.includes("your impact") ||
    norm.includes("what you'll work on") ||
    norm.includes("duties")
  ) {
    return "RESPONSIBILITIES";
  }
  if (
    norm.includes("preferred qualifications") ||
    norm.includes("nice to have") ||
    norm.includes("bonus points") ||
    norm.includes("bonus qualifications") ||
    norm.includes("preferred experience") ||
    norm.includes("good to have") ||
    norm.includes("plus")
  ) {
    return "PREFERRED";
  }
  if (
    norm.includes("minimum qualifications") ||
    norm.includes("basic qualifications") ||
    norm.includes("requirements") ||
    norm.includes("what we're looking for") ||
    norm.includes("what you bring") ||
    norm.includes("what you need") ||
    norm.includes("who you are") ||
    norm.includes("must have") ||
    norm.includes("qualifications")
  ) {
    return "REQUIRED";
  }
  if (
    norm.includes("compensation") ||
    norm.includes("salary") ||
    norm.includes("pay range") ||
    norm.includes("salary range")
  ) {
    return "COMPENSATION";
  }
  if (
    norm.includes("benefits") ||
    norm.includes("perks") ||
    norm.includes("what we offer") ||
    norm.includes("why join us")
  ) {
    return "BENEFITS";
  }
  return "OTHER";
}

/**
 * Classifies requirement category from text semantics.
 */
export function classifyRequirementCategory(text: string): RequirementCategory {
  const norm = text.toLowerCase();
  if (
    norm.includes("bachelor") ||
    norm.includes("master") ||
    norm.includes("degree") ||
    norm.includes("phd") ||
    norm.includes("b.s.") ||
    norm.includes("m.s.") ||
    norm.includes("bs in ") ||
    norm.includes("ms in ") ||
    norm.includes("computer science degree")
  ) {
    return "EDUCATION";
  }
  if (
    norm.includes("years of experience") ||
    norm.includes("years experience") ||
    norm.includes("years of ") ||
    norm.includes("+ years") ||
    norm.includes("years in ") ||
    norm.includes("track record") ||
    norm.includes("proven experience")
  ) {
    return "EXPERIENCE";
  }
  if (
    norm.includes("certified") ||
    norm.includes("certification") ||
    norm.includes("license")
  ) {
    return "CERTIFICATION";
  }
  if (
    norm.includes("distributed systems") ||
    norm.includes("microservices") ||
    norm.includes("latency") ||
    norm.includes("fintech") ||
    norm.includes("security") ||
    norm.includes("machine learning") ||
    norm.includes("rag") ||
    norm.includes("llm") ||
    norm.includes("infrastructure") ||
    norm.includes("database") ||
    norm.includes("pci-dss")
  ) {
    return "DOMAIN";
  }
  return "SKILL";
}

/**
 * Generates deterministic 64-char hash of string content.
 */
export function computeContentHash(content: string): string {
  let hash1 = 0xdeadbeef;
  let hash2 = 0x41c6ce57;
  for (let i = 0; i < content.length; i++) {
    const ch = content.charCodeAt(i);
    hash1 = Math.imul(hash1 ^ ch, 2654435761);
    hash2 = Math.imul(hash2 ^ ch, 1597334677);
  }
  hash1 = Math.imul(hash1 ^ (hash1 >>> 16), 2246822507) ^ Math.imul(hash2 ^ (hash2 >>> 13), 3266489909);
  hash2 = Math.imul(hash2 ^ (hash2 >>> 16), 2246822507) ^ Math.imul(hash1 ^ (hash1 >>> 13), 3266489909);
  const hex1 = (4294967296 + (hash1 >>> 0)).toString(16).substring(1);
  const hex2 = (4294967296 + (hash2 >>> 0)).toString(16).substring(1);
  return (hex1 + hex2).repeat(4).slice(0, 64);
}

/**
 * Converts rich HTML content into formatted clean Markdown with preserved headings and lists.
 * Robust against malformed, unclosed, or mismatched HTML tags.
 */
export function htmlToMarkdown(html: string): string {
  let text = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<h[1-2][^>]*>(.*?)(?:<\/h[1-6]>|<\/div>|<\/p>|\n|$)/gi, "\n\n## $1\n\n")
    .replace(/<h[3-6][^>]*>(.*?)(?:<\/h[1-6]>|<\/div>|<\/p>|\n|$)/gi, "\n\n### $1\n\n")
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<p[^>]*>/gi, "\n\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, "**$1**")
    .replace(/<b[^>]*>(.*?)<\/b>/gi, "**$1**")
    .replace(/<em[^>]*>(.*?)<\/em>/gi, "*$1*")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return text;
}

/**
 * Parses structured job description document into canonical section spans and provenance requirements.
 */
export function parseJobDescriptionDocument(options: ParseJobDescriptionOptions): JobDescriptionDocument {
  const acquiredAt = new Date().toISOString();
  let rawText = "";
  let sourceKind: SourceKind = "PASTED";
  const warnings: string[] = [];

  // 1. Ingest from Raw JSON ATS Payload (Greenhouse, Lever, Ashby)
  if (options.rawJson) {
    const json = options.rawJson;
    if (json.content && typeof json.content === "string") {
      // Greenhouse
      sourceKind = "GREENHOUSE";
      rawText = htmlToMarkdown(json.content);
    } else if (json.lists && Array.isArray(json.lists)) {
      // Lever
      sourceKind = "LEVER";
      const sections: string[] = [];
      if (json.descriptionPlain) sections.push(`## Role Summary\n\n${json.descriptionPlain}`);
      for (const list of json.lists) {
        const heading = list.text || "Requirements";
        const content = htmlToMarkdown(list.content || "");
        sections.push(`## ${heading}\n\n${content}`);
      }
      if (json.additionalPlain) sections.push(`## Additional Information\n\n${json.additionalPlain}`);
      rawText = sections.join("\n\n");
    } else if (json.jobPosting && json.jobPosting.descriptionHtml) {
      // Ashby
      sourceKind = "ASHBY";
      rawText = htmlToMarkdown(json.jobPosting.descriptionHtml);
    }
  }

  // 2. Ingest from JSON-LD inside HTML
  if (!rawText && options.html) {
    const jsonLdMatch = options.html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
    if (jsonLdMatch) {
      try {
        const parsed = JSON.parse(jsonLdMatch[1]);
        const jobPosting = parsed["@type"] === "JobPosting" ? parsed : parsed["@graph"]?.find((item: any) => item["@type"] === "JobPosting");
        if (jobPosting && jobPosting.description) {
          sourceKind = "JSON_LD";
          rawText = htmlToMarkdown(jobPosting.description);
        }
      } catch {
        warnings.push("Failed to parse JSON-LD payload; falling back to page HTML extraction.");
      }
    }

    if (!rawText) {
      sourceKind = "HTML";
      rawText = htmlToMarkdown(options.html);
      if (rawText.length < 150) {
        warnings.push("Extracted content is very brief; page may be a client-side rendered SPA shell.");
      }
    }
  }

  // 3. Ingest from Plain Text
  if (!rawText && options.text) {
    sourceKind = (options.sourceKind as SourceKind) || "PASTED";
    rawText = options.text.trim();
  }

  if (!rawText) {
    rawText = "No description provided.";
    warnings.push("Empty input provided to document pipeline.");
  }

  const normalizedMarkdown = rawText.trim();
  const contentHash = computeContentHash(normalizedMarkdown);

  // 4. Split into Deterministic Section Spans
  const sections: JobDescriptionSection[] = [];
  const lines = normalizedMarkdown.split("\n");
  let currentHeading = "Overview";
  let currentLines: string[] = [];
  let currentStart = 0;
  let runningIndex = 0;
  let sectionCounter = 1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isHeading = /^#{1,3}\s+(.+)$/.test(line);

    if (isHeading) {
      if (currentLines.length > 0) {
        const md = currentLines.join("\n").trim();
        if (md) {
          const kind = classifySectionHeading(currentHeading);
          sections.push({
            id: `sec-${sectionCounter++}`,
            kind,
            heading: currentHeading,
            markdown: md,
            sourceStart: currentStart,
            sourceEnd: runningIndex - 1,
          });
        }
      }
      currentHeading = line.replace(/^#{1,3}\s+/, "").trim();
      currentLines = [];
      currentStart = runningIndex;
    } else {
      currentLines.push(line);
    }
    runningIndex += line.length + 1;
  }

  if (currentLines.length > 0) {
    const md = currentLines.join("\n").trim();
    if (md) {
      const kind = classifySectionHeading(currentHeading);
      sections.push({
        id: `sec-${sectionCounter++}`,
        kind,
        heading: currentHeading,
        markdown: md,
        sourceStart: currentStart,
        sourceEnd: runningIndex,
      });
    }
  }

  // 5. Extract Provenance-Preserving Requirements from Sections
  const requirements: ProvenanceRequirement[] = [];
  let reqCounter = 1;

  for (const sec of sections) {
    const isReqSection = sec.kind === "REQUIRED";
    const isPrefSection = sec.kind === "PREFERRED";

    if (isReqSection || isPrefSection || sec.kind === "RESPONSIBILITIES" || sec.kind === "OTHER") {
      const secLines = sec.markdown.split("\n");
      let secRunningOffset = sec.sourceStart;

      for (const line of secLines) {
        const bulletMatch = line.match(/^[-*•]\s+(.*)$/);
        if (bulletMatch) {
          const quote = bulletMatch[1].trim();
          if (quote.length >= 8) {
            const category = classifyRequirementCategory(quote);
            let priority: RequirementPriority = "UNKNOWN";
            if (isReqSection) priority = "REQUIRED";
            else if (isPrefSection) priority = "PREFERRED";
            else priority = "REQUIRED";

            requirements.push({
              id: `req-${reqCounter++}`,
              label: quote.length > 60 ? quote.slice(0, 57) + "..." : quote,
              category,
              priority,
              sourceQuote: quote,
              sourceSectionId: sec.id,
              sourceStart: secRunningOffset,
              sourceEnd: secRunningOffset + line.length,
              confidence: "EXPLICIT",
            });
          }
        }
        secRunningOffset += line.length + 1;
      }
    }
  }

  // Determine diagnostics status
  let status: "VERIFIED_ATS" | "STRUCTURED_PAGE" | "PARTIAL_EXTRACTION" | "USER_PASTED" = "USER_PASTED";
  if (sourceKind === "GREENHOUSE" || sourceKind === "LEVER" || sourceKind === "ASHBY") {
    status = "VERIFIED_ATS";
  } else if (sourceKind === "JSON_LD") {
    status = "STRUCTURED_PAGE";
  } else if (warnings.length > 0) {
    status = "PARTIAL_EXTRACTION";
  }

  return {
    sourceUrl: options.sourceUrl,
    sourceKind,
    acquiredAt,
    contentHash,
    rawText,
    normalizedMarkdown,
    sections,
    requirements,
    diagnostics: {
      status,
      warnings,
    },
  };
}

/**
 * Creates a user-added requirement with confidence: "USER_ADDED".
 */
export function createUserRequirement(
  label: string,
  category: RequirementCategory = "SKILL",
  priority: RequirementPriority = "REQUIRED"
): ProvenanceRequirement {
  const id = `user-req-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  return {
    id,
    label: label.trim(),
    category,
    priority,
    sourceQuote: label.trim(),
    sourceSectionId: "user-defined",
    sourceStart: 0,
    sourceEnd: 0,
    confidence: "USER_ADDED",
  };
}
