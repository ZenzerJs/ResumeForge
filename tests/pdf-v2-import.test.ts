import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { convertPdfTextToTypst } from "@/lib/ai/gateway";
import { POST } from "@/app/api/resumes/upload-pdf/route";
import { buildResumeDocument, renderResumeDocument } from "@/lib/typst/resume-document";
import { classifyPdfTextFallback, parsePdfBuffer } from "@/lib/pdf/parser";
import * as auth from "@/lib/security/auth-request";
import * as db from "@/lib/db/resumes";

const source = "Ada Example\nada@example.com\nExperience\nExample Co\n- Built reliable systems\nAwards\nWon a prize\nAwards\nAnother prize";
const providerConfig = { provider: "openai" as const, apiKey: "test-key" };
const respond = (content: unknown) => vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content } }] }) } as Response);

// A real one-page PDF: the URL exists only in its link annotation, not in its text stream.
function annotationPdf(): Buffer {
  const stream = "BT /F1 12 Tf 72 720 Td (Morgan Sample) Tj 0 -20 Td (Portfolio) Tj ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R /Annots [6 0 R] >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Annot /Subtype /Link /Rect [72 695 130 710] /Border [0 0 0] /A << /S /URI /URI (https://example.com/portfolio) >> >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const [i, object] of objects.entries()) { offsets.push(Buffer.byteLength(pdf)); pdf += `${i + 1} 0 obj\n${object}\nendobj\n`; }
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${offsets.length}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf);
}
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

describe("V2 PDF extraction", () => {
  it("extracts an annotation-only URL without inserting Markdown into text", async () => {
    const parsed = await parsePdfBuffer(annotationPdf());
    expect(parsed.text).toContain("Portfolio");
    expect(parsed.text).not.toContain("https://example.com/portfolio");
    expect(parsed.text).not.toContain("[Portfolio](");
    expect(parsed.links).toContainEqual(expect.objectContaining({ url: "https://example.com/portfolio", page: 1 }));
  });
  it("accepts source spans and never returns provider code as Typst", async () => {
    respond(JSON.stringify({ assignments: [{ kind: "name", span: { start: 0, end: 11 } }] }));
    const result = await convertPdfTextToTypst({ providerConfig, rawText: source, formattingVersion: 2 });
    expect(result.success).toBe(true);
    expect(result.typstSource).toBeUndefined();
    const doc = buildResumeDocument(source, result.assignments);
    expect(doc.issues.length).toBeGreaterThan(0);
    expect(renderResumeDocument(doc)).toContain("Won a prize");
  });

  it.each([
    null, "", "#evil()", JSON.stringify({ assignments: [] }),
    JSON.stringify({ assignments: [{ kind: "name", span: { start: 0, end: 11 }, text: "Invented" }] }),
    JSON.stringify({ assignments: [{ kind: "name", span: { start: 0, end: 999 } }] }),
    JSON.stringify({ assignments: [{ kind: "name", span: { start: 0, end: 11 } }, { kind: "contact", span: { start: 5, end: 12 } }] }),
  ])("rejects empty, invented, invalid or overlapping assignments: %s", async (content) => {
    respond(content);
    expect((await convertPdfTextToTypst({ providerConfig, rawText: source, formattingVersion: 2 })).success).toBe(false);
  });

  it("preserves repeated headings and unknown text in fallback source order", () => {
    const doc = buildResumeDocument(source, classifyPdfTextFallback(source));
    expect(doc.sections.map((s) => s.heading.text)).toEqual(["Experience", "Awards", "Awards"]);
    const rendered = renderResumeDocument(doc);
    expect(rendered.indexOf("Won a prize")).toBeLessThan(rendered.indexOf("Another prize"));
    expect(doc.issues.length).toBeGreaterThan(0);
  });

  it("renders the fallback employer, role and date from a synthetic resume", () => {
    const text = "Morgan Sample\nmorgan@example.com\nExperience\nNorthwind Labs\nPlatform Engineer Jan 2020 - Present\n- Built services";
    const doc = buildResumeDocument(text, classifyPdfTextFallback(text));
    expect(doc.sections[0].blocks.map((block) => [block.kind, block.text.trim()])).toEqual([
      ["entry-title", "Northwind Labs"], ["entry-role", "Platform Engineer"],
      ["entry-date", "Jan 2020 - Present"], ["bullet", "- Built services"],
    ]);
    const output = renderResumeDocument(doc);
    expect(output).toContain("Northwind Labs");
    expect(output).toContain("Platform Engineer");
    expect(output).toContain("Jan 2020 \\- Present");
    expect(doc.source).toContain("Jan 2020 - Present");
  });

  it("separates a known employer location and role date into source spans", () => {
    const text = "Morgan Sample\nExperience\nNorthwind Health Systems Mississauga, ON\nIT Operations May 2026 - Present\n- Supported systems";
    const doc = buildResumeDocument(text, classifyPdfTextFallback(text));
    expect(doc.sections[0].blocks.map((block) => [block.kind, block.text.trim()])).toEqual([
      ["entry-title", "Northwind Health Systems"], ["entry-location", "Mississauga, ON"],
      ["entry-role", "IT Operations"], ["entry-date", "May 2026 - Present"], ["bullet", "- Supported systems"],
    ]);
  });

  it("keeps wrapped PDF bullets and skill categories together while preserving source text", () => {
    const text = "Morgan Sample\nExperience\nNorthwind Labs Toronto, ON\nPlatform Engineer Jan 2020 - Present\n- Developed high-throughput REST and GraphQL API endpoints serving over 100k daily active requests with\nsub-100ms response latency.\nSkills\nLanguages: TypeScript, JavaScript, Python,\nRust\nTools: Git, Docker";
    const doc = buildResumeDocument(text, classifyPdfTextFallback(text));
    const experience = doc.sections[0].blocks;
    expect(experience.map((block) => block.kind)).toEqual(["entry-title", "entry-location", "entry-role", "entry-date", "bullet"]);
    expect(experience[4].text).toContain("with\nsub-100ms response latency.");
    const skills = doc.sections[1].blocks;
    expect(skills.map((block) => block.kind)).toEqual(["skill", "skill"]);
    expect(skills[0].text).toContain("Python,\nRust");
    expect(doc.source).toBe(text);
    const rendered = renderResumeDocument(doc);
    expect(rendered).toContain("with sub\\-100ms response latency.");
    expect(rendered).toContain("Python, Rust");
  });

  it("classifies the extracted shipped starter's wrapped bullet and three skill lines", () => {
    // Text reproduced from the compiled starter PDF's extraction, without PDF page markers.
    const text = "Alex Morgan\nSan Francisco, CA ⋅ alex.morgan@example.com ⋅ (555) 019-2834\nExperience\nTechCorp Systems San Francisco, CA\nSoftware Engineer Intern Jun 2024 – Present\n• Developed high-throughput REST and GraphQL API endpoints serving over 100k daily active requests with\nsub-100ms response latency.\n• Refactored legacy frontend components into modular React hooks, reducing bundle size by 24% and improving initial\npage load speed.\nSkills\nLanguages: TypeScript, JavaScript, Python, Go, SQL, HTML/CSS\nFrameworks & Libraries: React, Next.js, Node.js, Express, Tailwind CSS, Prisma\nTools & Infrastructure: Git, Docker, PostgreSQL, SQLite, Vitest, CI/CD Pipelines";
    const doc = buildResumeDocument(text, classifyPdfTextFallback(text));
    const blocks = doc.sections[0].blocks;
    expect(blocks.map((block) => block.kind)).toEqual(["entry-title", "entry-location", "entry-role", "entry-date", "bullet", "bullet"]);
    expect(blocks[0].text).toBe("TechCorp Systems");
    expect(blocks[2].text.trim()).toBe("Software Engineer Intern");
    expect(blocks[3].text).toBe("Jun 2024 – Present");
    expect(blocks[4].text).toContain("with\nsub-100ms response latency.");
    expect(doc.sections[1].blocks.map((block) => block.kind)).toEqual(["skill", "skill", "skill"]);
    expect(doc.source).toBe(text);
  });

  it("keeps an unknown capitalized line separate from skills and styles explicit project titles", () => {
    const text = "Morgan Example\nProjects\nAtlas | GitHub | Live Demo\n- Built a tool\nBeacon | GitHub\n- Built a service\nSkills\nTools: Git, PostgreSQL\nUnclassified synthetic detail for review.";
    const doc = buildResumeDocument(text, classifyPdfTextFallback(text));
    expect(doc.sections[0].blocks.map((block) => block.kind)).toEqual(["entry-title", "bullet", "entry-title", "bullet"]);
    expect(doc.sections[1].blocks.map((block) => [block.kind, block.unassigned, block.text])).toEqual([
      ["skill", false, "Tools: Git, PostgreSQL"],
      ["paragraph", true, "Unclassified synthetic detail for review."],
    ]);
    expect(doc.source).toBe(text);
    const output = renderResumeDocument(doc);
    expect(output).toContain('#entry(title: [Atlas | GitHub | Live Demo]');
    expect(output).toContain("Unclassified synthetic detail for review.");
    expect(output).toContain("// @layout-v2-review-required");
  });

  it("classifies dense dated projects and wrapped continuations without promoting prose", () => {
    const text = readFileSync("tests/fixtures/dense-resume.txt", "utf8");
    const doc = buildResumeDocument(text, classifyPdfTextFallback(text));
    const projects = doc.sections.find((section) => section.heading.text === "Projects")!;
    expect(projects.blocks.filter((block) => block.kind === "entry-title").map((block) => block.text)).toEqual([
      "Atlas Workspace | GitHub | Live Demo", "Beacon Analysis Platform | GitHub | Live Demo", "Cedar Collaborative Planning System | GitHub | Live Demo",
    ]);
    expect(projects.blocks.filter((block) => block.kind === "entry-date")).toHaveLength(3);
    expect(projects.blocks.filter((block) => block.kind === "entry-role")).toHaveLength(3);
    expect(projects.blocks.filter((block) => block.kind === "bullet")).toHaveLength(7);
    expect(doc.source).toBe(text);
    const output = renderResumeDocument(doc);
    expect(output).not.toContain("- �");
    expect(output).toContain("columns: (1fr, auto)");
  });

  it("returns a reviewable browser-local fallback when AI is rejected", async () => {
    vi.stubEnv("DEMO_MODE", "true"); vi.stubEnv("NEXT_PUBLIC_RESUME_LAYOUT_V2", "true");
    respond("#invented()");
    const request = new Request("http://localhost/api/resumes/upload-pdf", { method: "POST", headers: { "content-type": "application/json", origin: "http://localhost" }, body: JSON.stringify({ rawText: source, providerConfig }) });
    const response = await POST(request);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.conversionPath).toBe("fallback");
    expect(body.data.typstSource).not.toContain("#invented()");
    expect(body.formattingVersion).toBe(2);
    expect(body.importIssues.length).toBeGreaterThan(0);
  });

  it("rejects empty input before persistence", async () => {
    vi.stubEnv("DEMO_MODE", "true"); vi.stubEnv("NEXT_PUBLIC_RESUME_LAYOUT_V2", "true");
    const create = vi.spyOn(db, "createResume");
    const response = await POST(new Request("http://localhost/api/resumes/upload-pdf", { method: "POST", headers: { "content-type": "application/json", origin: "http://localhost" }, body: JSON.stringify({ rawText: "   " }) }));
    expect(response.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  it.each(["null", "{", JSON.stringify({ rawText: null })])("rejects malformed JSON and invalid rawText: %s", async (payload) => {
    vi.stubEnv("DEMO_MODE", "true");
    const response = await POST(new Request("http://localhost/api/resumes/upload-pdf", { method: "POST", headers: { "content-type": "application/json", origin: "http://localhost" }, body: payload }));
    expect(response.status).toBe(400);
  });

  it("rejects a multipart file field that is not a file", async () => {
    vi.stubEnv("DEMO_MODE", "true");
    const form = new FormData(); form.set("file", "not a file");
    const response = await POST(new Request("http://localhost/api/resumes/upload-pdf", { method: "POST", headers: { origin: "http://localhost" }, body: form }));
    expect(response.status).toBe(400);
  });

  it("rejects foreign origins and oversized authenticated requests", async () => {
    vi.stubEnv("DEMO_MODE", "false");
    vi.spyOn(auth, "requireUserId").mockResolvedValue("user");
    const request = (headers: Record<string, string>) => new Request("http://localhost/api/resumes/upload-pdf", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify({ rawText: source }) });
    expect((await POST(request({ origin: "https://evil.example" }))).status).toBe(403);
    expect((await POST(request({ "content-length": "20000000" }))).status).toBe(413);
  });

  it("rejects missing demo origin and unauthenticated uploads", async () => {
    vi.stubEnv("DEMO_MODE", "true");
    const request = () => new Request("http://localhost/api/resumes/upload-pdf", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ rawText: source }) });
    expect((await POST(request())).status).toBe(403);
    vi.stubEnv("DEMO_MODE", "false");
    vi.spyOn(auth, "requireUserId").mockResolvedValue(auth.guestSaveResponse());
    expect((await POST(request())).status).toBe(401);
  });

  it("rejects an oversized chunked authenticated request", async () => {
    vi.stubEnv("DEMO_MODE", "false"); vi.spyOn(auth, "requireUserId").mockResolvedValue("user");
    const body = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(15 * 1024 * 1024)); controller.close(); } });
    const request = new Request("http://localhost/api/resumes/upload-pdf", { method: "POST", headers: { "content-type": "application/json" }, body, duplex: "half" } as RequestInit);
    expect((await POST(request)).status).toBe(413);
  });

  it("does not allow a filename to break out of its comment", async () => {
    vi.stubEnv("DEMO_MODE", "true"); vi.stubEnv("NEXT_PUBLIC_RESUME_LAYOUT_V2", "true");
    const response = await POST(new Request("http://localhost/api/resumes/upload-pdf", { method: "POST", headers: { "content-type": "application/json", origin: "http://localhost" }, body: JSON.stringify({ title: "x\n#injected()", rawText: source }) }));
    const body = await response.json();
    expect(body.data.typstSource).not.toContain("\n#injected()");
  });

  it("handles a provider timeout without logging the supplied key", async () => {
    vi.stubEnv("DEMO_MODE", "true"); vi.stubEnv("NEXT_PUBLIC_RESUME_LAYOUT_V2", "true");
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("timeout"));
    const log = vi.spyOn(console, "warn");
    const response = await POST(new Request("http://localhost/api/resumes/upload-pdf", { method: "POST", headers: { "content-type": "application/json", origin: "http://localhost", "x-ai-provider-config": JSON.stringify(providerConfig) }, body: JSON.stringify({ rawText: source }) }));
    expect((await response.json()).conversionPath).toBe("fallback");
    expect(JSON.stringify(log.mock.calls)).not.toContain(providerConfig.apiKey);
  });
});
