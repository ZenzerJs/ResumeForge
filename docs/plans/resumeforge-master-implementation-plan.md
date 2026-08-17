# ResumeForge — Antigravity Master Implementation Plan (WS0–WS5)

Source Document: `C:\Users\jayde\Downloads\resumeforge-antigravity-implementation-plan.html`

## Phase Architecture Breakdown

### Phase 1: WS0 — Critical UX Bug Fixes (P0)
- **WS0.1**: Editor header flex column layout fix (`top-nav.tsx`, `editor-workspace.tsx`, `editor/page.tsx`, `editor-workspace-skeleton.tsx`).
- **WS0.2**: Staged AI progress component (`src/components/ui/ai-progress.tsx`) replacing bare spinners in `ai-sidebar.tsx` and `tailor-workspace.tsx`.
- **WS0.3**: Landing marquee seamless loop fix (`src/components/landing/capability-marquee.tsx`, `src/app/globals.css`).

### Phase 2: WS1 — Job Ingest Taxonomy, Normalizer & AI Formatter (P1)
- **WS1.1**: `ExtractFailureCode` taxonomy and instrumentation (`src/lib/ingestion/types.ts`, `/api/jobs/extract`, `tier2-fetcher.ts`).
- **WS1.2**: Policy-compliant adapter order (ATS JSON -> Partner API -> User Paste -> Robots allowed URL). Strict Indeed/LinkedIn TOS compliance.
- **WS1.3**: `NormalizedJob` schema & transformer (`src/lib/ingestion/normalize-job.ts`).
- **WS1.4**: AI JD structured formatter (`src/lib/ai/jd-format-schema.ts`, `src/lib/ai/jd-format-prompt.ts`).

### Phase 3: WS2 — Discover Filters, Geocoding, Radius & Blended Sort (P1)
- **WS2.1**: Extended search filters (seniority, employment type, remote, posted within, salary, radius).
- **WS2.2**: Location typeahead suggest API (`/api/geo/suggest/route.ts`) with Canada bias.
- **WS2.3**: Haversine distance calculation and radius filtering.
- **WS2.4**: Blended compound ranking (`src/lib/jobs/rank-discovered.ts`).

### Phase 4: WS3 — Evidence-Bank Compatibility Filter (P1)
- **WS3.1**: Deterministic 0-LLM compatibility evaluation using `src/lib/matching/matcher.ts`.
- **WS3.2**: Compatibility badge on job cards and "Best fit" filter chip.

### Phase 5: WS4 — Tailor Auto-Rescan & Target Role Profile Swap (P2)
- **WS5.1**: Active job change event triggers auto-normalization, skill match, and profile swap in `src/hooks/use-active-job.ts` & `tailor-workspace.tsx`.
- **WS5.2**: Rescan idempotency key (`lastScannedJobHash`), progress banner, and undo option.

### Phase 6: WS5 — Tailor Information Architecture: Overview vs Job Information (P2)
- **WS6.1**: Dual-view switcher (**Overview** | **Job Information**) with `localStorage` persistence.
- **WS6.2**: Overview view (compact score, gaps, top 5 evidence, patches) vs Job Information view (full formatted JD, tools, raw text).

---

## Verification & Execution Rule
Each phase will be executed with pre-completion automated checks:
`npm run lint && npm run typecheck && npm run test && npm run build && npx playwright test`
followed by a dedicated walkthrough record (`walkthrough_wsX.md`).
