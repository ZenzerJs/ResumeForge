import { prisma } from "../src/lib/prisma";
import { backfillIngestedJobs } from "../src/lib/connectors/backfill-ingested";

async function main() {
  const args = new Set(process.argv.slice(2));
  const dryRun = args.has("--dry-run");
  const batchArg = process.argv.find((arg) => arg.startsWith("--batch-size="));
  const batchSize = batchArg ? Number(batchArg.split("=")[1]) : 100;

  const summary = await backfillIngestedJobs({
    prisma,
    dryRun,
    batchSize: Number.isFinite(batchSize) ? batchSize : 100,
  });

  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((err) => {
    console.error("Backfill failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
