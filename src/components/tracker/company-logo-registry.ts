/** Curated official assets; source URLs are recorded in public/company-logos/SOURCES.json. */
const LOGOS: Record<string, string> = {
  "coinbase": "/company-logos/coinbase.png",
  "stripe": "/company-logos/stripe.ico",
  "shopify": "/company-logos/shopify.png",
  "linear": "/company-logos/linear.png",
  "vercel": "/company-logos/vercel.png",
  "anthropic": "/company-logos/anthropic.png",
  "openai": "/company-logos/openai.png",
  "cloudflare": "/company-logos/cloudflare.png",
  "datadog": "/company-logos/datadog.ico",
  "wealthsimple": "/company-logos/wealthsimple.png",
  "cohere": "/company-logos/cohere.png",
  "tailscale": "/company-logos/tailscale.png",
  "ramp": "/company-logos/ramp.png",
  "google": "/company-logos/google.ico",
  "microsoft": "/company-logos/microsoft.ico",
  "amazon": "/company-logos/amazon.ico",
  "apple": "/company-logos/apple.ico",
  "meta": "/company-logos/meta.ico",
  "github": "/company-logos/github.png",
};

const ALIASES: Record<string, string> = {
  "coinbase, inc.": "coinbase",
  "coinbase inc": "coinbase",
  "stripe, inc.": "stripe",
  "shopify inc.": "shopify",
  "openai, l.l.c.": "openai",
  "openai, inc.": "openai",
  "cloudflare, inc.": "cloudflare",
  "datadog, inc.": "datadog",
  "google llc": "google",
  "microsoft corporation": "microsoft",
  "amazon.com, inc.": "amazon",
  "apple inc.": "apple",
  "meta platforms, inc.": "meta",
  "github, inc.": "github",
};

export function companyLogo(company?: string | null): string | null {
  const name = company?.trim().replace(/\s+/g, " ").toLowerCase();
  if (!name) return null;
  return LOGOS[ALIASES[name] ?? name] ?? null;
}
