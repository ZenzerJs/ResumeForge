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

// EXAMPLE WORKED SECTIONS
#section("Technical Skills")
#entry(
  details: [
    - *Languages:* Skill 1, Skill 2, Skill 3
    - *Tools:* Tool 1, Tool 2
  ]
)

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
\`\`\`

## MANDATORY STRUCTURAL RULES

1. **DO NOT REDEFINE OR RENAME HELPER FUNCTIONS**: You MUST reuse the \`#let section(title)\` and \`#let entry(...)\` helper functions exactly as defined above. Do NOT rename them, redefine them, or invent alternative helpers.
2. **DO NOT ALTER GLOBAL STYLE BLOCKS**: You MUST NOT alter the \`#set page\`, \`#set text\`, \`#set par\`, \`#show link\`, or \`#set list\` global style blocks.
3. **POPULATE WITH REAL CONTENT**: Populate \`entry(...)\` calls with the candidate's real extracted title, role, location, date, and details in the same parameter order and bullet style.
4. **UNLISTED SECTIONS**: If the candidate's resume contains sections not shown in the exemplar (e.g., "Certifications", "Publications"), create them using \`#section("Section Name")\` followed by \`#entry(...)\` blocks using the exact same pattern.
5. **OMIT MISSING SECTIONS**: If the candidate's resume lacks a section shown in the exemplar (e.g., no Projects section), omit that \`#section(...)\` block entirely. Do NOT invent placeholder sections.
6. **SPECIAL CHARACTER SANITIZATION**: Escape Typst special characters in plain text:
   - Escape '#' as '\\#' (unless creating a valid Typst syntax command like #section or #entry)
   - Escape '$' as '\\$'
   - Escape '@' as '\\@'
   - Escape '\\' as '\\\\'
7. **ZERO LOSS OF INFORMATION**: Preserve all extracted dates, job titles, companies, degrees, details, technologies, metrics, numbers, and bullets. Never drop or summarize candidate data.
8. **OUTPUT FORMAT**: Output ONLY valid Typst markup source code. Do NOT wrap the output in markdown fences (such as \`\`\`typst). Do NOT include preamble or conversational text.`;

  return buildComposedSystemPrompt(taskInstructions);
}

export function buildPdfToTypstUserPrompt(rawText: string, fileName?: string): string {
  return `Convert the following extracted PDF resume text into clean Typst markup:

FILE NAME: ${fileName || "Resume"}

=== EXTRACTED RAW TEXT START ===
${rawText}
=== EXTRACTED RAW TEXT END ===

Return ONLY the compiled Typst markup source code.`;
}
