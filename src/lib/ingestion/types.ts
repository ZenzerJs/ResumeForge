/**
 * Ingestion failure taxonomy and shared extraction types.
 * Enforces structured reason codes across all job extractors.
 */

export type ExtractFailureCode =
  | "robots_disallowed"
  | "http_401_403"
  | "http_404"
  | "cloudflare_challenge"
  | "login_wall"
  | "js_shell_empty"
  | "consent_wall"
  | "pdf_or_binary"
  | "iframe_ats"
  | "no_job_schema"
  | "blocked_host" // linkedin, indeed search, facebook
  | "timeout"
  | "invalid_url";

export interface ExtractDiagnostics {
  url?: string;
  host?: string;
  path?: string;
  statusCode?: number;
  contentType?: string;
  htmlLength?: number;
  hasJsonLdJobPosting?: boolean;
  hasOpenGraph?: boolean;
  failureCode?: ExtractFailureCode;
  errorMessage?: string;
  timestamp: number;
}
