import type { MetadataRoute } from "next";
import { getAppBaseUrl } from "@/lib/seo/metadata";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getAppBaseUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/privacy", "/terms", "/practice", "/tracker/feed"],
        disallow: [
          "/api/",
          "/editor",
          "/tailor",
          "/library",
          "/settings",
          "/tracker/applied",
          "/tracker/saved",
          "/tracker/outcomes",
          "/login",
          "/signup",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
