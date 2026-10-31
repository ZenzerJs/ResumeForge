import { describe, expect, it, vi } from "vitest";
import { fitManagedLayout } from "@/lib/typst/layout-fit";
import { buildResumeDocument, renderResumeDocument } from "@/lib/typst/resume-document";

const source = renderResumeDocument(buildResumeDocument("Jane Example\nExperience\nAcme\nEngineer\n- Built systems"));
describe("measured layout fitting", () => {
  it("chooses the first measured profile within the page budget", async () => {
    const measure = vi.fn().mockResolvedValueOnce(3).mockResolvedValueOnce(2);
    const result = await fitManagedLayout(source, 2, measure);
    expect(result).toMatchObject({ status: "fit", profile: "balanced", pageCount: 2 });
    expect(measure).toHaveBeenCalledTimes(2);
    if (result.status === "fit") {
      expect(result.source).toContain("// profile: balanced");
      expect(result.source).toContain("#set par(leading: 0.35em)");
      expect(result.source).toContain("margin: (x: 0.55in, y: 0.55in)");
      expect(result.source).toContain("size: 10.5pt");
    }
  });
  it("uses compact only after measuring the two more readable profiles", async () => {
    const result = await fitManagedLayout(source, 1, vi.fn().mockResolvedValueOnce(3).mockResolvedValueOnce(2).mockResolvedValueOnce(1));
    expect(result).toMatchObject({ status: "fit", profile: "compact", pageCount: 1 });
  });
  it("leaves source intact if no profile fits or measurement fails", async () => {
    expect(await fitManagedLayout(source, 1, async () => 3)).toEqual({ status: "no-fit", source });
    expect(await fitManagedLayout(source, 1, async () => { throw new Error("compiler error"); })).toEqual({ status: "measurement-error", source });
    expect(await fitManagedLayout(source, 1, async () => 0)).toEqual({ status: "measurement-error", source });
  });
  it("refuses unmanaged, modified and ambiguous styles before measuring", async () => {
    const measure = vi.fn();
    for (const input of ["#set text(size: 10pt)\nHello", source.replace("0.55em", "0.5em"), source.replace("10.5pt", "9pt"), `${source}\n#set par(leading: 0.2em)`]) {
      expect(await fitManagedLayout(input, 1, measure)).toEqual({ status: "unmanaged", source: input });
    }
    expect(measure).not.toHaveBeenCalled();
  });
  it("restarts from comfortable when a previously compact document gains space", async () => {
    const compact = renderResumeDocument(buildResumeDocument("Jane Example"), "compact");
    expect(await fitManagedLayout(compact, 1, async () => 1)).toMatchObject({ status: "fit", profile: "comfortable" });
  });
});
