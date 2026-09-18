import { prisma } from "../src/lib/prisma";
import { fetchAndCacheJobFullText, isTier1Placeholder } from "../src/lib/ingestion/tier2-fetcher";
import { convertHtmlToCleanMarkdown, formatCanonicalJobDescription } from "../src/lib/ingestion/jd-format";
import { parseJobDescription } from "../src/lib/jd-parser/parser";

/**
 * Strips known corporate careers portal navigation boilerplate (e.g. TikTok, Workday headers, Oracle HCM nav)
 */
function cleanPortalBoilerplate(text: string): string {
  let cleaned = text;

  // Strip empty Jina header noise if content follows
  cleaned = cleaned.replace(/^Title:\s*[^\n]*\n+URL Source:\s*[^\n]*\n+Markdown Content:\s*\n*/i, "");

  // Strip TikTok nav dump
  cleaned = cleaned.replace(/#LifeAtTikTok[\s\S]*?Search now\s*(?:English\s*日本語)?\s*(?:@\s*\d{4}\s*TikTok)?/i, "");
  cleaned = cleaned.replace(/p:empty\]:h-\[56px\][\s\S]*?Search now/i, "");
  cleaned = cleaned.replace(/Teams\s+Advertising & Sales[\s\S]*?Search now/i, "");

  // Strip repetitive footer & legal walls
  cleaned = cleaned.replace(/\b(?:TikTok Accommodation|For Los Angeles County \(unincorporated\) Candidates)[\s\S]*$/i, "");
  cleaned = cleaned.replace(/\bApply to this job\s*$/i, "");
  cleaned = cleaned.replace(/\bShare this listing:[\s\S]*?Responsibilities/i, "Responsibilities");

  // Clean empty bullet sequences
  cleaned = cleaned.replace(/(?:^|\n)-\s*\n(?:-\s*\n)+/g, "\n");

  return cleaned.trim();
}

export async function normalizeAllJobsInDb() {
  const jobs = await prisma.job.findMany({
    orderBy: { createdAt: "desc" },
  });

  console.log(`Starting normalization for ${jobs.length} jobs in database...`);

  let fetchedCount = 0;
  let normalizedCount = 0;
  let failedCount = 0;

  for (const job of jobs) {
    let raw = job.rawDescription || "";
    const isPlaceholder = isTier1Placeholder(raw);
    const withoutJina = raw.replace(/^#?[^\n]*\n*Title:[\s\S]*?Markdown Content:\s*/i, "").trim();
    const isBrokenJina = raw.includes("Markdown Content:") && withoutJina.length < 60;

    // 1. Re-fetch if placeholder or broken Jina shell
    if (isPlaceholder || isBrokenJina || raw.length < 250) {
      console.log(`Fetching fulltext for [${job.company}] - ${job.roleTitle}...`);
      const fetchRes = await fetchAndCacheJobFullText(job.id);
      if (fetchRes.success && fetchRes.data) {
        raw = fetchRes.data.rawDescription;
        fetchedCount++;
        console.log(`  ✓ Re-fetched (${raw.length} chars)`);
      } else {
        console.log(`  ✗ Fetch failed: ${fetchRes.error || "Unknown"}`);
      }
    }

    // 2. Clean and format canonical description
    const locMatch = job.notes?.match(/Location:\s*([^|]+)/i);
    const salMatch = job.notes?.match(/Salary:\s*([^|]+)/i);
    const location = locMatch ? locMatch[1].trim() : undefined;
    const salary = salMatch ? salMatch[1].trim() : undefined;

    const cleanedBody = cleanPortalBoilerplate(convertHtmlToCleanMarkdown(raw));
    const formatted = formatCanonicalJobDescription({
      title: job.roleTitle || undefined,
      company: job.company || undefined,
      location,
      salary,
      description: cleanedBody,
    });

    // 3. Extract requirements
    const parsedReqs = parseJobDescription(formatted);

    // 4. Update database record
    await prisma.job.update({
      where: { id: job.id },
      data: {
        rawDescription: formatted,
        extractedRequirements: JSON.stringify(parsedReqs),
      },
    });

    normalizedCount++;
    console.log(`✓ Normalized [${job.company}] - ${job.roleTitle} (Reqs: ${parsedReqs.requiredSkills.length} required, ${parsedReqs.preferredSkills.length} preferred)`);
  }

  console.log(`\n=== Normalization Complete ===`);
  console.log(`Total: ${jobs.length} | Re-fetched: ${fetchedCount} | Normalized: ${normalizedCount} | Failed: ${failedCount}`);
}

if (require.main === module) {
  normalizeAllJobsInDb().finally(() => prisma.$disconnect());
}
