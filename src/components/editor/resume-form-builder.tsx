"use client";

import React, { useState, useEffect } from "react";
import { buildResumeDocument, typstContent, typstString, type ResumeAssignment } from "@/lib/typst/resume-document";
import {
  User,
  Briefcase,
  GraduationCap,
  FolderKanban,
  Wrench,
  SlidersHorizontal,
  Plus,
  Trash2,
  Sparkles,
} from "lucide-react";

export interface ResumeEntryItem {
  id: string;
  title: string;
  role: string;
  location: string;
  date: string;
  bullets: string[];
}

export interface ResumeSkillGroup {
  id: string;
  category: string;
  items: string;
}

export interface StructuredResumeModel {
  fontSize: "8.5pt" | "9pt" | "9.5pt" | "10pt" | "10.5pt";
  marginPreset: "compact" | "balanced" | "spacious";
  fullName: string;
  location: string;
  email: string;
  phone: string;
  github: string;
  linkedin: string;
  summary: string;
  experience: ResumeEntryItem[];
  education: ResumeEntryItem[];
  projects: ResumeEntryItem[];
  skills: ResumeSkillGroup[];
}

function decodeTypstContent(value: string): string {
  return value.replace(/\\([\\#\[\]*_@$<>`~\/=+^.-])/g, "$1");
}

function makeId(prefix: string, idx: number): string {
  return `${prefix}-${idx}-${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Parse a Typst resume string into a StructuredResumeModel so non-technical users
 * can edit Contact, Summary, Experience, Education, Projects, Skills, and Formatting
 * via standard form inputs.
 */
export function parseTypstToStructuredModel(source: string): StructuredResumeModel {
  const sizeMatch = source.match(/size:\s*(8\.5pt|9pt|9\.5pt|10pt|10\.5pt)/);
  const fontSize = (sizeMatch?.[1] as StructuredResumeModel["fontSize"]) || "9pt";

  let marginPreset: StructuredResumeModel["marginPreset"] = "balanced";
  if (source.includes("x: 1cm") || source.includes("x: 1.0cm") || source.includes("0.4in")) {
    marginPreset = "compact";
  } else if (source.includes("x: 1.5cm") || source.includes("0.6in")) {
    marginPreset = "spacious";
  }

  // Name extraction
  let fullName = "";
  const headerNameMatch =
    source.match(/#text\([\s\S]*?size:\s*(?:1[4-9]|2[0-9])pt[\s\S]*?\)\s*\[([^\]]+)\]/) ||
    source.match(/^=\s+(.+)$/m);
  if (headerNameMatch?.[1]) {
    fullName = decodeTypstContent(headerNameMatch[1].trim());
  }

  const emailMatch = source.match(/mailto:([^\s"\]]+)/) || source.match(/([\w.+-]+@[\w-]+\.[\w.-]+)/);
  const email = emailMatch?.[1]?.replace(/\\@/g, "@") || "";

  const phoneMatch =
    source.match(/#sym\.dot\s*(\+?[\d\s().-]{7,25})\s*#sym\.dot/) ||
    source.match(/(\+?\d[\d\s().-]{7,}\d)/);
  const phone = phoneMatch?.[1]?.trim() || "";

  const githubMatch = source.match(/github\.com\/([A-Za-z0-9_.-]+)/i);
  const github = githubMatch?.[1] ? `github.com/${githubMatch[1]}` : "";

  const linkedinMatch = source.match(/linkedin\.com\/in\/([A-Za-z0-9_.-]+)/i);
  const linkedin = linkedinMatch?.[1] ? `linkedin.com/in/${linkedinMatch[1]}` : "";

  let location = "";
  const locMatch =
    source.match(/#text\([^)]*size:\s*9pt[^)]*\)\[\s*([^#\n]+?)\s*#sym\.dot/) ||
    source.match(/\[\s*([^#\n\[\]]+?)\s*#sym\.dot/);
  if (locMatch?.[1]) {
    location = locMatch[1].trim();
  }

  // Helper to split by #section("...") or == Section
  const parseEntriesInBlock = (block: string, prefix: string): ResumeEntryItem[] => {
    const items: ResumeEntryItem[] = [];
    const entryRegex = /#entry\(([\s\S]*?)\n\)/g;
    let match: RegExpExecArray | null;
    let idx = 0;

    while ((match = entryRegex.exec(block)) !== null) {
      const body = match[1];
      const title =
        body.match(/title:\s*"((?:[^"\\]|\\.)*)"/)?.[1]?.replace(/\\"/g, '"').replace(/\\\\/g, "\\") ?? "";
      const role =
        body.match(/role:\s*"((?:[^"\\]|\\.)*)"/)?.[1]?.replace(/\\"/g, '"').replace(/\\\\/g, "\\") ?? "";
      const loc =
        body.match(/location:\s*"((?:[^"\\]|\\.)*)"/)?.[1]?.replace(/\\"/g, '"').replace(/\\\\/g, "\\") ?? "";
      const date =
        body.match(/date:\s*"((?:[^"\\]|\\.)*)"/)?.[1]?.replace(/\\"/g, '"').replace(/\\\\/g, "\\") ?? "";
      const detailsMatch = body.match(/details:\s*\[([\s\S]*)\]/);
      const bulletsRaw = detailsMatch?.[1] ?? "";
      const bullets = bulletsRaw
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.startsWith("- "))
        .map((l) => decodeTypstContent(l.replace(/^-\s+/, "").trim()));

      if (title || role || bullets.length > 0) {
        items.push({
          id: makeId(prefix, idx++),
          title,
          role,
          location: loc,
          date,
          bullets: bullets.length > 0 ? bullets : [""],
        });
      }
    }

    if (items.length === 0) {
      const lines = block.split("\n");
      let current: ResumeEntryItem | null = null;
      for (const rawLine of lines) {
        const line = rawLine.trim();
        const boldPair = line.match(/^\*([^*]+)\*\s*(?:--|—|-)\s*\*([^*]+)\*(?:\s*\(([^)]+)\))?/);
        if (boldPair) {
          if (current) items.push(current);
          current = {
            id: makeId(prefix, idx++),
            title: boldPair[1].trim(),
            role: boldPair[2].trim(),
            location: "",
            date: boldPair[3]?.trim() || "",
            bullets: [],
          };
          continue;
        }
        if (current && line.startsWith("- ")) {
          current.bullets.push(line.replace(/^-\s+/, "").trim());
        }
      }
      if (current) {
        if (current.bullets.length === 0) current.bullets.push("");
        items.push(current);
      }
    }

    return items;
  };

  // Locate sections
  const sectionSplits = source.split(/#section\("([^"]+)"\)|^==\s+(.+)$/gm);
  let summary = "";
  let experience: ResumeEntryItem[] = [];
  let education: ResumeEntryItem[] = [];
  let projects: ResumeEntryItem[] = [];
  let skills: ResumeSkillGroup[] = [];

  for (let i = 1; i < sectionSplits.length; i += 3) {
    const secName = (sectionSplits[i] || sectionSplits[i + 1] || "").trim().toLowerCase();
    const secContent = sectionSplits[i + 2] || "";

    if (secName.includes("summary") || secName.includes("profile")) {
      summary = secContent
        .replace(/\/\/.*$/gm, "")
        .trim();
    } else if (secName.includes("experience") || secName.includes("work")) {
      experience = parseEntriesInBlock(secContent, "exp");
    } else if (secName.includes("education")) {
      education = parseEntriesInBlock(secContent, "edu");
    } else if (secName.includes("project")) {
      projects = parseEntriesInBlock(secContent, "proj");
    } else if (secName.includes("skill")) {
      const skillLines = secContent
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.startsWith("- "));
      skills = skillLines.map((line, sIdx) => {
        const clean = line.replace(/^-\s+/, "");
        const catMatch =
          clean.match(/^\*([^*]+)\*:\s*(.*)$/) ||
          clean.match(/^\*([^*:]+):?\*\s*(.*)$/) ||
          clean.match(/^([^:]+):\s*(.*)$/);
        if (catMatch) {
          return {
            id: makeId("skill", sIdx),
            category: catMatch[1].replace(/^\*+|\*+$/g, "").replace(/:$/, "").trim(),
            items: catMatch[2].trim(),
          };
        }
        return {
          id: makeId("skill", sIdx),
          category: "",
          items: clean,
        };
      });
    }
  }

  return {
    fontSize,
    marginPreset,
    fullName,
    location,
    email,
    phone,
    github,
    linkedin,
    summary,
    experience,
    education,
    projects,
    skills,
  };
}

function escapeTypstString(val: string): string {
  return val.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * Serialize a StructuredResumeModel back into clean, canonical Typst source code.
 */
export function serializeStructuredModelToTypst(model: StructuredResumeModel): string {
  const marginMap: Record<StructuredResumeModel["marginPreset"], string> = {
    compact: "(x: 1.0cm, y: 0.95cm)",
    balanced: "(x: 1.25cm, y: 1.1cm)",
    spacious: "(x: 1.5cm, y: 1.3cm)",
  };

  const escapedEmailDisplay = typstContent(model.email);
  const githubClean = model.github.replace(/^https?:\/\//, "");
  const linkedinClean = model.linkedin.replace(/^https?:\/\//, "");

  const renderEntryList = (entries: ResumeEntryItem[]) =>
    entries
      .map((entry) => {
        const bulletLines = entry.bullets
          .map((b) => b.trim())
          .filter(Boolean)
          .map((b) => `    - ${typstContent(b)}`)
          .join("\n");
        return `#entry(
  title: "${escapeTypstString(entry.title)}",
  role: "${escapeTypstString(entry.role)}",
  location: "${escapeTypstString(entry.location)}",
  date: "${escapeTypstString(entry.date)}",
  details: [
${bulletLines}
  ]
)`;
      })
      .join("\n\n");

  const skillLines = model.skills
    .filter((s) => s.category.trim() || s.items.trim())
    .map((s) => `    - *${typstContent(s.category.trim())}:* ${typstContent(s.items.trim())}`)
    .join("\n");

  const summaryBlock = model.summary.trim()
    ? `\n// SUMMARY\n#section("Summary")\n${typstContent(model.summary.trim())}\n`
    : "";

  return `// ResumeForge Canonical Resume Template (Typst)

#set page(
  paper: "us-letter",
  margin: ${marginMap[model.marginPreset]},
)

#set text(
  font: "Liberation Sans",
  size: ${model.fontSize},
  fill: rgb("#111827"),
)

#set par(justify: true, leading: 0.48em)

#show link: set text(fill: rgb("#1155CC"))

#let section(title) = {
  v(0.4em)
  text(size: 10pt, weight: "bold", tracking: 0.05em, upper(title))
  v(-0.4em)
  line(length: 100%, stroke: 0.5pt + rgb("#9CA3AF"))
  v(0.15em)
}

#let entry(
  title: "",
  role: "",
  location: "",
  date: "",
  details: [],
) = {
  block(width: 100%, breakable: false)[
    #grid(
      columns: (1fr, auto),
      align: (left, right),
      [
        #if title != "" [*#title*]
        #if role != "" [
          #if title != "" [ | ]
          #emph(role)
        ]
      ],
      [
        #if location != "" [
          #location
          #if date != "" [ | ]
        ]
        #if date != "" [*#date*]
      ]
    )
    #v(-0.35em)
    #details
  ]
}

#set list(
  marker: [•],
  spacing: 0.4em,
  indent: 0em,
  body-indent: 0.4em,
)

// HEADER
#align(center)[
  #text(size: 18pt, weight: "bold", fill: rgb("#111827"))[${typstContent(model.fullName)}] \\
  #v(2pt)
  #text(size: 9pt, fill: rgb("#475569"))[
    ${[model.location && typstContent(model.location), model.email && `#link(${typstString(`mailto:${model.email}`)})[${escapedEmailDisplay}]`, model.phone && typstContent(model.phone), githubClean && `#link(${typstString(`https://${githubClean}`)})[${typstContent(githubClean)}]`, linkedinClean && `#link(${typstString(`https://${linkedinClean}`)})[${typstContent(linkedinClean)}]`].filter(Boolean).join(" #sym.dot ")}
  ]
]
${summaryBlock}
// EXPERIENCE
#section("Experience")

${renderEntryList(model.experience)}

// EDUCATION
#section("Education")

${renderEntryList(model.education)}

// PROJECTS
#section("Projects")

${renderEntryList(model.projects)}

// SKILLS
#section("Skills")
#entry(
  details: [
${skillLines}
  ]
)
`;
}

/** Convert an already verified legacy form model to the source-backed layout. */
export function legacyFormToResumeDocument(model: StructuredResumeModel) {
  let source = "";
  const assignments: ResumeAssignment[] = [];
  const add = (kind: ResumeAssignment["kind"], text: string) => {
    if (!text.trim()) return;
    if (source) source += "\n";
    const start = source.length;
    source += text;
    assignments.push({ kind, span: { start, end: source.length } });
  };
  add("name", model.fullName);
  for (const contact of [model.location, model.email, model.phone, model.github, model.linkedin]) add("contact", contact);
  if (model.summary) { add("section", "Summary"); add("paragraph", model.summary); }
  for (const [title, entries] of [["Experience", model.experience], ["Education", model.education], ["Projects", model.projects]] as const) {
    if (!entries.length) continue;
    add("section", title);
    for (const entry of entries) {
      add("entry-title", entry.title); add("entry-role", entry.role); add("entry-location", entry.location); add("entry-date", entry.date);
      for (const bullet of entry.bullets) add("bullet", bullet);
    }
  }
  if (model.skills.length) {
    add("section", "Skills");
    for (const skill of model.skills) add("skill", [skill.category, skill.items].filter(Boolean).join(": "));
  }
  return buildResumeDocument(source, assignments);
}

interface ResumeFormBuilderProps {
  value: string;
  onChange: (newTypst: string) => void;
}

export function ResumeFormBuilder({ value, onChange }: ResumeFormBuilderProps) {
  const [model, setModel] = useState<StructuredResumeModel>(() =>
    parseTypstToStructuredModel(value)
  );
  const [activeSection, setActiveSection] = useState<
    "contact" | "experience" | "education" | "projects" | "skills"
  >("contact");

  // Re-sync if external source changes substantially (e.g. template reset or AI patch applied)
  useEffect(() => {
    if (!value) return;
    setModel((prev) => {
      const currentSerialized = serializeStructuredModelToTypst(prev);
      if (currentSerialized.trim() === value.trim()) return prev;
      return parseTypstToStructuredModel(value);
    });
  }, [value]);

  const safeToEdit = serializeStructuredModelToTypst(parseTypstToStructuredModel(value)).trim() === value.trim();
  const commitModel = (next: StructuredResumeModel) => {
    if (!safeToEdit) return;
    setModel(next);
    onChange(serializeStructuredModelToTypst(next));
  };

  const updateEntryField = (
    listKey: "experience" | "education" | "projects",
    id: string,
    field: keyof Omit<ResumeEntryItem, "id" | "bullets">,
    val: string
  ) => {
    const nextList = model[listKey].map((item) =>
      item.id === id ? { ...item, [field]: val } : item
    );
    commitModel({ ...model, [listKey]: nextList });
  };

  const updateEntryBullet = (
    listKey: "experience" | "education" | "projects",
    id: string,
    bulletIdx: number,
    val: string
  ) => {
    const nextList = model[listKey].map((item) => {
      if (item.id !== id) return item;
      const nextBullets = [...item.bullets];
      nextBullets[bulletIdx] = val;
      return { ...item, bullets: nextBullets };
    });
    commitModel({ ...model, [listKey]: nextList });
  };

  const addEntryBullet = (listKey: "experience" | "education" | "projects", id: string) => {
    const nextList = model[listKey].map((item) =>
      item.id === id ? { ...item, bullets: [...item.bullets, ""] } : item
    );
    commitModel({ ...model, [listKey]: nextList });
  };

  const removeEntryBullet = (
    listKey: "experience" | "education" | "projects",
    id: string,
    bulletIdx: number
  ) => {
    const nextList = model[listKey].map((item) => {
      if (item.id !== id) return item;
      const nextBullets = item.bullets.filter((_, idx) => idx !== bulletIdx);
      return { ...item, bullets: nextBullets.length > 0 ? nextBullets : [""] };
    });
    commitModel({ ...model, [listKey]: nextList });
  };

  const addEntry = (listKey: "experience" | "education" | "projects") => {
    const newItem: ResumeEntryItem = {
      id: makeId(listKey, model[listKey].length),
      title: "",
      role: "",
      location: "",
      date: "",
      bullets: [""],
    };
    commitModel({ ...model, [listKey]: [...model[listKey], newItem] });
  };

  const removeEntry = (listKey: "experience" | "education" | "projects", id: string) => {
    const nextList = model[listKey].filter((item) => item.id !== id);
    commitModel({ ...model, [listKey]: nextList });
  };

  if (!safeToEdit) return (
    <div data-testid="resume-form-builder-unavailable" className="p-6 text-sm text-slate-200" role="status">
      This source cannot be safely edited in the form without losing content. Use Typst Code to edit it.
    </div>
  );

  return (
    <div
      data-testid="resume-form-builder"
      className="flex h-full flex-col overflow-hidden bg-slate-900 text-slate-100"
    >
      {/* Formatting Quick Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-950/90 px-4 py-2 text-xs">
        <div className="flex items-center gap-2 text-slate-300 font-medium">
          <SlidersHorizontal className="h-3.5 w-3.5 text-[#ff8c00]" />
          <span>Formatting:</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono">
            <span>Font Size</span>
            <select
              value={model.fontSize}
              onChange={(e) =>
                commitModel({
                  ...model,
                  fontSize: e.target.value as StructuredResumeModel["fontSize"],
                })
              }
              data-testid="form-builder-font-size"
              className="rounded border border-slate-700 bg-slate-900 px-2 py-0.5 text-xs text-slate-200 focus:border-[#ff8c00] focus:outline-none"
            >
              <option value="8.5pt">8.5 pt (Dense)</option>
              <option value="9pt">9.0 pt (Default)</option>
              <option value="9.5pt">9.5 pt (Readable)</option>
              <option value="10pt">10.0 pt (Large)</option>
              <option value="10.5pt">10.5 pt (Executive)</option>
            </select>
          </label>

          <label className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono">
            <span>Margins</span>
            <select
              value={model.marginPreset}
              onChange={(e) =>
                commitModel({
                  ...model,
                  marginPreset: e.target.value as StructuredResumeModel["marginPreset"],
                })
              }
              data-testid="form-builder-margins"
              className="rounded border border-slate-700 bg-slate-900 px-2 py-0.5 text-xs text-slate-200 focus:border-[#ff8c00] focus:outline-none"
            >
              <option value="compact">Compact (1.0 cm)</option>
              <option value="balanced">Balanced (1.25 cm)</option>
              <option value="spacious">Spacious (1.5 cm)</option>
            </select>
          </label>
        </div>
      </div>

      {/* Section Navigation Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto border-b border-slate-800 bg-slate-900/80 px-4 py-2 no-scrollbar">
        {[
          { id: "contact", label: "Contact & Summary", icon: User },
          { id: "experience", label: `Experience (${model.experience.length})`, icon: Briefcase },
          { id: "education", label: `Education (${model.education.length})`, icon: GraduationCap },
          { id: "projects", label: `Projects (${model.projects.length})`, icon: FolderKanban },
          { id: "skills", label: `Skills (${model.skills.length})`, icon: Wrench },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeSection === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSection(tab.id as typeof activeSection)}
              data-testid={`form-builder-tab-${tab.id}`}
              className={`flex items-center gap-1.5 shrink-0 rounded-md px-2.5 py-1.5 text-xs font-mono font-medium transition ${
                active
                  ? "bg-[#ff8c00]/15 border border-[#ff8c00]/40 text-amber-300"
                  : "border border-transparent text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Form Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeSection === "contact" && (
          <div className="space-y-4" data-testid="form-section-contact">
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4 space-y-3">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#ff8c00]">
                Candidate Header &amp; Contact Info
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-mono text-slate-400 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={model.fullName}
                    onChange={(e) => commitModel({ ...model, fullName: e.target.value })}
                    data-testid="form-input-fullname"
                    className="w-full rounded border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white focus:border-[#ff8c00] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono text-slate-400 mb-1">Location</label>
                  <input
                    type="text"
                    value={model.location}
                    onChange={(e) => commitModel({ ...model, location: e.target.value })}
                    data-testid="form-input-location"
                    className="w-full rounded border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white focus:border-[#ff8c00] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono text-slate-400 mb-1">Email</label>
                  <input
                    type="email"
                    value={model.email}
                    onChange={(e) => commitModel({ ...model, email: e.target.value })}
                    data-testid="form-input-email"
                    className="w-full rounded border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white focus:border-[#ff8c00] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono text-slate-400 mb-1">Phone</label>
                  <input
                    type="text"
                    value={model.phone}
                    onChange={(e) => commitModel({ ...model, phone: e.target.value })}
                    data-testid="form-input-phone"
                    className="w-full rounded border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white focus:border-[#ff8c00] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono text-slate-400 mb-1">GitHub URL</label>
                  <input
                    type="text"
                    value={model.github}
                    onChange={(e) => commitModel({ ...model, github: e.target.value })}
                    className="w-full rounded border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white focus:border-[#ff8c00] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono text-slate-400 mb-1">LinkedIn URL</label>
                  <input
                    type="text"
                    value={model.linkedin}
                    onChange={(e) => commitModel({ ...model, linkedin: e.target.value })}
                    className="w-full rounded border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white focus:border-[#ff8c00] focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#ff8c00]">
                  Professional Summary (Optional)
                </h3>
                <span className="text-[10px] font-mono text-slate-500">Renders above Experience</span>
              </div>
              <textarea
                rows={3}
                value={model.summary}
                onChange={(e) => commitModel({ ...model, summary: e.target.value })}
                placeholder="e.g. Senior Full-Stack Engineer with 5+ years building distributed cloud systems..."
                data-testid="form-input-summary"
                className="w-full rounded border border-slate-700 bg-slate-900 p-2.5 text-xs text-white focus:border-[#ff8c00] focus:outline-none leading-relaxed"
              />
            </div>
          </div>
        )}

        {(activeSection === "experience" ||
          activeSection === "education" ||
          activeSection === "projects") && (
          <div className="space-y-4" data-testid={`form-section-${activeSection}`}>
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#ff8c00]">
                {activeSection === "experience"
                  ? "Work Experience"
                  : activeSection === "education"
                  ? "Education"
                  : "Projects"}
              </h3>
              <button
                type="button"
                onClick={() => addEntry(activeSection)}
                data-testid={`add-${activeSection}-entry-btn`}
                className="flex items-center gap-1 rounded bg-[#ff8c00] px-2.5 py-1 text-xs font-mono font-bold text-slate-950 hover:bg-amber-400 transition"
              >
                <Plus className="h-3.5 w-3.5" />
                Add{" "}
                {activeSection === "experience"
                  ? "Role"
                  : activeSection === "education"
                  ? "School"
                  : "Project"}
              </button>
            </div>

            {model[activeSection].map((entry, idx) => (
              <div
                key={entry.id}
                className="rounded-lg border border-slate-800 bg-slate-950/60 p-4 space-y-3"
              >
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                  <span className="font-mono text-xs font-semibold text-slate-300">
                    #{idx + 1} · {entry.title || "Untitled"}
                  </span>
                  {model[activeSection].length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeEntry(activeSection, entry.id)}
                      className="text-slate-500 hover:text-red-400 transition p-1"
                      title="Remove entry"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-mono text-slate-400 mb-1">
                      {activeSection === "education"
                        ? "University / Institution"
                        : activeSection === "projects"
                        ? "Project Title"
                        : "Company / Organization"}
                    </label>
                    <input
                      type="text"
                      value={entry.title}
                      onChange={(e) =>
                        updateEntryField(activeSection, entry.id, "title", e.target.value)
                      }
                      className="w-full rounded border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white focus:border-[#ff8c00] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-slate-400 mb-1">
                      {activeSection === "education" ? "Degree / Program" : "Role / Title"}
                    </label>
                    <input
                      type="text"
                      value={entry.role}
                      onChange={(e) =>
                        updateEntryField(activeSection, entry.id, "role", e.target.value)
                      }
                      className="w-full rounded border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white focus:border-[#ff8c00] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-slate-400 mb-1">
                      Location
                    </label>
                    <input
                      type="text"
                      value={entry.location}
                      onChange={(e) =>
                        updateEntryField(activeSection, entry.id, "location", e.target.value)
                      }
                      className="w-full rounded border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white focus:border-[#ff8c00] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-slate-400 mb-1">
                      Date Range
                    </label>
                    <input
                      type="text"
                      value={entry.date}
                      onChange={(e) =>
                        updateEntryField(activeSection, entry.id, "date", e.target.value)
                      }
                      className="w-full rounded border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white focus:border-[#ff8c00] focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                      Impact Bullets ({entry.bullets.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => addEntryBullet(activeSection, entry.id)}
                      className="text-[11px] font-mono text-[#ff8c00] hover:underline flex items-center gap-1"
                    >
                      <Plus className="h-3 w-3" /> Add Bullet
                    </button>
                  </div>
                  {entry.bullets.map((bullet, bIdx) => (
                    <div key={bIdx} className="flex items-start gap-2">
                      <span className="mt-2 text-xs text-[#ff8c00]">•</span>
                      <textarea
                        rows={2}
                        value={bullet}
                        onChange={(e) =>
                          updateEntryBullet(activeSection, entry.id, bIdx, e.target.value)
                        }
                        className="flex-1 rounded border border-slate-700 bg-slate-900 p-2 text-xs text-slate-100 focus:border-[#ff8c00] focus:outline-none leading-relaxed"
                      />
                      {entry.bullets.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeEntryBullet(activeSection, entry.id, bIdx)}
                          className="mt-1.5 text-slate-500 hover:text-red-400 p-1"
                          title="Delete bullet"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeSection === "skills" && (
          <div className="space-y-4" data-testid="form-section-skills">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#ff8c00]">
                Skills &amp; Technical Inventory
              </h3>
              <button
                type="button"
                onClick={() =>
                  commitModel({
                    ...model,
                    skills: [
                      ...model.skills,
                      {
                        id: makeId("skill", model.skills.length),
                        category: "Additional Skills",
                        items: "",
                      },
                    ],
                  })
                }
                data-testid="add-skill-category-btn"
                className="flex items-center gap-1 rounded bg-[#ff8c00] px-2.5 py-1 text-xs font-mono font-bold text-slate-950 hover:bg-amber-400 transition"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Category
              </button>
            </div>

            <div className="space-y-3">
              {model.skills.map((skill) => (
                <div
                  key={skill.id}
                  className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 flex flex-col sm:flex-row items-start sm:items-center gap-2.5"
                >
                  <input
                    type="text"
                    value={skill.category}
                    onChange={(e) => {
                      const next = model.skills.map((s) =>
                        s.id === skill.id ? { ...s, category: e.target.value } : s
                      );
                      commitModel({ ...model, skills: next });
                    }}
                    placeholder="Category (e.g. Languages)"
                    className="w-full sm:w-44 shrink-0 rounded border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-amber-300 focus:border-[#ff8c00] focus:outline-none"
                  />
                  <input
                    type="text"
                    value={skill.items}
                    onChange={(e) => {
                      const next = model.skills.map((s) =>
                        s.id === skill.id ? { ...s, items: e.target.value } : s
                      );
                      commitModel({ ...model, skills: next });
                    }}
                    placeholder="Comma-separated skills (e.g. TypeScript, Python, Go, PostgreSQL)"
                    className="flex-1 w-full rounded border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white focus:border-[#ff8c00] focus:outline-none"
                  />
                  {model.skills.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        const next = model.skills.filter((s) => s.id !== skill.id);
                        commitModel({ ...model, skills: next });
                      }}
                      className="text-slate-500 hover:text-red-400 p-1"
                      title="Remove skill category"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer Sync Indicator */}
      <div className="flex items-center justify-between border-t border-slate-800 bg-slate-950 px-4 py-2 text-[11px] text-slate-400 font-mono">
        <span className="flex items-center gap-1.5 text-emerald-400">
          <Sparkles className="h-3 w-3" />
          Live-synced with Typst WASM Preview
        </span>
        <span>Switch to Typst Code anytime for advanced layout control</span>
      </div>
    </div>
  );
}
