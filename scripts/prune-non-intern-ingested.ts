import { prisma } from "../src/lib/prisma";
import { isInternshipOrCoopTitle } from "../src/lib/connectors/internship-filter";

async function main() {
  const rows = await prisma.ingestedJob.findMany({
    where: { trackedJobId: null },
    select: { id: true, title: true },
  });
  const ids = rows.filter((row) => !isInternshipOrCoopTitle(row.title)).map((row) => row.id);

  let deleted = 0;
  const chunk = 200;
  for (let i = 0; i < ids.length; i += chunk) {
    const result = await prisma.ingestedJob.deleteMany({
      where: { id: { in: ids.slice(i, i + chunk) } },
    });
    deleted += result.count;
  }

  console.log(
    `Pruned ${deleted} untracked non-internship ingested jobs. Kept ${rows.length - deleted} untracked internship rows.`
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
