import { prisma } from "../src/lib/prisma";
import { fetchAndCacheJobFullText, extractFullTextFromUrl } from "../src/lib/ingestion/tier2-fetcher";

const REAL_PLATFORM_POSTINGS = [
  {
    platformType: "Greenhouse-hosted posting",
    company: "IMC Trading",
    roleTitle: "Machine Learning Research Intern",
    applyUrl: "https://job-boards.eu.greenhouse.io/imc/jobs/4907430101?utm_source=Simplify&ref=Simplify",
  },
  {
    platformType: "Workday-hosted posting",
    company: "Ciena",
    roleTitle: "Software Engineer Intern",
    applyUrl: "https://ciena.wd5.myworkdayjobs.com/Careers/job/UK--Edinburgh---19A-Canning-St/Software-Engineering-Intern--3-12-Months-_R031332?utm_source=Simplify&ref=Simplify",
  },
  {
    platformType: "Direct company career page posting",
    company: "Optiver",
    roleTitle: "Software Engineer Intern",
    applyUrl: "https://www.optiver.com/join-us/jobs/8401052002/?gh_jid=8401052002&utm_source=Simplify&ref=Simplify",
  },
];

async function main() {
  console.log("=================================================================");
  console.log("  Task 8.4: Real-Platform Tier 2 Extraction Verification Results");
  console.log("=================================================================\n");

  const results: any[] = [];

  for (const item of REAL_PLATFORM_POSTINGS) {
    console.log(`Testing Platform Type: [${item.platformType}]`);
    console.log(`  Company: ${item.company}`);
    console.log(`  Role:    ${item.roleTitle}`);
    console.log(`  URL:     ${item.applyUrl}`);

    // Create or find a Tier 1 placeholder job in DB
    const dummyId = `test-real-${item.company.toLowerCase().replace(/\s+/g, "-")}-job-uuid`;

    await prisma.job.upsert({
      where: { id: dummyId },
      create: {
        id: dummyId,
        company: item.company,
        roleTitle: item.roleTitle,
        rawDescription: `[Pending Import] Full job description text not yet fetched for ${item.company}...`,
        source: "simplify-jobs",
        notes: `Tier 1 Bulk Import | Location: Remote | Apply Link: ${item.applyUrl}`,
      },
      update: {
        rawDescription: `[Pending Import] Full job description text not yet fetched for ${item.company}...`,
        notes: `Tier 1 Bulk Import | Location: Remote | Apply Link: ${item.applyUrl}`,
      },
    });

    const startTime = Date.now();
    const fetchRes = await fetchAndCacheJobFullText(dummyId);
    const duration = Date.now() - startTime;

    // Second call: verify read-through cache hit
    const startCacheTime = Date.now();
    const cacheRes = await fetchAndCacheJobFullText(dummyId);
    const cacheDuration = Date.now() - startCacheTime;

    const report = {
      platformType: item.platformType,
      company: item.company,
      roleTitle: item.roleTitle,
      success: fetchRes.success,
      durationMs: duration,
      cached: fetchRes.cached,
      cacheHitSuccess: cacheRes.success && cacheRes.cached,
      cacheDurationMs: cacheDuration,
      error: fetchRes.error,
      extractedLength: fetchRes.data?.rawDescription ? fetchRes.data.rawDescription.length : 0,
      sampleText: fetchRes.data?.rawDescription
        ? fetchRes.data.rawDescription.slice(0, 160).replace(/\n+/g, " ") + "..."
        : null,
    };

    results.push(report);

    console.log(`  Initial Pass Status:   ${fetchRes.success ? "SUCCESS ✅" : "FAILED / FALLBACK REQUIRED ❌"}`);
    console.log(`  Initial Pass Duration: ${duration}ms (Network/Parse)`);
    if (fetchRes.success) {
      console.log(`  Cache Pass Status:     ${cacheRes.cached ? "CACHE HIT ✅" : "CACHE MISS ❌"}`);
      console.log(`  Cache Pass Duration:   ${cacheDuration}ms (DB Read-Through)`);
      console.log(`  Text Length:          ${report.extractedLength} characters`);
      console.log(`  Sample Text:          "${report.sampleText}"`);
    } else {
      console.log(`  Fallback Prompt:       "${fetchRes.error}"`);
    }
    console.log("-----------------------------------------------------------------\n");

    // Clean up test record after logging result
    await prisma.job.deleteMany({ where: { id: dummyId } });
  }

  console.log("=== SUMMARY TABLE ===");
  console.table(
    results.map((r) => ({
      Platform: r.platformType,
      Company: r.company,
      Result: r.success ? "SUCCESS" : "FALLBACK",
      Length: r.extractedLength,
      "Fetch Duration": `${r.durationMs}ms`,
      "Cache Hit": r.cacheHitSuccess ? "YES ✅" : "N/A",
      "Cache Duration": r.cacheHitSuccess ? `${r.cacheDurationMs}ms` : "N/A",
    }))
  );
}

main().catch(console.error).finally(() => prisma.$disconnect());
