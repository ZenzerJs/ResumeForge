/**
 * Single source of truth for company name normalization.
 * Strips all non-alphanumeric characters and converts to lowercase.
 */
export const normalizeCompany = (name: string): string =>
  (name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
