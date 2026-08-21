export interface CanonicalJdFields {
  title?: string;
  company?: string;
  location?: string;
  salary?: string;
  description: string;
}

export const JD_PASTE_TEMPLATE = `# Role title

Company: Company name
Location: City or Remote

## Job description

Paste the full posting here.

## Requirements

-

## Preferred

-
`;

export function formatCanonicalJobDescription(fields: CanonicalJdFields): string {
  const lines: string[] = [];
  const title = fields.title?.trim();
  const company = fields.company?.trim();
  const location = fields.location?.trim();
  const salary = fields.salary?.trim();
  const description = convertHtmlToCleanMarkdown(fields.description).trim();

  if (title) {
    lines.push(`# ${title}`, "");
  }
  if (company) lines.push(`Company: ${company}`);
  if (location) lines.push(`Location: ${location}`);
  if (salary) lines.push(`Salary: ${salary}`);
  if (company || location || salary) lines.push("");

  const alreadyHasDescriptionHeader = /^##\s+job description\b/im.test(description);
  if (!alreadyHasDescriptionHeader) {
    lines.push("## Job description", "");
  }
  lines.push(description);
  return `${lines.join("\n").trim()}\n`;
}

const META_LINE = /^(Company|Location|Salary|Posted)\s*:/i;

export type JobDescriptionBlock =
  | { type: "title"; text: string }
  | { type: "heading"; level: 2 | 3; text: string }
  | { type: "meta"; items: Array<{ label: string; value: string }> }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] };

export function isAtsWidgetNoise(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (/^\{\s*"widget"\s*:/.test(trimmed) || /"externalSpa"\s*:/.test(trimmed)) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      return Boolean(parsed && typeof parsed === "object" && (parsed.widget || parsed.externalSpa));
    } catch {
      return true;
    }
  }
  return false;
}

export function stripAtsWidgetJson(text: string): string {
  return text.replace(/\{[^{}]*"(?:widget|externalSpa)"[^{}]*\}/g, " ").replace(/[ \t]+\n/g, "\n");
}

function headingPrefixForTag(tag: string): string {
  const level = Number(tag.slice(1));
  if (level <= 1) return "# ";
  if (level === 2) return "## ";
  return "### ";
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#x2B;/gi, "+")
    .replace(/&#(\d+);/g, (_, n) => {
      const code = Number(n);
      return Number.isFinite(code) && code >= 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : _;
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => {
      const code = parseInt(n, 16);
      return Number.isFinite(code) && code >= 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : _;
    });
}

export function convertHtmlToCleanMarkdown(htmlContent: string): string {
  if (!htmlContent) return "";

  let text = htmlContent;
  for (let i = 0; i < 3; i++) {
    const next = decodeHtmlEntities(text);
    if (next === text) break;
    text = next;
  }

  text = text.replace(/<script[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style[\s\S]*?<\/style>/gi, "");
  text = text.replace(/<a\b[^>]*>([\s\S]*?)<\/a>/gi, "$1");
  text = text.replace(/<(?:strong|b)[^>]*>([\s\S]*?)<\/(?:strong|b)>/gi, "**$1**");
  text = text.replace(/<(?:em|i)[^>]*>([\s\S]*?)<\/(?:em|i)>/gi, "*$1*");
  text = text.replace(/<\/?(?:span|font)[^>]*>/gi, "");
  text = text.replace(/<h([1-6])[^>]*>\s*/gi, (_match, level: string) => `\n\n${headingPrefixForTag(`h${level}`)}`);
  text = text.replace(/<\/h[1-6]>/gi, "\n\n");
  text = text.replace(/<li[^>]*>\s*/gi, "\n- ");
  text = text.replace(/<\/li>/gi, "\n");
  text = text.replace(/<\/?(?:ul|ol)[^>]*>/gi, "\n");
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<\/?(?:p|div|section|article|tr|blockquote)[^>]*>/gi, "\n");
  text = text.replace(/<[^>]+>/g, " ");
  text = decodeHtmlEntities(text);
  text = stripAtsWidgetJson(text);

  const lines = text
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter((line) => line.length > 0 && !isAtsWidgetNoise(line));

  const blocks: string[] = [];
  let listBuf: string[] = [];
  const flushList = () => {
    if (listBuf.length > 0) {
      blocks.push(listBuf.join("\n"));
      listBuf = [];
    }
  };
  for (const line of lines) {
    if (line.startsWith("- ") || /^\d+\.\s/.test(line)) {
      listBuf.push(line);
    } else {
      flushList();
      blocks.push(line);
    }
  }
  flushList();
  return blocks.join("\n\n");
}

export function parseJobDescriptionMarkdown(markdown: string): JobDescriptionBlock[] {
  const cleaned = convertHtmlToCleanMarkdown(markdown);
  if (!cleaned.trim()) return [];

  const rawBlocks = cleaned.split(/\n{2,}/);
  const parsed: JobDescriptionBlock[] = [];

  const flushMeta = (items: Array<{ label: string; value: string }>) => {
    if (items.length > 0) parsed.push({ type: "meta", items: [...items] });
    items.length = 0;
  };

  const metaBuf: Array<{ label: string; value: string }> = [];

  for (const raw of rawBlocks) {
    const block = raw.trim();
    if (!block || isAtsWidgetNoise(block)) continue;

    const heading = block.match(/^(#{1,3})\s+(.+)$/);
    if (heading && !block.includes("\n")) {
      flushMeta(metaBuf);
      const level = heading[1].length;
      const text = heading[2].trim();
      if (level === 1) parsed.push({ type: "title", text });
      else parsed.push({ type: "heading", level: level === 2 ? 2 : 3, text });
      continue;
    }

    const listLines = block.split("\n").filter((line) => line.startsWith("- ") || /^\d+\.\s/.test(line));
    if (listLines.length > 0 && listLines.length === block.split("\n").length) {
      flushMeta(metaBuf);
      parsed.push({
        type: "list",
        items: listLines.map((line) => line.replace(/^(?:- |\d+\.\s)/, "").trim()),
      });
      continue;
    }

    const metaMatch = block.match(META_LINE);
    if (metaMatch && !block.includes("\n")) {
      const value = block.slice(block.indexOf(":") + 1).trim();
      metaBuf.push({ label: metaMatch[1], value });
      continue;
    }

    flushMeta(metaBuf);
    parsed.push({ type: "paragraph", text: block });
  }

  flushMeta(metaBuf);
  return parsed;
}

/**
 * Fast HTML cleaner that strips script/style tags, DOM boilerplate, and collapses whitespace
 * for clean LLM parser ingestion.
 */
export function cleanJobHtml(raw: string): string {
  if (!raw) return "";
  return raw
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, "")
    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, "")
    .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, "")
    .replace(/<aside\b[^<]*(?:(?!<\/aside>)<[^<]*)*<\/aside>/gi, "")
    .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, "")
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, "")
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Bookmarklet script for 1-click clipboard extraction of job descriptions from walled gardens (LinkedIn, Workday).
 */
export const BOOKMARKLET_EXTRACT_SNIPPET = `javascript:(function(){const t=window.getSelection().toString()||document.querySelector('.jobs-description__content,#job-details,.job-description,main,article')?.innerText||document.body.innerText;navigator.clipboard.writeText(t).then(()=>alert('Job description copied! Return to ResumeForge and paste.')).catch(()=>prompt('Copy job text:',t));})();`;

