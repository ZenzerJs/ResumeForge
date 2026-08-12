import type { ExtractedPdfLink } from "@/lib/pdf/parser";

function escapeTypstLabel(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/#/g, "\\#")
    .replace(/\$/g, "\\$")
    .replace(/@/g, "\\@");
}

/**
 * Ensures every scraped PDF hyperlink appears in Typst source as #link(...).
 * Injects any missing URLs after the first #align(center)[...] header block.
 */
export function ensureTypstLinks(source: string, links: ExtractedPdfLink[]): string {
  if (!source || !links?.length) return source;

  const missing = links.filter(
    (l) => l.url && !source.toLowerCase().includes(l.url.toLowerCase())
  );
  if (missing.length === 0) return source;

  const rendered = missing
    .map((l) => `#link("${l.url}")[${escapeTypstLabel(l.label || l.url)}]`)
    .join(" #sym.dot ");

  const injection = `\n#v(2pt)\n#align(center)[#text(size: 9pt, fill: rgb("#475569"))[${rendered}]]\n`;

  const alignStart = source.indexOf("#align(center)");
  if (alignStart !== -1) {
    const bracketStart = source.indexOf("[", alignStart);
    if (bracketStart !== -1) {
      let depth = 0;
      for (let i = bracketStart; i < source.length; i++) {
        const ch = source[i];
        if (ch === "[") depth++;
        else if (ch === "]") {
          depth--;
          if (depth === 0) {
            return source.slice(0, i + 1) + injection + source.slice(i + 1);
          }
        }
      }
    }
  }

  return `${source.trimEnd()}\n${injection}`;
}
