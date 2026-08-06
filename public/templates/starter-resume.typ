// ResumeForge Starter One-Page Resume Template (Typst)

#set page(
  paper: "us-letter",
  margin: (x: 1.5cm, y: 1.5cm),
)

#let section(title) = {
  v(3pt)
  text(weight: "bold", size: 11pt, fill: rgb("#0f172a"))[#title]
  v(-4pt)
  line(length: 100%, stroke: 0.5pt + rgb("#cbd5e1"))
  v(1pt)
}

// HEADER
#align(center)[
  #text(size: 18pt, weight: "bold", fill: rgb("#0f172a"))[Alex Morgan] \
  #v(2pt)
  #text(size: 9pt, fill: rgb("#475569"))[
    San Francisco, CA | alex.morgan\@example.com | (555) 019-2834 | github.com/alexmorgan | linkedin.com/in/alexmorgan
  ]
]

#v(4pt)

// SUMMARY
#section("Professional Summary")
Full-stack software engineer with 3+ years of experience building performant web applications, scalable APIs, and developer tooling. Proven track record of improving system reliability and optimizing end-user experiences.

// SKILLS
#section("Technical Skills")
*Languages:* TypeScript, JavaScript, Python, Go, SQL, HTML/CSS \
*Frameworks & Libraries:* React, Next.js, Node.js, Express, Tailwind CSS, Prisma \
*Tools & Infrastructure:* Git, Docker, PostgreSQL, SQLite, Vitest, CI/CD Pipelines

// EXPERIENCE
#section("Work Experience")

*Software Engineer Intern* #h(1fr) *TechCorp Systems* \
_Jun 2024 – Present_ #h(1fr) _San Francisco, CA_
- Developed high-throughput REST and GraphQL API endpoints serving over 100k daily active requests with sub-100ms response latency.
- Refactored legacy frontend components into modular React hooks, reducing bundle size by 24% and improving initial page load speed.
- Collaborated with cross-functional product teams to design and deploy automated integration test pipelines.

*Frontend Engineering Intern* #h(1fr) *WebScale Labs* \
_May 2023 – Aug 2023_ #h(1fr) _Austin, TX_
- Implemented responsive user interface dashboards utilizing Next.js, Tailwind CSS, and TypeScript.
- Integrated real-time WebSocket client notifications, increasing user dashboard engagement by 35%.
- Authored comprehensive unit test suites using Vitest, achieving 90%+ code coverage across core utilities.

// PROJECTS
#section("Key Projects")

*ResumeForge — Local-First AI Resume Workspace* #h(1fr) _2026_
- Engineered a local-first desktop web workspace utilizing Next.js, CodeMirror 6, and Typst WASM compilation for instantaneous document rendering.
- Integrated evidence-backed patch diff workflows ensuring 100% truthful resume variants.

*DataPulse — Metrics Analytics Dashboard* #h(1fr) _2024_
- Built a high-performance web dashboard displaying real-time server telemetries with interactive charts and custom alerting rules.

// EDUCATION
#section("Education")

*Bachelor of Science in Computer Science* #h(1fr) *University of California, Berkeley* \
_Graduated May 2025_ #h(1fr) _GPA: 3.8 / 4.0_
