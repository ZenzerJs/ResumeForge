import { prisma } from "../src/lib/prisma";

async function main() {
  const jobs = await prisma.job.findMany();
  console.log("Total jobs in DB:", jobs.length);
  for (const j of jobs) {
    console.log(`ID: ${j.id}`);
    console.log(`Company: ${j.company}`);
    console.log(`Role: ${j.roleTitle}`);
    console.log(`Source: ${j.source}`);
    console.log(`Notes: ${j.notes}`);
    console.log(`Desc sample: ${j.rawDescription.slice(0, 100)}...`);
    console.log("---");
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
