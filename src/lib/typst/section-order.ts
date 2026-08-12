/**
 * Canonical resume section order for PDF → Typst conversion.
 * Always emit: Experience → Education → Projects → Skills → everything else.
 */

export const CANONICAL_SECTION_ORDER = [
  "Experience",
  "Education",
  "Projects",
  "Skills",
] as const;

const SECTION_ALIASES: Record<string, (typeof CANONICAL_SECTION_ORDER)[number]> = {
  experience: "Experience",
  "work experience": "Experience",
  "professional experience": "Experience",
  employment: "Experience",
  "work history": "Experience",
  education: "Education",
  academic: "Education",
  academics: "Education",
  projects: "Projects",
  "personal projects": "Projects",
  "selected projects": "Projects",
  "side projects": "Projects",
  skills: "Skills",
  "technical skills": "Skills",
  technologies: "Skills",
  "tech stack": "Skills",
  "tools & technologies": "Skills",
};

export function normalizeSectionTitle(title: string): string {
  const key = title.trim().toLowerCase().replace(/\s+/g, " ");
  return SECTION_ALIASES[key] || title.trim();
}

export function canonicalSectionRank(title: string): number {
  const normalized = normalizeSectionTitle(title);
  const idx = CANONICAL_SECTION_ORDER.indexOf(
    normalized as (typeof CANONICAL_SECTION_ORDER)[number]
  );
  return idx === -1 ? CANONICAL_SECTION_ORDER.length + 50 : idx;
}

/**
 * Reorders `#section("...")` blocks in Typst source into canonical order.
 * Header / helpers before the first #section stay put; trailing content after
 * the last section stays with that section.
 */
export function reorderTypstSections(source: string): string {
  if (!source || !source.includes("#section(")) return source;

  const sectionRegex = /#section\(\s*"([^"]+)"\s*\)/g;
  const matches: Array<{ title: string; index: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = sectionRegex.exec(source)) !== null) {
    matches.push({ title: m[1], index: m.index });
  }
  if (matches.length < 2) return source;

  const preamble = source.slice(0, matches[0].index);
  const blocks: Array<{ title: string; body: string }> = [];

  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : source.length;
    blocks.push({
      title: matches[i].title,
      body: source.slice(start, end).replace(/\s+$/, "") + "\n\n",
    });
  }

  // Stable sort by canonical rank, then original appearance for ties
  const indexed = blocks.map((b, i) => ({ ...b, i }));
  indexed.sort((a, b) => {
    const rankDiff = canonicalSectionRank(a.title) - canonicalSectionRank(b.title);
    return rankDiff !== 0 ? rankDiff : a.i - b.i;
  });

  // Prefer canonical display titles for known aliases
  const rewritten = indexed.map((block) => {
    const canonical = normalizeSectionTitle(block.title);
    if (canonical === block.title) return block.body;
    return block.body.replace(
      `#section("${block.title}")`,
      `#section("${canonical}")`
    );
  });

  return preamble.replace(/\s+$/, "") + "\n\n" + rewritten.join("").trimEnd() + "\n";
}
