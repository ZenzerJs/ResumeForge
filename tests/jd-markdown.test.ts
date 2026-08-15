import { describe, it, expect } from "vitest";
import {
  convertHtmlToCleanMarkdown,
  parseJobDescriptionMarkdown,
  formatCanonicalJobDescription,
} from "@/lib/ingestion/jd-format";

describe("job description markdown formatting", () => {
  it("parses canonical title, company, and section headers", () => {
    const markdown = formatCanonicalJobDescription({
      title: "Software Engineer Intern",
      company: "RTX",
      description: "Build software for internships. Requirements include TypeScript experience.",
    });
    const blocks = parseJobDescriptionMarkdown(markdown);
    expect(blocks[0]).toEqual({ type: "title", text: "Software Engineer Intern" });
    expect(blocks[1]).toEqual({ type: "meta", items: [{ label: "Company", value: "RTX" }] });
    expect(blocks[2]).toEqual({ type: "heading", level: 2, text: "Job description" });
    expect(blocks.some((b) => b.type === "paragraph" && b.text.includes("TypeScript"))).toBe(true);
  });

  it("strips Workday widget JSON instead of showing it as the body", () => {
    const raw = `# Software Engineer Intern

Company: RTX

## Job description

{"widget":"redirect","url":"/fr-CA/Private_Posting_No_TMP/job/US-AL-HUNTSVILLE-382--420-Jan-Davis-Dr--DAVIS-382/Summer-2027--Software-Intern-OnSite_01865160?utm_source=Simplify&ref=Simplify","externalSpa":true}

You will write software with the engineering team.
`;
    const cleaned = convertHtmlToCleanMarkdown(raw);
    expect(cleaned).not.toContain("widget");
    expect(cleaned).not.toContain("externalSpa");
    expect(cleaned).toContain("# Software Engineer Intern");
    expect(cleaned).toContain("You will write software");

    const blocks = parseJobDescriptionMarkdown(raw);
    expect(blocks.some((b) => b.type === "paragraph" && JSON.stringify(b).includes("widget"))).toBe(false);
    expect(blocks.some((b) => b.type === "title")).toBe(true);
    expect(blocks.some((b) => b.type === "heading" && b.text === "Job description")).toBe(true);
  });

  it("turns HTML headings into markdown headings", () => {
    const html = "<h1>Intern</h1><h2>Requirements</h2><p>Work on software.</p>";
    const markdown = convertHtmlToCleanMarkdown(html);
    expect(markdown).toContain("# Intern");
    expect(markdown).toContain("## Requirements");
    const blocks = parseJobDescriptionMarkdown(markdown);
    expect(blocks[0]).toEqual({ type: "title", text: "Intern" });
    expect(blocks[1]).toEqual({ type: "heading", level: 2, text: "Requirements" });
  });
});
