import { expect, test, type Page } from "@playwright/test";
import path from "node:path";
import { mkdirSync } from "node:fs";

const artifacts = path.join("test-results", "suggestion-preview-run", "screenshots");

const base = `#set page(width: 8.5in, height: 11in, margin: 0.8in)
= Work Experience
- Built reliable services for a large and growing customer base with care and collaboration.
- Repeated phrase
- Repeated phrase
#pagebreak()
= Projects
- Improved the deployment process for engineering teams.
`;
const patches = [
  { id: "one", operation: "MODIFY_BULLET", targetSection: "Work Experience", before: "- Built reliable services for a large and growing customer base with care and collaboration.", after: "- Built reliable platforms for a large and growing customer base with care and collaboration.", evidenceIds: ["evidence-1"], rationale: "Clarify scope", confidence: 0.9 },
  { id: "two", operation: "MODIFY_BULLET", targetSection: "Projects", before: "- Improved the deployment process for engineering teams.", after: "- Streamlined the deployment process for engineering teams.", evidenceIds: ["evidence-2"], rationale: "Clarify impact", confidence: 0.9 },
  { id: "duplicate", operation: "MODIFY_BULLET", targetSection: "Work Experience", before: "- Repeated phrase", after: "- Different phrase", evidenceIds: ["evidence-3"], rationale: "Ambiguous", confidence: 0.8 },
];

async function prepare(page: Page) {
  const writes: string[] = [];
  await page.addInitScript(({ source, evidenceIds }) => {
    localStorage.setItem("resumeforge_typst_source", source);
    localStorage.setItem("resumeforge_guest_evidence", JSON.stringify(evidenceIds.map((id) => ({
      id,
      title: id,
      type: "project",
      status: "verified",
      verifiedSummary: "Synthetic verified evidence for suggestion previews.",
    }))));
    localStorage.setItem("resumeforge_ai_settings", JSON.stringify({ provider: "gemini", apiKey: "synthetic-test-key" }));
    const OriginalWorker = window.Worker;
    (window as unknown as { __pdfCompileCount: number }).__pdfCompileCount = 0;
    window.Worker = class SpyWorker extends OriginalWorker {
      postMessage(message: unknown, optionsOrTransfer?: StructuredSerializeOptions | Transferable[]) {
        if (message && typeof message === "object" && (message as { kind?: string }).kind === "pdf") {
          (window as unknown as { __pdfCompileCount: number }).__pdfCompileCount += 1;
        }
        if (Array.isArray(optionsOrTransfer)) {
          return super.postMessage(message, optionsOrTransfer);
        }
        return super.postMessage(message, optionsOrTransfer);
      }
    } as typeof Worker;
  }, { source: base, evidenceIds: patches.flatMap((patch) => patch.evidenceIds) });
  await page.route("**/api/**", async route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (pathname.includes("apply") || pathname.includes("export")) writes.push(pathname);
    const data = pathname === "/api/demo-config" ? { demoMode: true }
      : pathname === "/api/demo/generate-patches" ? { success: true, data: { verified: patches, rejected: [], gaps: [], demo: true } }
      : { success: false, error: "Synthetic test endpoint unavailable" };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(data) });
  });
  await page.goto("/tailor");
  await expect(page.getByTestId("generate-patches-btn")).toBeVisible();
  await page.getByTestId("generate-patches-btn").click();
  await page.getByTestId("tailor-tab-3-pane").click();
  const preview = page.getByRole("region", { name: "Resume suggestion preview" });
  await expect(preview).toBeVisible();
  await expect(preview.getByRole("img", { name: "Resume page 2" })).toBeVisible({ timeout: 90000 });
  return { preview, writes };
}

for (const viewport of [{ name: "desktop", width: 1440, height: 900 }, { name: "narrow", width: 375, height: 812 }]) {
  test(`${viewport.name} real renderer and suggestion decisions`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    const { preview, writes } = await prepare(page);
    await expect(preview.getByRole("button", { name: "Review suggestion 1, pending" })).toBeVisible();
    await expect(preview.getByRole("button", { name: "Review suggestion 2, pending" })).toBeAttached();
    await expect(preview.getByRole("button", { name: /Review suggestion 3/ })).toHaveCount(0);
    await expect(preview.getByText(/1 conflicting or invalid suggestion/)).toBeVisible();
    const original = await preview.getByRole("img", { name: "Resume page 1" }).getAttribute("src");
    const countAfterOriginal = await page.evaluate(() => (window as unknown as { __pdfCompileCount: number }).__pdfCompileCount);
    expect(countAfterOriginal).toBe(3);

    await preview.getByRole("button", { name: "Suggested", exact: true }).click();
    await expect.poll(async () => preview.getByRole("img", { name: "Resume page 1" }).getAttribute("src"), { timeout: 90000 }).not.toBe(original);
    await expect(preview.getByRole("button", { name: "Review suggestion 1, pending" })).toBeVisible({ timeout: 90000 });
    await expect(preview.getByRole("button", { name: "Review suggestion 2, pending" })).toBeAttached({ timeout: 90000 });
    await expect(preview.getByText(/no verified location/)).toHaveCount(0);
    const countAfterFirstSuggested = await page.evaluate(() => (window as unknown as { __pdfCompileCount: number }).__pdfCompileCount);
    expect(countAfterFirstSuggested).toBe(6);

    // Switching back and forth reuses cached renders and probes with zero new PDF compiles
    await preview.getByRole("button", { name: "Original", exact: true }).click();
    await preview.getByRole("button", { name: "Suggested", exact: true }).click();
    await preview.getByRole("button", { name: "Original", exact: true }).click();
    await expect.poll(async () => preview.getByRole("img", { name: "Resume page 1" }).getAttribute("src"), { timeout: 90000 }).toBe(original);
    await expect(preview.getByRole("button", { name: "Original", exact: true })).toHaveAttribute("aria-pressed", "true");
    expect(await page.evaluate(() => (window as unknown as { __pdfCompileCount: number }).__pdfCompileCount)).toBe(countAfterFirstSuggested);

    await preview.getByRole("button", { name: "Suggested", exact: true }).click();
    await expect.poll(async () => preview.getByRole("img", { name: "Resume page 1" }).getAttribute("src"), { timeout: 90000 }).not.toBe(original);
    expect(await page.evaluate(() => (window as unknown as { __pdfCompileCount: number }).__pdfCompileCount)).toBe(countAfterFirstSuggested);
    const geometry = await preview.getByRole("button", { name: "Review suggestion 1, pending" }).evaluate(button => {
      const marker = button.getBoundingClientRect();
      const pageRect = button.parentElement!.getBoundingClientRect();
      const highlight = button.previousElementSibling!.getBoundingClientRect();
      return { highlightLeft: highlight.left, x: marker.x, y: marker.y, right: marker.right, bottom: marker.bottom, pageX: pageRect.x, pageY: pageRect.y, pageRight: pageRect.right, pageBottom: pageRect.bottom };
    });
    expect(geometry.right).toBeLessThanOrEqual(geometry.highlightLeft + 1);
    expect(geometry.x).toBeGreaterThanOrEqual(geometry.pageX - 14);
    expect(geometry.y).toBeGreaterThanOrEqual(geometry.pageY - 14);
    expect(geometry.right).toBeLessThanOrEqual(geometry.pageRight + 14);
    expect(geometry.bottom).toBeLessThanOrEqual(geometry.pageBottom + 14);
    const widths = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: document.documentElement.clientWidth }));
    expect(widths.document).toBeLessThanOrEqual(widths.viewport + 1);
    mkdirSync(artifacts, { recursive: true });
    await preview.screenshot({ path: path.join(artifacts, `${viewport.name}-suggested.png`), style: "header { visibility: hidden !important; }" });
    await preview.getByRole("button", { name: "Review suggestion 1, pending" }).click();
    await expect(preview.getByText(/Clarify scope/)).toBeVisible();
    await expect(preview.getByText(/evidence-1/)).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __pdfCompileCount: number }).__pdfCompileCount)).toBe(countAfterFirstSuggested);

    await preview.getByRole("button", { name: "Accept", exact: true }).click();
    await expect(preview.getByRole("button", { name: "Review suggestion 1, accepted" })).toBeVisible({ timeout: 90000 });
    expect(await page.evaluate(() => (window as unknown as { __pdfCompileCount: number }).__pdfCompileCount)).toBe(countAfterFirstSuggested);

    await preview.getByRole("button", { name: "Reject", exact: true }).click();
    await expect(preview.getByRole("button", { name: "Review suggestion 1, rejected" })).toBeVisible({ timeout: 90000 });
    await expect.poll(async () => preview.getByRole("img", { name: "Resume page 1" }).getAttribute("src"), { timeout: 90000 }).toBe(original);
    const countAfterReject = await page.evaluate(() => (window as unknown as { __pdfCompileCount: number }).__pdfCompileCount);
    expect(countAfterReject).toBeGreaterThan(countAfterFirstSuggested);
    expect(await page.evaluate(() => localStorage.getItem("resumeforge_typst_source"))).toBe(base);
    expect(writes).toEqual([]);
    await preview.screenshot({ path: path.join(artifacts, `${viewport.name}-rejected.png`), style: "header { visibility: hidden !important; }" });
    await page.evaluate(() => { localStorage.setItem("resumeforge_typst_source", "changed elsewhere"); window.dispatchEvent(new Event("focus")); });
    await expect(page.getByText(/Preview unavailable: this proposal no longer matches/)).toBeVisible();
    expect(errors).toEqual([]);
  });
}
