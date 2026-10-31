import { isDemoMode } from "@/lib/demo-mode";

function hostnameOf(raw: string | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  try {
    const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    return new URL(withProto).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Server env API keys attach only when the caller did not choose a foreign base URL.
 * A request-supplied baseUrl on a non-official host must bring its own apiKey.
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

  const trusted = new Set(input.officialHosts.map((host) => host.toLowerCase()));
  const envHost = hostnameOf(envBase);
  const defaultHost = hostnameOf(input.defaultBaseUrl);
  if (envHost) trusted.add(envHost);
  if (defaultHost) trusted.add(defaultHost);

  let apiKey = clientKey;
  if (!apiKey) {
    const clientHost = hostnameOf(clientBase);
    if (!clientBase || (clientHost !== null && trusted.has(clientHost))) {
      apiKey = envKey;
    }
  }

  return { apiKey, baseUrl };
}
