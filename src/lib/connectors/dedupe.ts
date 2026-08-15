import crypto from "node:crypto";

const TRACKING_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "ref",
  "source",
  "gh_jid",
  "lever-source",
  "ashby_jid",
  "fbclid",
  "gclid",
  "trk",
  "tracking",
];

/**
 * Strips known marketing, analytics, and affiliate tracking parameters from job URLs.
 */
export function canonicalizeUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    for (const param of TRACKING_PARAMS) {
      url.searchParams.delete(param);
    }
    const cleanSearch = url.searchParams.toString();
    const query = cleanSearch ? `?${cleanSearch}` : "";
    return `${url.origin}${url.pathname.replace(/\/+$/, "")}${query}`;
  } catch {
    return rawUrl.trim().replace(/\/+$/, "");
  }
}

/**
 * Produces a deterministic SHA-256 fingerprint for deduplicating job listings.
 */
export function generateJobFingerprint(
  company: string,
  title: string,
  applyUrl: string
): string {
  const normCompany = company.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  const normTitle = title.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  const cleanUrl = canonicalizeUrl(applyUrl);

  return crypto
    .createHash("sha256")
    .update(`${normCompany}:${normTitle}:${cleanUrl}`)
    .digest("hex");
}
