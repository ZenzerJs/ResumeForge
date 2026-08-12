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
  text = text.replace(/<\/?(?:strong|b|em|i|span|font)[^>]*>/gi, "");
  text = text.replace(/<h[1-6][^>]*>\s*/gi, "\n\n");
  text = text.replace(/<\/h[1-6]>/gi, "\n\n");
  text = text.replace(/<li[^>]*>\s*/gi, "\n- ");
  text = text.replace(/<\/li>/gi, "\n");
  text = text.replace(/<\/?(?:ul|ol)[^>]*>/gi, "\n");
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<\/?(?:p|div|section|article|tr|blockquote)[^>]*>/gi, "\n");
  text = text.replace(/<[^>]+>/g, " ");
  text = decodeHtmlEntities(text);

  const lines = text
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter((line) => line.length > 0);

  const blocks: string[] = [];
  let listBuf: string[] = [];
  const flushList = () => {
    if (listBuf.length > 0) {
      blocks.push(listBuf.join("\n"));
      listBuf = [];
    }
  };
  for (const line of lines) {
    if (line.startsWith("- ")) {
      listBuf.push(line);
    } else {
      flushList();
      blocks.push(line);
    }
  }
  flushList();
  return blocks.join("\n\n");
}
