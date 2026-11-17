import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  buildManagedFormFields,
  commitManagedFieldBlur,
  ManagedResumeForm,
  presetSectionOrder,
  removeManagedFieldBlock,
} from "@/components/editor/managed-resume-form";
import { PreviewPanel } from "@/components/editor/preview-panel";
import {
  parseTypstToStructuredModel,
  ResumeFormBuilder,
  serializeStructuredModelToTypst,
} from "@/components/editor/resume-form-builder";
import {
  buildResumeDocument,
  parseManagedResume,
  renderResumeDocument,
  updateResumeBlock,
} from "@/lib/typst/resume-document";
import {
  parseTailorReturnContext,
  writeActiveApplicationContext,
  type StorageLike,
} from "@/lib/tailor/application-context";
import { renderLegacyResumeDocument } from "@/lib/typst/resume-document-v2-legacy";
import { renderPreviousResumeDocument } from "@/lib/typst/resume-document-v2-previous";

function buildAnnotatedSample() {
  const rows = [
    ["name", "Morgan Example"],
    ["contact", "Boston, MA"],
    ["contact", "morgan@example.test"],
    ["contact", "(555) 010-2000"],
    ["contact", "github.com/morgan-example"],
    ["contact", "linkedin.com/in/morgan-example"],
    ["section", "Experience"],
    ["entry-title", "Northwind"],
    ["entry-role", "Senior Engineer"],
    ["entry-location", "Remote"],
    ["entry-date", "2022 - Present"],
    ["bullet", "- Built distributed services"],
    ["bullet", "- Cut latency by 40%"],
    ["entry-title", "Contoso"],
    ["entry-role", "Software Engineer"],
    ["bullet", "- Built developer CLI"],
    ["section", "Projects"],
    ["entry-title", "Atlas | GitHub | Live Demo"],
    ["bullet", "- Shipped Atlas"],
    ["section", "Skills"],
    ["skill", "Languages: TypeScript, Python"],
  ] as const;

  const source = rows.map((row) => row[1]).join("\n");
  let offset = 0;
  const assignments = rows.map(([kind, text]) => {
    const start = offset;
    offset += text.length + 1;
    return { kind, span: { start, end: start + text.length } };
  });
  const doc = buildResumeDocument(source, assignments);
  const atlasLineStart = source.indexOf("Atlas | GitHub | Live Demo");
  const githubStart = atlasLineStart + "Atlas | ".length;
  const demoStart = atlasLineStart + "Atlas | GitHub | ".length;
  const links = [
    {
      label: "GitHub",
      url: "https://github.com/example/atlas",
      span: { start: githubStart, end: githubStart + "GitHub".length },
    },
    {
      label: "Live Demo",
      url: "https://atlas.example.test",
      span: { start: demoStart, end: demoStart + "Live Demo".length },
    },
  ];
  return { doc, source, links };
}

describe("managed resume form safety", () => {
  it("retains linked annotations and rejects stale embedded data after a patch", () => {
    const doc = buildResumeDocument("Jane\nSkills\nTypeScript", [
      { kind: "name", span: { start: 0, end: 4 } },
      { kind: "section", span: { start: 5, end: 11 } },
      { kind: "skill", span: { start: 12, end: 22 } },
    ]);
    const links = [{ url: "https://example.com", label: "Portfolio" }];
    const source = renderResumeDocument(doc, "comfortable", links);
    expect(parseManagedResume(source)?.links).toEqual(links);
    expect(parseManagedResume(source.replace("TypeScript", "JavaScript"))).toBeNull();
    const updated = updateResumeBlock(doc, { start: 12, end: 22 }, "Rust");
    const rendered = renderResumeDocument(updated, "comfortable", links);
    expect(rendered).toContain("Rust");
    expect(parseManagedResume(rendered)?.links).toEqual(links);
  });

  it("orders requested presets and preserves remaining research sections", () => {
    const titles = [
      "Awards",
      "Projects",
      "Skills",
      "Experience",
      "Summary",
      "Education",
      "Research Experience",
      "Publications",
    ];
    const sections = titles.map((text) => ({ heading: { text } }));
    expect(presetSectionOrder(sections, "professional").map((s) => s.heading.text)).toEqual([
      "Summary",
      "Experience",
      "Research Experience",
      "Skills",
      "Education",
      "Projects",
      "Awards",
      "Publications",
    ]);
    expect(presetSectionOrder(sections, "research").map((s) => s.heading.text)).toEqual([
      "Education",
      "Research Experience",
      "Publications",
      "Awards",
      "Projects",
      "Skills",
      "Experience",
      "Summary",
    ]);
  });

  it("gives every input a visible label and matching accessible name including contact roles and entry context", () => {
    const { doc, links } = buildAnnotatedSample();
    const rendered = renderResumeDocument(doc, "balanced", links);
    const { headerFields, sectionGroups } = buildManagedFormFields(doc, links);

    expect(headerFields.map((field) => field.label)).toEqual([
      "Full name",
      "Location",
      "Email",
      "Phone",
      "GitHub",
      "LinkedIn",
    ]);

    const expFields = sectionGroups[0].blockFields.map((field) => field.label);
    expect(expFields).toContain("Experience · Entry 1 title (Northwind — Senior Engineer)");
    expect(expFields).toContain("Experience · Northwind · Role");
    expect(expFields).toContain("Experience · Northwind — Senior Engineer · Bullet 1");
    expect(expFields).toContain("Experience · Northwind — Senior Engineer · Bullet 2");
    expect(expFields).toContain("Experience · Entry 2 title (Contoso — Software Engineer)");
    expect(expFields).toContain("Experience · Contoso · Role");
    expect(expFields).toContain("Experience · Contoso — Software Engineer · Bullet 1");

    const allLabels = [
      ...headerFields.map((f) => f.label),
      ...sectionGroups.flatMap((g) => [g.headingField.label, ...g.blockFields.map((f) => f.label)]),
    ];
    expect(new Set(allLabels).size).toBe(allLabels.length);

    const html = renderToStaticMarkup(
      React.createElement(ManagedResumeForm, { value: rendered, onChange: () => {} })
    );
    const textareaIds = Array.from(html.matchAll(/<textarea[^>]*\sid="([^"]+)"/g)).map((m) => m[1]);
    expect(textareaIds.length).toBe(allLabels.length);
    for (const id of textareaIds) {
      expect(html).toContain(`for="${id}"`);
    }
    expect(html).toContain(">Email</label>");
    expect(html).toContain(">Phone</label>");
    expect(html).toContain(">GitHub</label>");
    expect(html).toContain(">LinkedIn</label>");
    expect(html).toContain(">Location</label>");
    expect(html).toContain('aria-label="Remove Email"');
    expect(html).toContain('aria-label="Remove Experience · Northwind — Senior Engineer · Bullet 1"');
    expect(html).not.toContain('aria-label="Remove Full name"');
  });

  it("preserves all values in descriptive labels for compound contact lines", () => {
    const raw =
      "Morgan Example\nPortland | (555) 010-1234 | morgan@example.test | Other text\nExperience\n- Built tools";
    const doc = buildResumeDocument(raw, [
      { kind: "name", span: { start: 0, end: 14 } },
      {
        kind: "contact",
        span: { start: 15, end: 15 + "Portland | (555) 010-1234 | morgan@example.test | Other text".length },
      },
      { kind: "section", span: { start: raw.indexOf("Experience"), end: raw.indexOf("Experience") + 10 } },
      { kind: "bullet", span: { start: raw.indexOf("- Built tools"), end: raw.length } },
    ]);
    const { headerFields } = buildManagedFormFields(doc);
    expect(headerFields[1].label).toContain("Portland | (555) 010-1234 | morgan@example.test | Other text");
    expect(headerFields[1].label).toContain("Location");
    expect(headerFields[1].label).toContain("Phone");
    expect(headerFields[1].label).toContain("Email");
  });

  it("keeps invalid input visible with an error on keyboard blur instead of silently snapping back", () => {
    const { doc, links } = buildAnnotatedSample();
    const rendered = renderResumeDocument(doc, "balanced", links);
    const managed = parseManagedResume(rendered)!;
    const { headerFields, sectionGroups } = buildManagedFormFields(managed.document, managed.links);

    const nameField = headerFields[0];
    const invalidName = commitManagedFieldBlur({ managed, field: nameField, rawValue: "" });
    expect(invalidName.status).toBe("invalid");
    if (invalidName.status === "invalid") {
      expect(invalidName.draftValue).toBe("");
      expect(invalidName.error).toContain("Full name is required");
    }

    const headingField = sectionGroups[0].headingField;
    const invalidHeading = commitManagedFieldBlur({ managed, field: headingField, rawValue: "   " });
    expect(invalidHeading.status).toBe("invalid");
    if (invalidHeading.status === "invalid") {
      expect(invalidHeading.draftValue).toBe("   ");
      expect(invalidHeading.error).toContain("required");
    }

    const emailField = headerFields[2];
    const blankEmail = commitManagedFieldBlur({ managed, field: emailField, rawValue: "" });
    expect(blankEmail.status).toBe("invalid");
    if (blankEmail.status === "invalid") {
      expect(blankEmail.draftValue).toBe("");
      expect(blankEmail.error).toContain("Remove");
    }

    // Valid blur commits and shifts placed link spans in following blocks
    const bulletField = sectionGroups[0].blockFields.find((f) =>
      f.label.includes("Northwind — Senior Engineer · Bullet 1")
    )!;
    const validEdit = commitManagedFieldBlur({
      managed,
      field: bulletField,
      rawValue: "- Built resilient distributed services across regions",
    });
    expect(validEdit.status).toBe("committed");
    if (validEdit.status === "committed") {
      const reloaded = parseManagedResume(validEdit.nextSource);
      expect(reloaded).not.toBeNull();
      expect(reloaded!.profile).toBe("balanced");
      expect(reloaded!.document.source).toContain("- Built resilient distributed services across regions");
      expect(reloaded!.document.source).toContain("Atlas | GitHub | Live Demo");
      const githubLink = reloaded!.links.find((l) => l.label === "GitHub");
      expect(githubLink?.span).toBeDefined();
      expect(reloaded!.document.source.slice(githubLink!.span!.start, githubLink!.span!.end)).toBe("GitHub");
    }
  });

  it("removes optional fields and bullets explicitly and round-trips through parser/renderer on reload", () => {
    const { doc, links } = buildAnnotatedSample();
    const olderSource = renderPreviousResumeDocument(doc, "compact", links);
    const managed = parseManagedResume(olderSource);
    expect(managed).not.toBeNull();

    const { headerFields, sectionGroups } = buildManagedFormFields(managed!.document, managed!.links);
    const emailField = headerFields.find((f) => f.label === "Email")!;
    const emailRemoved = removeManagedFieldBlock({ managed: managed!, field: emailField });
    expect(emailRemoved.status).toBe("removed");
    if (emailRemoved.status !== "removed") return;

    const afterEmailReload = parseManagedResume(emailRemoved.nextSource);
    expect(afterEmailReload).not.toBeNull();
    expect(afterEmailReload!.profile).toBe("compact");
    expect(afterEmailReload!.document.source).not.toContain("morgan@example.test");
    expect(afterEmailReload!.document.source).toContain("Boston, MA");

    const bulletField = buildManagedFormFields(afterEmailReload!.document, afterEmailReload!.links)
      .sectionGroups[0].blockFields.find((f) => f.label.includes("Northwind — Senior Engineer · Bullet 1"))!;
    const bulletRemoved = removeManagedFieldBlock({ managed: afterEmailReload!, field: bulletField });
    expect(bulletRemoved.status).toBe("removed");
    if (bulletRemoved.status !== "removed") return;

    const finalReload = parseManagedResume(bulletRemoved.nextSource);
    expect(finalReload).not.toBeNull();
    expect(finalReload!.profile).toBe("compact");
    expect(finalReload!.document.source).not.toContain("- Built distributed services");
    expect(finalReload!.document.source).toContain("- Cut latency by 40%");
    const demoLink = finalReload!.links.find((l) => l.label === "Live Demo");
    expect(demoLink?.span).toBeDefined();
    expect(finalReload!.document.source.slice(demoLink!.span!.start, demoLink!.span!.end)).toBe("Live Demo");
    // Patch validation still detects out-of-band modifications
    expect(parseManagedResume(bulletRemoved.nextSource.replace("Cut latency", "Improved latency"))).toBeNull();

    // Legacy v2 renderer also round-trips cleanly
    const legacySource = renderLegacyResumeDocument(doc, "balanced", []);
    const legacyParsed = parseManagedResume(legacySource);
    expect(legacyParsed).not.toBeNull();

    // Required blocks cannot be removed
    const requiredRemoved = removeManagedFieldBlock({
      managed: managed!,
      field: sectionGroups[0].headingField,
    });
    expect(requiredRemoved.status).toBe("error");
  });

  it("opens unmanaged legacy sources in ResumeFormBuilder with accessible label associations", () => {
    const legacyTypst = serializeStructuredModelToTypst(
      parseTypstToStructuredModel(
        `= Alex Rivera\n#text(size: 9pt)[Austin, TX #sym.dot #link("mailto:alex@example.com")[alex@example.com]]\n== Experience\n#entry(title: "Acme", role: "Engineer", location: "Austin", date: "2023", details: [- Built APIs])`
      )
    );
    expect(parseManagedResume(legacyTypst)).toBeNull();

    const html = renderToStaticMarkup(
      React.createElement(ResumeFormBuilder, { value: legacyTypst, onChange: () => {} })
    );
    const fullnameId = html.match(/id="([^"]+)"[^>]*data-testid="form-input-fullname"/)?.[1];
    const emailId = html.match(/id="([^"]+)"[^>]*data-testid="form-input-email"/)?.[1];
    const summaryId = html.match(/id="([^"]+)"[^>]*data-testid="form-input-summary"/)?.[1];
    expect(fullnameId).toBeTruthy();
    expect(emailId).toBeTruthy();
    expect(summaryId).toBeTruthy();
    expect(html).toContain(`for="${fullnameId}"`);
    expect(html).toContain(`for="${emailId}"`);
    expect(html).toContain(`for="${summaryId}"`);
  });

  it("renders responsive PreviewPanel toolbar keeping lg:h-8, distinct zoom/layout actions, and paper top spacing", () => {
    const prevFlag = process.env.NEXT_PUBLIC_RESUME_LAYOUT_V2;
    process.env.NEXT_PUBLIC_RESUME_LAYOUT_V2 = "true";
    try {
      const { doc, links } = buildAnnotatedSample();
      const v2Source = renderResumeDocument(doc, "comfortable", links);
      const html = renderToStaticMarkup(
        React.createElement(PreviewPanel, {
          svg: null,
          error: null,
          source: v2Source,
          isCompiling: false,
          onResetTemplate: () => {},
          onApplyLayout: () => {},
        })
      );
      expect(html).toContain("lg:h-8");
      expect(html).toContain("basis-full");
      expect(html.match(/data-testid="layout-page-status"/g)).toHaveLength(1);
      expect(html).toContain("Fit width");
      expect(html).toContain("Fit to one page");
      expect(html).toContain("lg:pt-2");
      expect(html).not.toContain("text-[22px]");
    } finally {
      if (prevFlag === undefined) delete process.env.NEXT_PUBLIC_RESUME_LAYOUT_V2;
      else process.env.NEXT_PUBLIC_RESUME_LAYOUT_V2 = prevFlag;
    }
  });

  it("builds contextual Back to Tailor link preserving variantId, resumeId, mode, and active role", () => {
    const store = new Map<string, string>();
    const storage: StorageLike = {
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => { store.set(k, v); },
      removeItem: (k) => { store.delete(k); },
    };
    const scope = { userId: "user-1", demoMode: false, scopeResolved: true };
    writeActiveApplicationContext(
      {
        jobId: "job-42",
        tab: "3-pane",
        roleTitle: "Staff Backend Engineer",
        variantId: "var-9",
        mode: "visual",
      },
      scope,
      storage
    );

    const ctx = parseTailorReturnContext(
      new URLSearchParams("from=tailor&jobId=job-42&tab=3-pane&variantId=var-9&resumeId=res-1&mode=visual"),
      {
        scope,
        storage,
        overrides: { variantId: "var-9", resumeId: "res-1", mode: "visual" },
      }
    );
    expect(ctx).not.toBeNull();
    expect(ctx!.label).toBe("Back to Tailor · Staff Backend Engineer");
    expect(ctx!.href).toContain("/tailor?");
    expect(ctx!.href).toContain("jobId=job-42");
    expect(ctx!.href).toContain("tab=3-pane");
    expect(ctx!.href).toContain("variantId=var-9");
    expect(ctx!.href).toContain("resumeId=res-1");
    expect(ctx!.href).toContain("mode=visual");

    expect(
      parseTailorReturnContext(new URLSearchParams("variantId=var-9&mode=visual"), {
        scope,
        storage,
      })
    ).toBeNull();
  });
});
