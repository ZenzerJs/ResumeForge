import { isDemoMode } from "@/lib/demo-mode";

function originOf(raw: string | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  try {
    const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const parsed = new URL(withProto);
    if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

/**
 * Server env API keys attach only to trusted origins, including scheme and port.
 * A request-supplied baseUrl on a different origin must bring its own apiKey.
 */
export function resolveProviderCredentials(input: {
  configApiKey?: string;
  configBaseUrl?: string;
  envApiKey?: string;
  envBaseUrl?: string;
  defaultBaseUrl: string;
  officialHosts: string[];
}): { apiKey: string | undefined; baseUrl: string } {
  const clientKey = input.configApiKey?.trim() || undefined;
  const clientBase = input.configBaseUrl?.trim() || undefined;
  const envKey = isDemoMode() ? undefined : input.envApiKey?.trim() || undefined;
  const envBase = isDemoMode() ? undefined : input.envBaseUrl?.trim() || undefined;
  const baseUrl = (clientBase || envBase || input.defaultBaseUrl).replace(/\/+$/, "");

  const trusted = new Set(input.officialHosts.map(originOf).filter((origin) => origin !== null));
  const envOrigin = originOf(envBase);
  const defaultOrigin = originOf(input.defaultBaseUrl);
  if (envOrigin) trusted.add(envOrigin);
  if (defaultOrigin) trusted.add(defaultOrigin);

  let apiKey = clientKey;
  if (!apiKey) {
    const clientOrigin = originOf(clientBase);
    if (!clientBase || (clientOrigin !== null && trusted.has(clientOrigin))) {
      apiKey = envKey;
    }
  }

  return { apiKey, baseUrl };
}
