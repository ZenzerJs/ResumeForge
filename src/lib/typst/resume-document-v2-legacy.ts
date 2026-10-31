import { createInlineRenderer, type InlineLink } from "./inline-content-v2-legacy";
import { ResumeDocumentSchema, typstString, type ResumeDocument, type LayoutProfile } from "./resume-document";

export function renderLegacyResumeDocument(input: ResumeDocument, profile: LayoutProfile = "comfortable", links: InlineLink[] = []) {
  const doc = ResumeDocumentSchema.parse(input);
  const inline = createInlineRenderer(links);
  const gap = { comfortable: "0.55em", balanced: "0.35em", compact: "0.2em" }[profile];
  const renderBlocks = (blocks: ResumeDocument["header"]) => {
    const out: string[] = [];
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      if (block.kind === "entry-title") {
        const fields: Record<string, string> = { "entry-title": block.text };
        while (i + 1 < blocks.length && ["entry-role", "entry-location", "entry-date"].includes(blocks[i + 1].kind)) {
          const next = blocks[i + 1];
          if (fields[next.kind] !== undefined) break;
          i++; fields[next.kind] = next.text;
        }
        out.push(`#entry(title: ${typstString(fields["entry-title"] || "")}, role: ${typstString(fields["entry-role"] || "")}, location: ${typstString(fields["entry-location"] || "")}, date: ${typstString(fields["entry-date"] || "")})`);
      } else if (block.kind === "name") out.push(`#align(center)[#text(size: 21pt, weight: "bold")[${inline.render(block.text)}]]`);
      else if (block.kind === "contact") {
        const contacts = [block];
        while (i + 1 < blocks.length && blocks[i + 1].kind === "contact") contacts.push(blocks[++i]);
        const items = contacts.map((contact) => {
          const rendered = inline.render(contact.text);
          // Very long contact items remain breakable so they cannot overflow the page.
          return contact.text.length <= 45 ? `#box[${rendered}]` : rendered;
        });
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
      else if (block.kind === "bullet") out.push(`- ${inline.render(block.text.replace(/^\s*[-•]\s*/, "").replace(/\s*\r?\n\s*/g, " "))}`);
      else out.push(`${inline.render(block.text)}\n`);
    }
    return out.join("\n");
  };
  const header = renderBlocks(doc.header);
  const sections = doc.sections.map((s) => `#section(${typstString(s.heading.text)})\n${renderBlocks(s.blocks)}`).join("\n");
  const remainingLinks = inline.renderRemaining().map((link) => `#align(center)[#text(size: 10pt)[${link}]]`).join("\n");
  const metadata = btoa(Array.from(new TextEncoder().encode(JSON.stringify({ document: doc, links })), (byte) => String.fromCharCode(byte)).join(""));
  return `// ResumeForge layout v2\n// profile: ${profile}\n${doc.issues.length || inline.issues.length ? "// @layout-v2-review-required\n" : ""}#set page(paper: ${typstString(doc.paper)}, margin: (x: 0.65in, y: 0.6in))\n#set text(font: "Libertinus Serif", size: 10.5pt)\n#set par(leading: ${gap})\n#set list(marker: [•], indent: 0.2em, body-indent: 0.5em, spacing: 0.25em)\n#let section(title) = block(sticky: true, below: 0.4em)[#v(0.35em)#text(size: 11pt, weight: "bold")[#title]\n#line(length: 100%, stroke: 0.5pt + rgb("#777777"))]\n#let entry(title: "", role: "", location: "", date: "") = block(sticky: true, breakable: false)[#grid(columns: (1fr, 1fr), row-gutter: 1.75pt, [*#title*], [#align(right)[#location]], ..(if role != "" or date != "" { ([#emph(role)], [#align(right)[#date]]) } else { () }))]\n${header}\n${remainingLinks}\n${sections}\n// @resume-document-v2 ${metadata}\n`;
}
