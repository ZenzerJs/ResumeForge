import { DEFAULT_SIMPLIFY_SOURCE_URL, parseMarkdownTable } from "../src/lib/ingestion/tier1-importer";
import { prisma } from "../src/lib/prisma";

async function main() {
  const res = await fetch(DEFAULT_SIMPLIFY_SOURCE_URL);
  const text = await res.text();
  const rows = parseMarkdownTable(text);

  console.log("Total Parsed Rows from Live URL:", rows.length);

  // Analyze duplicates in live feed
  const mapCompanyRole = new Map<string, typeof rows[0]>();
  const mapCompanyRoleLoc = new Map<string, typeof rows[0]>();

  let multiLocCount = 0;
  const multiLocExamples: any[] = [];

  for (const r of rows) {
    const keyCR = `${r.company} | ${r.roleTitle}`;
    const keyCRL = `${r.company} | ${r.roleTitle} | ${r.location}`;

    if (mapCompanyRole.has(keyCR)) {
      const prev = mapCompanyRole.get(keyCR)!;
      if (prev.location !== r.location) {
        multiLocCount++;
        multiLocExamples.push({
          company: r.company,
          roleTitle: r.roleTitle,
          loc1: prev.location,
          loc2: r.location,
          url1: prev.applyUrl,
          url2: r.applyUrl,
        });
      }
    } else {
      mapCompanyRole.set(keyCR, r);
    }

    mapCompanyRoleLoc.set(keyCRL, r);
  }

  console.log("Unique (Company + RoleTitle) pairs:", mapCompanyRole.size);
  console.log("Unique (Company + RoleTitle + Location) triplets:", mapCompanyRoleLoc.size);
  console.log("Multi-location role duplicates:", multiLocCount);
  console.log("\nSample Multi-Location Duplicate Postings:");
  console.log(JSON.stringify(multiLocExamples.slice(0, 5), null, 2));

  // Check what source value is stored in DB right now
  const sampleDbRow = await prisma.job.findFirst({
    where: { notes: { contains: "Tier 1 Bulk Import" } },
  });
  console.log("\nSample DB Job Source Field Value:", sampleDbRow?.source);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
