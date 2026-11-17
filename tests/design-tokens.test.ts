import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, "src");

function collectSourceFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectSourceFiles(full));
    } else if (/\.(ts|tsx|css)$/.test(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

describe("Design tokens & Ember Ink taste invariants", () => {
  const sourceFiles = collectSourceFiles(SRC_DIR);

  it("forbids navy hex codes and Tailwind slate classes across src/**/*.{ts,tsx,css}", () => {
    const navyHexRe =
      /#(?:0b1326|0a1224|0f172a|131b2e|171f33|172033|1e293b|060e20|121929|030712|020617)\b/gi;
    const slateClassRe = /\b(?:bg|border|from|to|via|text)-slate-/g;

    const violations: string[] = [];
    for (const file of sourceFiles) {
      const text = fs.readFileSync(file, "utf8");
      const navyMatches = text.match(navyHexRe);
      const slateMatches = text.match(slateClassRe);
      if (navyMatches || slateMatches) {
        const rel = path.relative(ROOT, file);
        violations.push(
          `${rel}: ${[...(navyMatches ?? []), ...(slateMatches ?? [])].join(", ")}`,
        );
      }
    }

    expect(violations).toEqual([]);
  });

  it("maps semantic success tokens to Electric Blue with espresso and paper contrast-safe variants in globals.css", () => {
    const globalsSrc = fs.readFileSync(path.join(SRC_DIR, "app/globals.css"), "utf8");

    expect(globalsSrc).toContain("--status-success: var(--accent-contrast);");
    expect(globalsSrc).toContain("--status-success-soft:");
    expect(globalsSrc).toContain("--status-success-paper:");
    expect(globalsSrc).toContain("--status-success-paper-bg:");
    expect(globalsSrc).toContain(".text-status-success-soft");
    expect(globalsSrc).toContain(".status-success-surface");
    expect(globalsSrc).toContain(".paper-highlight-accepted");
    expect(globalsSrc).toContain(".paper-marker-accepted");
    expect(globalsSrc).toContain(".paper-action-accepted");
    expect(globalsSrc).not.toContain("--rf-emerald");
    expect(globalsSrc).not.toContain("107 214 154");
  });

  it("forbids green/emerald/teal status styling across src/**/*.{ts,tsx,css}", () => {
    const greenClassRe =
      /\b(?:bg|text|border|from|to|via|ring|shadow|outline|decoration|accent|fill|stroke)-(?:green|emerald|teal)-\d{2,3}(?:\/\d{1,3})?\b/g;
    const greenHexRe =
      /#(?:6bd69a|10b981|34d399|059669|047857|065f46|064e3b|22c55e|4ade80|86efac|16a34a|14b8a6|2dd4bf)\b/gi;
    const legacyAliasRe = /--rf-emerald|\brf-emerald\b/g;

    const violations: string[] = [];
    for (const file of sourceFiles) {
      const rel = path.relative(ROOT, file).replace(/\\/g, "/");
      const text = fs.readFileSync(file, "utf8");
      const matches = [
        ...(text.match(greenClassRe) ?? []),
        ...(text.match(greenHexRe) ?? []),
        ...(text.match(legacyAliasRe) ?? []),
      ];
      if (matches.length > 0) {
        violations.push(`${rel}: ${matches.join(", ")}`);
      }
    }

    expect(violations).toEqual([]);
  });

  it("disables cursor interaction on every AsciiWaves usage", () => {
    const violations: string[] = [];
    for (const file of sourceFiles) {
      if (!file.endsWith(".tsx")) continue;
      const text = fs.readFileSync(file, "utf8");
      if (/hasCursorInteraction\s*=\s*\{true\}/.test(text)) {
        violations.push(path.relative(ROOT, file));
      }
    }
    expect(violations).toEqual([]);
  });

  it("configures homepage LandingAtmosphere with clear-window glass, radial mask, Ember Ink dynamic waves, and reduced-motion fallback", () => {
    const atmosphereSrc = fs.readFileSync(
      path.join(SRC_DIR, "components/landing/landing-atmosphere.tsx"),
      "utf8",
    );
    const homeSrc = fs.readFileSync(
      path.join(SRC_DIR, "components/landing/home-landing.tsx"),
      "utf8",
    );

    expect(atmosphereSrc).toContain('color="#f7bd3f"');
    expect(atmosphereSrc).toContain('secondaryColor="#ff8b3d"');
    expect(atmosphereSrc).toContain('contrastColor="#4f8fff"');
    expect(atmosphereSrc).toContain('troughColor="#9e9287"');
    expect(atmosphereSrc).toContain("hasCursorInteraction={false}");
    expect(atmosphereSrc).toContain("prefers-reduced-motion: reduce");
    expect(atmosphereSrc).toContain('data-testid="atmosphere-static-fallback"');
    expect(atmosphereSrc).toContain("backdrop-blur-[1.5px]");
    expect(atmosphereSrc).toContain("bg-canvas/[0.06]");
    expect(atmosphereSrc).toContain("radial-gradient(520px 420px at 26% 42%");

    const speedMatch = atmosphereSrc.match(/<AsciiWaves[\s\S]*?speed=\{([0-9.]+)\}/);
    expect(speedMatch).not.toBeNull();
    expect(Number(speedMatch?.[1])).toBeGreaterThan(0);

    expect(homeSrc).toMatch(/data-testid="landing-hero-copy-glass"[\s\S]{0,120}glass-pane/);
    expect(homeSrc).not.toMatch(/data-testid="landing-hero-copy-glass"[\s\S]{0,120}surface-glass/);
    expect(homeSrc).toContain('data-testid="landing-lower-atmosphere-stage"');
    expect(homeSrc).toContain('testId="landing-lower-blobs"');
    expect(homeSrc).toContain("ombre-bar");
    expect(homeSrc).toContain("ombre-divider");
  });

  it("mounts pure-CSS 7-orb WorkspaceAtmosphere in AppShell & PageSkeleton and defines ombre, orb, and skeleton glint utilities with reduced-motion guards", () => {
    const wsAtmosphereSrc = fs.readFileSync(
      path.join(SRC_DIR, "components/design-system/workspace-atmosphere.tsx"),
      "utf8",
    );
    const appShellSrc = fs.readFileSync(
      path.join(SRC_DIR, "components/design-system/app-shell.tsx"),
      "utf8",
    );
    const pageSkeletonSrc = fs.readFileSync(
      path.join(SRC_DIR, "components/design-system/page-skeleton.tsx"),
      "utf8",
    );
    const globalsSrc = fs.readFileSync(
      path.join(SRC_DIR, "app/globals.css"),
      "utf8",
    );

    expect(wsAtmosphereSrc).toContain("export function AmbientColorBlobs");
    expect(wsAtmosphereSrc).toContain('testId="ambient-floating-blobs"');
    expect(wsAtmosphereSrc).toContain("data-blob-orb");
    const orbIds = wsAtmosphereSrc.match(/\bid:\s*\d+/g) ?? [];
    expect(orbIds.length).toBeGreaterThanOrEqual(7);
    expect(wsAtmosphereSrc).toContain("ombre-divider");
    expect(wsAtmosphereSrc).not.toContain("AsciiWaves");
    expect(wsAtmosphereSrc).not.toMatch(/\brequestAnimationFrame\s*\(/);
    expect(wsAtmosphereSrc).toContain('variant === "landing" || variant === "editor"');
    expect(wsAtmosphereSrc).toContain('data-testid="workspace-atmosphere"');

    expect(appShellSrc).toContain("<WorkspaceAtmosphere variant={variant} />");
    expect(appShellSrc).toContain('variant !== "landing" && variant !== "editor"');
    expect(appShellSrc).toContain("glass-bar");

    expect(pageSkeletonSrc).toContain("<WorkspaceAtmosphere");
    expect(pageSkeletonSrc).toContain('variant !== "editor"');

    for (const token of [
      "--shadow-1",
      "--shadow-2",
      "--shadow-3",
      ".glass-pane",
      ".glass-bar",
      ".surface-raised",
      ".card-lift",
      ".edge-glow",
      ".ombre-bar",
      ".ombre-divider",
      ".ambient-blob-a",
      ".ambient-blob-b",
      ".ambient-blob-c",
      ".ambient-blob-d",
      ".ambient-blob-e",
      ".ambient-blob-f",
      "@keyframes rf-blob-drift-a",
      "@keyframes rf-blob-drift-b",
      "@keyframes rf-blob-drift-c",
      "@keyframes rf-blob-drift-d",
      "@keyframes rf-blob-drift-e",
      "@keyframes rf-blob-drift-f",
      ".skeleton-pulse::after",
      "@keyframes skeleton-glint-sweep",
      ".enter-once",
      "@media (prefers-reduced-motion: reduce)",
    ]) {
      expect(globalsSrc).toContain(token);
    }

    const reducedMotionMatch = globalsSrc.match(/@media \(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*\n\s*\}/);
    expect(reducedMotionMatch).not.toBeNull();
    const reducedBlock = reducedMotionMatch?.[0] ?? "";
    expect(reducedBlock).toContain(".skeleton-pulse::after");
    expect(reducedBlock).toContain(".ambient-blob-f");
    expect(reducedBlock).toContain("animation: none !important");
  });

  it("uses cherry-picked named simple-icons imports and currentColor in BrandIcon", () => {
    const brandIconSrc = fs.readFileSync(
      path.join(SRC_DIR, "components/design-system/brand-icon.tsx"),
      "utf8",
    );

    expect(brandIconSrc).toContain("export function BrandIcon");
    expect(brandIconSrc).toContain("export function hasBrandIcon");
    expect(brandIconSrc).toContain('from "simple-icons"');
    expect(brandIconSrc).not.toMatch(/import\s+\*\s+as\s+\w+\s+from\s+["']simple-icons["']/);
    expect(brandIconSrc).not.toMatch(/require\(["']simple-icons["']\)/);
    expect(brandIconSrc).toContain('fill="currentColor"');
    expect(brandIconSrc).toContain('aria-hidden="true"');
  });

  it("forbids hardcoded -900 and -950 status classes across src/app and src/components", () => {
    const hardcoded900sRe =
      /\b(?:bg|border|text)-(?:red|amber|sky|blue|orange|yellow|rose|pink|purple|indigo|violet|cyan|lime|teal|emerald|green)-(?:900|950)\b/g;

    const appAndComponents = sourceFiles.filter((file) => {
      const rel = path.relative(SRC_DIR, file).replace(/\\/g, "/");
      return rel.startsWith("app/") || rel.startsWith("components/");
    });

    const violations: string[] = [];
    for (const file of appAndComponents) {
      const src = fs.readFileSync(file, "utf8");
      const matches = src.match(hardcoded900sRe);
      if (matches && matches.length > 0) {
        violations.push(`${path.relative(ROOT, file).replace(/\\/g, "/")}: ${matches.join(", ")}`);
      }
    }

    expect(violations).toEqual([]);
  });

  it("forbids numbered palette classes across src/**/*.{ts,tsx,css}", () => {
    const numberedPaletteRe =
      /\b(?:bg|text|border|ring|from|to|via)-(?:red|rose|amber|orange|yellow|purple|violet|blue|pink|indigo)-\d{2,3}\b/g;

    const violations: string[] = [];
    for (const file of sourceFiles) {
      const src = fs.readFileSync(file, "utf8");
      const matches = src.match(numberedPaletteRe);
      if (matches && matches.length > 0) {
        violations.push(`${path.relative(ROOT, file).replace(/\\/g, "/")}: ${matches.join(", ")}`);
      }
    }

    expect(violations).toEqual([]);
  });

  it("defaults confirmed to false in ConfirmMasterDialog", () => {
    const dialogSrc = fs.readFileSync(
      path.join(SRC_DIR, "components/editor/confirm-master-dialog.tsx"),
      "utf8",
    );
    expect(dialogSrc).toMatch(/useState\(false\)/);
    expect(dialogSrc).toContain("const [confirmed, setConfirmed] = useState(false)");
  });

  it("omits fake Live badge in ProductProofCard and sub-12px Math.max(8 floor in HomeLanding", () => {
    const proofCardSrc = fs.readFileSync(
      path.join(SRC_DIR, "components/landing/product-proof-card.tsx"),
      "utf8",
    );
    const homeSrc = fs.readFileSync(
      path.join(SRC_DIR, "components/landing/home-landing.tsx"),
      "utf8",
    );

    expect(proofCardSrc).not.toContain(">Live<");
    expect(proofCardSrc).not.toContain('"Live"');
    expect(homeSrc).not.toContain("Math.max(8");
  });

  it("enforces the 12px typography floor across src/app and src/components", () => {
    const collectTsx = (dir: string): string[] => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      const results: string[] = [];
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          results.push(...collectTsx(full));
        } else if (entry.name.endsWith(".tsx")) {
          results.push(full);
        }
      }
      return results;
    };

    const sub12Re = /\btext-\[(?:\d|1[01])(?:\.\d+)?px\]/g;
    const files = [
      ...collectTsx(path.join(SRC_DIR, "app")),
      ...collectTsx(path.join(SRC_DIR, "components")),
    ];
    const violations: string[] = [];

    for (const file of files) {
      const src = fs.readFileSync(file, "utf8");
      const matches = src.match(sub12Re);
      if (matches && matches.length > 0) {
        violations.push(`${path.relative(SRC_DIR, file)}: ${matches.join(", ")}`);
      }
    }

    expect(violations).toEqual([]);
  });
});
