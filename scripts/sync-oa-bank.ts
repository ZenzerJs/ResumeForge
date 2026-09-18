import { PrismaClient } from "@prisma/client";
import { normalizeCompany } from "../src/lib/company";

const prisma = new PrismaClient();

// Default branch unverified — try main, fall back to master.
const REPO_RAW_URLS = [
  "https://raw.githubusercontent.com/perixtar/Tech-OA-Interview-Questions/main/README.md",
  "https://raw.githubusercontent.com/perixtar/Tech-OA-Interview-Questions/master/README.md",
];

export async function fetchRepoMarkdown(): Promise<string> {
  for (const url of REPO_RAW_URLS) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.text();
    } catch {
      continue;
    }
  }
  throw new Error("Failed to fetch Tech-OA README from main or master branch.");
}

// Strip markdown artifacts (backticks, asterisks, underscores) from cells
export const cleanCell = (str: string): string =>
  (str || "").replace(/[`*_]/g, "").trim();

// Repo dates look like "Jul, 08, 2025" — normalize the stray comma first.
// Never use `new Date(x) || null`: Invalid Date is a truthy object.
export function parseObservedDate(raw: string): Date | null {
  if (!raw) return null;
  const cleaned = cleanCell(raw)
    .replace(/(\w+),\s*(\d{1,2}),\s*(\d{4})/, "$1 $2, $3")
    .trim();
  const t = Date.parse(cleaned);
  return Number.isNaN(t) ? null : new Date(t);
}

export interface ParsedProblemRow {
  company: string;
  companyKey: string;
  problemTitle: string;
  sourceUrl: string | null;
  lastObserved: Date | null;
}

export function parseMarkdownTable(markdown: string): ParsedProblemRow[] {
  const rows: ParsedProblemRow[] = [];

  for (const line of markdown.split("\n")) {
    if (!line.trim().startsWith("|")) continue;
    const cells = line.split("|").slice(1, -1).map((c) => c.trim());
    if (cells.length < 3) continue;

    const company = cleanCell(cells[0]);
    const rawTitle = cells[1];
    if (!company || !rawTitle) continue;
    if (/^[:\- ]+$/.test(company) || company.toLowerCase() === "company") continue; // header/separator

    // Titles may be markdown links: [Title](https://...)
    const link = rawTitle.match(/\[([^\]]+)\]\(([^)]+)\)/);
    const problemTitle = cleanCell(link ? link[1] : rawTitle);
    const sourceUrl = link ? link[2].trim() : null;

    rows.push({
      company,
      companyKey: normalizeCompany(company),
      problemTitle,
      sourceUrl,
      lastObserved: parseObservedDate(cells[cells.length - 1]), // date = LAST cell
    });
  }

  // In-memory dedupe on compound key
  const seen = new Set<string>();
  return rows.filter((r) => {
    const k = `${r.companyKey}::${r.problemTitle.toLowerCase()}`;
    return seen.has(k) ? false : (seen.add(k), true);
  });
}

export async function syncOaBank() {
  console.log("Fetching latest Tech OA questions from repository...");
  const markdown = await fetchRepoMarkdown();
  const unique = parseMarkdownTable(markdown);

  console.log(`Parsed ${unique.length} unique problems. Upserting in chunks...`);
  const CHUNK = 100;
  let count = 0;

  for (let i = 0; i < unique.length; i += CHUNK) {
    const batch = unique.slice(i, i + CHUNK);
    await prisma.$transaction(
      batch.map((r) =>
        prisma.interviewProblem.upsert({
          where: {
            companyKey_problemTitle: {
              companyKey: r.companyKey,
              problemTitle: r.problemTitle,
            },
          },
          update: {
            company: r.company,
            lastObserved: r.lastObserved,
            sourceUrl: r.sourceUrl,
          },
          create: {
            company: r.company,
            companyKey: r.companyKey,
            problemTitle: r.problemTitle,
            category: "OA",
            sourceUrl: r.sourceUrl,
            lastObserved: r.lastObserved,
          },
        })
      )
    );
    count += batch.length;
  }

  console.log(`Synced ${count} problems.`);
  if (unique.length < 50) {
    console.warn("Suspiciously few rows parsed — the table format likely changed. Re-inspect the README.");
  }
}

if (require.main === module || (typeof process !== "undefined" && process.argv[1]?.endsWith("sync-oa-bank.ts"))) {
  syncOaBank()
    .catch((err) => {
      console.error("Sync error:", err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
