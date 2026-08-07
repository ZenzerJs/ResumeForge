import { prisma } from "../src/lib/prisma";
import { importTier1Jobs, DEFAULT_SIMPLIFY_SOURCE_URL } from "../src/lib/ingestion/tier1-importer";
import { extractLocationFromNotes, extractApplyUrlFromNotes } from "../src/components/tracker/tracker-feed";

async function testTikTokMultiLocation() {
  console.log("=== TikTok Multi-Location Regression Test ===");

  await importTier1Jobs({ sourceUrl: DEFAULT_SIMPLIFY_SOURCE_URL });

  const tiktokJobs = await prisma.job.findMany({
    where: { company: "TikTok" },
    orderBy: { createdAt: "desc" },
  });

  console.log(`Found ${tiktokJobs.length} TikTok job postings in SQLite database.\n`);

  tiktokJobs.forEach((job, index) => {
    const location = extractLocationFromNotes(job.notes);
    const applyUrl = extractApplyUrlFromNotes(job.notes);
    console.log(`[Card ${index + 1}] ID: ${job.id}`);
    console.log(`  Role: ${job.roleTitle}`);
    console.log(`  Location: ${location}`);
    console.log(`  Apply URL: ${applyUrl}\n`);
  });

  const sanJosePosting = tiktokJobs.find((j) => extractLocationFromNotes(j.notes).includes("San Jose"));
  const seattlePosting = tiktokJobs.find((j) => extractLocationFromNotes(j.notes).includes("Seattle"));

  if (sanJosePosting && seattlePosting) {
    console.log("✅ Multi-Location Verification SUCCESS:");
    console.log(`  San Jose Card ID: ${sanJosePosting.id} | Link: ${extractApplyUrlFromNotes(sanJosePosting.notes)}`);
    console.log(`  Seattle Card ID:  ${seattlePosting.id} | Link: ${extractApplyUrlFromNotes(seattlePosting.notes)}`);
    if (extractApplyUrlFromNotes(sanJosePosting.notes) !== extractApplyUrlFromNotes(seattlePosting.notes)) {
      console.log("✅ Verified: Both cards have distinct apply URLs and render independently!");
    }
  } else {
    console.error("❌ Failed to find both San Jose and Seattle TikTok postings.");
  }
}

testTikTokMultiLocation()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
