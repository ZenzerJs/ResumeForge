<div align="center">

# 🛠️ ResumeForge

**Self-hostable, BYOK AI workspace that creates evidence-grounded, job-specific resume variants from one protected master resume.**

[![CI](https://github.com/ZenzerJs/ResumeForge/actions/workflows/ci.yml/badge.svg)](https://github.com/ZenzerJs/ResumeForge/actions/workflows/ci.yml)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Prisma](https://img.shields.io/badge/Prisma-PostgreSQL-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![Typst](https://img.shields.io/badge/Typst-WASM_Engine-239DAD)](https://typst.app/)
[![Tests](https://img.shields.io/badge/tests-Vitest_%2B_Playwright-6E9F18?logo=vitest&logoColor=white)](https://vitest.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

*Zero hallucination. Zero data leaks. Every resume bullet is a reviewable, evidence-backed patch.*

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
| ❌ LLM invents employers, seniority, dates, or metrics | ✅ **Mechanical guardrail** hard-blocks fabricated employers, inflated titles/dropped level markers, widened dates (ISO month-level containment, with year-level fallback when months are omitted), and inflated or subject-swapped metrics against your frozen Master Resume snapshot |
| ❌ Silent overwrites destroy your original resume | ✅ Your **Master Resume** is write-protected; changes are reviewable patches written to isolated variants |
| ❌ Opaque third-party key storage | ✅ **Self-hostable, BYOK** — keys are AES-GCM encrypted in browser `localStorage`; the app does not store or log request bodies or keys in Postgres |
| ❌ "ATS score" is just an LLM guess | ✅ **Deterministic scoring engine** with auditable, rule-based checks |

---

### 🚫 What ResumeForge refuses to do

- **Never auto-submits** an application. You press the button.
- **Never persists your API keys in the database.** Keys are encrypted in browser `localStorage` or read from server environment variables; the app does not store or log request bodies or keys.
- **Never invents experience.** If a job requirement has no matching evidence, you get an explicit *Gap*, not a made-up bullet. Unverified skills are flagged as soft warnings and require explicit per-skill acknowledgement before an AI patch can add them.
- **Never overwrites your master resume silently.** It is write-protected; every change is a reviewable patch, and exporting a tailored or AI-patched variant fails closed unless a frozen Master Resume snapshot exists.

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
Generates evidence-grounded resume patches using your own OpenAI, Anthropic, Gemini, or Groq key. The app does not store or log request bodies or keys.

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
    F --> G[Mechanical Guardrail<br/>Employers / Titles / Dates / Metrics]
    G --> H[Typst WASM<br/>Live Compile]
    E --> I[ATS Quality Score Engine]
    F --> J[Tailored Cover Letter]
    H --> K[(Tailored Resume Variant)]

    style A fill:#0b1326,stroke:#ff8c00,color:#fff
    style B fill:#0b1326,stroke:#4edea3,color:#fff
    style F fill:#0b1326,stroke:#ff8c00,color:#fff
    style G fill:#0b1326,stroke:#ff8c00,color:#fff
    style I fill:#0b1326,stroke:#4edea3,color:#fff
```

Typst compilation (`typst.ts` WASM) runs client-side in the browser. Browser BYOK calls to OpenAI, Anthropic, and Groq route through an authenticated same-origin relay (`/api/ai/byok-proxy`) restricted to allowlisted HTTPS provider endpoints; the app does not store or log request bodies or keys (note that the underlying hosting platform may log HTTP metadata).

---

## 🧱 Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) + React 19 + TypeScript |
| Styling | Tailwind CSS + shadcn/ui — custom **"Forge Terminal"** dark design system (obsidian background, amber/emerald accents, glassmorphic panels) |
| Database | PostgreSQL 16 via Prisma ORM (`docker compose`) |
| Document Engine | Typst (`typst.ts` WASM browser compiler) |
| Code Editor | CodeMirror 6 |
| AI Integration | BYOK gateway — OpenAI, Anthropic, Gemini, Groq — AES-GCM browser vault & error redaction |
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
| `npm run generate:fixtures` | Regenerate the synthetic PDF test fixture (`e2e/fixtures/sample-resume.pdf`) |

---

## 📁 Project Structure

```
ResumeForge/
├── src/
│   ├── app/            # Next.js App Router pages & API routes
│   ├── components/     # UI components — editor/, tailor/, tracker/, design-system/
│   └── lib/            # Mechanical guardrail, facts extractor, BYOK vault, security guards
├── packages/
│   ├── core/src/       # Deterministic engines — scoring/ (ATS score), intel/
│   └── schema/src/     # Shared schemas/types
├── prisma/             # PostgreSQL schema and migrations
├── e2e/ & tests/       # Playwright and Vitest test suites
├── DESIGN.md           # Design system reference
├── PRODUCT.md          # Product spec
├── SECURITY.md         # Threat model and security controls
└── AGENTS.md           # AI-agent working agreements for this repo
```

---

## 🎓 Philosophy & Disclosure

> **Truthfulness over persuasion.**

The AI never invents experience — it only rephrases, restructures, or highlights what already exists in your verified Evidence Bank. Every AI-assisted change is a **diffable, reviewable patch**, and every score or recommendation traces back to a concrete, auditable reason.

*Developed with AI coding assistants (Cursor, Antigravity). The author designed the architecture, product spec and guardrail policy, and reviews and validates changes.*

<div align="center">

*Built by [@ZenzerJs](https://github.com/ZenzerJs) · [MIT License](LICENSE)*

</div>
