# ResumeForge

> Local-first AI workspace that creates truthful, job-specific resume variants from one protected master resume.

ResumeForge empowers candidates to tailor their resume for specific job postings without compromising truthfulness or risking silent document overwrites. Every proposed modification is a reviewable, evidence-backed patch.

---

## Key Features (V1 Roadmap)

- **Master Resume & Evidence Bank**: Protected single source of truth storing verified work history, projects, skills, education, and metrics.
- **Job Requirement Extraction**: Import or paste job postings to extract hard skills, soft skills, domain requirements, and role profiles.
- **Rule-Based & AI Matcher**: Compare job requirements directly against your verified evidence bank to highlight candidate strengths and missing experience.
- **Structured Patch Diffs**: Review AI-proposed bullet/section tweaks as structured diffs (accept/reject per item). AI can never silently overwrite the master resume or invent false claims.
- **ATS Quality Evaluator**: Internship-focused 100-point rubric assessing base resume quality, job-specific match, and role-profile depth.
- **Typst Document Preview & Export**: Fast, precise, web-native compilation via WASM to high-quality PDF resume variants.

---

## Tech Stack

- **Framework**: Next.js 15 (App Router) + React 19 + TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **Database**: SQLite (via Prisma ORM)
- **Document Engine**: Typst (`typst.ts` WASM browser compiler)
- **Code Editor**: CodeMirror 6
- **AI Gateway**: Bring-Your-Own-Key (BYOK) — supporting OpenAI, Anthropic, Gemini, or local OpenAI-compatible proxies (Ollama/FreeLLMAPI).

---

## Local Development Setup

### Prerequisites

- **Node.js**: v18.0.0 or higher (v24+ recommended)
- **npm**: v9.0.0 or higher

### Installation

1. **Clone Repository**:
   ```bash
   git clone https://github.com/user/ResumeForge.git
   cd ResumeForge
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

4. **Initialize Local Database**:
   ```bash
   npx prisma migrate dev --name init
   ```

5. **Start Local Development Server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Quality Gates & Verification Scripts

ResumeForge enforces strict quality gates on every commit and phase deliverable:

- `npm run lint` — Runs ESLint to check for code style issues.
- `npm run typecheck` — Executes TypeScript compiler check (`tsc --noEmit`).
- `npm run test` — Executes Vitest suite.
- `npm run build` — Compiles Prisma client and verifies production Next.js build.

---

## Phase Status

Currently at **Phase 0** (Scaffold & Repository Architecture Foundation).
See [`docs/phase-status.md`](docs/phase-status.md) for full project roadmap and execution status.
