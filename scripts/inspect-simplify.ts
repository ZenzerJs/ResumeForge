import { parseMarkdownTable, DEFAULT_SIMPLIFY_SOURCE_URL } from "../src/lib/ingestion/tier1-importer";

async function main() {
  console.log("Fetching SimplifyJobs README from:", DEFAULT_SIMPLIFY_SOURCE_URL);
  const res = await fetch(DEFAULT_SIMPLIFY_SOURCE_URL);
  if (!res.ok) {
    console.error("Failed to fetch:", res.status, res.statusText);
    return;
  }
  const text = await res.text();
  const rows = parseMarkdownTable(text);
  console.log(`Parsed ${rows.length} rows.`);

  const imc = rows.filter(r => r.company.toLowerCase().includes("imc"));
  const ciena = rows.filter(r => r.company.toLowerCase().includes("ciena"));
  const optiver = rows.filter(r => r.company.toLowerCase().includes("optiver"));

  console.log("\nIMC Trading rows:", imc);
  console.log("\nCiena rows:", ciena);
  console.log("\nOptiver rows:", optiver);
}

main().catch(console.error);
