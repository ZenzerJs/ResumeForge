import { buildComposedSystemPrompt } from "./master-prompt";

/**
 * Prompt templates for AI-Powered PDF-to-Typst conversion.
 * Conforms to Task 9.1b fixed template exemplar specification and Task 9.4 master prompt engine.
 */

export function buildPdfToTypstSystemPrompt(): string {
  const taskInstructions = `## TASK-SPECIFIC: PDF-TO-TYPST CONVERSION SPECIALIST

Your task is to take raw, extracted text from a candidate's PDF resume and convert it into a clean, well-structured single-page Typst document using the MANDATORY TEMPLATE EXEMPLAR provided below.

## MANDATORY TEMPLATE EXEMPLAR & HELPER DEFINITIONS

You MUST use the exact styling, helper functions, and structural pattern defined in this exemplar:

\`\`\`typst
#set page(
  paper: "us-letter",
  margin: (x: 1.25cm, y: 1.1cm),
)

#set text(
  font: "Liberation Sans",
  size: 9pt,
  fill: rgb("#111827"),
)

#set par(justify: true, leading: 0.48em)

// Link styling matching LaTeX linkblue (#1155CC)
#show link: set text(fill: rgb("#1155CC"))

// Section heading helper
#let section(title) = {
  v(0.4em)
  text(size: 10pt, weight: "bold", tracking: 0.05em, upper(title))
  v(-0.4em)
  line(length: 100%, stroke: 0.5pt + rgb("#9CA3AF"))
  v(0.15em)
}

// Header/entry helper for aligned roles & dates
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

// Compact list styling
#set list(
  marker: [•],
  spacing: 0.4em,
  indent: 0em,
  body-indent: 0.4em,
)

// HEADER
#align(center)[
  #text(size: 18pt, weight: "bold", fill: rgb("#111827"))[CANDIDATE NAME] \\
  #v(2pt)
  #text(size: 9pt, fill: rgb("#475569"))[
    Location #sym.dot #link("mailto:email@example.com")[email\\@example.com] #sym.dot Phone #sym.dot #link("https://linkedin.com/in/profile")[linkedin.com/in/profile] #sym.dot #link("https://github.com/profile")[github.com/profile]
  ]
]

// EXAMPLE WORKED SECTIONS — ALWAYS THIS ORDER
#section("Experience")
#entry(
  title: "Company Name",
  role: "Role Title",
  location: "City, ST",
  date: "Date Range",
  details: [
    - Accomplishment bullet 1...
    - Accomplishment bullet 2...
  ]
)

#section("Education")
#entry(
  title: "University Name",
  role: "Degree Title",
  location: "City, ST",
  date: "Graduation Date",
  details: [
    - Relevant honors or coursework...
  ]
)

#section("Projects")
#entry(
  title: "Project Name",
  role: "Role / Tech Stack",
  location: "",
  date: "Year",
  details: [
    - Project accomplishment bullet...
  ]
)

#section("Skills")
#entry(
  details: [
    - *Languages:* Skill 1, Skill 2, Skill 3
    - *Tools:* Tool 1, Tool 2
  ]
)
\`\`\`

## MANDATORY STRUCTURAL RULES

1. **DO NOT REDEFINE OR RENAME HELPER FUNCTIONS**: You MUST reuse the \`#let section(title)\` and \`#let entry(...)\` helper functions exactly as defined above. Do NOT rename them, redefine them, or invent alternative helpers.
2. **DO NOT ALTER GLOBAL STYLE BLOCKS**: You MUST NOT alter the \`#set page\`, \`#set text\`, \`#set par\`, \`#show link\`, or \`#set list\` global style blocks.
3. **POPULATE WITH REAL CONTENT**: Populate \`entry(...)\` calls with the candidate's real extracted title, role, location, date, and details in the same parameter order and bullet style.
4. **CANONICAL SECTION ORDER (ALWAYS)**: Emit sections in this exact order whenever they exist: **Experience → Education → Projects → Skills**. Rename aliases to these titles (e.g. "Technical Skills" → "Skills", "Work Experience" → "Experience"). Any additional sections (Certifications, Publications, Awards, etc.) MUST come AFTER Skills, in the order they appear in the source.
5. **UNLISTED SECTIONS**: If the candidate's resume contains sections not shown in the exemplar (e.g., "Certifications", "Publications"), create them using \`#section("Section Name")\` followed by \`#entry(...)\` blocks using the exact same pattern — after Skills.
6. **OMIT MISSING SECTIONS**: If the candidate's resume lacks a section shown in the exemplar (e.g., no Projects section), omit that \`#section(...)\` block entirely. Do NOT invent placeholder sections.
7. **PRESERVE ALL HYPERLINKS**: Every URL / mailto / LinkedIn / GitHub / Portfolio link from VERIFIED PDF HYPERLINKS (and any visible in the extracted text) MUST appear in the Typst output as \`#link("URL")[Label]\` in the header contact line. Never drop scraped links.
8. **SPECIAL CHARACTER SANITIZATION**: Escape Typst special characters in plain text:
   - Escape '#' as '\\#' (unless creating a valid Typst syntax command like #section or #entry)
   - Escape '$' as '\\$'
   - Escape '@' as '\\@'
   - Escape '\\' as '\\\\'
9. **ZERO LOSS OF INFORMATION**: Preserve all extracted dates, job titles, companies, degrees, details, technologies, metrics, numbers, and bullets. Never drop or summarize candidate data.
10. **FORBIDDEN ANGLE-BRACKET LABELS**: NEVER wrap email addresses, URLs, or domains in angle brackets like \`<yahoo.com>\` or \`<user@domain.com>\`. Typst treats angle brackets as document label references, causing fatal compiler errors. Keep emails as plain text or \`#link("mailto:user@domain.com")[user\\\\@domain.com]\`.
11. **FORBIDDEN LABELS & METADATA**: Do NOT output \`#label(...)\` commands or metadata tags.
12. **APPROVED FONT STACK ONLY**: Do NOT introduce custom font set blocks or lowercased font overrides like \`font: "liberation sans"\`. Use \`font: "Liberation Sans"\` exactly as defined in the template.
13. **OUTPUT FORMAT**: Output ONLY valid Typst markup source code. Do NOT wrap the output in markdown fences (such as \`\`\`typst). Do NOT include preamble or conversational text.`;

  return buildComposedSystemPrompt(taskInstructions);
}

import { ExtractedPdfLink } from "../pdf/parser";

export function buildPdfToTypstUserPrompt(
  rawText: string,
  fileName?: string,
  links?: ExtractedPdfLink[]
): string {
  let linkSection = "";
  if (links && links.length > 0) {
    const linkItems = links
      .map((l) => `- URL: ${l.url}${l.label ? ` (Label: "${l.label}")` : ""}`)
      .join("\n");

    linkSection = `\n### VERIFIED PDF HYPERLINKS (PRESERVE ALL EXACTLY)\n${linkItems}\n\nCRITICAL LINK INSTRUCTIONS:\n1. Preserve every extracted URL above EXACTLY. Match URLs to their visible header/text labels (e.g. LinkedIn, GitHub, Email, Portfolio).\n2. Render links using Typst link syntax: #link("URL")[Label]\n3. Place all contact links in the centered header contact line.\n4. NEVER invent, guess, or infer URLs that are not listed in the VERIFIED PDF HYPERLINKS list above.\n5. NEVER drop a verified link — every URL in this list must appear in the Typst output.\n`;
  }

  return `Convert the following extracted PDF resume text into clean Typst markup.

CANONICAL SECTION ORDER (ALWAYS): Experience → Education → Projects → Skills → any other sections.

FILE NAME: ${fileName || "Resume"}
${linkSection}
=== EXTRACTED RAW TEXT START ===
${rawText}
=== EXTRACTED RAW TEXT END ===

Return ONLY the compiled Typst markup source code.`;
}
