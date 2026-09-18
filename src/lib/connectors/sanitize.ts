import sanitizeHtml from "sanitize-html";

export interface SanitizedPayload {
  html: string;
  text: string;
}

/**
 * Sanitizes HTML job descriptions and extracts pure plain text for AI context and ATS scoring.
 */
export function sanitizeJobPayload(rawHtml: string): SanitizedPayload {
  if (!rawHtml || !rawHtml.trim()) {
    return { html: "", text: "" };
  }

  const html = sanitizeHtml(rawHtml, {
    allowedTags: [
      "h1",
      "h2",
      "h3",
      "h4",
      "p",
      "ul",
      "ol",
      "li",
      "strong",
      "em",
      "b",
      "i",
      "br",
      "code",
      "blockquote",
    ],
    allowedAttributes: {},
    disallowedTagsMode: "discard",
  });

  // Extract clean plain text
  const text = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n/g, "\n\n")
    .trim();

  return { html, text };
}
