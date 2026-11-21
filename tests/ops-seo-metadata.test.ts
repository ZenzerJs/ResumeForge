import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, vi, afterEach } from "vitest";
import { GET as healthGET } from "@/app/api/health/route";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { isPublicPath } from "@/lib/security/session";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}));

describe("P2-7 Ops endpoints, favicon, and per-page SEO metadata", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("GET /api/health returns 200 on liveness and DB readiness, and 503 when DB check fails", async () => {
    const liveRes = await healthGET(new Request("http://localhost:3000/api/health?live=1"));
    expect(liveRes.status).toBe(200);
    expect(liveRes.headers.get("cache-control")).toBe("no-store");
    expect(await liveRes.json()).toMatchObject({ status: "ok", mode: "liveness" });

    const querySpy = vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([{ "?column?": 1 }] as never);
    const okRes = await healthGET(new Request("http://localhost:3000/api/health"));
    expect(okRes.status).toBe(200);
    expect(await okRes.json()).toMatchObject({ status: "ok", db: "ok" });
    expect(querySpy).toHaveBeenCalledTimes(1);

    vi.mocked(prisma.$queryRaw).mockRejectedValueOnce(new Error("DB unreachable"));
    const failRes = await healthGET(new Request("http://localhost:3000/api/health"));
    expect(failRes.status).toBe(503);
    expect(await failRes.json()).toMatchObject({ status: "error", db: "error" });
  });

  it("exposes /api/health, /robots.txt, /sitemap.xml, and /favicon.ico as public paths", () => {
    expect(isPublicPath("/api/health")).toBe(true);
    expect(isPublicPath("/robots.txt")).toBe(true);
    expect(isPublicPath("/sitemap.xml")).toBe(true);
    expect(isPublicPath("/favicon.ico")).toBe(true);
    expect(fs.existsSync(path.resolve("src/app/favicon.ico"))).toBe(true);
  });

  it("robots() and sitemap() publish canonical public URLs and disallow private workspaces", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://resumeforge.app/");
    const r = robots();
    expect(r.sitemap).toBe("https://resumeforge.app/sitemap.xml");
    const rules = Array.isArray(r.rules) ? r.rules[0] : r.rules;
    expect(rules.disallow).toContain("/editor");
    expect(rules.disallow).toContain("/api/");

    const entries = sitemap();
    const urls = entries.map((e) => e.url);
    expect(urls).toContain("https://resumeforge.app/");
    expect(urls).toContain("https://resumeforge.app/privacy");
    expect(urls).toContain("https://resumeforge.app/terms");
    expect(urls.some((u) => u.includes("/editor") || u.includes("/settings"))).toBe(false);
  });

  it("buildPageMetadata sets per-page canonical, OG url, Twitter card, and noIndex when requested", () => {
    const priv = buildPageMetadata({
      path: "/privacy",
      title: "Privacy Policy",
      description: "Privacy details",
    });
    expect(priv.alternates?.canonical).toBe("/privacy");
    expect(priv.openGraph?.url).toBe("/privacy");
    expect(priv.openGraph?.title).toBe("Privacy Policy | ResumeForge");
    expect(priv.twitter?.title).toBe("Privacy Policy | ResumeForge");
    expect(priv.robots).toBeUndefined();

    const editorMeta = buildPageMetadata({
      path: "/editor",
      title: "Typst Workspace",
      description: "Live editor",
      noIndex: true,
    });
    expect(editorMeta.alternates?.canonical).toBe("/editor");
    expect(editorMeta.robots).toEqual({ index: false, follow: false });
  });
});
