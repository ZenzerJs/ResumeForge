import { describe, it, expect } from "vitest";
import { convertTextToTypst } from "@/lib/pdf/parser";

describe("PDF Parser & Typst Converter", () => {
  it("converts raw resume text into valid Typst markup", () => {
    const sampleText = `Alex Mercer
alex@example.com | (555) 019-2831 | San Francisco, CA

EXPERIENCE
Senior Backend Engineer at Acme Systems
- Built high-throughput distributed API handling 50k req/sec
- Reduced database query latency by 40% with Redis caching

EDUCATION
B.S. Computer Science — UC Berkeley
`;

    const typst = convertTextToTypst(sampleText);
    expect(typst).toContain("= Alex Mercer");
    expect(typst).toContain("== EXPERIENCE");
    expect(typst).toContain("- Built high-throughput");
    expect(typst).toContain("== EDUCATION");
  });

  it("handles empty or single line text gracefully", () => {
    const typst = convertTextToTypst("John Doe", "MyResume.pdf");
    expect(typst).toContain("= John Doe");
    expect(typst).toContain("#line(length: 100%");
  });

  it("renders verified extracted link annotations in header when provided", () => {
    const links = [
      { url: "https://linkedin.com/in/alex", label: "LinkedIn" },
      { url: "https://github.com/alex", label: "GitHub" },
    ];
    const typst = convertTextToTypst("Alex Mercer\nalex@example.com", "MyResume.pdf", links);
    expect(typst).toContain('#link("https://linkedin.com/in/alex")[LinkedIn]');
    expect(typst).toContain('#link("https://github.com/alex")[GitHub]');
  });
});
