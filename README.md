<div align="center">

# 🛠️ ResumeForge

**Local-first AI workspace that creates truthful, job-specific resume variants from one protected master resume.**

[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Prisma](https://img.shields.io/badge/Prisma-PostgreSQL-2D3748?logo=postgresql&logoColor=white)](https://www.prisma.io/)
[![CI](https://github.com/ZenzerJs/ResumeForge/actions/workflows/ci.yml/badge.svg)](https://github.com/ZenzerJs/ResumeForge/actions/workflows/ci.yml)
[![Typst](https://img.shields.io/badge/Typst-WASM_Engine-239DAD)](https://typst.app/)
[![Tests](https://img.shields.io/badge/tests-Vitest_%2B_Playwright-6E9F18?logo=vitest&logoColor=white)](https://vitest.dev/)

*Evidence-grounded. Local-first. Every resume bullet is a reviewable, evidence-backed patch.*

<!-- TODO: Replace this screenshot with an animated demo GIF (docs/demo.gif)
     showing the full workflow: paste JD → generate patches → accept → preview PDF. -->
<img src="docs/screenshot.png" alt="ResumeForge landing page — evidence-grounded resume workspace with live Typst preview" width="800" />

> Built after a season of silent rejections as a first-year. This tool carried my own search into a Google technical interview as a second-year.

</div>

---

## 📋 Table of Contents

- [Why ResumeForge](#-why-resumeforge)
- [Key Features](#-key-features)
- [Architecture](#-architecture)
- [Tech Stack](#-tech-stack)
- [Getting Started](#-getting-started)
- [Available Scripts](#-available-scripts)
- [Project Structure](#-project-structure)
- [Philosophy](#-philosophy)

---

## 💡 Why ResumeForge

Most AI resume tools invent experience you don't have, or silently overwrite your master document. ResumeForge does neither:

| Problem with typical AI resume tools | How ResumeForge fixes it |
|---|---|
| ❌ LLM invents skills/metrics you never had | ✅ Every bullet traces back to a **verified Evidence Bank** item |
| ❌ Silent overwrites destroy your original resume | ✅ Your **Master Resume** is protected; changes are reviewable patches |
| ❌ Cloud AI providers see your resume + API keys | ✅ **Local-first, BYOK** — keys stay in your browser, AI calls go direct to your provider |
| ❌ "ATS score" is just an LLM guess | ✅ **Deterministic scoring engine** with auditable, rule-based checks |

---

### 🚫 What ResumeForge refuses to do

- **Never auto-submits** an application. You press the button.
- **Never stores your API keys server-side.** Keys live in your browser's local storage and are scrubbed from all server logs.
- **Designed to avoid inventing experience.** If a job requirement has no matching evidence, you get an explicit *Gap*, not a made-up bullet.
- **Never overwrites your master resume.** It is write-protected; every change is a reviewable patch.

---

## ✨ Key Features

<table>
<tr>
<td width="50%" valign="top">

### 🗂️ Master Resume & Evidence Bank
Protected single source of truth storing verified work history, projects, skills, education, and metrics. Every resume bullet traces back to a verified evidence item.

### 🎯 Job Requirement Extraction
Import or paste job postings to automatically extract hard skills, soft skills, domain requirements, and role profiles into an editable requirements list.

### 🔍 Ranked Evidence Matching
Automatically ranks your Evidence Bank against a target job description — surfacing satisfied requirements, gaps, and reusable bullets.

### 🤖 AI Patch Generator (BYOK)
Generates evidence-grounded resume patches using your own OpenAI, Anthropic, or Gemini key. Keys are scrubbed client-side, never stored server-side.

</td>
<td width="50%" valign="top">

### 📊 ATS Quality Score Engine
Deterministic, rule-based scoring across base resume health, required/preferred skill match, and role-relevant evidence — plus an optional bounded AI qualitative reviewer.

### ✉️ Tailored Cover Letter Generator
Produces cover letters grounded strictly in your verified Evidence Bank, with inline citations back to source achievements.

### 📌 Job Application Tracker
Searchable, filterable pipeline for saved/applied jobs with per-job evidence-match scoring, notes, and status history.

### 📝 Typst-Powered Resume Editor
Three-pane editor (CodeMirror 6 source, live Typst WASM preview, AI Tailoring Assistant) with instant client-side compilation.

</td>
</tr>
</table>

---

## 🏗️ Architecture

```mermaid
flowchart LR
    A[Master Resume<br/>Protected Source] --> B[Evidence Bank<br/>Verified Bullets]
    C[Job Posting] --> D[Requirement Extraction]
    B --> E[Ranked Evidence Matching]
    D --> E
    E --> F[AI Patch Generator<br/>BYOK Gateway]
    F --> G[Typst WASM<br/>Live Compile]
    E --> H[ATS Quality Score Engine]
    F --> I[Tailored Cover Letter]
    G --> J[(Tailored Resume Variant)]

    style A fill:#0b1326,stroke:#ff8c00,color:#fff
    style B fill:#0b1326,stroke:#4edea3,color:#fff
    style F fill:#0b1326,stroke:#ff8c00,color:#fff
    style H fill:#0b1326,stroke:#4edea3,color:#fff
```

AI calls route through a **BYOK gateway** — you supply your own API key, and it stays in your browser's local storage.

---

## 🧱 Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) + React 19 + TypeScript |
| Styling | Tailwind CSS + shadcn/ui — custom **"Forge Terminal"** dark design system (obsidian background, amber/emerald accents, glassmorphic panels) |
| Database | PostgreSQL 16 via Prisma ORM (`docker compose`) |
| Document Engine | Typst (`typst.ts` WASM browser compiler) |
| Code Editor | CodeMirror 6 |
| AI Integration | BYOK gateway — OpenAI, Anthropic, Gemini — client-side key scrubbing |
| Testing | Vitest (unit/integration) + Playwright (E2E) |

---

## 🚀 Getting Started

<details>
<summary><strong>1. Clone the repository</strong></summary>

```bash
git clone https://github.com/ZenzerJs/ResumeForge.git
cd ResumeForge
```
</details>

<details>
<summary><strong>2. Install dependencies</strong></summary>

```bash
npm install
```
</details>

<details>
<summary><strong>3. Configure environment variables</strong></summary>

```bash
cp .env.example .env
```

`DATABASE_URL` must be a Postgres URL. `APP_ACCESS_SECRET` signs the session cookie. Provider keys in this file are optional server fallbacks. The browser BYOK vault does not read them.
</details>

<details>
<summary><strong>4. Start Postgres, migrate, and seed</strong></summary>

```bash
docker compose up -d
npx prisma migrate deploy
npx prisma db seed
```

`docker compose` starts Postgres 16 on `127.0.0.1:5432` with user, password, and database `resumeforge`. Seed is idempotent.
</details>

<details>
<summary><strong>5. Start the local development server</strong></summary>

```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.
</details>

---

## 📜 Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the local development server |
| `npm run build` | Generate Prisma client and build for production |
| `npm run start` | Start the production server |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run the TypeScript compiler in check-only mode |
| `npm run test` | Run the Vitest unit/integration suite |
| `npm run check:env` | Fail if code reads a `process.env` name missing from `.env.example` |

---

## 📁 Project Structure

```
ResumeForge/
├── src/
│   ├── app/            # Next.js App Router pages (Editor, Evidence Bank, Jobs, Tailor, Settings)
│   ├── components/     # UI components — landing/, tracker/, shared design-system primitives
│   └── lib/            # AI gateway logic, theme/animation config, utilities
├── packages/
│   ├── core/src/       # Deterministic engines — scoring/ (ATS score), intel/
│   └── schema/src/     # Shared schemas/types
├── prisma/             # Database schema and migrations
├── e2e/ & tests/        # Playwright and Vitest test suites
├── DESIGN.md           # Design system reference
├── PRODUCT.md          # Product spec
└── AGENTS.md           # AI-agent working agreements for this repo
```

---

## 🎓 Philosophy

> **Truthfulness over persuasion.**

The AI is constrained to rephrase, restructure, or highlight what already exists in your verified Evidence Bank. Every AI-assisted change is a **diffable, reviewable patch**, and every score or recommendation traces back to a concrete, auditable reason.

<div align="center">

*Built by [@ZenzerJs](https://github.com/ZenzerJs)*

</div>
