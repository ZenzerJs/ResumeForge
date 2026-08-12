# ResumeForge

> Local-first AI workspace that creates truthful, job-specific resume variants from one protected master resume.

ResumeForge empowers candidates to tailor their resume for specific job postings without compromising truthfulness or risking silent document overwrites. Every proposed modification is a reviewable, evidence-backed patch — nothing is invented, nothing is silently rewritten.

---

## Key Features

- **Master Resume & Evidence Bank**: A protected single source of truth storing verified work history, projects, skills, education, and metrics. Every resume bullet traces back to a verified evidence item — no hallucinated claims.
- **Job Requirement Extraction**: Import or paste job postings to automatically extract hard skills, soft skills, domain requirements, and role profiles into an editable requirements list.
- **Ranked Evidence Matching**: Automatically ranks your Evidence Bank against a target job description, surfacing which requirements are satisfied, which are gaps, and which bullets to reuse.
- **AI Patch Generator (BYOK)**: Generates evidence-grounded resume patches using your own OpenAI, Anthropic, or Gemini API key — all keys are scrubbed and processed client-side, never stored server-side.
- **ATS Quality Score Engine**: A deterministic, rule-based scoring engine (not just an LLM guess) that grades resume-to-job fit across base resume health, required/preferred skill match, and role-relevant evidence — plus an optional AI qualitative reviewer for bounded contextual feedback.
- **Tailored Cover Letter Generator**: Produces cover letters grounded strictly in your verified Evidence Bank, with inline citations back to the source achievements used.
- **Job Application Tracker**: A searchable, filterable pipeline for tracking saved/applied jobs, complete with per-job evidence-match scoring, notes, and status history.
- **Typst-Powered Resume Editor**: A three-pane editor (CodeMirror 6 source, live Typst WASM-compiled preview, AI Tailoring Assistant) with instant compilation, no server round-trip required.
- **Local-First & Privacy-Preserving**: All document compilation and AI-key handling happens client-side. Your resume and API keys never leave your machine.

---

## Tech Stack

- **Framework**: Next.js 15 (App Router) + React 19 + TypeScript
- **Styling**: Tailwind CSS + shadcn/ui, custom "Forge Terminal" dark design system (obsidian background, amber/emerald accents, glassmorphic panels)
- **Database**: SQLite (via Prisma ORM)
- **Document Engine**: Typst (`typst.ts` WASM browser compiler)
- **Code Editor**: CodeMirror 6
- **AI Integration**: BYOK gateway supporting OpenAI, Anthropic, and Gemini, with client-side key scrubbing
- **Testing**: Vitest (unit/integration) + Playwright (E2E)

---

## Getting Started

1. **Clone the repository**:
   ```bash
   git clone https://github.com/ZenzerJs/ResumeForge.git
   cd ResumeForge
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables**:
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   Fill in any required values (database URL, BYOK provider settings, etc.).

4. **Set up the database**:
   ```bash
   npx prisma migrate dev --name init
   ```

5. **Start the local development server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the local development server |
| `npm run build` | Generate Prisma client and build for production |
| `npm run start` | Start the production server |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run the TypeScript compiler in check-only mode |
| `npm run test` | Run the Vitest unit/integration suite |

---

## Project Structure Highlights

- `src/app/` — Next.js App Router pages (Editor, Evidence Bank, Jobs, Tailor, Settings)
- `src/components/` — UI components, including `landing/` (marketing page), `tracker/` (Job Tracker), and shared design-system primitives
- `src/lib/` — Shared utilities, including AI gateway logic and theme/animation config
- `prisma/` — Database schema and migrations
- `e2e/` / `tests/` — Playwright and Vitest test suites
- `DESIGN.md` / `PRODUCT.md` / `AGENTS.md` — Living documents describing the design system, product spec, and AI-agent working agreements for this repo

---

## Philosophy

ResumeForge is built around one rule: **truthfulness over persuasion**. The AI never invents experience — it only rephrases, restructures, or highlights what already exists in your verified Evidence Bank. Every AI-assisted change is a diffable, reviewable patch, and every score or recommendation traces back to a concrete, auditable reason.
