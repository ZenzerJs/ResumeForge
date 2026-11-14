import { safeDestination } from "@/lib/typst/inline-content";

export type SvgSanitizeResult =
  | { ok: true; svg: string }
  | { ok: false; error: string };

const ALLOWED_SVG_TAGS = new Set([
  "svg",
  "g",
  "defs",
  "clipPath",
  "mask",
  "path",
  "use",
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "text",
  "tspan",
  "a",
  "title",
  "desc",
]);

const ALLOWED_SVG_ATTRS = new Set([
  "id",
  "class",
  "viewBox",
  "width",
  "height",
  "x",
  "y",
  "dx",
  "dy",
  "x1",
  "y1",
  "x2",
  "y2",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "d",
  "points",
  "transform",
  "fill",
  "fill-rule",
  "fill-opacity",
  "stroke",
  "stroke-width",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-miterlimit",
  "stroke-dasharray",
  "stroke-dashoffset",
  "stroke-opacity",
  "opacity",
  "clip-rule",
  "clip-path",
  "mask",
  "preserveAspectRatio",
  "text-anchor",
  "dominant-baseline",
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "letter-spacing",
]);

const SVG_NS = "http://www.w3.org/2000/svg";
const XLINK_NS = "http://www.w3.org/1999/xlink";

const SAFE_ID_PATTERN = /^[A-Za-z0-9_+.:/-]+$/;
const LOCAL_FRAGMENT_PATTERN = /^#[A-Za-z0-9_+.:/-]+$/;
const URL_FUNC_PATTERN = /^\s*url\(\s*(#[A-Za-z0-9_+.:/-]+)\s*\)\s*$/i;

function isSafeLocalFragment(value: string): boolean {
  const trimmed = value.trim();
  return LOCAL_FRAGMENT_PATTERN.test(trimmed) && !trimmed.startsWith("#//");
}

function isSafeId(value: string): boolean {
  const trimmed = value.trim();
  return SAFE_ID_PATTERN.test(trimmed) && !trimmed.startsWith("//");
}

function sanitizePaintOrRefValue(attrName: string, value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (attrName === "clip-path" || attrName === "mask") {
    const match = trimmed.match(URL_FUNC_PATTERN);
    if (!match) return null;
    return isSafeLocalFragment(match[1]) ? `url(${match[1]})` : null;
  }

  // For fill/stroke: allow solid/named colors, disallow external url(...) or CSS/script schemes.
  const lower = trimmed.toLowerCase();
  if (lower.includes("javascript:") || lower.includes("expression(")) {
    return null;
  }
  if (/url\s*\(/i.test(trimmed)) {
    const match = trimmed.match(URL_FUNC_PATTERN);
    if (!match || !isSafeLocalFragment(match[1])) return null;
    return `url(${match[1]})`;
  }

  return trimmed;
}

function sanitizeElementTree(doc: Document, root: Element): void {
  const stack: Element[] = [root];

  while (stack.length > 0) {
    const el = stack.pop()!;

    // Remove comments and processing instructions among children.
    for (const child of Array.from(el.childNodes)) {
      if (child.nodeType === 1) {
        const childEl = child as Element;
        if (childEl.namespaceURI !== SVG_NS || !ALLOWED_SVG_TAGS.has(childEl.localName)) {
          el.removeChild(childEl);
        } else {
          stack.push(childEl);
        }
      } else if (child.nodeType === 4) {
        // Normalize CDATA sections into plain text nodes so XMLSerializer never emits raw <![CDATA[...]]> into HTML5.
        el.replaceChild(doc.createTextNode(child.textContent ?? ""), child);
      } else if (child.nodeType !== 3) {
        // Only text and allowed elements stay.
        el.removeChild(child);
      }
    }

    // Strip disallowed attributes first.
    const rawHref =
      el.getAttribute("href") ??
      el.getAttributeNS(XLINK_NS, "href") ??
      el.getAttribute("xlink:href");
    const rawTarget = el.getAttribute("target");
    const classAttr = el.getAttribute("class") || "";

    for (const attr of Array.from(el.attributes)) {
      const name = attr.name;

      if (/^on/i.test(name) || name === "style") {
        el.removeAttribute(name);
        continue;
      }

      if (name === "xmlns" || name.startsWith("xmlns:")) {
        if (el === root && name === "xmlns" && attr.value === SVG_NS) {
          continue;
        }
        el.removeAttribute(name);
        continue;
      }

      if (attr.namespaceURI || !ALLOWED_SVG_ATTRS.has(name)) {
        el.removeAttribute(name);
        continue;
      }

      if (name === "id" && !isSafeId(attr.value)) {
        el.removeAttribute(name);
        continue;
      }

      if (name === "clip-path" || name === "mask" || name === "fill" || name === "stroke") {
        const safeVal = sanitizePaintOrRefValue(name, attr.value);
        if (safeVal === null) {
          el.removeAttribute(name);
        } else if (safeVal !== attr.value) {
          el.setAttribute(name, safeVal);
        }
      }
    }

    if (el.localName === "use") {
      if (rawHref && isSafeLocalFragment(rawHref)) {
        el.setAttribute("href", rawHref.trim());
      } else {
        el.parentNode?.removeChild(el);
        continue;
      }
    } else if (el.localName === "a") {
      const safeHref = rawHref ? safeDestination(rawHref.trim()) : null;
      if (safeHref) {
        el.setAttribute("href", safeHref);
        if (rawTarget === "_blank") {
          el.setAttribute("target", "_blank");
          el.setAttribute("rel", "noopener noreferrer");
        }
      } else {
        // Keep children inert if the link destination was invalid or unsafe.
        const replacementGroup = doc.createElementNS(SVG_NS, "g");
        while (el.firstChild) {
          replacementGroup.appendChild(el.firstChild);
        }
        el.parentNode?.replaceChild(replacementGroup, el);
      }
    }

    if (el === root && classAttr.split(/\s+/).includes("typst-doc") && !el.hasAttribute("fill")) {
      el.setAttribute("fill", "none");
    }
    if (el.localName === "rect" && classAttr.split(/\s+/).includes("pseudo-link") && !el.hasAttribute("fill")) {
      el.setAttribute("fill", "transparent");
    }
  }
}

function stripRawScriptAndStyleBlocks(raw: string): string {
  const out: string[] = [];
  let cursor = 0;

  while (cursor < raw.length) {
    const lt = raw.indexOf("<", cursor);
    if (lt === -1) {
      out.push(raw.slice(cursor));
      break;
    }

    if (raw.startsWith("<!--", lt)) {
      const commentEnd = raw.indexOf("-->", lt + 4);
      if (commentEnd === -1) {
        out.push(raw.slice(cursor));
        break;
      }
      out.push(raw.slice(cursor, commentEnd + 3));
      cursor = commentEnd + 3;
      continue;
    }

    if (raw.startsWith("<![CDATA[", lt)) {
      const cdataEnd = raw.indexOf("]]>", lt + 9);
      if (cdataEnd === -1) {
        out.push(raw.slice(cursor));
        break;
      }
      out.push(raw.slice(cursor, cdataEnd + 3));
      cursor = cdataEnd + 3;
      continue;
    }

    const openMatch = raw
      .slice(lt + 1, lt + 129)
      .match(/^(?:[A-Za-z_][A-Za-z0-9._-]*:)?(script|style)(?=[\s>/])/i);
    if (!openMatch) {
      out.push(raw.slice(cursor, lt + 1));
      cursor = lt + 1;
      continue;
    }

    const fullTagName = openMatch[0];
    let tagEnd = lt + 1 + fullTagName.length;
    let quote: string | null = null;
    let selfClosing = false;
    let foundTagEnd = false;

    while (tagEnd < raw.length) {
      const ch = raw[tagEnd];
      if (quote) {
        if (ch === quote) {
          quote = null;
        }
      } else if (ch === '"' || ch === "'") {
        quote = ch;
      } else if (ch === ">") {
        selfClosing = raw[tagEnd - 1] === "/";
        foundTagEnd = true;
        break;
      }
      tagEnd += 1;
    }

    if (!foundTagEnd) {
      out.push(raw.slice(cursor));
      break;
    }

    if (selfClosing) {
      out.push(raw.slice(cursor, lt));
      cursor = tagEnd + 1;
      continue;
    }

    const expectedTagLower = fullTagName.toLowerCase();
    let searchFrom = tagEnd + 1;
    let closeEnd = -1;

    while (searchFrom < raw.length) {
      const closeStart = raw.indexOf("</", searchFrom);
      if (closeStart === -1) break;
      const nameStart = closeStart + 2;
      const nameEnd = nameStart + expectedTagLower.length;
      if (
        nameEnd <= raw.length &&
        raw.slice(nameStart, nameEnd).toLowerCase() === expectedTagLower
      ) {
        let after = nameEnd;
        while (after < raw.length && /[ \t\r\n]/.test(raw[after])) {
          after += 1;
        }
        if (raw[after] === ">") {
          closeEnd = after + 1;
          break;
        }
      }
      searchFrom = closeStart + 2;
    }

    if (closeEnd === -1) {
      out.push(raw.slice(cursor));
      break;
    }

    out.push(raw.slice(cursor, lt));
    cursor = closeEnd;
  }

  return out.join("");
}

export function sanitizeTypstSvg(
  rawSvg: string,
  options?: { domParser?: DOMParser; xmlSerializer?: XMLSerializer }
): SvgSanitizeResult {
  if (typeof rawSvg !== "string" || !rawSvg.trim()) {
    return { ok: false, error: "Preview SVG is empty." };
  }

  const parser =
    options?.domParser ?? (typeof DOMParser !== "undefined" ? new DOMParser() : null);
  const serializer =
    options?.xmlSerializer ?? (typeof XMLSerializer !== "undefined" ? new XMLSerializer() : null);

  if (!parser || !serializer) {
    return {
      ok: false,
      error: "Browser XML parser unavailable to verify preview SVG safely.",
    };
  }

  // Typst WASM SVG embeds HTML-mode <script> (with unescaped &&) and <style> blocks
  // that are not valid XML PCDATA; strip them before strict XML parsing while still
  // dropping any residual disallowed elements in sanitizeElementTree.
  const preStrippedSvg = stripRawScriptAndStyleBlocks(rawSvg);

  if (/<!\s*(?:doctype|entity)\b/i.test(preStrippedSvg) || /<\?(?!xml[ \t\r\n])/i.test(preStrippedSvg)) {
    return {
      ok: false,
      error: "Preview SVG rejected unsafe XML declarations or processing instructions.",
    };
  }

  let doc: Document;
  try {
    doc = parser.parseFromString(preStrippedSvg, "image/svg+xml");
  } catch {
    return { ok: false, error: "Preview SVG could not be parsed as valid XML." };
  }

  if (
    !doc ||
    !doc.documentElement ||
    doc.getElementsByTagName("parsererror").length > 0 ||
    doc.documentElement.localName !== "svg" ||
    doc.documentElement.namespaceURI !== SVG_NS ||
    Boolean(doc.documentElement.prefix)
  ) {
    return {
      ok: false,
      error: "Preview SVG failed XML validation and was blocked.",
    };
  }

  const root = doc.documentElement;
  sanitizeElementTree(doc, root);
  root.setAttribute("xmlns", SVG_NS);

  return {
    ok: true,
    svg: serializer.serializeToString(root),
  };
}
