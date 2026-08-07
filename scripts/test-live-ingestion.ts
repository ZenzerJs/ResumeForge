import { DEFAULT_SIMPLIFY_SOURCE_URL, importTier1Jobs } from "../src/lib/ingestion/tier1-importer";
import { prisma } from "../src/lib/prisma";

async function main() {
  const testUrl = "https://raw.githubusercontent.com/SimplifyJobs/Summer2026-Internships/dev/README.md";
  console.log("=== Live Ingestion Verification ===");
  console.log("Testing URL:", testUrl);

  // 1. Live Fetch Resolution
  try {
    const res = await fetch(testUrl);
    console.log(`Fetch Status: ${res.status} ${res.statusText}`);
    if (res.ok) {
      const text = await res.text();
      console.log(`Fetched Content Length: ${text.length} bytes`);
    }
  } catch (e) {
    console.log("Live fetch error:", e);
  }

  // 2. Execute Live Import (First Run)
  const result = await importTier1Jobs({ sourceUrl: testUrl });
  console.log("\n=== Live Import Result (First Run) ===");
  console.log(`Success: ${result.success}`);
  console.log(`Created: ${result.createdCount}`);
  console.log(`Skipped: ${result.skippedCount}`);
  console.log(`Total Processed: ${result.totalProcessed}`);
  console.log(`Message: ${result.message}`);

  // 2b. Execute Live Import (Second Run — Deduplication Check)
  const resultDedup = await importTier1Jobs({ sourceUrl: testUrl });
  console.log("\n=== Live Import Result (Second Run — Deduplication Check) ===");
  console.log(`Success: ${resultDedup.success}`);
  console.log(`Created: ${resultDedup.createdCount}`);
  console.log(`Skipped: ${resultDedup.skippedCount}`);
  console.log(`Total Processed: ${resultDedup.totalProcessed}`);
  console.log(`Message: ${resultDedup.message}`);

  // 3. Spot Check Real DB Rows for Zero Inference
  const sampleJobs = await prisma.job.findMany({
    where: { source: "manual" },
    take: 3,
    orderBy: { createdAt: "desc" },
  });

  console.log("\n=== Spot Check DB Rows (Zero Inference) ===");
  sampleJobs.forEach((job, index) => {
    console.log(`[Job ${index + 1}] ID: ${job.id}`);
    console.log(`  Company: ${job.company}`);
    console.log(`  Role: ${job.roleTitle}`);
    console.log(`  Source: ${job.source}`);
    console.log(`  Notes: ${job.notes}`);
    console.log(`  Raw Description: ${job.rawDescription.slice(0, 100)}...`);
    console.log(`  Extracted Reqs: ${job.extractedRequirements}`);
    console.log(`  Applied At: ${job.appliedAt}`);
  });

  // 4. Test Failure Behavior with Unreachable URL
  console.log("\n=== Testing Unreachable URL Failure Path ===");
  const failResult = await importTier1Jobs({ sourceUrl: "https://raw.githubusercontent.com/SimplifyJobs/NonExistentRepo2099/main/README.md" });
  console.log(`Failure Path Success: ${failResult.success}`);
  console.log(`Failure Path Message: ${failResult.message}`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
