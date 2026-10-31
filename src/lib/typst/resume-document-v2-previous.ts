import { createInlineRenderer, type InlineLink } from "./inline-content";
import { ResumeDocumentSchema, typstString, type ResumeDocument, type LayoutProfile } from "./resume-document";

// Frozen renderer for exact validation of previously saved V2 source.
export function renderPreviousResumeDocument(input: ResumeDocument, profile: LayoutProfile = "comfortable", links: InlineLink[] = []) {
  const doc = ResumeDocumentSchema.parse(input);
  const inline = createInlineRenderer(links, doc.source);
  const gap = { comfortable: "0.55em", balanced: "0.35em", compact: "0.2em" }[profile];
  const renderBlocks = (blocks: ResumeDocument["header"]) => {
    const out: string[] = [];
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      if (block.kind === "entry-title") {
        const fields: Record<string, typeof block> = { "entry-title": block };
        while (i + 1 < blocks.length && ["entry-role", "entry-location", "entry-date"].includes(blocks[i + 1].kind)) {
          const next = blocks[i + 1];
          if (fields[next.kind] !== undefined) break;
          i++; fields[next.kind] = next;
        }
        const field = (kind: string) => fields[kind] ? `[${inline.render(fields[kind].text, [], fields[kind].span.start)}]` : `[]`;
        out.push(`#entry(title: ${field("entry-title")}, role: ${field("entry-role")}, location: ${field("entry-location")}, date: ${field("entry-date")})`);
      } else if (block.kind === "name") out.push(`#align(center)[#text(size: 21pt, weight: "bold")[${inline.render(block.text)}]]`);
      else if (block.kind === "contact") {
        const contacts = [block];
        while (i + 1 < blocks.length && blocks[i + 1].kind === "contact") contacts.push(blocks[++i]);
        const seenContacts = new Set<string>();
        const items = contacts.flatMap((contact) => contact.text.split(/\s*[|\u2022\u00b7]\s*/).filter(Boolean).map((text) => {
          const matching = links.filter((link) => {
            if (link.label === text || link.url === text) return true;
            try {
              const url = new URL(link.url);
              return ["http:", "https:"].includes(url.protocol) && `${url.host}${url.pathname}${url.search}${url.hash}`.replace(/\/$/, "") === text.replace(/\/$/, "");
            } catch { return false; }
          });
          const candidate = matching.length === 1 ? matching[0].url : /^(?:https?:\/\/|mailto:)/i.test(text) ? text : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text) ? `mailto:${text}` : /^(?:linkedin\.com\/in\/|github\.com\/|gitlab\.com\/)/i.test(text) ? `https://${text}` : null;
          let key: string | null = null;
          if (candidate) try { key = new URL(candidate).href.replace(/\/$/, ""); } catch { /* Preserve unrecognized text. */ }
          if (key && seenContacts.has(key)) return "";
          if (key) seenContacts.add(key);
          const rendered = inline.render(text);
          return text.length <= 45 ? `#box[${rendered}]` : rendered;
        })).filter(Boolean);
        out.push(`#align(center)[#text(size: 10pt)[${items.join(" #sym.dot ")}]]`);
      }
      else if (block.kind === "skill") {
        const text = block.text.replace(/\s*\r?\n\s*/g, " ");
        const colon = text.indexOf(":");
        const content = colon > 0
          ? `#strong[${inline.render(text.slice(0, colon + 1))}]${inline.render(text.slice(colon + 1))}`
          : inline.render(text);
        out.push(`#block(above: 0.35em, below: 0.15em)[${content}]`);
      }
      else if (block.kind === "bullet") {
        const prefix = block.text.match(/^\s*[-•]\s*/)?.[0].length || 0;
        out.push(`- ${inline.render(block.text.slice(prefix), [], block.span.start + prefix).replace(/\s*\r?\n\s*/g, " ")}`);
      }
      else out.push(`#block(above: 0.35em, below: 0.15em)[${inline.render(block.text, [], block.span.start)}]`);
    }
    return out.join("\n");
  };
  const header = renderBlocks(doc.header);
  const sections = doc.sections.map((s) => `#section(${typstString(s.heading.text)})\n${renderBlocks(s.blocks)}`).join("\n");
  const unresolved = inline.renderRemaining();
  const remainingLinks = unresolved.length ? `#section("Links requiring review")\n${unresolved.map((link) => `- ${link}`).join("\n")}` : "";
  const canonicalLinks = links.map(({ url, label, page, span }) => ({ url, label, page, span }));
  const metadata = btoa(Array.from(new TextEncoder().encode(JSON.stringify({ document: doc, links: canonicalLinks })), (byte) => String.fromCharCode(byte)).join(""));
  return `// ResumeForge layout v2\n// profile: ${profile}\n${doc.issues.length || inline.issues.length ? "// @layout-v2-review-required\n" : ""}#set page(paper: ${typstString(doc.paper)}, margin: (x: 0.65in, y: 0.6in))\n#set text(font: "Libertinus Serif", size: 10.5pt)\n#set par(leading: ${gap})\n#set list(marker: [•], indent: 0.2em, body-indent: 0.5em, spacing: 0.25em)\n#let section(title) = block(sticky: true, below: 0.4em)[#v(0.35em)#text(size: 11pt, weight: "bold")[#title]\n#line(length: 100%, stroke: 0.5pt + rgb("#777777"))]\n#let entry(title: [], role: [], location: [], date: []) = block(sticky: true, breakable: false)[#grid(columns: (1fr, 1fr), row-gutter: 1.75pt, [#strong(title)], [#align(right)[#location]], ..(if role != [] or date != [] { ([#emph(role)], [#align(right)[#date]]) } else { () }))]\n${header}\n${sections}\n${remainingLinks}\n// @resume-document-v2 ${metadata}\n`;
}
