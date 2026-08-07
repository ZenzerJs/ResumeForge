# ResumeForge — Product Specification

## 1. Product Vision

ResumeForge is a **local-first AI workspace** that generates truthful, job-specific resume variants from a single, protected master resume.

Job seekers today face a dilemma: submitting generic resumes leads to poor automated screening outcomes, while manually tailoring resumes for hundreds of applications is exhausting and prone to accidental inaccuracies or resume drift. Existing AI resume tools frequently fabricate experience, overwrite core records without user consent, or use shady keyword-stuffing tactics that degrade document quality.

ResumeForge solves this by establishing a strict, evidence-backed patch workflow:
1. The user maintains a verified **Master Resume** and **Evidence Bank**.
2. For each application, ResumeForge ingests the **Job Description** and extracts requirements.
3. An AI agent proposes targeted, structured **Patches** (diffs) citing verified evidence items.
4. The user accepts or rejects each proposed patch.
5. The result is a tailored, one-page **Resume Variant** rendered cleanly using Typst.

---

## 2. Core Non-Negotiable Rules

These ten rules govern all design and development decisions across ResumeForge:

1. **Master Protection**: AI can never silently overwrite a master resume.
2. **Patch-Only Output**: AI may only propose structured patches/diffs, never unreviewed full rewrites.
3. **Strict Truthfulness**: AI must never invent experience, employers, metrics, technologies, skills, education, or accomplishments not present in the verified evidence bank.
4. **Traceable Citations**: Every resume claim must be traceable to a verified evidence item.
5. **No ATS Gaming**: No hidden text, white text, keyword stuffing, or cheat codes anywhere in generated output.
6. **Zero Plaintext Secrets**: API keys must never be committed to git, logged, or stored in plaintext in the database.
7. **Local-First & BYOK**: V1 is local-first, single-user, and Bring-Your-Own-Key (BYOK). No cloud sync, no auth, no analytics, no telemetry.
8. **Intership-Focused 100-Point ATS Rubric**: Base resume quality + job-specific match + role profile equal exactly 100 base points before optional bonus points. Every category weight must have a clear rationale.
9. **One-Page Constraint**: One-page target is the default; multi-page layouts require explicit user override.
10. **Scope Discipline**: Implementers must not build beyond the task assigned to them. No feature may be added "while I was in there."

---

## 3. Core Features (Scope Expanded per ADR-010 & ADR-011)

The ResumeForge workspace consists of eight core modules:

### Feature 1: Master Resume Workspace
- Single source of truth containing contact info, summary, education, experience bullets, projects, and skills.
- Protected master view with version snapshots (`MasterHistory`) and instant Undo/Revert safety controls.

### Feature 2: Verified Evidence Bank
- Repository of detailed accomplishment items, project artifacts, measurable metrics, and verified skill usages.
- Tagged with technologies, metrics, dates, and evidence confidence levels.

### Feature 3: Job Description Input & Parser
- Interface to paste job description text or fetch web posting links.
- Structured parser output extracting required skills, experience levels, responsibilities, and role profiles (backend, frontend, AI/ML, data).

### Feature 4: Rule-Based Requirement Matcher
- Deterministic analysis comparing job requirements against Evidence Bank tags.
- Categorizes requirements into: Strong Match, Partial Match, Unverified Gap.

### Feature 5: AI Tailoring & Review Interface
- LLM prompt runner generating structured patch objects.
- Side-by-side diff view allowing item-by-item accept/reject/edit controls before applying to variant.

### Feature 6: ATS Evaluation Panel & Typst Export
- Real-time 100-point rubric score breakdown.
- Live Typst WASM preview and one-click PDF export tailored to a single page.

### Feature 7: Two-Tier Job Ingestion & Application Tracker (Added per ADR-010)
- **Tier 1 Bulk Ingestion**: Manual, on-demand import of structured job listing feeds (SimplifyJobs snapshots) into `Job` records with deduplication.
- **Tier 2 Best-Effort Fetch**: On-demand extraction of full job text when opening postings, with graceful fallback to manual text paste.
- **Indeed/Glassdoor Feed UI**: Vertical feed layout with status tracking (`SAVED`, `APPLIED`, `INTERVIEWING`, `OFFER`, `REJECTED`), separate click zones (title → external posting; actions → internal tailor/cover-letter workflows), and `useActiveJob` persistence.

### Feature 8: Evidence-Grounded Cover Letter Generator (Added per ADR-011)
- On-demand generation of tailored cover letters linked directly to `jobId`.
- Enforces strict zero-hallucination citation guardrail: every claim MUST cite verified Evidence Bank items.
- Explicit gap reporting for unsupported job requirements.

---

## 4. Out of Scope for V1

The following features are explicitly deferred to post-V1 phases:

- Multi-user authentication & user accounts
- Cloud database sync & remote storage
- Background automated scheduled scrapers or auto-polling (on-demand manual refresh only per ADR-010)
- Automated job application submitting bots
- Analytics, telemetry, or user tracking
- Collaborative multi-user editing
- LaTeX or Markdown PDF compilers (Typst is the locked compiler)
