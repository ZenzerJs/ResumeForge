import type { ExtractedPdfLink } from "@/lib/pdf/parser";
import { safeDestination } from "@/lib/typst/inline-content";
import { typstContent, typstString } from "@/lib/typst/resume-document";

/**
 * Ensures every scraped PDF hyperlink appears in Typst source as #link(...).
 * Injects any missing URLs after the first #align(center)[...] header block.
 */
export function ensureTypstLinks(source: string, links: ExtractedPdfLink[]): string {
  if (!source || !links?.length) return source;

  const lowerSource = source.toLowerCase();
  const seenDestinations = new Set<string>();
  const renderedParts: string[] = [];

  for (const l of links) {
    if (!l.url) continue;
    const canonical = safeDestination(l.url);
    if (!canonical) {
      const visible = l.label || l.url;
      if (!lowerSource.includes(visible.toLowerCase())) {
        renderedParts.push(typstContent(visible));
      }
      continue;
    }

    const canonicalLower = canonical.toLowerCase();
    const rawLower = l.url.trim().toLowerCase();
    if (seenDestinations.has(canonicalLower)) continue;
    seenDestinations.add(canonicalLower);

    if (lowerSource.includes(canonicalLower) || lowerSource.includes(rawLower)) {
      continue;
    }

    renderedParts.push(`#link(${typstString(canonical)})[${typstContent(l.label || canonical)}]`);
  }

  if (renderedParts.length === 0) return source;

  const rendered = renderedParts.join(" #sym.dot ");
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
