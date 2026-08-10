/**
 * Pre-compilation Typst Source Sanitizer.
 * Cleans up invalid LLM-emitted syntax before sending to Typst WASM compiler:
 * 1. Strips stray angle-bracket email/domain constructs like `<yahoo.com>` or `<user@domain.com>`.
 *    (Typst interprets `<...>` as document label references, causing `label '<yahoo.com>' does not exist` compiler errors).
 * 2. Removes explicit `#label(<...>)` declarations.
 * 3. Normalizes font family declarations (e.g. `font: "liberation sans"` -> `font: "Liberation Sans"`).
 */

export function sanitizeTypstSource(source: string): string {
  if (!source || typeof source !== "string") {
    return source;
  }

  let sanitized = source;

  // 1. Remove explicit #label(<...>) syntax
  sanitized = sanitized.replace(/#label\s*\(\s*<[^>]+>\s*\);?/g, "");

  // 2. Strip angle brackets around email addresses like <user@domain.com> -> "user@domain.com"
  sanitized = sanitized.replace(/<([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>/g, "$1");

  // 3. Strip angle brackets around domain names like <yahoo.com> -> "yahoo.com"
  sanitized = sanitized.replace(/<([a-zA-Z0-9.-]+\.(?:com|org|net|edu|io|gov|me|dev|co))>/g, "$1");

  // 4. Normalize font family declarations (e.g., font: "liberation sans" -> font: "Liberation Sans")
  sanitized = sanitized.replace(
    /font\s*:\s*"(?:liberation sans|helvetica|arial|calibri|times new roman)"/gi,
    'font: "Liberation Sans"'
  );

  return sanitized;
}
