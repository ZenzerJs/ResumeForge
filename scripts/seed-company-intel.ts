import { PrismaClient } from "@prisma/client";
import { normalizeCompany } from "../src/lib/company";

const prisma = new PrismaClient();
const HWW_URL =
  "https://raw.githubusercontent.com/poteto/hiring-without-whiteboards/main/README.md";

// Phase A — hiring-without-whiteboards.
// Line format: - [Company](url) | locations | interview process description
export function parseHwwLine(line: string): { displayName: string; slug: string; processNotes: string } | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("-") && !trimmed.startsWith("*")) return null;
  const cleaned = trimmed.replace(/^[-*]\s*/, "");
  if (!cleaned.includes("|")) return null;

  const parts = cleaned.split("|").map((s) => s.trim());
  if (parts.length < 3) return null; // need name | location | process

  const linkMatch = parts[0].match(/\[([^\]]+)\]\(([^)]+)\)/);
  const displayName = linkMatch
    ? linkMatch[1].trim()
    : parts[0].replace(/[`*]/g, "").trim();
  const processNotes = parts[parts.length - 1];

  const slug = normalizeCompany(displayName);
  if (!slug) return null;

  return { displayName, slug, processNotes };
}

export async function seedWhiteboardFree() {
  console.log("Fetching hiring-without-whiteboards list...");
  const res = await fetch(HWW_URL);
  if (!res.ok) throw new Error(`HWW fetch failed: ${res.status}`);
  const md = await res.text();
  let count = 0;

  for (const line of md.split("\n")) {
    const parsed = parseHwwLine(line);
    if (!parsed) continue;

    await prisma.companyDossier.upsert({
      where: { companySlug: parsed.slug },
      update: { isWhiteboardFree: true, processNotes: parsed.processNotes },
      create: {
        companySlug: parsed.slug,
        displayName: parsed.displayName,
        isWhiteboardFree: true,
        processNotes: parsed.processNotes,
        source: "seed",
      },
    });
    count++;
  }
  console.log(`Seeded ${count} whiteboard-free companies.`);
}

// Phase B — tech-interview-handbook.
// Only ingest docs that map to a real company. Generic guides like
// "behavioral-questions.md" must NOT create junk dossier rows.
export const COMPANY_ALLOWLIST = [
  "amazon", "google", "meta", "facebook", "apple", "microsoft", "netflix",
  "stripe", "tiktok", "bytedance", "citadel", "shopify", "uber", "airbnb",
  "linkedin", "salesforce", "adobe", "oracle", "ibm", "intel", "nvidia",
  "palantir", "databricks", "snowflake", "coinbase", "robinhood", "doordash",
  "instacart", "lyft", "pinterest", "snap", "spotify", "block", "square",
  "twilio", "atlassian", "slack", "zoom", "dropbox", "asana", "notion",
  "figma", "canva", "openai", "anthropic", "tesla",
];

export async function seedHandbookNotes() {
  console.log("Discovering Tech Interview Handbook docs...");
  try {
    const treeRes = await fetch(
      "https://api.github.com/repos/yangshun/tech-interview-handbook/git/trees/main?recursive=1",
      { headers: { "User-Agent": "ResumeForge-Seed-Bot" } } // required by GitHub
    );
    if (!treeRes.ok) {
      console.warn(`GitHub tree API returned ${treeRes.status} (rate limit?). Skipping handbook pass.`);
      return;
    }
    const treeData = await treeRes.json();
    const docPaths: string[] = (treeData.tree || [])
      .filter((n: { path: string }) => {
        if (!n.path.endsWith(".md")) return false;
        const file = n.path.split("/").pop()!.replace(".md", "").toLowerCase();
        return COMPANY_ALLOWLIST.some((c) => file.includes(c));
      })
      .map((n: { path: string }) => n.path);

    console.log(`Found ${docPaths.length} company-specific handbook docs.`);
    if (docPaths.length === 0) {
      console.warn("No company docs matched — print sample tree paths and update the allowlist/filters.");
      return;
    }

    for (const path of docPaths.slice(0, 30)) {
      const rawRes = await fetch(
        `https://raw.githubusercontent.com/yangshun/tech-interview-handbook/main/${path}`
      );
      if (!rawRes.ok) continue;
      const content = await rawRes.text();
      const file = path.split("/").pop()!.replace(".md", "").toLowerCase();
      const company = COMPANY_ALLOWLIST.find((c) => file.includes(c))!;
      const slug = normalizeCompany(company);

      await prisma.companyDossier.upsert({
        where: { companySlug: slug },
        update: { referenceNotes: content.slice(0, 2000) },
        create: {
          companySlug: slug,
          displayName: company[0].toUpperCase() + company.slice(1),
          referenceNotes: content.slice(0, 2000),
          source: "seed",
        },
      });
    }
  } catch (err) {
    console.warn("Handbook seeding failed (non-critical):", err);
  }
}

export async function main() {
  await seedWhiteboardFree();
  await seedHandbookNotes();
}

if (require.main === module || (typeof process !== "undefined" && process.argv[1]?.endsWith("seed-company-intel.ts"))) {
  main()
    .catch((err) => {
      console.error("Seed error:", err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
