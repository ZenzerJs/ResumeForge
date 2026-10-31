/** Verified destinations originate from PDF annotations, never from model output. */
export interface InlineLink { url: string; label?: string; page?: number; span?: { start: number; end: number } }
export interface InlineEmphasis { start: number; end: number; kind: "bold" | "italic" }
type Token = { start: number; end: number; href?: string; emphasis?: InlineEmphasis["kind"]; linkIndex?: number };

function escapeRegex(value: string): string { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function escapeContent(value: string): string {
  return value.replace(/([\\#\[\]*_@$<>`\/=+~^-])/g, "\\$1")
    .replace(/^(\s*\d+)\./gm, "$1\\.");
}
function escapeString(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r/g, "\\r").replace(/\n/g, "\\n")}"`;
}
function safeDestination(value: string): string | null {
  try {
    const url = new URL(value);
    if (!["http:", "https:", "mailto:"].includes(url.protocol.toLowerCase()) || /[\r\n\u0000-\u001f]/.test(value)) return null;
    if ((url.protocol === "http:" || url.protocol === "https:") && (!url.hostname || url.username || url.password)) return null;
    return url.href;
  } catch { return null; }
}

/** Shared state prevents repeated destinations while preserving every visible label. */
export function createInlineRenderer(links: InlineLink[] = [], source?: string) {
  const used = new Set<string>();
  const represented = new Set<number>();
  const issues: string[] = [];
  const unsafe = new Set<number>();
  links.forEach((link, index) => {
    if (!safeDestination(link.url)) {
      unsafe.add(index);
      issues.push(`A PDF link uses an unsupported or invalid destination and needs review: ${link.url}`);
    }
  });

  function render(text: string, emphasis: InlineEmphasis[] = [], blockStart?: number): string {
    const tokens: Token[] = [];
    const free = (start: number, end: number) => tokens.every((token) => end <= token.start || start >= token.end);
    // Only unambiguous labels or verified source spans can bind an annotation.
    links.forEach((link, index) => {
      let label = link.label || link.url;
      // A displayed scheme-less address can identify the same verified annotation.
      if (!text.includes(label)) {
        try {
          const url = new URL(link.url);
          const address = `${url.host}${url.pathname}${url.search}${url.hash}`.replace(/\/$/, "");
          if (["http:", "https:"].includes(url.protocol) && text.replace(/\/$/, "") === address) label = text;
        } catch { /* Invalid destinations are handled below. */ }
      }
      if (!label || represented.has(index)) return;
      let start = text.indexOf(label);
      if (source !== undefined) {
        const matches = [...source.matchAll(new RegExp(escapeRegex(label), "g"))];
        if (link.span) {
          const { start: sourceStart, end } = link.span;
          if (!Number.isInteger(sourceStart) || !Number.isInteger(end) || sourceStart < 0 || end <= sourceStart || end > source.length || source.slice(sourceStart, end) !== label) return;
          if (links.some((other, otherIndex) => otherIndex !== index && other.span?.start === sourceStart && other.span.end === end && safeDestination(other.url) !== safeDestination(link.url))) return;
          if (blockStart === undefined || sourceStart < blockStart || end > blockStart + text.length || text !== source.slice(blockStart, blockStart + text.length)) return;
          start = sourceStart - blockStart;
        } else if (matches.length !== 1 || links.filter((candidate) => !candidate.span && (candidate.label || candidate.url) === label).length > 1) return;
      }
      if (start < 0 || !free(start, start + label.length)) return;
      tokens.push({ start, end: start + label.length, href: unsafe.has(index) ? undefined : link.url, linkIndex: index });
      represented.add(index);
    });
    const pattern = /https?:\/\/[^\s<>\[\]()"']+|(?:linkedin\.com\/in\/|github\.com\/|gitlab\.com\/)[A-Za-z0-9_./-]+|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/gi;
    for (const match of text.matchAll(pattern)) {
      const visible = match[0].replace(/[.,;:!?]+$/, "");
      const start = match.index!;
      if (!visible || !free(start, start + visible.length)) continue;
      const href = visible.includes("@") && !/^https?:/i.test(visible) ? `mailto:${visible}` : /^https?:/i.test(visible) ? visible : `https://${visible}`;
      if (safeDestination(href)) tokens.push({ start, end: start + visible.length, href });
    }
    for (const span of emphasis) {
      if (!Number.isInteger(span.start) || !Number.isInteger(span.end) || span.start < 0 || span.end <= span.start || span.end > text.length || !["bold", "italic"].includes(span.kind) || !free(span.start, span.end)) throw new Error("Invalid or overlapping emphasis span");
      tokens.push({ start: span.start, end: span.end, emphasis: span.kind });
    }
    tokens.sort((a, b) => a.start - b.start);
    let output = "";
    let offset = 0;
    for (const token of tokens) {
      output += escapeContent(text.slice(offset, token.start));
      const label = escapeContent(text.slice(token.start, token.end));
      const canonical = token.href ? safeDestination(token.href) : null;
      if (canonical && !used.has(canonical)) {
        used.add(canonical);
        output += `#link(${escapeString(token.href!)})[${label}]`;
      } else if (token.emphasis) {
        output += token.emphasis === "bold" ? `#strong[${label}]` : `#emph[${label}]`;
      } else output += label;
      offset = token.end;
    }
    return output + escapeContent(text.slice(offset));
  }

  /** Annotation labels absent from source are displayed once, in their original order. */
  function renderRemaining(): string[] {
    const result: string[] = [];
    links.forEach((link, index) => {
      if (represented.has(index)) return;
      represented.add(index);
      const canonical = safeDestination(link.url);
      if (canonical && used.has(canonical)) return;
      if (!unsafe.has(index)) issues.push(`A PDF link could not be placed unambiguously and needs review: ${link.label || link.url}`);
      const label = escapeContent(link.label || link.url);
      if (canonical && !used.has(canonical)) {
        used.add(canonical);
        result.push(`#link(${escapeString(link.url)})[${label}]`);
      } else result.push(label);
    });
    return result;
  }
  return { render, renderRemaining, issues, usedDestinations: used };
}

export function renderInlineContent(value: string, links: InlineLink[] = []) {
  const renderer = createInlineRenderer(links);
  const content = renderer.render(value);
  return { content, issues: renderer.issues, usedDestinations: [...renderer.usedDestinations] };
}
