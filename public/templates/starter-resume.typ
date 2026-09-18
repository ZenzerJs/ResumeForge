// ResumeForge Canonical Resume Template (Typst)

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
  #text(size: 18pt, weight: "bold", fill: rgb("#111827"))[Alex Morgan] \
  #v(2pt)
  #text(size: 9pt, fill: rgb("#475569"))[
    San Francisco, CA #sym.dot #link("mailto:alex.morgan@example.com")[alex.morgan\@example.com] #sym.dot (555) 019-2834 #sym.dot #link("https://github.com/alexmorgan")[github.com/alexmorgan] #sym.dot #link("https://linkedin.com/in/alexmorgan")[linkedin.com/in/alexmorgan]
  ]
]

// EXPERIENCE
#section("Experience")

#entry(
  title: "TechCorp Systems",
  role: "Software Engineer Intern",
  location: "San Francisco, CA",
  date: "Jun 2024 – Present",
  details: [
    - Developed high-throughput REST and GraphQL API endpoints serving over 100k daily active requests with sub-100ms response latency.
    - Refactored legacy frontend components into modular React hooks, reducing bundle size by 24% and improving initial page load speed.
    - Collaborated with cross-functional product teams to design and deploy automated integration test pipelines.
  ]
)

#entry(
  title: "WebScale Labs",
  role: "Frontend Engineering Intern",
  location: "Austin, TX",
  date: "May 2023 – Aug 2023",
  details: [
    - Implemented responsive user interface dashboards utilizing Next.js, Tailwind CSS, and TypeScript.
    - Integrated real-time WebSocket client notifications, increasing user dashboard engagement by 35%.
    - Authored comprehensive unit test suites using Vitest, achieving 90%+ code coverage across core utilities.
  ]
)

// EDUCATION
#section("Education")

#entry(
  title: "University of California, Berkeley",
  role: "Bachelor of Science in Computer Science",
  location: "Berkeley, CA",
  date: "Graduated May 2025",
  details: [
    - GPA: 3.8 / 4.0 | Relevant Coursework: Data Structures, Operating Systems, Database Systems.
  ]
)

// PROJECTS
#section("Projects")

#entry(
  title: "ResumeForge — Local-First AI Resume Workspace",
  role: "Creator & Lead Developer",
  location: "",
  date: "2026",
  details: [
    - Engineered a local-first desktop web workspace utilizing Next.js, CodeMirror 6, and Typst WASM compilation for instantaneous document rendering.
    - Integrated evidence-backed patch diff workflows ensuring 100% truthful resume variants.
  ]
)

// SKILLS
#section("Skills")
#entry(
  details: [
    - *Languages:* TypeScript, JavaScript, Python, Go, SQL, HTML/CSS
    - *Frameworks & Libraries:* React, Next.js, Node.js, Express, Tailwind CSS, Prisma
    - *Tools & Infrastructure:* Git, Docker, PostgreSQL, SQLite, Vitest, CI/CD Pipelines
  ]
)
