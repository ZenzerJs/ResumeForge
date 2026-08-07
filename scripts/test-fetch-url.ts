async function testUrl(label: string, url: string) {
  console.log(`\n=================== ${label} ===================`);
  console.log(`URL: ${url}`);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      }
    });
    console.log(`Status: ${res.status} ${res.statusText}`);
    const html = await res.text();
    console.log(`HTML Length: ${html.length}`);
    console.log(`Title tag match:`, html.match(/<title[^>]*>(.*?)<\/title>/i)?.[1]);
    
    // Check if Greenhouse / Workday / Direct contains JSON-LD or meta tags or text content
    if (html.includes("json+ld") || html.includes('type="application/ld+json"')) {
      console.log("Found JSON-LD script block!");
      const matches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
      matches?.forEach(m => console.log("JSON-LD snippet:", m.slice(0, 300)));
    }

    // Check meta description or main text
    const metaDesc = html.match(/<meta[^>]*name=["']description["'][^>]*content=["'](.*?)["']/i)?.[1] ||
                     html.match(/<meta[^>]*content=["'](.*?)["'][^>]*name=["']description["']/i)?.[1];
    if (metaDesc) console.log("Meta description:", metaDesc.slice(0, 200));

    // Sample snippet of text body
    const bodyText = html.replace(/<script[\s\S]*?<\/script>/gi, '')
                         .replace(/<style[\s\S]*?<\/style>/gi, '')
                         .replace(/<[^>]+>/g, ' ')
                         .replace(/\s+/g, ' ')
                         .trim();
    console.log(`Extracted plain body text length: ${bodyText.length}`);
    console.log(`Sample body text: ${bodyText.slice(0, 400)}...`);

  } catch (err: any) {
    console.error(`Fetch error for ${label}:`, err.message);
  }
}

async function main() {
  await testUrl("IMC Trading (Greenhouse)", "https://job-boards.eu.greenhouse.io/imc/jobs/4907430101?utm_source=Simplify&ref=Simplify");
  await testUrl("Ciena (Workday)", "https://ciena.wd5.myworkdayjobs.com/Careers/job/UK--Edinburgh---19A-Canning-St/Software-Engineering-Intern--3-12-Months-_R031332?utm_source=Simplify&ref=Simplify");
  await testUrl("Optiver (Direct Career Page)", "https://www.optiver.com/join-us/jobs/8401052002/?gh_jid=8401052002&utm_source=Simplify&ref=Simplify");
}

main();
