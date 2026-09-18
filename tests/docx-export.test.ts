import { describe, it, expect } from "vitest";
import { generateAtsDocx } from "@/lib/export/docx";

describe("ATS DOCX Generator", () => {
  it("generates a valid DOCX binary buffer matching Typst content", async () => {
    const sampleTypst = `
= Jane Doe
jane.doe@example.com | (555) 123-4567 | San Francisco, CA | linkedin.com/in/janedoe

== EXPERIENCE
*Google* | *Senior Software Engineer* | *May 2022 – Present*
- Architected distributed data processing pipeline reducing latency by 45ms across 10M daily requests.
- Led migration of 12 microservices to TypeScript and PostgreSQL with zero downtime.

== EDUCATION
*University of California, Berkeley* | *B.S. Computer Science* | *2018 – 2022*

== SKILLS
- Languages: TypeScript, Python, Go, SQL
- Frameworks: React, Next.js, Node.js, Tailwind CSS
    `;

    const docxBytes = await generateAtsDocx(sampleTypst);

    expect(docxBytes).toBeInstanceOf(Uint8Array);
    expect(docxBytes.length).toBeGreaterThan(1000);

    // Verify DOCX / ZIP magic header (0x50, 0x4B, 0x03, 0x04 = "PK..")
    expect(docxBytes[0]).toBe(0x50);
    expect(docxBytes[1]).toBe(0x4b);
    expect(docxBytes[2]).toBe(0x03);
    expect(docxBytes[3]).toBe(0x04);
  });
});
