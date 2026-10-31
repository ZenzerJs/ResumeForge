import { test, expect, type Page } from "@playwright/test";

import { execFileSync } from "node:child_process";

import { mkdir, readFile, writeFile } from "node:fs/promises";

import path from "node:path";

import { classifyPdfTextFallback, parsePdfBuffer } from "../src/lib/pdf/parser";

import { buildResumeDocument, parseManagedResume, renderResumeDocument, type ResumeAssignment } from "../src/lib/typst/resume-document";

import { renderLegacyResumeDocument } from "../src/lib/typst/resume-document-v2-legacy";



const artifacts = process.env.RESUME_LAYOUT_ARTIFACTS || path.join(process.cwd(), "test-results", "resume-layout-v2");



async function inspectPdfGeometry(name: string) {

  const probe = `

    import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

    import { readFile } from "node:fs/promises";

    const task = pdfjs.getDocument({ data: new Uint8Array(await readFile(process.argv[1])), disableFontFace: true });

    const doc = await task.promise;

    const pages = [];

    for (let i = 1; i <= doc.numPages; i++) {

      const page = await doc.getPage(i);

      const content = await page.getTextContent();

      const annotations = await page.getAnnotations();

      pages.push({ view: page.view, items: content.items.filter(item => item.str).map(item => ({ text: item.str, x: item.transform[4], y: item.transform[5], width: item.width, height: item.height })), links: annotations.filter(item => item.url).map(item => ({ url: item.url, rect: item.rect })) });

    }

    await task.destroy();

    process.stdout.write(JSON.stringify(pages));

  `;

  const pages = JSON.parse(execFileSync(process.execPath, ["--input-type=module", "-e", probe, path.join(artifacts, `${name}.pdf`)], { encoding: "utf8" })) as Array<{

    view: number[];

    items: Array<{ text: string; x: number; y: number; width: number; height: number }>;

    links: Array<{ url: string; rect: number[] }>;

  }>;

  await writeFile(path.join(artifacts, `${name}-geometry.json`), JSON.stringify(pages, null, 2));

  return pages;

}



async function previewAndExport(page: Page, source: string | null, name: string, approveTwoPages = false, beforeExport?: (page: Page) => Promise<void>) {

  const fontRequests: string[] = [];

  page.on("request", (request) => {

    const url = request.url();

    if (/\.(?:woff2?|otf|ttf)(?:\?|$)/i.test(url) || /fonts\.googleapis\.com|fonts\.gstatic\.com/i.test(url)) fontRequests.push(url);

  });

  // Isolate the synthetic local document from any saved user master; compilation remains real.

  await page.route("**/api/resumes", async (route) => {

    if (route.request().method() === "GET") await route.fulfill({ json: { success: true, data: [] } });

    else await route.continue();

  });

  // Test the empty-storage starter branch even though the isolated server runs in demo mode.

  await page.route("**/api/demo-config", (route) => route.fulfill({ json: { demoMode: false } }));

  await page.addInitScript((typst) => {

    localStorage.clear();

    if (typst) localStorage.setItem("resumeforge_typst_source", typst);

  }, source);

  await page.goto("/editor");

  const isV2 = !source || source.includes("// ResumeForge layout v2");

  const preview = isV2 ? page.getByTestId("layout-page-preview").first() : page.locator(".typst-preview-svg").first();

  await expect(preview.locator(isV2 ? "img" : "svg").first()).toBeVisible({ timeout: 30000 });

  await expect(page.getByText("Compilation Error")).toHaveCount(0);

  if (beforeExport) await beforeExport(page);

  await mkdir(artifacts, { recursive: true });

  await preview.screenshot({ path: path.join(artifacts, `${name}.png`) });

  if (beforeExport) await page.getByTestId("editor-mode-code").first().click();
  const currentSource = await page.locator(".cm-content").first().textContent();
  if (currentSource?.includes("// @layout-v2-review-required")) {

    await page.locator('[data-testid="export-dropdown-btn"]:visible').first().click();

    await page.getByTestId("export-pdf-menu-item").click();

    await expect(page.getByTestId("export-error-recovery-banner").first()).toContainText("Review the unclassified");

    await page.getByRole("button", { name: "I reviewed this content" }).first().click();

    await expect(page.getByTestId("layout-page-status").first()).toContainText(/\d pages? measured/, { timeout: 30000 });

  }

  if (approveTwoPages) {

    await expect(page.getByTestId("layout-page-status").first()).toContainText("2 pages measured", { timeout: 30000 });

    await expect(preview.locator("img")).toHaveCount(2);

    await preview.locator("img").nth(0).screenshot({ path: path.join(artifacts, `${name}-page-1.png`) });

    await preview.locator("img").nth(1).screenshot({ path: path.join(artifacts, `${name}-page-2.png`) });

    for (const item of ["export-pdf-menu-item", "export-zip-menu-item"]) {

      await page.locator('[data-testid="export-dropdown-btn"]:visible').first().click();

      await page.getByTestId(item).click();

      await expect(page.getByTestId("export-error-recovery-banner").first()).toContainText("Use two pages");

    }

    await page.getByRole("button", { name: "Use two pages" }).first().click();

    await expect(page.getByTestId("layout-page-status").first()).toContainText("✓", { timeout: 30000 });

    await expect(page.getByTestId("layout-page-status").first()).toContainText("2 pages measured", { timeout: 30000 });

  }

  const downloadPromise = page.waitForEvent("download", { timeout: 30000 });

  await page.locator('[data-testid="export-dropdown-btn"]:visible').first().click();

  await page.locator('[data-testid="export-pdf-menu-item"]:visible').first().click();

  const download = await downloadPromise;

  const pdfPath = path.join(artifacts, `${name}.pdf`);

  await download.saveAs(pdfPath);

  const bytes = await readFile(pdfPath);

  expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");

  // Isolate PDF.js from pdf-parse's different PDF.js worker version.

  const fontProbe = `

    import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

    import { readFile } from "node:fs/promises";

    const task = pdfjs.getDocument({ data: new Uint8Array(await readFile(process.argv[1])), disableFontFace: true });

    const doc = await task.promise;

    const fonts = [];

    const items = [];

    for (let i = 1; i <= doc.numPages; i++) {

      const page = await doc.getPage(i);

      const content = await page.getTextContent();

      items.push(...content.items.filter(item => item.str).map(item => ({ text: item.str, y: item.transform[5], height: item.height })));

      await page.getOperatorList();

      for (const id of Object.keys(content.styles)) {

        const font = page.commonObjs.get(id);

        fonts.push({ name: font.name, missingFile: font.missingFile });

      }

    }

    await task.destroy();

    process.stdout.write(JSON.stringify({ fonts, items }));

  `;

  const { fonts, items } = JSON.parse(execFileSync(process.execPath, ["--input-type=module", "-e", fontProbe, pdfPath], { encoding: "utf8" })) as { fonts: Array<{ name?: string; missingFile?: boolean }>; items: Array<{ text: string; y: number; height: number }> };

  expect(fonts.length).toBeGreaterThan(0);

  expect(fonts.every((font) => font.missingFile === false)).toBe(true);

  expect(fonts.some((font) => font.name?.includes("LibertinusSerif"))).toBe(true);

  if (name === "starter") {

    const labels = ["Languages:", "Frameworks & Libraries:", "Tools & Infrastructure:"].map((label) => items.find((item) => item.text === label));

    expect(labels.every(Boolean)).toBe(true);

    for (let i = 1; i < labels.length; i++) {

      expect(labels[i - 1]!.y - labels[i]!.y).toBeGreaterThanOrEqual(labels[i]!.height);

    }

  }

  expect(fontRequests.every((url) => new URL(url).origin === new URL(page.url()).origin)).toBe(true);

  return bytes;

}



test.describe("Real Typst resume rendering", () => {

  test("dense synthetic resume keeps project links with their entries and contact facts", async ({ page }) => {

    const lines: Array<[ResumeAssignment["kind"], string]> = [

      ["name", "Morgan Example"],

      ["contact", "morgan@example.invalid | +1 555 010 2000 | Boston, MA | morgan@example.invalid"],

      ["section", "Experience"],

      ["entry-title", "Synthetic Systems"], ["entry-role", "Software Engineer"], ["entry-date", "2022 – Present"],

      ["bullet", "- Built a fictional service that improved reliability and delivery."],

      ["entry-title", "Example Labs"], ["entry-role", "Developer"], ["entry-date", "2019 – 2022"],

      ["bullet", "- Developed fictional tooling and documented operational workflows."],

      ["section", "Education"], ["entry-title", "Example University"], ["entry-role", "Bachelor of Science"], ["entry-date", "2019"],

      ["section", "Projects"],

      ["entry-title", "Project Alpha | GitHub | Live Demo"], ["bullet", "- Built a fictional planning tool."],

      ["entry-title", "Project Beta | GitHub | Live Demo"], ["bullet", "- Built a fictional research tool."],

      ["entry-title", "Project Gamma | GitHub | Live Demo"], ["bullet", "- Built a fictional reporting tool."],

      ["section", "Skills"], ["skill", "Languages: TypeScript, Python"], ["skill", "Tools: Git, PostgreSQL"],

      ["paragraph", "Unclassified synthetic detail for review."],

    ];

    const text = lines.map(([, value]) => value).join("\n");

    let offset = 0;

    const assignments = lines.map(([kind, value]) => {

      const assignment = { kind, span: { start: offset, end: offset + value.length } };

      offset += value.length + 1;

      return assignment;

    });

    const links = ["alpha", "beta", "gamma"].flatMap((project) => {

      return [

        { url: `https://example.invalid/${project}/source`, label: "GitHub" },

        { url: `https://example.invalid/${project}/demo`, label: "Live Demo" },

      ];

    });

    const source = renderResumeDocument(buildResumeDocument(text, assignments), "compact", links);

    expect(source).toContain("// @layout-v2-review-required");

    await mkdir(artifacts, { recursive: true });

    await writeFile(path.join(artifacts, "dense-synthetic.typ"), source);

    const pdf = await previewAndExport(page, source, "dense-synthetic", false, async (editorPage) => {

      await editorPage.getByTestId("editor-mode-visual").first().click();

      await expect(editorPage.getByTestId("managed-resume-form").first()).toBeVisible();

      for (let i = 0; i < 6; i++) {

        const project = ["Alpha", "Beta", "Gamma"][Math.floor(i / 2)];

        const selector = editorPage.getByTestId(`link-placement-${i}`).first();

        const label = i % 2 === 0 ? "GitHub" : "Live Demo";

        const option = selector.locator("option").filter({ hasText: new RegExp(`^${label} — .*Project ${project}`) }).first();

        const value = await option.getAttribute("value");

        expect(value).toBeTruthy();

        await selector.selectOption(value!);

      }

      await expect(editorPage.getByTestId("layout-page-status").first()).toContainText("1 page measured", { timeout: 30000 });

    });

    const parsed = await parsePdfBuffer(pdf);

    expect(parsed.numpages).toBe(1);

    for (const fact of ["+1 555 010 2000", "Boston, MA", "Unclassified synthetic detail for review.", "Languages:", "Tools:"]) expect(parsed.text).toContain(fact);

    expect((parsed.text.match(/morgan@example\.invalid/g) || [])).toHaveLength(1);

    const [geometry] = await inspectPdfGeometry("dense-synthetic");

    const originalTools = geometry.items.find((item) => item.text.includes("Tools:"));

    const originalUnknown = geometry.items.find((item) => item.text.includes("Unclassified synthetic detail for review."));

    expect(originalTools).toBeTruthy();

    expect(originalUnknown).toBeTruthy();

    expect(originalTools!.y - originalUnknown!.y).toBeGreaterThanOrEqual(10.5);

    const projectItems = ["Project Alpha", "Project Beta", "Project Gamma"].map((label) => geometry.items.find((item) => item.text.includes(label))!);

    expect(projectItems.every(Boolean)).toBe(true);

    const projectLinks = geometry.links.filter((link) => /\/(?:alpha|beta|gamma)\/(?:source|demo)$/.test(link.url));

    expect(projectLinks.map((link) => link.url)).toEqual(["alpha", "beta", "gamma"].flatMap((project) => [`https://example.invalid/${project}/source`, `https://example.invalid/${project}/demo`]));

    for (let i = 0; i < projectItems.length; i++) for (const link of projectLinks.slice(i * 2, i * 2 + 2)) {

      expect(Math.abs(link.rect[1] - projectItems[i].y)).toBeLessThan(15);

      expect(link.rect[1]).toBeLessThan(geometry.items.find((item) => item.text.includes("Experience"))!.y);

    }

    const roundtripDocument = buildResumeDocument(parsed.text, classifyPdfTextFallback(parsed.text));

    const roundtripBlocks = roundtripDocument.sections.flatMap((section) => section.blocks);

    const unknown = roundtripBlocks.find((block) => block.text.includes("Unclassified synthetic detail for review."));

    expect(unknown).toMatchObject({ kind: "paragraph", unassigned: true });

    expect(roundtripBlocks.filter((block) => block.kind === "skill").every((block) => !block.text.includes("Unclassified synthetic detail for review."))).toBe(true);

    for (const project of ["Alpha", "Beta", "Gamma"]) {

      expect(roundtripBlocks.some((block) => block.kind === "entry-title" && block.text.includes(`Project ${project}`))).toBe(true);

    }

    const roundtripSource = renderResumeDocument(roundtripDocument, "compact", parsed.links);

    expect(roundtripSource).toContain("// @layout-v2-review-required");

    await writeFile(path.join(artifacts, "dense-roundtrip.typ"), roundtripSource);

    const secondPage = await page.context().newPage();

    const roundtrip = await parsePdfBuffer(await previewAndExport(secondPage, roundtripSource, "dense-roundtrip", false, async (editorPage) => {

      await editorPage.getByTestId("editor-mode-visual").first().click();

      for (let i = 0; i < parsed.links.length; i++) {

        const match = parsed.links[i].url.match(/\/(alpha|beta|gamma)\/(source|demo)$/);

        if (!match) continue;

        const project = match[1][0].toUpperCase() + match[1].slice(1);

        const label = match[2] === "source" ? "GitHub" : "Live Demo";

        const selector = editorPage.getByTestId(`link-placement-${i}`).first();

        const value = await selector.locator("option").filter({ hasText: new RegExp(`^${label} . .*Project ${project}`) }).first().getAttribute("value");

        expect(value).toBeTruthy();

        await selector.selectOption(value!);

      }

      await expect(editorPage.getByTestId("layout-page-status").first()).toContainText("1 page measured", { timeout: 30000 });

    }));

    for (const url of projectLinks.map((link) => link.url)) expect(roundtrip.links.some((link) => link.url === url)).toBe(true);

    expect(roundtrip.text).toContain("Unclassified synthetic detail for review.");

    const [roundtripGeometry] = await inspectPdfGeometry("dense-roundtrip");

    const tools = roundtripGeometry.items.find((item) => item.text.includes("Tools:"));

    const unknownLine = roundtripGeometry.items.find((item) => item.text.includes("Unclassified synthetic detail for review."));

    expect(tools).toBeTruthy();

    expect(unknownLine).toBeTruthy();

    expect(tools!.y - unknownLine!.y).toBeGreaterThanOrEqual(10.5);

  });

  test("realistic extracted resume remains one page with all content", async ({ page }) => {

    const text = await readFile(path.join(process.cwd(), "tests", "fixtures", "dense-resume.txt"), "utf8");

    const document = buildResumeDocument(text, classifyPdfTextFallback(text));

    const blocks = document.sections.flatMap((section) => section.blocks);

    for (const title of ["Northwind Systems", "Contoso Research", "Atlas Workspace", "Beacon Analysis Platform", "Cedar Collaborative Planning System"]) {

      expect(blocks.some((block) => block.kind === "entry-title" && block.text.includes(title))).toBe(true);

    }

    for (const stack of ["TypeScript, React, PostgreSQL", "Python, FastAPI, React", "JavaScript, Node.js, React"]) {

      expect(blocks.some((block) => block.kind !== "entry-title" && block.text.includes(stack))).toBe(true);

    }

    expect(blocks.filter((block) => block.kind === "skill")).toHaveLength(3);

    expect(blocks.some((block) => block.kind === "bullet" && block.text.includes("including automated checks"))).toBe(true);

    const source = renderResumeDocument(document, "compact");

    expect(Number(source.match(/#set text\(font: [^,]+, size: ([\d.]+)pt\)/)?.[1])).toBeGreaterThanOrEqual(10);

    await mkdir(artifacts, { recursive: true });

    await writeFile(path.join(artifacts, "realistic-one-page.typ"), source);

    const parsed = await parsePdfBuffer(await previewAndExport(page, source, "realistic-one-page"));

    expect(parsed.numpages).toBe(1);
    const [geometry] = await inspectPdfGeometry("realistic-one-page");
    const educationBullets = ["Studied software design", "Collaborated on a capstone"].map((fact) => geometry.items.find((item) => item.text.includes(fact)));
    expect(educationBullets.every(Boolean)).toBe(true);
    expect(educationBullets[0]!.y - educationBullets[1]!.y).toBeGreaterThanOrEqual(10);
    const company = geometry.items.find((item) => item.text.includes("Northwind Systems"));
    const role = geometry.items.find((item) => item.text.includes("Software Engineer"));
    const languages = geometry.items.find((item) => item.text.includes("Languages:"));
    const frameworks = geometry.items.find((item) => item.text.includes("Frameworks:"));
    expect(company && role && languages && frameworks).toBeTruthy();
    expect(company!.y - role!.y).toBeGreaterThanOrEqual(10);
    expect(languages!.y - frameworks!.y).toBeGreaterThanOrEqual(10);

    const normalize = (value: string) => value.replace(/[\u2013\u2014\u2022\u22c5|]/g, " ").replace(/\s+/g, " ").trim();
    const normalized = normalize(parsed.text);

    for (const line of text.split(/\r?\n/).filter(Boolean)) {

      const pieces = line.split(/(?=\b(?:Jan|Feb) 20\d\d \u2013 )/);
      for (const piece of pieces) expect(normalized).toContain(normalize(piece));

    }

    expect(parsed.text).not.toMatch(/Review imported links|Unresolved PDF links/i);

    expect(parsed.text).not.toMatch(/\u2022\s*[\u2022\u2013\u2014]/);

  });



  test("unresolved links block export until placed", async ({ page }) => {

    const text = "Morgan Example\nProjects\nProject Alpha | GitHub\nProject Beta | GitHub";

    const source = renderResumeDocument(buildResumeDocument(text, classifyPdfTextFallback(text)), "compact", [

      { url: "https://example.invalid/alpha", label: "GitHub" },

      { url: "https://example.invalid/beta", label: "GitHub" },

      { url: "https://example.invalid/unresolved", label: "GitHub" },

    ]);

    expect(source).toContain("// @layout-v2-link-placement-required");

    await page.route("**/api/resumes", (route) => route.fulfill({ json: { success: true, data: [] } }));

    await page.route("**/api/demo-config", (route) => route.fulfill({ json: { demoMode: false } }));

    await page.addInitScript((value) => { localStorage.clear(); localStorage.setItem("resumeforge_typst_source", value); }, source);

    await page.goto("/editor");

    await expect(page.getByTestId("layout-page-preview").first().locator("img").first()).toBeVisible({ timeout: 30000 });

    await mkdir(artifacts, { recursive: true });

    await page.getByTestId("layout-page-preview").first().screenshot({ path: path.join(artifacts, "unresolved-links.png") });

    for (const item of ["export-pdf-menu-item", "export-zip-menu-item"]) {

      await page.locator('[data-testid="export-dropdown-btn"]:visible').first().click();

      await page.getByTestId(item).click();

      await expect(page.getByTestId("export-error-recovery-banner").first()).toContainText("Place the unresolved PDF links");

    }

  });



  test("previous managed v2 sources remain recognized and exportable", async ({ page }) => {

    const text = "Morgan Example\nmorgan@example.invalid\nExperience\nSynthetic Systems\nSoftware Engineer\n- Built a fictional service.";

    const lines: Array<[ResumeAssignment["kind"], string]> = [

      ["name", "Morgan Example"], ["contact", "morgan@example.invalid"], ["section", "Experience"],

      ["entry-title", "Synthetic Systems"], ["entry-role", "Software Engineer"], ["bullet", "- Built a fictional service."],

    ];

    let offset = 0;

    const assignments = lines.map(([kind, value]) => {

      const assignment = { kind, span: { start: offset, end: offset + value.length } };

      offset += value.length + 1;

      return assignment;

    });

    const source = renderLegacyResumeDocument(buildResumeDocument(text, assignments), "comfortable", [{ url: "https://example.invalid/portfolio", label: "Portfolio" }]);

    expect(parseManagedResume(source)).not.toBeNull();

    const pdf = await previewAndExport(page, source, "legacy-managed");

    const parsed = await parsePdfBuffer(pdf);

    expect(parsed.numpages).toBe(1);

    expect(parsed.text).toContain("Synthetic Systems");

    expect(parsed.links.some((link) => link.url === "mailto:morgan@example.invalid")).toBe(true);

    expect(parsed.links.some((link) => link.url === "https://example.invalid/portfolio")).toBe(true);

  });

  test("shipped starter renders and exports one page with its sample facts", async ({ page }) => {

    const pdf = await previewAndExport(page, null, "starter");

    await expect(page.locator(".cm-content").first()).toContainText("ResumeForge layout v2");

    await expect(page.getByTestId("layout-page-status").first()).toContainText("1 page measured");

    const parsed = await parsePdfBuffer(pdf);

    expect(parsed.numpages).toBe(1);

    for (const fact of ["Alex Morgan", "TechCorp Systems", "Software Engineer Intern", "Jun 2024", "University of California"]) expect(parsed.text).toContain(fact);

    expect(parsed.links.some((link) => link.url.includes("github.com/alexmorgan"))).toBe(true);

  });



  test("PDF extraction and fallback conversion preserve sample facts and links", async ({ page }) => {

    const first = await previewAndExport(page, null, "fallback-source");

    const extracted = await parsePdfBuffer(first);

    const document = buildResumeDocument(extracted.text, classifyPdfTextFallback(extracted.text));

    const blocks = document.sections.flatMap((section) => section.blocks);

    const developed = blocks.filter((block) => block.kind === "bullet" && block.text.includes("Developed high-throughput REST"));

    expect(developed).toHaveLength(1);

    expect(developed[0].text.replace(/\s+/g, " ")).toContain("sub-100ms response latency");

    const skills = blocks.filter((block) => block.kind === "skill");

    for (const label of ["Languages:", "Frameworks & Libraries:", "Tools & Infrastructure:"]) {

      expect(skills.some((block) => block.text.includes(label))).toBe(true);

    }

    const source = renderResumeDocument(document, "comfortable", extracted.links);

    await writeFile(path.join(artifacts, "fallback.typ"), source);

    const secondPage = await page.context().newPage();

    const second = await previewAndExport(secondPage, source, "fallback-roundtrip");

    const result = await parsePdfBuffer(second);

    for (const fact of ["Alex Morgan", "TechCorp Systems", "Software Engineer Intern", "Jun 2024", "University of California"]) expect(result.text).toContain(fact);

    expect(result.links.some((link) => link.url.includes("github.com/alexmorgan"))).toBe(true);

  });



  test("two-page shared renderer requires approval and preserves every synthetic fact", async ({ page }) => {

    const lines: Array<[ResumeAssignment["kind"], string]> = [

      ["name", "Morgan Example"],

      ["contact", "https://example.invalid/morgan"],

      ["section", "Experience"],

      ["entry-title", "Fictional Systems Incorporated"],

      ["entry-role", "Principal Software Engineer"],

      ["entry-location", "Remote"],

      ["entry-date", "January 2018 – Present"],

      ...Array.from({ length: 80 }, (_, index): [ResumeAssignment["kind"], string] => ["bullet", `- Synthetic achievement ${String(index + 1).padStart(2, "0")} improved reliability, documentation, and delivery for a fictional platform.`]),

      ["section", "Education"],

      ["paragraph", "Example University, Bachelor of Science, May 2017"],

    ];

    const text = lines.map(([, value]) => value).join("\n");

    let offset = 0;

    const assignments = lines.map(([kind, value]) => {

      const assignment = { kind, span: { start: offset, end: offset + value.length } };

      offset += value.length + 1;

      return assignment;

    });

    const source = renderResumeDocument(buildResumeDocument(text, assignments));

    const pdf = await previewAndExport(page, source, "two-page-approved", true);

    const parsed = await parsePdfBuffer(pdf);

    expect(parsed.numpages).toBe(2);

    for (const [, value] of lines) {

      const fact = value.replace(/^- /, "");

      expect(parsed.text.replace(/\s+/g, " ")).toContain(fact);

    }

    expect(parsed.links.some((link) => link.url.includes("example.invalid/morgan"))).toBe(true);

    const editor = page.locator(".cm-content").first();

    await editor.click();

    await page.keyboard.press("Control+End");

    await page.keyboard.insertText("\n// Synthetic edit after approval");

    await expect(page.getByTestId("layout-page-status").first()).toContainText("Measuring", { timeout: 10000 });

    await expect(page.getByTestId("layout-page-status").first()).toContainText("2 pages measured", { timeout: 30000 });

    await page.locator('[data-testid="export-dropdown-btn"]:visible').first().click();

    await page.getByTestId("export-pdf-menu-item").click();

    await expect(page.getByTestId("export-error-recovery-banner").first()).toContainText("Use two pages");

  });





  test("sparse research resume preserves Unicode, repeated sections and long fields on one page", async ({ page }) => {

    const lines: Array<[ResumeAssignment["kind"], string]> = [

      ["name", "Élodie Núñez"],

      ["contact", "https://example.invalid/research/extraordinarily-long-publication-portfolio"],

      ["section", "Research"],

      ["entry-title", "Institute for Advanced Synthetic Scientific Research and Interdisciplinary Studies"],

      ["entry-role", "Senior Research Scientist and Principal Investigator for Distributed Systems"],

      ["entry-date", "September 2016 – December 2025"],

      ["bullet", "- Published a fictional study on resilient distributed computation."],

      ["section", "Research"],

      ["paragraph", "Synthetic public research archive with supporting materials."],

      ["section", "Community Service"],

      ["paragraph", "Mentored fictional early career researchers."],

    ];

    const text = lines.map(([, value]) => value).join("\n");

    let offset = 0;

    const assignments = lines.map(([kind, value]) => {

      const assignment = { kind, span: { start: offset, end: offset + value.length } };

      offset += value.length + 1;

      return assignment;

    });

    const source = renderResumeDocument(buildResumeDocument(text, assignments));

    const pdf = await previewAndExport(page, source, "sparse-research");

    const parsed = await parsePdfBuffer(pdf);

    expect(parsed.numpages).toBe(1);

    for (const [, value] of lines) expect(parsed.text.replace(/\s+/g, " ")).toContain(value.replace(/^- /, ""));

    expect((parsed.text.match(/Research/g) || []).length).toBeGreaterThanOrEqual(2);

    expect(parsed.links.some((link) => link.url.includes("extraordinarily-long-publication-portfolio"))).toBe(true);

  });





  test("a document exceeding two pages blocks PDF and ZIP", async ({ page }) => {

    const lines = ["Morgan Example", "Experience", ...Array.from({ length: 260 }, (_, i) => `- Synthetic achievement ${i + 1} describes fictional reliability and delivery work for a long document.`)];

    const text = lines.join("\n");

    let offset = 0;

    const assignments = lines.map((value, i): ResumeAssignment => {

      const item = { kind: i === 0 ? "name" as const : i === 1 ? "section" as const : "bullet" as const, span: { start: offset, end: offset + value.length } };

      offset += value.length + 1;

      return item;

    });

    const source = renderResumeDocument(buildResumeDocument(text, assignments));

    await page.route("**/api/resumes", async (route) => {

      if (route.request().method() === "GET") await route.fulfill({ json: { success: true, data: [] } });

      else await route.continue();

    });

    await page.route("**/api/demo-config", (route) => route.fulfill({ json: { demoMode: false } }));

    await page.addInitScript((value) => { localStorage.clear(); localStorage.setItem("resumeforge_typst_source", value); }, source);

    await page.goto("/editor");

    await expect(page.getByTestId("layout-page-status").first()).toContainText(/(?:[3-9]|[1-9][0-9]+) pages measured/, { timeout: 60000 });

    for (const item of ["export-pdf-menu-item", "export-zip-menu-item"]) {

      await page.locator('[data-testid="export-dropdown-btn"]:visible').first().click();

      await page.getByTestId(item).click();

      await expect(page.getByTestId("export-error-recovery-banner").first()).toContainText("exceeds two pages");

    }

  });





  test("unclassified text requires review before PDF export", async ({ page }) => {

    const text = "Morgan Example\nEXPERIENCE\nAn unusual line retained for explicit review.";

    const source = renderResumeDocument(buildResumeDocument(text, [

      { kind: "name", span: { start: 0, end: 14 } },

      { kind: "section", span: { start: 15, end: 25 } },

    ]));

    expect(source).toContain("// @layout-v2-review-required");

    const pdf = await previewAndExport(page, source, "review-acknowledged");

    const parsed = await parsePdfBuffer(pdf);

    expect(parsed.text).toContain("An unusual line retained for explicit review.");

  });



});

