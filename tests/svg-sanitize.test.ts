import { describe, it, expect } from "vitest";
import { sanitizeTypstSvg } from "@/lib/typst/svg-sanitize";

describe("sanitizeTypstSvg fail-closed & allowlist policy", () => {
  it("fails closed when DOMParser is unavailable or input is empty", () => {
    expect(sanitizeTypstSvg("")).toEqual({ ok: false, error: "Preview SVG is empty." });
    const result = sanitizeTypstSvg('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    expect(result.ok).toBe(false);
  });

  it("blocks DOCTYPE, ENTITY declarations, and unsafe XML processing instructions before parsing even when DOMParser is available", () => {
    const validStubRoot = { localName: "svg", namespaceURI: "http://www.w3.org/2000/svg", childNodes: [], attributes: [], getAttribute: () => null, getAttributeNS: () => null, hasAttribute: () => false, setAttribute: () => {}, removeAttribute: () => {} };
    const fakeValidParser = {
      parseFromString: () => ({
        documentElement: validStubRoot,
        getElementsByTagName: () => [],
      }),
    } as unknown as DOMParser;
    const fakeSerializer = { serializeToString: () => "<svg/>" } as unknown as XMLSerializer;

    const doctype = sanitizeTypstSvg(
      '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://evil.invalid/x.dtd"><svg xmlns="http://www.w3.org/2000/svg"/>',
      { domParser: fakeValidParser, xmlSerializer: fakeSerializer }
    );
    expect(doctype.ok).toBe(false);

    const entity = sanitizeTypstSvg(
      '<!ENTITY xxe SYSTEM "file:///etc/passwd"><svg xmlns="http://www.w3.org/2000/svg"/>',
      { domParser: fakeValidParser, xmlSerializer: fakeSerializer }
    );
    expect(entity.ok).toBe(false);

    const stylesheetPi = sanitizeTypstSvg(
      '<?xml-stylesheet type="text/css" href="https://evil.invalid/steal.css"?><svg xmlns="http://www.w3.org/2000/svg"/>',
      { domParser: fakeValidParser, xmlSerializer: fakeSerializer }
    );
    expect(stylesheetPi.ok).toBe(false);

    const xmlDecl = sanitizeTypstSvg(
      '<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg"/>',
      { domParser: fakeValidParser, xmlSerializer: fakeSerializer }
    );
    expect(xmlDecl.ok).toBe(true);
  });

  it("fails closed on parsererror or non-SVG root documents", () => {
    const fakeErrorParser = {
      parseFromString: () => ({
        documentElement: { localName: "svg", namespaceURI: "http://www.w3.org/2000/svg" },
        getElementsByTagName: (tag: string) => (tag === "parsererror" ? [{}] : []),
      }),
    } as unknown as DOMParser;

    const fakeSerializer = { serializeToString: () => "<svg/>" } as unknown as XMLSerializer;

    const errRes = sanitizeTypstSvg("<svg><broken>", {
      domParser: fakeErrorParser,
      xmlSerializer: fakeSerializer,
    });
    expect(errRes.ok).toBe(false);

    const htmlRootParser = {
      parseFromString: () => ({
        documentElement: { localName: "html", namespaceURI: "http://www.w3.org/1999/xhtml" },
        getElementsByTagName: () => [],
      }),
    } as unknown as DOMParser;

    const htmlRes = sanitizeTypstSvg("<html/>", {
      domParser: htmlRootParser,
      xmlSerializer: fakeSerializer,
    });
    expect(htmlRes.ok).toBe(false);

    const prefixedSvgRootParser = {
      parseFromString: () => ({
        documentElement: {
          localName: "svg",
          prefix: "svg",
          namespaceURI: "http://www.w3.org/2000/svg",
        },
        getElementsByTagName: () => [],
      }),
    } as unknown as DOMParser;

    const prefixedRes = sanitizeTypstSvg(
      '<svg:svg xmlns:svg="http://www.w3.org/2000/svg"/>',
      {
        domParser: prefixedSvgRootParser,
        xmlSerializer: fakeSerializer,
      }
    );
    expect(prefixedRes.ok).toBe(false);
  });

  it("strips unsafe elements, styles, event handlers, and external refs while preserving safe Typst geometry and links", () => {
    const SVG_NS = "http://www.w3.org/2000/svg";
    const XHTML_NS = "http://www.w3.org/1999/xhtml";
    const XLINK_NS = "http://www.w3.org/1999/xlink";

    type StubAttr = { name: string; localName: string; value: string; namespaceURI: string | null };
    class StubEl {
      nodeType = 1;
      parentNode: StubEl | null = null;
      childNodes: StubEl[] = [];
      attributes: StubAttr[] = [];
      constructor(
        public localName: string,
        public namespaceURI: string = SVG_NS,
        attrs: Record<string, string> = {}
      ) {
        for (const [k, v] of Object.entries(attrs)) {
          this.setAttribute(k, v);
        }
      }
      get firstChild() {
        return this.childNodes[0] ?? null;
      }
      appendChild(child: StubEl) {
        if (child.parentNode) {
          child.parentNode.removeChild(child);
        }
        child.parentNode = this;
        this.childNodes.push(child);
        return child;
      }
      removeChild(child: StubEl) {
        const idx = this.childNodes.indexOf(child);
        if (idx >= 0) this.childNodes.splice(idx, 1);
        child.parentNode = null;
      }
      replaceChild(next: StubEl, prev: StubEl) {
        const idx = this.childNodes.indexOf(prev);
        if (idx >= 0) {
          prev.parentNode = null;
          next.parentNode = this;
          this.childNodes[idx] = next;
        }
      }
      hasAttribute(name: string) {
        return this.attributes.some((a) => a.name === name);
      }
      getAttribute(name: string) {
        return this.attributes.find((a) => a.name === name)?.value ?? null;
      }
      getAttributeNS(ns: string, local: string) {
        return this.attributes.find((a) => a.namespaceURI === ns && a.localName === local)?.value ?? null;
      }
      setAttribute(name: string, value: string) {
        const idx = this.attributes.findIndex((a) => a.name === name);
        const colon = name.indexOf(":");
        const localName = colon >= 0 ? name.slice(colon + 1) : name;
        const namespaceURI = name.startsWith("xlink:") ? XLINK_NS : null;
        const entry: StubAttr = { name, localName, value, namespaceURI };
        if (idx >= 0) this.attributes[idx] = entry;
        else this.attributes.push(entry);
      }
      removeAttribute(name: string) {
        this.attributes = this.attributes.filter((a) => a.name !== name);
      }
    }

    const root = new StubEl("svg", SVG_NS, {
      class: "typst-doc",
      viewBox: "0 0 596 842",
      onload: "alert(1)",
      style: "background:url(https://evil.invalid/x)",
    });
    const styleEl = new StubEl("style", SVG_NS);
    const scriptEl = new StubEl("script", SVG_NS);
    const foreignEl = new StubEl("foreignObject", SVG_NS);
    foreignEl.appendChild(new StubEl("div", XHTML_NS));

    const defsEl = new StubEl("defs", SVG_NS);
    const glyphPath = new StubEl("path", SVG_NS, { id: "g5t/Mrw8", d: "M 0 0 L 10 10 Z", onclick: "xss()" });
    const clipEl = new StubEl("clipPath", SVG_NS, { id: "clip1" });
    clipEl.appendChild(new StubEl("path", SVG_NS, { d: "M 0 0 L 10 10 Z" }));
    defsEl.appendChild(glyphPath);
    defsEl.appendChild(clipEl);

    const safeGroup = new StubEl("g", SVG_NS, { "clip-path": "url(#clip1)", fill: "#000" });
    const safeUse = new StubEl("use", SVG_NS, { x: "0", y: "0", href: "#g5t/Mrw8" });
    const evilUse = new StubEl("use", SVG_NS, { href: "https://evil.invalid/sprite.svg#x" });
    const badExtClipGroup = new StubEl("g", SVG_NS, { "clip-path": "url(https://evil.invalid/#clip)" });

    const safeLink = new StubEl("a", SVG_NS, { target: "_blank", "xlink:href": "https://example.com" });
    safeLink.appendChild(new StubEl("rect", SVG_NS, { class: "pseudo-link", width: "20", height: "10" }));

    const unsafeLink = new StubEl("a", SVG_NS, { "xlink:href": "javascript:alert(1)" });
    unsafeLink.appendChild(new StubEl("rect", SVG_NS, { width: "10", height: "10", fill: "#111" }));

    safeGroup.appendChild(safeUse);
    safeGroup.appendChild(evilUse);
    safeGroup.appendChild(badExtClipGroup);
    safeGroup.appendChild(safeLink);
    safeGroup.appendChild(unsafeLink);

    root.appendChild(styleEl);
    root.appendChild(scriptEl);
    root.appendChild(foreignEl);
    root.appendChild(defsEl);
    root.appendChild(safeGroup);

    const fakeDoc = {
      documentElement: root,
      getElementsByTagName: () => [],
      createElementNS: (ns: string, tag: string) => new StubEl(tag, ns),
    };

    const serializeNode = (el: StubEl): string => {
      const attrs = el.attributes.map((a) => `${a.name}="${a.value}"`).join(" ");
      const open = attrs ? `<${el.localName} ${attrs}>` : `<${el.localName}>`;
      return `${open}${el.childNodes.map(serializeNode).join("")}</${el.localName}>`;
    };

    const out = sanitizeTypstSvg("<svg/>", {
      domParser: { parseFromString: () => fakeDoc } as unknown as DOMParser,
      xmlSerializer: { serializeToString: (n: Node) => serializeNode(n as unknown as StubEl) } as unknown as XMLSerializer,
    });

    expect(out.ok).toBe(true);
    if (!out.ok) return;

    expect(out.svg).not.toContain("<style");
    expect(out.svg).not.toContain("<script");
    expect(out.svg).not.toContain("foreignObject");
    expect(out.svg).not.toContain("onload");
    expect(out.svg).not.toContain("onclick");
    expect(out.svg).not.toContain("javascript:");
    expect(out.svg).not.toContain("evil.invalid");
    expect(out.svg).toContain('viewBox="0 0 596 842"');
    expect(out.svg).toContain('fill="none"');
    expect(out.svg).toContain('id="g5t/Mrw8"');
    expect(out.svg).toContain('href="#g5t/Mrw8"');
    expect(out.svg).toContain('clip-path="url(#clip1)"');
    expect(out.svg).toContain('<a href="https://example.com/" target="_blank" rel="noopener noreferrer">');
    expect(out.svg).toContain('<rect class="pseudo-link" width="20" height="10" fill="transparent">');
  });

  it("normalizes CDATA sections to escaped text and strips namespaced attributes", () => {
    const SVG_NS = "http://www.w3.org/2000/svg";
    const EVIL_NS = "https://evil.invalid/ns";
    type StubNode = { nodeType: number; textContent?: string; parentNode: StubEl | null };
    type StubAttr = { name: string; localName: string; value: string; namespaceURI: string | null };
    class StubEl {
      nodeType = 1;
      parentNode: StubEl | null = null;
      childNodes: Array<StubEl | StubNode> = [];
      attributes: StubAttr[] = [];
      constructor(
        public localName: string,
        public namespaceURI: string = SVG_NS,
        attrs: StubAttr[] = []
      ) {
        this.attributes = attrs;
      }
      get firstChild() {
        return this.childNodes[0] ?? null;
      }
      appendChild(child: StubEl | StubNode) {
        child.parentNode = this;
        this.childNodes.push(child);
        return child;
      }
      removeChild(child: StubEl | StubNode) {
        const idx = this.childNodes.indexOf(child);
        if (idx >= 0) this.childNodes.splice(idx, 1);
        child.parentNode = null;
      }
      replaceChild(next: StubEl | StubNode, prev: StubEl | StubNode) {
        const idx = this.childNodes.indexOf(prev);
        if (idx >= 0) {
          prev.parentNode = null;
          next.parentNode = this;
          this.childNodes[idx] = next;
        }
      }
      hasAttribute(name: string) {
        return this.attributes.some((a) => a.name === name);
      }
      getAttribute(name: string) {
        return this.attributes.find((a) => a.name === name)?.value ?? null;
      }
      getAttributeNS(ns: string, local: string) {
        return this.attributes.find((a) => a.namespaceURI === ns && a.localName === local)?.value ?? null;
      }
      setAttribute(name: string, value: string) {
        const idx = this.attributes.findIndex((a) => a.name === name);
        const entry: StubAttr = { name, localName: name, value, namespaceURI: null };
        if (idx >= 0) this.attributes[idx] = entry;
        else this.attributes.push(entry);
      }
      removeAttribute(name: string) {
        this.attributes = this.attributes.filter((a) => a.name !== name);
      }
    }

    const root = new StubEl("svg", SVG_NS);
    const textEl = new StubEl("text", SVG_NS, [
      { name: "evil:id", localName: "id", value: "//bad", namespaceURI: EVIL_NS },
      { name: "x", localName: "x", value: "10", namespaceURI: null },
    ]);
    textEl.appendChild({ nodeType: 4, textContent: "<script>alert(1)</script>", parentNode: null });
    root.appendChild(textEl);

    const fakeDoc = {
      documentElement: root,
      getElementsByTagName: () => [],
      createElementNS: (ns: string, tag: string) => new StubEl(tag, ns),
      createTextNode: (text: string) => ({ nodeType: 3, textContent: text, parentNode: null }),
    };

    const escapeXml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const serializeNode = (node: StubEl | StubNode): string => {
      if (node.nodeType === 3) return escapeXml((node as StubNode).textContent ?? "");
      if (node.nodeType === 4) return `<![CDATA[${(node as StubNode).textContent ?? ""}]]>`;
      const el = node as StubEl;
      const attrs = el.attributes.map((a) => `${a.name}="${a.value}"`).join(" ");
      const open = attrs ? `<${el.localName} ${attrs}>` : `<${el.localName}>`;
      return `${open}${el.childNodes.map(serializeNode).join("")}</${el.localName}>`;
    };

    const out = sanitizeTypstSvg("<svg/>", {
      domParser: { parseFromString: () => fakeDoc } as unknown as DOMParser,
      xmlSerializer: { serializeToString: (n: Node) => serializeNode(n as unknown as StubEl) } as unknown as XMLSerializer,
    });

    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.svg).not.toContain("<![CDATA[");
    expect(out.svg).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(out.svg).not.toContain("evil:id");
    expect(out.svg).toContain('x="10"');
  });

  it("strips embedded <script> and <style> blocks with unescaped && before XML parsing while failing closed on malformed non-script XML", () => {
    const SVG_NS = "http://www.w3.org/2000/svg";
    let lastParsedInput = "";

    const validRoot = {
      localName: "svg",
      namespaceURI: SVG_NS,
      childNodes: [],
      attributes: [{ name: "class", localName: "class", value: "typst-doc", namespaceURI: null }],
      getAttribute: (n: string) => (n === "class" ? "typst-doc" : null),
      getAttributeNS: () => null,
      hasAttribute: (n: string) => n === "class",
      setAttribute: () => {},
      removeAttribute: () => {},
    };

    // Simulate Chromium's libxml2 behavior: any unescaped `&` (not `&amp;`/`&lt;`/etc.) triggers parsererror.
    const strictEntityParser = {
      parseFromString: (input: string) => {
        lastParsedInput = input;
        const withoutCommentsAndCdata = input
          .replace(/<!--[\s\S]*?-->/g, "")
          .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, "");
        const hasUnescapedAmpersand = /&(?!([A-Za-z_][A-Za-z0-9._-]*|#\d+|#x[0-9A-Fa-f]+);)/.test(
          withoutCommentsAndCdata
        );
        const hasUnbalancedTag = /<broken\b/i.test(withoutCommentsAndCdata);
        const hasUnclosedScript =
          /<script\b/i.test(withoutCommentsAndCdata) && !/<\/script\s*>/i.test(withoutCommentsAndCdata);
        if (hasUnescapedAmpersand || hasUnbalancedTag || hasUnclosedScript) {
          return {
            documentElement: { localName: "parsererror", namespaceURI: "http://www.mozilla.org/newlayout/xml/parsererror.xml" },
            getElementsByTagName: (tag: string) => (tag === "parsererror" ? [{}] : []),
          };
        }
        return {
          documentElement: validRoot,
          getElementsByTagName: () => [],
        };
      },
    } as unknown as DOMParser;

    const fakeSerializer = {
      serializeToString: () => '<svg xmlns="http://www.w3.org/2000/svg" class="typst-doc" fill="none"></svg>',
    } as unknown as XMLSerializer;

    const typstLikeSvg = [
      '<svg class="typst-doc" viewBox="0 0 596 842" xmlns="http://www.w3.org/2000/svg">',
      '<style type="text/css">.pseudo-link { fill: transparent; } svg > g { opacity: 1; }</style>',
      '<style type="text/css"></style>',
      '<!-- <script> comment should not swallow following group -->',
      '<g class="typst-page"><path d="M 0 0 L 10 10 Z" fill="#000"/></g>',
      '<script type="text/javascript" data-guard="a>b">n&gt;u&&(t[r]=e,i());p&&q();</script >',
      '<svg:script src="https://evil.invalid/x.js"/>',
      "</svg>",
    ].join("");

    const okResult = sanitizeTypstSvg(typstLikeSvg, {
      domParser: strictEntityParser,
      xmlSerializer: fakeSerializer,
    });
    expect(okResult.ok).toBe(true);
    expect(lastParsedInput).not.toContain("n&gt;u&&");
    expect(lastParsedInput).not.toContain("<svg:script");
    expect(lastParsedInput).not.toContain("<style");
    expect(lastParsedInput).toContain("<!-- <script> comment should not swallow following group -->");
    expect(lastParsedInput).toContain('<g class="typst-page">');

    // Malformed non-script XML must still fail closed.
    const badEntityOutsideScript = sanitizeTypstSvg(
      '<svg xmlns="http://www.w3.org/2000/svg"><text>AT&T</text><script>a&&b</script></svg>',
      { domParser: strictEntityParser, xmlSerializer: fakeSerializer }
    );
    expect(badEntityOutsideScript.ok).toBe(false);

    const badBrokenTag = sanitizeTypstSvg(
      '<svg xmlns="http://www.w3.org/2000/svg"><broken><script>a&&b</script></svg>',
      { domParser: strictEntityParser, xmlSerializer: fakeSerializer }
    );
    expect(badBrokenTag.ok).toBe(false);

    // Unclosed <script> must fail closed.
    const unclosedScript = sanitizeTypstSvg(
      '<svg xmlns="http://www.w3.org/2000/svg"><script>a&&b</svg>',
      { domParser: strictEntityParser, xmlSerializer: fakeSerializer }
    );
    expect(unclosedScript.ok).toBe(false);

    // Split/nested <scr<script>...</script>ipt> bypass attempt with && must fail closed.
    const splitScriptBypass = sanitizeTypstSvg(
      '<svg xmlns="http://www.w3.org/2000/svg"><scr<script>a&&b</script>ipt>c&&d</script></svg>',
      { domParser: strictEntityParser, xmlSerializer: fakeSerializer }
    );
    expect(splitScriptBypass.ok).toBe(false);

    // Stripped <script>/<style> containing "<?" or "<!DOCTYPE" strings should pass cleanly,
    // while unclosed <script> containing "<!DOCTYPE" or non-XML whitespace after "<?xml" must fail closed.
    const piInsideStrippedScript = sanitizeTypstSvg(
      '<svg xmlns="http://www.w3.org/2000/svg"><script>const x = "<?php <!DOCTYPE html>";</script><g/></svg>',
      { domParser: strictEntityParser, xmlSerializer: fakeSerializer }
    );
    expect(piInsideStrippedScript.ok).toBe(true);

    const doctypeInsideUnclosedScript = sanitizeTypstSvg(
      '<svg xmlns="http://www.w3.org/2000/svg"><script><!DOCTYPE svg></svg>',
      { domParser: strictEntityParser, xmlSerializer: fakeSerializer }
    );
    expect(doctypeInsideUnclosedScript.ok).toBe(false);

    const nbspXmlDecl = sanitizeTypstSvg(
      '<?xml\u00a0version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"/>',
      { domParser: strictEntityParser, xmlSerializer: fakeSerializer }
    );
    expect(nbspXmlDecl.ok).toBe(false);
  });
});
