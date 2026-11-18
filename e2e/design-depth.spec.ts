import { expect, test } from "@playwright/test";

function parseRgbaAlpha(color: string): number {
  const match = color.match(/rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(?:\s*,\s*([\d.]+))?\s*\)/i);
  if (!match) return 1;
  return match[1] !== undefined ? Number(match[1]) : 1;
}

function parseRgb(color: string): [number, number, number] {
  const match = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (!match) return [0, 0, 0];
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function contrastRatio(fg: [number, number, number], bg: [number, number, number]): number {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

test.describe("Clear-window homepage glass, dynamic Ember Ink waves, and workspace depth", () => {
  test("Homepage uses clear-window glass, masked canvas for >=4.5:1 h1 contrast, and dynamic AsciiWaves", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const diffusion = page.getByTestId("landing-glass-diffusion");
    await expect(diffusion).toBeVisible();

    const glassStyles = await diffusion.evaluate((el) => {
      const style = getComputedStyle(el);
      const canvas = document.querySelector('[data-testid="ascii-waves-canvas"]');
      const maskHolder = canvas?.parentElement;
      const maskStyle = maskHolder ? getComputedStyle(maskHolder) : null;
      const h1 = document.querySelector("h1");
      const h1Color = h1 ? getComputedStyle(h1).color : "rgb(244, 238, 231)";
      const bodyBg = getComputedStyle(document.body).backgroundColor;
      return {
        backdropFilter: style.backdropFilter || (style as CSSStyleDeclaration & { webkitBackdropFilter?: string }).webkitBackdropFilter || "",
        backgroundColor: style.backgroundColor,
        maskImage: maskStyle?.maskImage || maskStyle?.webkitMaskImage || "",
        h1Color,
        bodyBg,
      };
    });

    const blurMatch = glassStyles.backdropFilter.match(/blur\(([\d.]+)px\)/);
    expect(blurMatch).not.toBeNull();
    expect(Number(blurMatch?.[1])).toBeLessThanOrEqual(2);
    expect(parseRgbaAlpha(glassStyles.backgroundColor)).toBeLessThanOrEqual(0.08);
    expect(glassStyles.maskImage).toContain("radial-gradient");

    const h1Contrast = contrastRatio(parseRgb(glassStyles.h1Color), parseRgb(glassStyles.bodyBg));
    expect(h1Contrast).toBeGreaterThanOrEqual(4.5);

    // Dynamic AsciiWaves: verify frames evolve over time when motion is enabled
    const waveCanvas = page.getByTestId("ascii-waves-canvas");
    await expect(waveCanvas).toBeVisible();

    const sampleFrame = () =>
      waveCanvas.evaluate((el: HTMLCanvasElement) => {
        const ctx = el.getContext("2d");
        if (!ctx || el.width === 0 || el.height === 0) return "";
        const data = ctx.getImageData(0, 0, Math.min(el.width, 320), Math.min(el.height, 240)).data;
        let checksum = 0;
        let nonZero = 0;
        for (let i = 0; i < data.length; i += 16) {
          checksum = (checksum + data[i] + data[i + 1] + data[i + 2] + data[i + 3]) | 0;
          if (data[i + 3] > 0) nonZero++;
        }
        return `${nonZero}:${checksum}`;
      });

    const frameA = await sampleFrame();
    expect(frameA.startsWith("0:")).toBe(false);
    await expect.poll(sampleFrame, { timeout: 5000 }).not.toBe(frameA);

    const lowerBlobs = page
      .getByTestId("landing-lower-atmosphere-stage")
      .getByTestId("landing-lower-blobs");
    await expect(lowerBlobs).toHaveCount(1);
    await expect(lowerBlobs.locator("[data-blob-orb]")).toHaveCount(7);
  });

  test("WorkspaceAtmosphere mounts 7 roaming CSS orbs on non-editor routes without continuous rAF loops, and stays absent on /editor", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const origRaf = window.requestAnimationFrame.bind(window);
      (window as Window & { __rfRafCount?: number }).__rfRafCount = 0;
      window.requestAnimationFrame = (cb: FrameRequestCallback) => {
        (window as Window & { __rfRafCount?: number }).__rfRafCount =
          ((window as Window & { __rfRafCount?: number }).__rfRafCount ?? 0) + 1;
        return origRaf(cb);
      };
    });

    await page.setViewportSize({ width: 1440, height: 900 });

    for (const route of ["/library", "/tracker", "/tracker/feed", "/tailor", "/practice", "/settings"]) {
      await page.goto(route);
      await page.waitForLoadState("networkidle");
      const atmosphere = page.getByTestId("workspace-atmosphere");
      await expect(atmosphere).toHaveCount(1);
      const blobs = atmosphere.getByTestId("ambient-floating-blobs");
      await expect(blobs).toHaveCount(1);
      await expect(blobs.locator("[data-blob-orb]")).toHaveCount(7);

      const transformsBefore = await blobs
        .locator("[data-blob-orb]")
        .evaluateAll((els) => els.map((el) => getComputedStyle(el).transform));

      // Allow CSS animation progress + verify zero continuous JS rAF loop
      await page.evaluate(() => {
        (window as Window & { __rfRafCount?: number }).__rfRafCount = 0;
      });
      await expect
        .poll(
          async () => {
            const transformsAfter = await blobs
              .locator("[data-blob-orb]")
              .evaluateAll((els) => els.map((el) => getComputedStyle(el).transform));
            return transformsBefore.filter((t, i) => t !== transformsAfter[i]).length;
          },
          { timeout: 3000 }
        )
        .toBeGreaterThan(0);

      const idleRafCount = await page.evaluate(
        () => (window as Window & { __rfRafCount?: number }).__rfRafCount ?? 0,
      );
      expect(idleRafCount).toBeLessThanOrEqual(2);
    }

    await page.goto("/editor");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("workspace-atmosphere")).toHaveCount(0);
  });

  test("Reduced motion disables .enter-once, .ambient-blob-* animations, .skeleton-pulse::after glint, .card-lift hover translate, and homepage dynamic waves", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1440, height: 900 });

    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("atmosphere-static-fallback")).toBeVisible();
    await expect(page.getByTestId("ascii-waves-canvas")).toHaveCount(0);
    const homeBlobAnims = await page.evaluate(() =>
      ["a", "b", "c", "d", "e", "f"].map((suffix) => {
        const el = document.querySelector(`.ambient-blob-${suffix}`);
        return el ? getComputedStyle(el).animationName : null;
      }),
    );
    expect(homeBlobAnims.every((anim) => anim === "none")).toBe(true);

    const proofCard = page.getByTestId("product-proof-card");
    await expect(proofCard).toBeVisible();
    await proofCard.hover();
    expect(await proofCard.evaluate((el) => getComputedStyle(el).transform)).toBe("none");

    const workspaceLink = page.getByTestId("capability-grid-section").locator("a").first();
    await expect(workspaceLink).toBeVisible();
    await workspaceLink.hover();
    expect(await workspaceLink.evaluate((el) => getComputedStyle(el).transform)).toBe("none");

    const cardLiftHoverTransform = await page.evaluate(() => {
      const probe = document.createElement("div");
      probe.className = "card-lift";
      document.body.appendChild(probe);
      const transform = getComputedStyle(probe).transform;
      probe.remove();
      return transform;
    });
    expect(cardLiftHoverTransform).toBe("none");

    await page.goto("/settings");
    await page.waitForLoadState("networkidle");
    const enterAnim = await page.evaluate(() => {
      const el = document.querySelector(".enter-once");
      return el ? getComputedStyle(el).animationName : null;
    });
    expect(enterAnim).toBe("none");
    const wsBlobAnims = await page.evaluate(() =>
      ["a", "b", "c", "d", "e", "f"].map((suffix) => {
        const el = document.querySelector(`.ambient-blob-${suffix}`);
        return el ? getComputedStyle(el).animationName : null;
      }),
    );
    expect(wsBlobAnims.every((anim) => anim === "none")).toBe(true);

    const skeletonGlintAnim = await page.evaluate(() => {
      const existing = document.querySelector(".skeleton-pulse");
      if (existing) return getComputedStyle(existing, "::after").animationName;
      const probe = document.createElement("div");
      probe.className = "skeleton-pulse";
      document.body.appendChild(probe);
      const anim = getComputedStyle(probe, "::after").animationName;
      probe.remove();
      return anim;
    });
    expect(skeletonGlintAnim).toBe("none");
  });
});
