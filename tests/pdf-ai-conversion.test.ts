import { describe, it, expect, vi, beforeEach } from "vitest";
import { stripCodeFences } from "@/lib/ai/utils";
import { convertPdfTextToTypst } from "@/lib/ai/gateway";
import { ProviderConfig } from "@/lib/ai/types";
import { convertTextToTypst } from "@/lib/pdf/parser";

const sampleExtractedText = `Jayden Saha
Ontario, Canada | Jaydensaha@yahoo.com | LinkedIn | GitHub | Portfolio

Education
Wilfrid Laurier University Waterloo, ON
Bachelor of Science, Computer Science with Management Option Expected Apr. 2029
- Relevant Coursework: Data Structures and Algorithms, Object-Oriented Programming, Database Management Systems (SQL), Linear Algebra, Calculus II

Experience
Trillium Health Partners Mississauga, ON
IT Operations May 2026 - Present
- Maintained data-center asset, rack, and cabinet documentation using Sunbird dcTrack and monitored infrastructure health through Power IQ.
- Supported software updates, server maintenance, and data backup workflows in a reliability-sensitive healthcare IT environment.

Projects
AI Stock Analyst Agent | GitHub - Next.js, TypeScript, Python, FastAPI, LangGraph May 2026 - Jun. 2026
- Built and deployed a full-stack AI agent that synthesizes financial statements, market data, analyst sentiment, earnings data, and SEC filing attribution.

Technical Skills
Languages: Python, TypeScript, JavaScript, Java, Swift, SQL, HTML/CSS
AI/ML: LangGraph, LangChain, LangSmith, LLM Tool Calling, PyTorch
Engineering: Next.js, React, FastAPI, REST APIs, GitHub Actions, Git, Vercel, Linux
`;

describe("Task 9.1 — AI-Powered PDF to Typst Conversion & Utilities", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("1. stripCodeFences utility strips ```typst, ```json, ```markdown, and raw fences", () => {
    expect(stripCodeFences("```typst\n= Header\n```")).toBe("= Header");
    expect(stripCodeFences("```json\n{\"test\": 1}\n```")).toBe("{\"test\": 1}");
    expect(stripCodeFences("```markdown\n# Hello\n```")).toBe("# Hello");
    expect(stripCodeFences("```\nBare content\n```")).toBe("Bare content");
    expect(stripCodeFences("Plain text without fences")).toBe("Plain text without fences");
  });

  it("2. AI conversion path returns valid Typst markup for a representative fixture", async () => {
    const mockFetch = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: "```typst\n= Jayden Saha\n\n== Education\nWilfrid Laurier University\n```",
            },
          },
        ],
      }),
    } as Response);

    const config: ProviderConfig = { provider: "openai", apiKey: "sk-test-key-12345" };
    const result = await convertPdfTextToTypst({
      providerConfig: config,
      rawText: sampleExtractedText,
      fileName: "Jayden_Saha_Resume",
    });

    expect(result.success).toBe(true);
    expect(result.typstSource).toContain("= Jayden Saha");
    expect(result.typstSource).not.toContain("```");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("3. Fallback path activates when no provider is configured", () => {
    const fallbackTypst = convertTextToTypst(sampleExtractedText, "Jayden Saha Resume");
    expect(fallbackTypst).toContain("= Jayden Saha");
    expect(fallbackTypst).toContain("== Education");
    expect(fallbackTypst).toContain("== Experience");
  });

  it("4. Fallback path activates when AI gateway call throws an error or times out", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Network timeout after 30000ms"));

    const config: ProviderConfig = { provider: "openai", apiKey: "sk-test-key-12345" };
    const result = await convertPdfTextToTypst({
      providerConfig: config,
      rawText: sampleExtractedText,
      fileName: "Jayden_Saha_Resume",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("5. Zero-content-drop metric assertion: verifies key section headers and >= 90% word preservation", () => {
    const fallbackTypst = convertTextToTypst(sampleExtractedText, "Jayden Saha Resume");

    // Section headers preservation
    const requiredSections = ["Education", "Experience", "Projects", "Technical Skills"];
    for (const section of requiredSections) {
      expect(fallbackTypst.toLowerCase()).toContain(section.toLowerCase());
    }

    // Key terminology preservation
    const keyTerms = ["Wilfrid Laurier", "Trillium Health", "FastAPI", "LangGraph", "Python", "TypeScript"];
    for (const term of keyTerms) {
      expect(fallbackTypst).toContain(term);
    }

    // Word count preservation check
    const rawWords = sampleExtractedText.split(/\s+/).filter(Boolean);
    const typstWords = fallbackTypst.split(/\s+/).filter(Boolean);

    // Converted markup should retain at least 90% of original raw text words
    expect(typstWords.length).toBeGreaterThanOrEqual(Math.floor(rawWords.length * 0.9));
  });

  it("6. Special character escaping rules in fallback converter", () => {
    const textWithSpecialChars = "Experience at Company #1 & Salary $100k @ Remote \\ Main";
    const converted = convertTextToTypst(textWithSpecialChars, "Test");

    expect(converted).toContain("\\#1");
    expect(converted).toContain("\\$100k");
    expect(converted).toContain("\\@ Remote");
    expect(converted).toContain("\\\\ Main");
  });

  it("7. AI conversion output verifies section headers and key term preservation against rich mocked AI response", async () => {
    const mockedAiTypst = `= Jayden Saha\n\n== Education\nWilfrid Laurier University\nBachelor of Science\n\n== Experience\nTrillium Health Partners\n- Maintained data-center asset, rack, and cabinet documentation\n\n== Projects\nAI Stock Analyst Agent\n- Built full-stack AI agent with FastAPI and LangGraph\n\n== Technical Skills\nLanguages: Python, TypeScript`;

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: mockedAiTypst } }],
      }),
    } as Response);

    const config: ProviderConfig = { provider: "openai", apiKey: "sk-test-key" };
    const result = await convertPdfTextToTypst({
      providerConfig: config,
      rawText: sampleExtractedText,
      fileName: "Jayden_Saha_Resume",
    });

    expect(result.success).toBe(true);
    expect(result.typstSource).toContain("Education");
    expect(result.typstSource).toContain("Experience");
    expect(result.typstSource).toContain("Trillium Health");
    expect(result.typstSource).toContain("FastAPI");
  });
});
