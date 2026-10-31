import { parseManagedResume, renderResumeDocument, type LayoutProfile } from "./resume-document";

const profiles: LayoutProfile[] = ["comfortable", "balanced", "compact"];
export type LayoutFitResult =
  | { status: "fit"; source: string; profile: LayoutProfile; pageCount: number }
  | { status: "unmanaged" | "no-fit" | "measurement-error"; source: string };

/** Only adjust an exact, current managed renderer output. */
function withProfile(source: string, profile: LayoutProfile): string | null {
  if (!source.includes("// renderer-revision: 2\n")) return null;
  const parsed = parseManagedResume(source);
  if (!parsed) return null;
  return parsed.prefix + renderResumeDocument(parsed.document, profile, parsed.links);
}

/** Measure actual compiled pages from most readable to most compact. */
export async function fitManagedLayout(
  source: string,
  pageBudget: 1 | 2,
  measure: (source: string) => Promise<number>,
): Promise<LayoutFitResult> {
  if (!withProfile(source, "comfortable")) return { status: "unmanaged", source };
  for (const profile of profiles) {
    const candidate = withProfile(source, profile)!;
    let pageCount: number;
    try { pageCount = await measure(candidate); } catch { return { status: "measurement-error", source }; }
    if (!Number.isInteger(pageCount) || pageCount < 1) return { status: "measurement-error", source };
    if (pageCount <= pageBudget) return { status: "fit", source: candidate, profile, pageCount };
  }
  return { status: "no-fit", source };
}
