export interface PreviewTextItem {
  text: string;
  page: number;
  left: number;
  top: number;
  width: number;
  height: number;
}
export interface PreviewLocation {
  page: number;
  left: number;
  top: number;
  width: number;
  height: number;
}

const normalize = (text: string) => text.replace(/\s+/g, " ").trim();
/** Only literal Typst text is eligible; markup needs a source map we do not have. */
export function literalPreviewText(text: string): string | null {
  text = text.replace(/^\s*[-+]\s+/, "").trim();
  if (!text.trim() || /[#*_$`\\\[\]<>@~]/.test(text)) return null;
  return normalize(text);
}
export function previewText(items: PreviewTextItem[]): string {
  return normalize(items.map((item) => item.text).join(" "));
}
/** Require whole PDF text items and unique, exact rendered text; never estimate glyph widths. */
export function locatePreviewText(
  items: PreviewTextItem[],
  anchor: string,
): PreviewLocation[] | null {
  const needle = literalPreviewText(anchor);
  if (!needle) return null;
  const matches: Array<[number, number]> = [];
  for (let start = 0; start < items.length; start++) {
    let text = "";
    for (let end = start; end < items.length; end++) {
      text = normalize(`${text} ${items[end].text}`);
      if (text === needle) matches.push([start, end]);
      if (text.length >= needle.length) break;
    }
  }
  if (matches.length !== 1) return null;
  const [start, end] = matches[0];
  return items
    .slice(start, end + 1)
    .map(({ page, left, top, width, height }) => ({
      page,
      left,
      top,
      width,
      height,
    }));
}
/** Differential compilation proves that changing this source occurrence changes only the located rendered text. */
export function provesPreviewMapping(
  original: PreviewTextItem[],
  probe: PreviewTextItem[],
  anchor: string,
  sentinel: string,
): boolean {
  const needle = literalPreviewText(anchor);
  if (
    !needle ||
    !locatePreviewText(original, anchor) ||
    !locatePreviewText(probe, sentinel)
  )
    return false;
  const originalText = previewText(original);
  const probeText = previewText(probe);
  const index = originalText.indexOf(needle);
  if (index < 0 || originalText.indexOf(needle, index + 1) !== -1) return false;
  return (
    originalText.slice(0, index) +
      sentinel +
      originalText.slice(index + needle.length) ===
    probeText
  );
}
