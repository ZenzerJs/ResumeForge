import type { Metadata } from "next";

export function getAppBaseUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_APP_URL || "https://resumeforge.app").trim();
  return raw.replace(/\/+$/, "");
}

export interface BuildPageMetadataOptions {
  path: string;
  title: string;
  description: string;
  noIndex?: boolean;
  absoluteTitle?: boolean;
}

export function buildPageMetadata({
  path,
  title,
  description,
  noIndex = false,
  absoluteTitle = false,
}: BuildPageMetadataOptions): Metadata {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const fullTitle = absoluteTitle ? title : `${title} | ResumeForge`;

  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: {
      canonical: normalizedPath,
    },
    openGraph: {
      title: fullTitle,
      description,
      url: normalizedPath,
      siteName: "ResumeForge",
      locale: "en_US",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
    },
    ...(noIndex
      ? {
          robots: {
            index: false,
            follow: false,
          },
        }
      : {}),
  };
}
