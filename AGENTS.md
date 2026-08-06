# AGENTS.md — AI Engineering Guidelines for ResumeForge

Welcome, AI Agent (Gemini, Claude, GPT, or custom subagent).

This repository is governed by strict architecture, security, and scoping rules. You must read and follow these guidelines unconditionally on every turn and task.

---

## Mandatory Pre-Task Context Checklist

BEFORE writing any code, modifying schemas, or planning tasks, you MUST read the following foundational documents in full:

1. [`docs/phase-status.md`](docs/phase-status.md) — Current phase, recent progress, open limitations, and current task focus.
2. [`docs/decisions.md`](docs/decisions.md) — Architecture Decision Records (ADRs) and design trade-offs.
3. [`docs/architecture.md`](docs/architecture.md) — System module boundaries, data flows, and architectural constraints.
4. [`docs/ai-guardrails.md`](docs/ai-guardrails.md) — AI patch object schema, evidence citation rules, and gap handling contracts.

---

## Core Scoping Discipline

- **Strict Task Boundaries**: Implement ONLY the task assigned to you. Do NOT add extra utilities, refactor adjacent modules, or build unrequested features "while you were in there."
- **No Speculation**: Never guess file paths, schema structures, or variable names. Inspect existing source files using code viewing tools before writing code.
- **No Silent Overwrites**: You must never modify master data records without explicit user confirmation.

---

## Required Pre-Completion Checks

Never mark a task complete or report success to the user until ALL of the following automated verification checks pass cleanly:

```bash
npm run lint       # ESLint rules check
npm run typecheck  # TypeScript compilation check (tsc --noEmit)
npm run test       # Vitest unit & smoke tests
npm run build      # Prisma compilation and Next.js build
```

If any check fails, you must diagnose the full, un-truncated error log, fix the root cause, and re-run all checks until they pass.

---

## Playwright & Execution Reporting Discipline

- **Subagent Delegation for Playwright**: Always delegate Playwright test execution (`npx playwright test`) to a dedicated subagent to monitor and report test status.
- **No Premature Reporting**: Never state that commands or tests ran without error if they are still executing in the background. State in-progress status explicitly until completion notification is received.
- **Unbiased Transparency on Failures**: Always act as an unbiased marker. If any test or command fails during development (such as an interim timeout or parsing error), explicitly report the failure, root cause diagnosis, code fix applied, and final re-test verification status.

---

## Mandatory Post-Phase Walkthrough Artifact

After completing any phase or major implementation task, you MUST write or update a comprehensive `walkthrough.md` artifact (in `<appDataDir>\brain\<conversation-id>/walkthrough.md`) detailing:
1. Deliverable Summary of implemented features
2. Full list of created/modified files
3. Automated verification test results (`lint`, `typecheck`, `test`, `build`)
4. Known limitations and deferred scope items
5. Suggested next task


---

## The Patch-Only AI Contract

When writing code or prompts for AI modules:
1. Output MUST strictly conform to the `Patch` object schema defined in [`docs/ai-guardrails.md`](docs/ai-guardrails.md).
2. Every change MUST cite valid `evidenceIds` from the user's Evidence Bank.
3. If a job requirement cannot be matched to verified evidence, return an explicit `Gap` item — NEVER invent or hallucinate experience.

---

## Environment & Secrets Safety

- Never write API keys, tokens, or plaintext credentials into `.env`, code, database models, or log outputs.
- Read settings from environment variables or OS keychain references only.
