import { ExtractedPdfEvidence, extractTechnologies } from "./pdfExtractor";

export interface CreateEvidencePayload {
  type: string;
  title: string;
  organization?: string;
  dates?: string;
  verifiedSummary: string;
  tags: string[];
  status: string;
  bullets: Array<{ text: string; verified: boolean }>;
}

export function cleanBulletText(text: string): string {
  return text
    .replace(/^(?:[\s•\-\*\–\—\u2022\u2023\u25E6\u2043\u2219]+|\d+[\.\)])\s*/, "")
    .trim();
}

export function isBulletLine(line: string): boolean {
  const trimmed = line.trim();
  return (
    /^[\s•\-\*\–\—\u2022\u2023\u25E6\u2043\u2219]/.test(trimmed) ||
    /^\d+[\.\)]\s+/.test(trimmed)
  );
}

export function assembleBullets(lines: string[]): string[] {
  const bullets: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const isBullet = isBulletLine(line);
    const cleaned = cleanBulletText(line);
    if (!cleaned) continue;

    const startsWithLower = /^[a-z]/.test(cleaned);
    const prevEndsSentence =
      bullets.length > 0 &&
      /[.!?]\s*(?:\[[^\]]*\])?$/.test(bullets[bullets.length - 1]);

    if (
      bullets.length > 0 &&
      (startsWithLower || (!isBullet && !prevEndsSentence))
    ) {
      bullets[bullets.length - 1] += " " + cleaned;
    } else {
      bullets.push(cleaned);
    }
  }

  return bullets
    .map((b) => b.replace(/\s+/g, " ").trim())
    .filter((b) => b.length > 0);
}

export const DATE_RANGE_REGEX = /\b(?:(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{4}|\d{1,2}\/\d{4}|\d{4})\s*(?:[\u2010-\u2015\-]|to)\s*(?:(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{4}|\d{1,2}\/\d{4}|\d{4}|Present|Current)\b/i;

const ROLE_TITLE_PATTERN = /\b(Engineer|Developer|Architect|Designer|Manager|Lead|Intern|Consultant|Director|Analyst|Specialist|Administrator|Scientist|Programmer|Technician|VP|Head|Founder|Co-Founder|Researcher)\b/i;

export const EXP_HEADER_REGEX = /^(?:#{1,3}\s*)?(EXP-[A-Za-z0-9_-]+)(?:\s*[:—–|-]\s*(.*))?$/i;
export const PRJ_HEADER_REGEX = /^(?:#{1,3}\s*)?(PRJ-[A-Za-z0-9_-]+)(?:\s*[:—–|-]\s*(.*))?$/i;

function isLikelyJobHeader(line: string): boolean {
  if (DATE_RANGE_REGEX.test(line)) return true;
  if (ROLE_TITLE_PATTERN.test(line)) return true;
  if (/^[A-Z0-9][\w\s&.,'-]{1,50}\s*[|—–]\s*[\w\s&.,'-]+$/i.test(line)) return true;
  if (line.length <= 45 && /^[A-Z][A-Za-z0-9\s&.,'-]+$/.test(line) && !/[.,;!?]$/.test(line)) {
    return true;
  }
  return false;
}

function parseJobHeader(
  headerLines: string[],
  baseName: string
): { title: string; organization: string; dates?: string } {
  let title = "";
  let organization = "";
  let dates: string | undefined = undefined;

  const nonDateLines: string[] = [];
  for (const line of headerLines) {
    const dateMatch = line.match(DATE_RANGE_REGEX);
    if (dateMatch) {
      dates = dateMatch[0].trim();
      const remaining = line
        .replace(dateMatch[0], "")
        .replace(/^[|\s—–,-]+|[|\s—–,-]+$/g, "")
        .trim();
      if (remaining.length > 0) {
        nonDateLines.push(remaining);
      }
    } else {
      nonDateLines.push(line);
    }
  }

  if (nonDateLines.length === 1) {
    const single = nonDateLines[0];
    const parts = single.split(/\s*[|—–]\s*/);
    if (parts.length >= 2) {
      if (ROLE_TITLE_PATTERN.test(parts[0]) && !ROLE_TITLE_PATTERN.test(parts[1])) {
        title = parts[0].trim();
        organization = parts[1].trim();
      } else {
        organization = parts[0].trim();
        title = parts[1].trim();
      }
    } else {
      if (ROLE_TITLE_PATTERN.test(single)) {
        title = single;
        organization = baseName;
      } else {
        organization = single;
        title = `Role at ${single}`;
      }
    }
  } else if (nonDateLines.length >= 2) {
    if (ROLE_TITLE_PATTERN.test(nonDateLines[0]) && !ROLE_TITLE_PATTERN.test(nonDateLines[1])) {
      title = nonDateLines[0].trim();
      organization = nonDateLines[1].trim();
    } else if (ROLE_TITLE_PATTERN.test(nonDateLines[1]) && !ROLE_TITLE_PATTERN.test(nonDateLines[0])) {
      organization = nonDateLines[0].trim();
      title = nonDateLines[1].trim();
    } else {
      organization = nonDateLines[0].trim();
      title = nonDateLines[1].trim();
    }
  }

  if (!title) title = `Role at ${organization || baseName}`;
  if (!organization) organization = baseName;

  return { title, organization, dates };
}

function parseProjectHeader(headerLines: string[]): {
  title: string;
  organization: string;
  dates?: string;
  stackTags: string[];
} {
  let title = headerLines[0] || "Project";
  let organization = "Personal Project";
  let dates: string | undefined = undefined;
  let stackTags: string[] = [];

  const dateMatch = title.match(DATE_RANGE_REGEX);
  if (dateMatch) {
    dates = dateMatch[0].trim();
    title = title.replace(dateMatch[0], "").replace(/[()]/g, "").trim();
  }

  const parts = title.split(/\s*[|—–]\s*/);
  if (parts.length >= 2) {
    title = parts[0].trim();
    const rest = parts.slice(1).join(", ");
    stackTags = extractTechnologies(rest);
    if (stackTags.length === 0) {
      organization = rest;
    }
  }

  return { title, organization, dates, stackTags };
}

interface EvidenceBankRawItem {
  id: string;
  headerRest: string;
  lines: string[];
}

function parseEvidenceBankItems(
  lines: string[],
  type: "experience" | "project",
  baseName: string,
  docTechnologies: string[]
): CreateEvidencePayload[] {
  const headerRegex = type === "experience" ? EXP_HEADER_REGEX : PRJ_HEADER_REGEX;
  const rawItems: EvidenceBankRawItem[] = [];
  let current: EvidenceBankRawItem | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const match = line.match(headerRegex);
    if (match) {
      if (current) rawItems.push(current);
      current = {
        id: match[1],
        headerRest: match[2] || "",
        lines: [],
      };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) rawItems.push(current);

  const payloads: CreateEvidencePayload[] = [];

  for (const item of rawItems) {
    let organization = "";
    let title = "";
    let dates: string | undefined = undefined;
    let status = "verified";

    const combinedText = [item.headerRest, ...item.lines].join(" ");
    if (/\[\s*(UNVERIFIED|PLANNED)\s*\]/i.test(combinedText)) {
      status = "draft";
    } else if (/\[\s*VERIFIED\s*\]/i.test(combinedText)) {
      status = "verified";
    }

    const cleanedHeaderRest = item.headerRest
      .replace(/\[\s*(VERIFIED|UNVERIFIED|PLANNED|DRAFT|REPORTED)[^\]]*\]/gi, "")
      .replace(/\s*[⭐★].*$/, "")
      .trim();

    // Delimiter split prioritizing em-dash, en-dash, pipe, or spaced hyphen (never unspaced hyphen)
    const delimRegex = /\s+[—–|]\s+|\s+-\s+/;
    const parts = cleanedHeaderRest
      .split(delimRegex)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    if (type === "experience") {
      if (parts.length >= 2) {
        organization = parts[0];
        title = parts.slice(1).join(" — ");
      } else if (parts.length === 1 && parts[0].length > 0) {
        organization = parts[0];
        title = parts[0];
      } else {
        organization = baseName;
        title = `Experience (${item.id})`;
      }
    } else {
      title = parts[0] || `Project (${item.id})`;
      organization = parts.length >= 2 ? parts[1] : "Personal Project";
      // Strip parenthetical date tags from project title (e.g. "Ai-Lab (September 2026)")
      title = title.replace(/\s*\((?:January|February|March|April|May|June|July|August|September|October|November|December)?\s*\d{4}\)/i, "").trim();
    }

    let explicitBulletsMode = false;
    const bulletCandidates: string[] = [];
    const explicitBullets: string[] = [];

    for (let i = 0; i < item.lines.length; i++) {
      const line = item.lines[i];

      // Extract date range if not yet found
      if (!dates) {
        const whenPrefixMatch = line.match(
          /(?:^|[|—–])\s*(?:Where\/when|When\/where|Where\s*\/\s*when|\bWhen|\bDates?)\s*:\s*(.+)$/i
        );
        if (whenPrefixMatch) {
          let rawDateVal = whenPrefixMatch[1].trim();

          // Check if date wrapped to next line (e.g. "February 2026 ‒ March" and next line is "2026 | Python")
          if (
            i + 1 < item.lines.length &&
            /(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?|[\u2010-\u2015\-])\s*$/i.test(
              rawDateVal
            )
          ) {
            const nextL = item.lines[i + 1].trim();
            const yearMatch = nextL.match(/^(\d{4}|Present|Current)\b/);
            if (yearMatch) {
              rawDateVal += " " + yearMatch[1];
              item.lines[i + 1] = nextL.replace(/^(\d{4}|Present|Current)\b\s*[|—–,-]?\s*/, "").trim();
            }
          }

          rawDateVal = rawDateVal
            .replace(/\[\s*(VERIFIED|UNVERIFIED|PLANNED|DRAFT|REPORTED)[^\]]*\]/gi, "")
            .replace(/\.\s*(?:Role\s+framing|Role|Link|confirm|Note).*$/i, "")
            .replace(/\|\s*(?:Python|TypeScript|React|Swift|Go|Rust|Java|C\+\+|SQL|HTML|MIT|Apache|GPL|BSD|CI|License).*$/i, "")
            .trim();

          if (rawDateVal.length > 0) {
            dates = rawDateVal;
          }
        } else {
          const dateMatch = line.match(DATE_RANGE_REGEX);
          if (dateMatch) {
            dates = dateMatch[0].trim();
          } else if (/\b(?:when|dates?)\b/i.test(line)) {
            const singleYearMatch = line.match(
              /\b(?:(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{4}|\d{4})\b/i
            );
            if (singleYearMatch) {
              dates = singleYearMatch[0].trim();
            }
          }
        }
      }

      // Check official title
      const officialTitleMatch = line.match(/^Official\s+title\s*:\s*(.+)$/i);
      if (officialTitleMatch) {
        const resumeFacing = officialTitleMatch[1].match(/Resume-facing:\s*"([^"]+)"/i);
        if (resumeFacing) {
          title = resumeFacing[1].trim();
        } else {
          title = officialTitleMatch[1].split(/[.;]/)[0].trim();
        }
        continue;
      }

      // Check status
      const statusMatch = line.match(/^Status\s*:\s*(.+)$/i);
      if (statusMatch) {
        if (/unverified|planned|draft/i.test(statusMatch[1])) {
          status = "draft";
        } else if (/verified/i.test(statusMatch[1])) {
          status = "verified";
        }
        continue;
      }

      // Check if explicit bullet section heading
      if (/^(?:Resume-ready\s+bullets?|System\s+bullets)\s*(?:\[[^\]]*\])?\s*:/i.test(line)) {
        explicitBulletsMode = true;
        continue;
      }

      // Metadata headers to ignore or end explicit bullet section
      const isMetadataHeader = /^(?:Evidence\s+ID|Target\s+families|Infrastructure\s+context|Interview\s+story.*|Claim\s+guards.*|Scale\s+note|Product|Capabilities|September\s+\d{4}\s+competitive|In-flight|Measurement\s+provenance|GitHub|Live|Context|Domain|Impact|Where\/when|When\/where|When|Dates?|Not pinned|Background artifacts|Other repositories|Repository curation)\s*[:(—–]/i.test(
        line
      );

      if (isMetadataHeader) {
        explicitBulletsMode = false;
        continue;
      }

      // Internal candidate advice or non-bullet lines
      const isInternalCandidateNote =
        /^(?:One concise resume entry|Details are sparse|Do not pad or infer|Background context only|Do not give resume space|Use ONLY in the|Not pinned|Synthetic-data demo|Profile README repo|odin-recipes|clinical-license-tracker-demo|ZenzerJs\/ZenzerJs)\b/i.test(
          line
        ) ||
        /^school co-op placement/i.test(line) ||
        /\[VERIFIED — confirmed by candidate\]/i.test(line);

      if (isInternalCandidateNote) {
        continue;
      }

      if (explicitBulletsMode) {
        explicitBullets.push(line);
      } else {
        bulletCandidates.push(line);
      }
    }

    const linesToAssemble = explicitBullets.length > 0 ? explicitBullets : bulletCandidates;
    const bullets = assembleBullets(linesToAssemble);
    const itemFullText = [title, organization, ...bullets].join(" ");
    const itemTags = extractTechnologies(itemFullText);
    const finalTags =
      itemTags.length > 0 ? itemTags.slice(0, 8) : docTechnologies.slice(0, 6);

    const verifiedSummary =
      bullets.slice(0, 2).join(". ").slice(0, 200) ||
      `${title} at ${organization}`;

    payloads.push({
      type,
      title: title || `${type === "experience" ? "Role" : "Project"} (${item.id})`,
      organization: organization || baseName,
      dates,
      verifiedSummary,
      tags: finalTags,
      status,
      bullets: bullets.map((text) => ({ text, verified: status === "verified" })),
    });
  }

  return payloads;
}

function parseStandardResumeJobs(
  lines: string[],
  baseName: string,
  docTechnologies: string[]
): CreateEvidencePayload[] {
  const hasBullets = lines.some((l) => isBulletLine(l));
  const hasDates = lines.some((l) => DATE_RANGE_REGEX.test(l));
  const hasHeaders = lines.some((l) => isLikelyJobHeader(l));

  if (!hasBullets && !hasDates && !hasHeaders) {
    const bullets = assembleBullets(lines);
    return [
      {
        type: "experience",
        title: `Professional Experience (${baseName})`,
        organization: baseName,
        verifiedSummary:
          bullets.slice(0, 2).join(". ").slice(0, 200) ||
          `Extracted work experience bullets from ${baseName}`,
        tags: docTechnologies.slice(0, 6),
        status: "verified",
        bullets: bullets.map((text) => ({ text, verified: true })),
      },
    ];
  }

  interface RawJob {
    headerLines: string[];
    bulletLines: string[];
  }

  const rawJobs: RawJob[] = [];
  let current: RawJob = { headerLines: [], bulletLines: [] };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (isBulletLine(line)) {
      current.bulletLines.push(line);
    } else {
      if (current.bulletLines.length > 0) {
        if (!isLikelyJobHeader(line) && (line.length > 55 || /^[a-z]/.test(line))) {
          current.bulletLines[current.bulletLines.length - 1] += " " + line;
        } else {
          rawJobs.push(current);
          current = { headerLines: [line], bulletLines: [] };
        }
      } else {
        current.headerLines.push(line);
      }
    }
  }
  if (current.headerLines.length > 0 || current.bulletLines.length > 0) {
    rawJobs.push(current);
  }

  if (rawJobs.length === 1 && rawJobs[0].headerLines.length === 0) {
    const bullets = assembleBullets(rawJobs[0].bulletLines);
    return [
      {
        type: "experience",
        title: `Professional Experience (${baseName})`,
        organization: baseName,
        verifiedSummary:
          bullets.slice(0, 2).join(". ").slice(0, 200) ||
          `Extracted work experience bullets from ${baseName}`,
        tags: docTechnologies.slice(0, 6),
        status: "verified",
        bullets: bullets.map((text) => ({ text, verified: true })),
      },
    ];
  }

  const payloads: CreateEvidencePayload[] = [];

  for (const job of rawJobs) {
    const { title, organization, dates } = parseJobHeader(job.headerLines, baseName);
    const bullets = assembleBullets(job.bulletLines);
    const itemFullText = [title, organization, ...bullets].join(" ");
    const tags = extractTechnologies(itemFullText);
    const finalTags =
      tags.length > 0 ? tags.slice(0, 8) : docTechnologies.slice(0, 6);

    const verifiedSummary =
      bullets.slice(0, 2).join(". ").slice(0, 200) ||
      `${title} at ${organization}`;

    payloads.push({
      type: "experience",
      title,
      organization,
      dates,
      verifiedSummary,
      tags: finalTags,
      status: "verified",
      bullets: bullets.map((text) => ({ text, verified: true })),
    });
  }

  return payloads;
}

function parseStandardResumeProjects(
  lines: string[],
  baseName: string,
  docTechnologies: string[]
): CreateEvidencePayload[] {
  const hasBullets = lines.some((l) => isBulletLine(l));
  const hasDates = lines.some((l) => DATE_RANGE_REGEX.test(l));
  const hasDividers = lines.some((l) => l.includes("|") || l.includes("—") || l.includes("–"));

  if (!hasBullets && !hasDates && !hasDividers) {
    const bullets = assembleBullets(lines);
    return [
      {
        type: "project",
        title: `Technical Projects (${baseName})`,
        organization: "Personal & Academic Projects",
        verifiedSummary:
          bullets.slice(0, 2).join(". ").slice(0, 200) ||
          `Extracted project work from ${baseName}`,
        tags: docTechnologies.slice(0, 6),
        status: "verified",
        bullets: bullets.map((text) => ({ text, verified: true })),
      },
    ];
  }

  interface RawProject {
    headerLines: string[];
    bulletLines: string[];
  }

  const rawProjects: RawProject[] = [];
  let current: RawProject = { headerLines: [], bulletLines: [] };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (isBulletLine(line)) {
      current.bulletLines.push(line);
    } else {
      if (current.bulletLines.length > 0) {
        if (line.length > 55 || /^[a-z]/.test(line)) {
          current.bulletLines[current.bulletLines.length - 1] += " " + line;
        } else {
          rawProjects.push(current);
          current = { headerLines: [line], bulletLines: [] };
        }
      } else {
        current.headerLines.push(line);
      }
    }
  }
  if (current.headerLines.length > 0 || current.bulletLines.length > 0) {
    rawProjects.push(current);
  }

  if (rawProjects.length === 1 && rawProjects[0].headerLines.length === 0) {
    const bullets = assembleBullets(rawProjects[0].bulletLines);
    return [
      {
        type: "project",
        title: `Technical Projects (${baseName})`,
        organization: "Personal & Academic Projects",
        verifiedSummary:
          bullets.slice(0, 2).join(". ").slice(0, 200) ||
          `Extracted project work from ${baseName}`,
        tags: docTechnologies.slice(0, 6),
        status: "verified",
        bullets: bullets.map((text) => ({ text, verified: true })),
      },
    ];
  }

  const payloads: CreateEvidencePayload[] = [];

  for (const proj of rawProjects) {
    const { title, organization, dates, stackTags } = parseProjectHeader(
      proj.headerLines
    );
    const bullets = assembleBullets(proj.bulletLines);
    const itemFullText = [title, organization, ...bullets].join(" ");
    const tags = Array.from(
      new Set([...stackTags, ...extractTechnologies(itemFullText)])
    );
    const finalTags =
      tags.length > 0 ? tags.slice(0, 8) : docTechnologies.slice(0, 6);

    const verifiedSummary =
      bullets.slice(0, 2).join(". ").slice(0, 200) ||
      `${title} — ${organization}`;

    payloads.push({
      type: "project",
      title,
      organization,
      dates,
      verifiedSummary,
      tags: finalTags,
      status: "verified",
      bullets: bullets.map((text) => ({ text, verified: true })),
    });
  }

  return payloads;
}

function parseEducationItems(
  lines: string[],
  baseName: string
): CreateEvidencePayload[] {
  const rawBullets = lines.map((l) => l.trim()).filter((l) => l.length > 0);
  if (rawBullets.length === 0) return [];

  const institutionKeywords = /\b(University|College|School|Institute|Academy|Polytechnic)\b/i;
  const degreeKeywords = /\b(Bachelor|Master|PhD|Doctor|B\.S\.|M\.S\.|B\.Sc|M\.Sc|Degree|Diploma|Honours)\b/i;

  interface RawEdu {
    institution: string;
    degree: string;
    dates?: string;
    details: string[];
  }

  const eduEntries: RawEdu[] = [];
  let currentEdu: RawEdu | null = null;

  for (const line of rawBullets) {
    const isInst = institutionKeywords.test(line);
    const isDeg = degreeKeywords.test(line);
    const dateMatch =
      line.match(DATE_RANGE_REGEX) ||
      line.match(/\b(19\d\d|20\d\d)\s*(?:–|-|—|to)\s*(19\d\d|20\d\d|Present)\b/);

    if (isInst && (!currentEdu || currentEdu.institution)) {
      if (currentEdu) eduEntries.push(currentEdu);
      currentEdu = { institution: "", degree: "", details: [] };
    }

    if (!currentEdu) {
      currentEdu = { institution: "", degree: "", details: [] };
    }

    if (dateMatch && !currentEdu.dates) {
      currentEdu.dates = dateMatch[0].trim();
    }

    if (isInst && !currentEdu.institution) {
      const parts = line.split(/[,|—–]\s*/);
      if (parts.length >= 2 && degreeKeywords.test(parts[1])) {
        currentEdu.institution = parts[0].trim();
        currentEdu.degree = parts.slice(1).join(", ").trim();
      } else {
        currentEdu.institution = line;
      }
    } else if (isDeg && !currentEdu.degree) {
      currentEdu.degree = line;
    } else {
      currentEdu.details.push(cleanBulletText(line));
    }
  }
  if (currentEdu) eduEntries.push(currentEdu);

  if (eduEntries.length === 0) {
    return [
      {
        type: "education",
        title: `Education & Academics (${baseName})`,
        organization: rawBullets[0]?.slice(0, 50) || "Academic Institution",
        verifiedSummary: rawBullets.join(" | ").slice(0, 200),
        tags: ["Education", "Degree"],
        status: "verified",
        bullets: rawBullets.map((text) => ({
          text: cleanBulletText(text),
          verified: true,
        })),
      },
    ];
  }

  return eduEntries.map((edu) => {
    const org = edu.institution || rawBullets[0]?.slice(0, 50) || "Academic Institution";
    const title = edu.degree || `Education (${org})`;
    const bullets =
      edu.details.length > 0
        ? edu.details.map((text) => ({ text, verified: true }))
        : [
            {
              text: `${title} - ${org}${edu.dates ? ` (${edu.dates})` : ""}`,
              verified: true,
            },
          ];

    return {
      type: "education",
      title,
      organization: org,
      dates: edu.dates,
      verifiedSummary: [title, org, edu.dates].filter(Boolean).join(" | ").slice(0, 200),
      tags: ["Education", "Degree"],
      status: "verified",
      bullets,
    };
  });
}

function parseSkillsMatrix(
  lines: string[],
  docTechnologies: string[],
  baseName: string
): CreateEvidencePayload[] {
  const categoryMap = new Map<string, string[]>();
  const unmappedSkills: string[] = [];

  let currentCategory: string | null = null;
  let currentTokens: string[] = [];

  for (const rawLine of lines) {
    const line = cleanBulletText(rawLine);
    if (!line) continue;

    // Discard any residual subtitle/parenthetical header remnants
    if (
      line.endsWith(")") &&
      !line.includes(":") &&
      (line.includes("pool") ||
        line.includes("evidence") ||
        line.includes("ATS") ||
        line.includes("entry"))
    ) {
      continue;
    }

    const colonIdx = line.indexOf(":");
    // Check if this line starts a new category (e.g. "Languages:", "Frontend:", "Backend/APIs:")
    const isNewCategory =
      colonIdx > 0 &&
      colonIdx < 35 &&
      !/[.!?]/.test(line.substring(0, colonIdx)) &&
      !/\b(?:note|usage|confirm)\b/i.test(line.substring(0, colonIdx));

    if (isNewCategory) {
      if (currentCategory && currentTokens.length > 0) {
        const existing = categoryMap.get(currentCategory) || [];
        categoryMap.set(currentCategory, Array.from(new Set([...existing, ...currentTokens])));
      }
      currentCategory = line.substring(0, colonIdx).trim();
      const rest = line.substring(colonIdx + 1).trim();
      currentTokens = rest
        .split(/[,•|/–—]/)
        .map((s) => s.trim().replace(/^[\(\)]+|[\(\)\.]+$/g, ""))
        .filter((s) => s.length > 0 && !/^(?:confirm|usage|only)$/i.test(s));
    } else if (currentCategory) {
      const continuationTokens = line
        .split(/[,•|/–—]/)
        .map((s) => s.trim().replace(/^[\(\)]+|[\(\)\.]+$/g, ""))
        .filter((s) => s.length > 0 && !/^(?:confirm|usage|only)$/i.test(s));
      currentTokens.push(...continuationTokens);
    } else {
      const tokens = line
        .split(/[,•|/–—]/)
        .map((s) => s.trim().replace(/^[\(\)]+|[\(\)\.]+$/g, ""))
        .filter((s) => s.length > 0 && !/^(?:confirm|usage|only)$/i.test(s));
      unmappedSkills.push(...tokens);
    }
  }

  if (currentCategory && currentTokens.length > 0) {
    const existing = categoryMap.get(currentCategory) || [];
    categoryMap.set(currentCategory, Array.from(new Set([...existing, ...currentTokens])));
  }

  const payloads: CreateEvidencePayload[] = [];

  if (categoryMap.size > 0) {
    for (const [category, skills] of categoryMap.entries()) {
      payloads.push({
        type: "skill",
        title: `Technical Skills — ${category}`,
        organization: category,
        verifiedSummary: skills.join(", ").slice(0, 200),
        tags: skills.slice(0, 10),
        status: "verified",
        bullets: skills.map((text) => ({ text, verified: true })),
      });
    }

    if (unmappedSkills.length > 0) {
      const unique = Array.from(new Set(unmappedSkills));
      payloads.push({
        type: "skill",
        title: `Additional Competencies (${baseName})`,
        organization: "Core Competencies",
        verifiedSummary: unique.slice(0, 15).join(", ").slice(0, 200),
        tags: unique.slice(0, 8),
        status: "verified",
        bullets: unique.map((text) => ({ text, verified: true })),
      });
    }
  } else {
    const allSkills = Array.from(
      new Set([...unmappedSkills, ...docTechnologies])
    ).filter((s) => s.length > 0);

    if (allSkills.length > 0) {
      payloads.push({
        type: "skill",
        title: `Technical Competencies & Stack (${baseName})`,
        organization: "Core Competencies",
        verifiedSummary: allSkills.slice(0, 15).join(", ").slice(0, 200),
        tags: allSkills.slice(0, 8),
        status: "verified",
        bullets: allSkills.map((text) => ({ text, verified: true })),
      });
    }
  }

  return payloads;
}

function parseCertifications(
  lines: string[],
  baseName: string
): CreateEvidencePayload[] {
  const rawBullets = lines
    .map((l) => cleanBulletText(l))
    .filter((l) => l.length > 0);
  if (rawBullets.length === 0) return [];

  return rawBullets.map((cert) => {
    let organization = "Certification Authority";
    if (/\bAWS\b/i.test(cert)) organization = "Amazon Web Services";
    else if (/\b(Azure|Microsoft)\b/i.test(cert)) organization = "Microsoft";
    else if (/\b(GCP|Google)\b/i.test(cert)) organization = "Google Cloud";
    else if (/\bKubernetes\b/i.test(cert) || /\bCKA\b/i.test(cert))
      organization = "Cloud Native Computing Foundation";

    return {
      type: "award",
      title: cert,
      organization,
      verifiedSummary: cert,
      tags: ["Certification"],
      status: "verified",
      bullets: [{ text: cert, verified: true }],
    };
  });
}

export function convertExtractedPdfToEvidenceItems(
  extracted: ExtractedPdfEvidence
): CreateEvidencePayload[] {
  const items: CreateEvidencePayload[] = [];
  const baseName = extracted.sourceDoc.replace(/\.pdf$/i, "");

  // 1. Work Experience
  if (extracted.sections.experience && extracted.sections.experience.length > 0) {
    const isEvidenceBank = extracted.sections.experience.some((l) =>
      EXP_HEADER_REGEX.test(l.trim())
    );

    if (isEvidenceBank) {
      items.push(
        ...parseEvidenceBankItems(
          extracted.sections.experience,
          "experience",
          baseName,
          extracted.extractedTechnologies
        )
      );
    } else {
      items.push(
        ...parseStandardResumeJobs(
          extracted.sections.experience,
          baseName,
          extracted.extractedTechnologies
        )
      );
    }
  }

  // 2. Projects
  if (extracted.sections.projects && extracted.sections.projects.length > 0) {
    const isEvidenceBank = extracted.sections.projects.some((l) =>
      PRJ_HEADER_REGEX.test(l.trim())
    );

    if (isEvidenceBank) {
      items.push(
        ...parseEvidenceBankItems(
          extracted.sections.projects,
          "project",
          baseName,
          extracted.extractedTechnologies
        )
      );
    } else {
      items.push(
        ...parseStandardResumeProjects(
          extracted.sections.projects,
          baseName,
          extracted.extractedTechnologies
        )
      );
    }
  }

  // Check if uncategorized has Evidence Bank items (EXP- or PRJ-)
  if (
    extracted.sections.uncategorized &&
    extracted.sections.uncategorized.length > 0
  ) {
    const uncategorizedExp = extracted.sections.uncategorized.some((l) =>
      EXP_HEADER_REGEX.test(l.trim())
    );
    if (uncategorizedExp) {
      items.push(
        ...parseEvidenceBankItems(
          extracted.sections.uncategorized,
          "experience",
          baseName,
          extracted.extractedTechnologies
        )
      );
    }

    const uncategorizedPrj = extracted.sections.uncategorized.some((l) =>
      PRJ_HEADER_REGEX.test(l.trim())
    );
    if (uncategorizedPrj) {
      items.push(
        ...parseEvidenceBankItems(
          extracted.sections.uncategorized,
          "project",
          baseName,
          extracted.extractedTechnologies
        )
      );
    }
  }

  // 3. Technical Skills
  if (
    (extracted.sections.skills && extracted.sections.skills.length > 0) ||
    extracted.extractedTechnologies.length > 0
  ) {
    items.push(
      ...parseSkillsMatrix(
        extracted.sections.skills || [],
        extracted.extractedTechnologies,
        baseName
      )
    );
  }

  // 4. Education
  if (extracted.sections.education && extracted.sections.education.length > 0) {
    items.push(...parseEducationItems(extracted.sections.education, baseName));
  } else {
    // Check candidate quick facts in uncategorized or full document pages
    const allDocLines = [
      ...(extracted.sections.uncategorized || []),
      ...extracted.pages.flatMap((p) => p.text.split("\n")),
    ];

    let quickFactsEdu: { degree: string; institution: string; dates?: string } | null = null;
    for (let i = 0; i < allDocLines.length; i++) {
      const line = allDocLines[i].trim();
      const eduMatch = line.match(/^education\s*:\s*(.+)$/i);
      if (eduMatch) {
        let fullEduStr = eduMatch[1].trim();
        // Check if next line continues the institution name (e.g. "University")
        if (i + 1 < allDocLines.length) {
          const nextL = allDocLines[i + 1].trim();
          if (
            /^(?:University|College|Institute)\b/i.test(nextL) ||
            (!nextL.includes(":") && nextL.length < 40 && !/^(?:graduation|work_|availability)/i.test(nextL))
          ) {
            fullEduStr += " " + nextL;
          }
        }

        // Look for graduation date nearby (within next 3 lines)
        let gradDate: string | undefined = undefined;
        for (let j = i + 1; j <= Math.min(i + 3, allDocLines.length - 1); j++) {
          const gradMatch = allDocLines[j].match(/^graduation\s*:\s*(.+)$/i);
          if (gradMatch) {
            gradDate = gradMatch[1].replace(/#.*$/, "").trim();
            break;
          }
        }

        const parts = fullEduStr.split(/\s*[—–|]\s*/);
        if (parts.length >= 2) {
          quickFactsEdu = {
            degree: parts[0].trim(),
            institution: parts.slice(1).join(" — ").trim(),
            dates: gradDate,
          };
        } else {
          quickFactsEdu = {
            degree: fullEduStr,
            institution: "Academic Institution",
            dates: gradDate,
          };
        }
        break;
      }
    }

    if (quickFactsEdu) {
      items.push({
        type: "education",
        title: quickFactsEdu.degree,
        organization: quickFactsEdu.institution,
        dates: quickFactsEdu.dates,
        verifiedSummary: [quickFactsEdu.degree, quickFactsEdu.institution, quickFactsEdu.dates].filter(Boolean).join(" | "),
        tags: ["Education", "Degree"],
        status: "verified",
        bullets: [
          {
            text: `${quickFactsEdu.degree} — ${quickFactsEdu.institution}${quickFactsEdu.dates ? ` (${quickFactsEdu.dates})` : ""}`,
            verified: true,
          },
        ],
      });
    } else if (extracted.sections.uncategorized && extracted.sections.uncategorized.length > 0) {
      const eduCandidates = extracted.sections.uncategorized.filter(
        (l) =>
          /\b(?:Bachelor|Master|PhD|B\.S\.|B\.Sc|M\.S\.|M\.Sc)\b/i.test(l) &&
          /\b(?:University|College|Institute)\b/i.test(l) &&
          !/→/.test(l) &&
          !/bio\s+now/i.test(l)
      );
      if (eduCandidates.length > 0) {
        items.push(...parseEducationItems(eduCandidates, baseName));
      }
    }
  }

  // 5. Certifications
  if (
    extracted.sections.certifications &&
    extracted.sections.certifications.length > 0
  ) {
    items.push(...parseCertifications(extracted.sections.certifications, baseName));
  }

  // 6. Fallback: Uncategorized or raw text lines if no specific sections matched
  if (items.length === 0) {
    const rawLines = [
      ...(extracted.sections.uncategorized || []),
      ...extracted.pages.flatMap((p) => p.text.split("\n")),
    ]
      .map((l) => l.trim())
      .filter((l) => l.length > 5);

    if (rawLines.length > 0) {
      items.push({
        type: "experience",
        title: `Indexed Content from ${extracted.sourceDoc}`,
        organization: baseName,
        verifiedSummary: rawLines.slice(0, 3).join(". ").slice(0, 200),
        tags: extracted.extractedTechnologies.slice(0, 5),
        status: "verified",
        bullets: rawLines.slice(0, 25).map((text) => ({ text, verified: true })),
      });
    }
  }

  return items;
}
