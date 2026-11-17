# Surface Briefs

Concise surface contracts for the Home checklist, Typst editor review markers, Settings provider onboarding, and Tailor task navigation. These briefs record verified implementation invariants without altering `DESIGN.md`.

---

## 1. Home Setup Checklist (`/`, `src/components/landing/home-landing.tsx`)

The onboarding checklist presents a four-step workspace setup sequence under the heading `"Prepare your workspace for truthful tailoring."` Progress (`completedCount / 4`, `progressPct`) is computed strictly by `computeOnboardingChecklistState`:

| Step | Label | Completion Predicate | Copy & Sample Handling |
|---|---|---|---|
| 1 | **Create or import your resume** | `stats.hasMasterResume \|\| hasLocalResume` (`hasLocalPersonalResume` on `resumeforge_typst_source`, requiring non-starter text `trim().length > 30`) | No master-freeze claim. CTAs: `Upload PDF`, `Visual Builder` (`/editor?mode=visual`). |
| 2 | **Verify your first evidence item** | `stats.verifiedEvidenceCount > 0 \|\| guestEvidence.personalVerifiedCount > 0` | `parseGuestEvidenceSummary` on `resumeforge_guest_evidence` counts only items with `status === "verified"` and excludes `demo-sample-` fixtures. Draft, archived, missing-status, and malformed entries remain incomplete. Sample-only state displays `"Synthetic sample available · verify your own item"`. |
| 3 | **Add your AI provider key** | `Boolean(hasAiKey) && !aiKeyless` (from `getActiveConfig()`) | Keyed state CTA reads `"Key saved · Manage"` (never `"Connected"` or `"Test passed"`). Keyless local providers (`aiKeyless`) show `"Local provider selected; test in Settings"` with CTA `"Open Settings"`. |
| 4 | **Add a target job** | `Boolean(stats.hasTargetJob \|\| guestJobs.personalCount > 0)` | Server `hasTargetJob` (`src/lib/db/stats.ts`) checks for a viewer-owned `Job` or tracked `JobApplication`. `parseGuestJobsSummary` on `resumeforge_guest_jobs` requires `id` plus non-empty `rawDescription`, `roleTitle`, or `company`, excluding `demo-sample-` fixtures (which show `"Synthetic sample available · save your own job"`). Body: `"Save a job description, then open Tailor to review matches and proposed edits."` Does not imply a reviewed variant or submission readiness. |

---

## 2. Verification Terminology Rule (`/editor` & `/library`, `src/components/editor/code-editor.tsx`)

- **Terminology boundary:** `"Verified evidence"` refers exclusively to the Evidence Bank workflow (`/library`, `src/components/library/library-workspace.tsx`) where `EvidenceItem` and bullet records are verified.
- **Source review markers:** The Typst Source toolbar action `"Add review marker"` (`insertReviewMarkerInView`) inserts a plain dated source comment (`// Reviewed: YYYY-MM-DD`). It issues zero Evidence Bank API requests, changes no `EvidenceItem` status, and creates no citations.
- **Accessible help & counter:** Accessible description/tooltip reads `"Insert a dated source comment. This does not verify Evidence Bank items or create citations."` Counter text reads `"1 review marker"` / `"N review markers"` (`formatReviewMarkerCount`). Legacy `// ✓ @verified:...` comments remain valid Typst comments with no bulk migration.
- **Editor toolbar wrapping contract:** `Visual Form` mode keeps `md:h-8 md:flex-nowrap` on the pane toolbar to preserve the 32px desktop chrome budget (within the 128px `/editor` top budget). `Typst Source` mode (`editorMode === "code"`) uses `min-h-8 flex-wrap` with `gap-1.5` and `md:py-1` (without `md:h-8`, `md:flex-nowrap`, or `md:overflow-x-auto`) so `Visual Form`, `Typst Source`, `Entry`, `N review markers`, `Add review marker`, and `Reformat draft` remain unclipped across `375×812`, `768×1024`, `1280×800`, and `1440×900`.

---

## 3. Settings Provider Onboarding (`/settings`, `src/components/settings/settings-workspace.tsx`)

### Main Setup Sequence

1. **Provider** (`#provider-select`): Choose Google Gemini, OpenAI, Anthropic, Groq, or (when not in demo mode) Ollama / Custom OpenAI-compatible endpoint.
2. **Contextual prerequisite & key link** (`data-testid="provider-help"`): For cloud providers, renders `whatIsNeeded`, a `"Get an API key"` external link (`target="_blank" rel="noopener noreferrer"`), and `Account & billing` prerequisites directly above the key input.
3. **API key / required endpoint**:
   - `#api-key-input` (hidden for Ollama; optional for Custom) with client-side AES-GCM vault indicator (`[data-testid="vault-status"]`), kept distinct from connection-test status.
   - Required endpoint (`#base-url-input`, `data-testid="ollama-endpoint"`) rendered outside `Advanced` whenever `provider === "ollama"` (with `"Local daemon endpoint (no API key required)"`) or `provider === "custom"`.
4. **Test connection & result**: `#test-connection-btn` (`"Test Connection"`) and `#test-result-banner` (`"Connection Verified"` / `"Connection Failed"`).

### Required vs. Optional Fields

- **Always visible when required:** Provider selector; cloud API key (`#api-key-input`); Ollama Endpoint (`http://localhost:11434`); Custom Endpoint Base URL (`http://localhost:8000`).
- **Collapsed `Advanced` disclosure (`<details data-testid="advanced-settings-disclosure">`):** Houses optional `Model Name` (`#model-input`, falling back to `DEFAULT_MODELS`) and, for `openai`, optional `Endpoint Base URL` override (`placeholder="https://api.openai.com"`). Auto-expands on load or provider selection when `hasNonDefaultAdvancedConfig(provider, model, baseUrl)` is true; expanding/collapsing never resets field values.

### Verified Cloud Provider URLs & Prerequisites (Verified `2026-11-17`)

| Provider | Official Key URL | Verified Prerequisites Summary |
|---|---|---|
| Google Gemini | `https://aistudio.google.com/app/apikey` | Google account + Google AI Studio key; rate-limited Free tier requires no credit card (prompts may be used to improve Google products); higher limits and private data handling require a linked Google Cloud billing account. |
| OpenAI | `https://platform.openai.com/api-keys` | Separate from ChatGPT subscription; requires an OpenAI Platform organization with a payment method and prepaid API billing credits. |
| Anthropic | `https://platform.claude.com/settings/keys` | Separate from consumer Claude plans; requires a Claude Console organization with prepaid usage credits in Billing. |
| Groq | `https://console.groq.com/keys` | GroqCloud account + key; rate-limited Free tier requires no credit card; Developer tier requires a payment method in Billing. |

---

## 4. Tailor Task Sequence (`/tailor`, `src/components/tailor/tailor-workspace.tsx`)

The Tailor flow guides applicants through **Job → Matches and gaps → Review edits → Export** without forcing a rigid multi-page wizard.

### Primary Destinations & Secondary Tools

- **Primary destinations (`TAILOR_PRIMARY_TABS`, `role="tablist"`):**
  1. `Job` (`id="tailor-tab-job-info"`, query `?tab=job-info`, default) — job description input, extracted requirements, and matches/gaps in one context, with extraction diagnostics inside a disclosure.
  2. `Review edits` (`id="tailor-tab-3-pane"`, query `?tab=3-pane`) — patch diff decisions, evidence citations, preview, ATS details, and export controls.
- **Secondary `More tools` menu (`TAILOR_MORE_TOOLS`, `data-testid="tailor-more-tools-trigger"`):**
  - `Overview` (`?tab=overview`, `data-testid="tailor-tool-overview"`)
  - `Cover letter` (`?tab=cover-letter`, `data-testid="tailor-tool-cover-letter"`)
  - `Diagnostics` (`?tab=diagnostic`, `data-testid="tailor-tool-diagnostic"`)
  - When a secondary tool is active, `aria-selected` stays `false` on both primary tabs, and `data-testid="tailor-secondary-tool-banner"` identifies the active tool with `← Job` and `Review edits →` escape actions.

### URL Compatibility, `previousTab`, and Small-Screen Layout

- **Legacy `?tab=` compatibility & fallback:** `normalizeTailorTabParam` accepts all five legacy values (`job-info`, `3-pane`, `overview`, `cover-letter`, `diagnostic`) and falls back to `"job-info"` (`Job`) for missing or unknown values.
- **`previousTab` behavior:** `createInitialTailorNavigationState` initializes `previousTab: null` so a fresh direct load never renders a spurious Back button. `transitionTailorNavigation` sets `previousTab` only when invoked with `{ preserveReturnRoute: true }`, rendering `← Back to <Tool>` via `getTailorBackLabel`.
- **Small-screen (375px+) single-row primary bar order:** The navigation container (`flex flex-wrap items-center gap-2`) places the compact two-tab pill (`[ Job | Review edits ]`) followed immediately by `More tools ▾` so all primary destinations and secondary-tool access sit left-to-right on a single row from 375px upward.
