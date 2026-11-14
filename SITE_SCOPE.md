# ResumeForge — Live Website & Visual Scoping (`SITE_SCOPE.md`)

> Read-only Track A audit of routes, views, design tokens, "2022–2024 dev-tool" tells, accessibility, and layout bottlenecks.

---

## 1. Route & View Inventory

### 1.1 App Router Pages, Layouts & Boundaries (`src/app/`)

| Route | File (`file:line`) | Shell / Layout | Primary Component & Behavior |
| :--- | :--- | :--- | :--- |
| **Root Layout** | `src/app/layout.tsx:31-98` | `<html lang="en" className="dark">` (`line 58`), skip-link `#main-content` (`line 66`), `<GuestMigrationModal />` (`line 92`), `<KeyboardShortcutsModal />` (`line 93`) | Loads `Hanken_Grotesk` (`400, 600, 700`) and `JetBrains_Mono` (`400, 600`) (`lines 6-23`). |
| **Root Loading / Error / 404** | `src/app/loading.tsx:1-5`<br>`src/app/error.tsx:1-84`<br>`src/app/not-found.tsx:1-55` | `PageSkeleton` (`variant="workspace"`); standalone dark error/404 views (`bg-[#0b1326]`) | `error.tsx:34` renders `ErrorBoundary // Runtime Exception`; `not-found.tsx:22` renders `404 // Route Not Found`. |
| `/` (Landing) | `src/app/page.tsx:1-14` | `HomeLanding` (`src/components/landing/home-landing.tsx:157-733`) | `<TopNav variant="landing">`, `<LandingAtmosphere>` (`AsciiWaves`), Hero (`StaggeredText` + `ProductProofCard`), `<CapabilityMarquee>`, `<AtsSandboxSection>`, `<CompetitiveMatrixSection>`, 3-card Bento grid, `<LandingFooter>`. |
| `/login` | `src/app/login/page.tsx:1-18` | `<AppShell variant="quiet">` (`login-form.tsx:177`) | `LoginForm` (`src/components/auth/login-form.tsx:31-361`) — Sign In / Create Account tabs, OAuth (GitHub/Google), demo mode fallback, or password-gate unlock. |
| `/editor` | `src/app/editor/page.tsx:1-16`<br>`src/app/editor/loading.tsx:1-5` | `<AppShell variant="editor">` (`editor-workspace.tsx:788`)<br>`EditorWorkspaceSkeleton` (`editor-workspace-skeleton.tsx:79-233`) | `EditorWorkspace` (`src/components/editor/editor-workspace.tsx:91-1265`) — 3-pane resizable IDE (`CodeEditor` / `ResumeFormBuilder` + `PreviewPanel` Typst WASM SVG preview + `AiSidebar` / `AiAssistantWindow`). |
| `/tailor` | `src/app/tailor/page.tsx:1-17`<br>`src/app/tailor/loading.tsx:1-5` | `<AppShell variant="tailor">` (`tailor-workspace.tsx:762`) | `TailorWorkspace` (`src/components/tailor/tailor-workspace.tsx:66-1781`) — 5-tab workspace (`Overview`, `Workspace` 3-pane, `Job info` with 3 subtabs, `Cover Letter`, `Diagnostics`). |
| `/tracker` | `src/app/tracker/page.tsx:1-10`<br>`src/app/tracker/loading.tsx:1-5` | `<AppShell variant="tracker">` (`tracker-feed.tsx:598`) | `TrackerFeed` (`src/components/tracker/tracker-feed.tsx:109-1051`) — Split-view (`JobListRow` + `JobDetailPane`) and Kanban board (`SAVED`, `APPLIED`, `INTERVIEWING`, `OFFER`, `REJECTED`). |
| `/tracker/feed` | `src/app/tracker/feed/page.tsx:1-10`<br>`src/app/tracker/feed/loading.tsx:1-5` | `<AppShell variant="tracker" layout="page">` (`discover-feed.tsx:362`) | `DiscoverFeed` (`src/components/tracker/discover-feed.tsx:154-904`) — Connector discovery feed with filters, `FitPercentageDial`, `JobCardSignalBadge`, and `TechDiffPillList`. |
| `/tracker/applied` | `src/app/tracker/applied/page.tsx:1-14`<br>`src/app/tracker/applied/loading.tsx:1-5` | `<AppShell variant="tracker">` | `<TrackerFeed filterStatuses={["APPLIED", "INTERVIEWING", "OFFER", "REJECTED"]} />`. |
| `/tracker/saved` | `src/app/tracker/saved/page.tsx:1-10`<br>`src/app/tracker/saved/loading.tsx:1-5` | `<AppShell variant="tracker">` | `<TrackerFeed filterStatuses={["SAVED"]} />`. |
| `/tracker/outcomes` | `src/app/tracker/outcomes/page.tsx:1-10` | `<AppShell variant="tracker" layout="page">` (`outcomes-panel.tsx:45`) | `OutcomesPanel` (`src/components/tracker/outcomes-panel.tsx:26-115`) — Pipeline funnel bars & variant interview rate table. |
| `/tracker/discover` | `src/app/tracker/discover/page.tsx:1-6` | Redirect only | Calls `redirect("/tracker/feed")`. |
| `/discover` | `src/app/discover/page.tsx:1-6`<br>`src/app/discover/loading.tsx:1-5` | Redirect only | Calls `redirect("/tracker/feed")` (`discover/loading.tsx` is dead code). |
| `/library` | `src/app/library/page.tsx:1-10`<br>`src/app/library/loading.tsx:1-5` | `<AppShell variant="library">` (`library-workspace.tsx:555`) | `LibraryWorkspace` (`src/components/library/library-workspace.tsx:68-1163`) — Evidence Bank inventory, `BulkPdfDropzone`, JSON import, and `Review Queue` duplicate merger. |
| `/practice` | `src/app/practice/page.tsx:1-22` | `<AppShell variant={mainTab === "runner" ? "editor" : "quiet"}>` (`practice-workspace.tsx:114`) | `PracticeWorkspace` (`src/components/practice/practice-workspace.tsx:22-239`) — Target Role selector + `Questions` tab (`InterviewHub`) and `Code Runner` tab (`DsaWorkspace embedded`). |
| `/interview` | `src/app/interview/page.tsx:1-6` | `<AppShell variant="quiet">` (`app-shell.tsx:252`) | Legacy/Orphan wrapper rendering `<InterviewPrepPageShell>` (`app-shell.tsx:250-257`) + `<InterviewHub />`. Unlinked in `TopNav` (`top-nav.tsx:30-37`) and `LandingFooter` (`landing-footer.tsx:27-44`). |
| `/interview/dsa` | `src/app/interview/dsa/page.tsx:1-21` | Standalone (`min-h-screen`, no `AppShell` / `TopNav`) | Renders `<DsaWorkspace />` directly (`dsa-workspace.tsx:50-877`) without global navigation. |
| `/settings` | `src/app/settings/page.tsx:1-10`<br>`src/app/settings/loading.tsx:1-5` | `<AppShell variant="settings">` (`settings-workspace.tsx:278`) | `SettingsWorkspace` (`src/components/settings/settings-workspace.tsx:48-548`) — Account username/sign-out + BYOK AI provider Web Crypto vault settings. |
| `/privacy`, `/terms` | `src/app/privacy/page.tsx:1-102`<br>`src/app/terms/page.tsx:1-76` | `<AppShell variant="quiet">` | Static legal pages with `Surface` cards. |

---

### 1.2 Modals, Drawers, Sheets, Popovers & Workspace Sub-States (16 Surfaces)

| Surface / Dialog | File (`file:line`) | Implementation Primitive | Trigger / Purpose |
| :--- | :--- | :--- | :--- |
| **1. Mobile Navigation Drawer** | `src/components/navigation/top-nav.tsx:287-361` | Radix `Sheet` (`side="right"`, `bg-[#0b1326]`) | Hamburger trigger on `<md` viewports (`top-nav.tsx:279-286`). |
| **2. Keyboard Shortcuts Modal** | `src/components/ui/keyboard-shortcuts-modal.tsx:59-139` | Custom fixed `div` (`role="dialog" aria-modal="true"`) | Triggered by `?` key (`line 36`) or `TopNav` keyboard button (`top-nav.tsx:130`). |
| **3. Guest Migration Modal** | `src/components/auth/guest-migration-modal.tsx:177-361` | Custom fixed `div` (`role="dialog" aria-modal="true"`) | Prompts post-login users to import `localStorage` guest resume/evidence/jobs into Postgres. |
| **4. Clear Master Resume Modal** | `src/components/landing/home-landing.tsx:694-730` | Custom fixed `div` (`role="dialog" aria-modal="true"`) | Destructive confirmation when clearing master resume from `/` (`home-landing.tsx:543`). |
| **5. Confirm Master Overwrite Dialog** | `src/components/editor/confirm-master-dialog.tsx:96-357` | Radix `Dialog` (`DialogContent`, `max-w-3xl`) | Line-by-line LCS diff confirmation (`computeLineDiff`, `lines 27-94`) + confirm checkbox (`line 314`) before overwriting Master Resume in `/editor`. |
| **6. AI Assistant Window** | `src/components/editor/ai-assistant-window.tsx:222-355` + `ai-sidebar.tsx:669-1143` | Custom fixed draggable/resizable window (`mode: "docked" \| "floating" \| "fullscreen"`) | Houses `AiSidebar` (`Tailor`, `Chat` via `ChatPanel`, and `Review` via `QualitativeReviewPanel`). |
| **7. Editor ATS Grade Drawer** | `src/components/editor/preview-panel.tsx:447-480` | Inline collapsible drawer inside `PreviewPanel` | Toggled by `Grade` button (`preview-panel.tsx:375-385`); embeds dark `AtsScorePanel` (`appearance="editor"`) above light paper stage. |
| **8. Template Picker & Form Builder** | `src/components/editor/editor-workspace.tsx:860-874` + `resume-form-builder.tsx:507-921` | Toolbar `<select id="template-selector">` + `Visual Form` tab | Switches templates (`Classic ATS`, `Modern Tech`, `Compact 1-Page`) and visual form vs. raw Typst CodeMirror (`code-editor.tsx:90-183`). |
| **9. Quick-Add Evidence Modal** | `src/components/tailor/quick-add-evidence-modal.tsx:79-206` | Custom fixed `div` (`role="dialog" aria-modal="true"`) | Opened from `/tailor` missing skill pills (`tailor-workspace.tsx:1645-1657`, `1769-1778`). |
| **10. Patch Diff Review & Suggestion Preview** | `src/components/tailor/patch-diff-review.tsx:212-618`<br>`src/components/tailor/suggestion-preview.tsx:69-319` | Inline interactive diff cards + acknowledgement checkboxes | Per-hunk Accept/Reject review with guardrail table (`GuardrailFeedback`) and LCS diff preview. |
| **11. Library Create/Edit Evidence Modal** | `src/components/library/library-workspace.tsx:1045-1160` | Custom fixed `div` (missing `role="dialog"` and `aria-modal`) | Create/Edit Evidence Bank item form in `/library`. |
| **12. Tracker Mobile Detail Sheet** | `src/components/tracker/job-detail-pane.tsx:661-699` | Custom fixed `div` (`role="dialog" aria-modal="true"`) | Full-screen mobile job detail view when selecting a row on `<1024px` (`tracker-feed.tsx:379-381`, `1024-1048`). |
| **13. 1-Click Apply Sheet** | `src/components/tracker/apply-sheet.tsx:534-797` | Radix `Sheet` (`SheetContent`, `sm:max-w-lg`) | 5-step drawer (`1. Job`, `2. Tailor`, `3. Guardrail`, `4. Score`, `5. Apply`) with PDF/DOCX/ZIP export. |
| **14. Application & Interview Prep Modal** | `src/components/tracker/apply-prep-sheet-modal.tsx:280-1012` | Custom fixed `div` (`role="dialog" aria-modal="true"`) | 5-tab modal (`oa-mock`, `star`, `intel` via `CompanyIntelDossierPanel`, `form`, `cover`). |
| **15. Fit Score & Signal Popovers** | `src/components/tracker/fit-percentage-dial.tsx:24-79`<br>`src/components/tracker/job-card-signal-badge.tsx:155-343` | Radix `Popover` (`PopoverTrigger` + `PopoverContent`) | Click/hover popovers on `/tracker/feed` job cards showing weighted match score derivation. |
| **16. Interview Question Detail Modal** | `src/components/interview/interview-hub.tsx:209-327` | Custom fixed `div` (`role="dialog" aria-modal="true"`) | Displays problem complexity, constraints, rubric guide, and STAR rubric in `/practice` or `/interview`. |

---

## 2. Visual & "2022–2024 Dev-Tool" Tell Audit (`impeccable` + `taste-skill`)

### 2.1 Split-Personality Color Palette & 3 Competing Token Systems
- **Global CSS Variable Mutation (`src/app/globals.css:6-76`):**
  - `:root` (`globals.css:6-48`) sets `--rf-bg: #0b1326`, `--rf-surface: #171f33`, `--rf-surface-elevated: #222a3d`, `--rf-border: rgba(148, 163, 184, 0.22)`.
  - `body:has([data-workspace-theme])` (`globals.css:57-76`) — triggered whenever `AppShell` renders with `variant !== "quiet"` (`src/components/design-system/app-shell.tsx:208`) — mutates those global CSS variables to `--rf-bg: #080e1c`, `--rf-surface: #1c2940`, `--rf-surface-elevated: #2b3b55`, `--rf-border: rgba(165, 185, 213, 0.42)`.
  - Components simultaneously hardcode arbitrary hex backgrounds (`bg-[#0b1326]`, `bg-[#121929]`, `bg-[#060e20]`, `bg-[#171f33]`, `bg-[#0d1727]/95`, `bg-slate-900`) alongside `bg-rf-surface` (`#1c2940`), e.g. `src/components/tailor/tailor-workspace.tsx:1037, 1089, 1623`.
- **Three Competing Token Vocabularies (`tailwind.config.ts:75-169`):**
  1. Custom `rf-*` tokens (`bg-rf-bg`, `bg-rf-surface`, `bg-rf-elevated`, `text-rf-cloud`, `text-rf-meta` at `tailwind.config.ts:155-168`).
  2. Material Design 3 tokens (`surface-variant`, `surface-container-lowest: "#060e20"`, `outline-variant`, `on-surface` at `tailwind.config.ts:118-154`) — used in `src/components/tracker/job-detail-pane.tsx:317, 325, 397, 455` while adjacent `src/components/tracker/job-list-row.tsx:99-101` uses `bg-rf-surface` and `border-slate-800/80`.
  3. Standard shadcn HSL tokens (`bg-card`, `bg-muted/40`, `text-muted-foreground`, `border-border` at `tailwind.config.ts:76-116`) — used in `src/components/interview/interview-hub.tsx:163-190`.

### 2.2 Typography & Synthetic Faux-Bold
- **Unloaded Weights Trigger Browser Faux-Bold (`src/app/layout.tsx:6-23` vs `tailwind.config.ts:41-55`):**
  - `Hanken_Grotesk` loads only weights `["400", "600", "700"]` (`layout.tsx:9`) and `JetBrains_Mono` loads `["400", "600"]` (`layout.tsx:18`).
  - `tailwind.config.ts:43, 51` assigns `fontWeight: "800"` to `page-title` and `page-title-mobile`, and components use `font-extrabold` (`800`) and `font-black` (`900`) (`home-landing.tsx:222, 608`, `library-workspace.tsx:594`, `confirm-master-dialog.tsx:229`, `ats-score-panel.tsx:249, 255`), forcing synthetic browser bolding.
- **Monospace Terminal Cosplay:**
  - Micro-labels, badges, and status messages over-index on `font-mono uppercase tracking-widest text-[10px]`: `"ErrorBoundary // Runtime Exception"` (`src/app/error.tsx:34`), `"404 // Route Not Found"` (`src/app/not-found.tsx:22`), `"01 // End-to-End Pipeline"` (`home-landing.tsx:419`), `"FOUR DETERMINISTIC STAGES"` (`home-landing.tsx:427`), `"GUEST_LOCAL"` (`top-nav.tsx:96`).

### 2.3 "2022–2024 Dev-Tool / AI Slop" Tells
1. **30fps Full-Viewport ASCII Wave Canvas + Blur (`src/components/landing/landing-atmosphere.tsx:32-43`, `src/components/design-system/ascii-waves.tsx:1-245`):** Continuous `requestAnimationFrame` ASCII glyph field behind `backdrop-blur-[2px]` and orange/emerald radial glows (`lines 25-30`).
2. **Continuous 72s SVG Wave Background Drift (`src/app/globals.css:101-149`, `src/components/design-system/app-shell.tsx:212`):** `.workspace-wave-texture` runs `animation: workspace-wave-drift 72s linear infinite` with `mix-blend-mode: screen` behind every authenticated workspace.
3. **3D Mouse-Tilt Terminal Card (`src/components/landing/product-proof-card.tsx:12-112`):** `onMouseMove` 3D tilt (`rotateX`/`rotateY`, `transformStyle: "preserve-3d"` at `lines 26-44`), macOS dots (`lines 54-56`), `"Illustrative interface — sample layout only"` badge (`line 48`), and looping `<TextType>` typewriter (`lines 69-79`) typing invalid Typst syntax (`#let master = import("resume.pdf")`).
4. **Word-by-Word Blur-Slide Hero Text (`src/components/landing/home-landing.tsx:221-226`, `src/components/ui/staggered-text.tsx:42-63`):** Animates every word from `filter: "blur(8px)"` and `y: 20` using a spring (`damping: 14, stiffness: 200`).
5. **Infinite Rainbow Pill Marquee (`src/components/landing/capability-marquee.tsx:15-80`):** 10 multi-colored pills scrolling infinitely via `animate-marquee`.
6. **Frozen Fake Progress Bar (`src/components/landing/home-landing.tsx:627-635`):** Bento card 3 renders a static `"Variant Generation"` / `"Processing..."` box with width permanently fixed to `w-[70%]` (`line 633`).
7. **Contradictory Architecture Claims (`src/components/landing/competitive-matrix-section.tsx:105-108` vs `home-landing.tsx:625`):** `competitive-matrix-section.tsx:105-108` claims `"100% Local Invariant (Zero Egress)... ResumeForge runs client-side with zero server-side storage"` while `home-landing.tsx:625` states `"Your master resume, evidence bank, and job tracker live in your hosted database"`.
8. **Legacy Glassmorphism & Neon Glow Utilities (`src/app/globals.css:208-256`):** `.glass-panel` (`backdrop-filter: blur(20px)`, `transition: all 0.3s cubic-bezier(...)`), `.glow-effect:hover` (`box-shadow: 0 0 25px rgba(255, 140, 0, 0.25)`), `.terminal-text` (`text-shadow: 0 0 8px rgba(255, 140, 0, 0.4)`).

### 2.4 Chrome Proportions vs. Resume Paper Stage (`/editor`)
- **Vertical Chrome Stacking (`app-shell.tsx` + `editor-workspace.tsx` + `code-editor.tsx` + `preview-panel.tsx`):**
  1. `TopNav` (`h-16` / 64px, `src/components/navigation/top-nav.tsx:215`).
  2. `GuestBanner` (`py-2` / ~37px, `src/components/design-system/app-shell.tsx:58`).
  3. `workspace-toolbar` (`py-2` / ~48px, `app-shell.tsx:238`, `editor-workspace.tsx:790-957`).
  4. Conditional full-width status/error/undo banners (`editor-workspace.tsx:960-1072`).
  5. Pane headers (`CodeEditor` 40px header at `code-editor.tsx:92`, plus 2 extra sub-bars when `Visual Form` is active at `resume-form-builder.tsx:516-597`; `PreviewPanel` 44px white toolbar at `preview-panel.tsx:336` + 28px `v2` layout density bar at `lines 436-445`).
  - **Impact:** 215px–265px (~30% of a 900px viewport) is consumed by stacked bars above the paper stage.
- **Light/Dark Clash in `PreviewPanel` (`src/components/editor/preview-panel.tsx:334-480`):**
  - Outer panel uses light-mode `bg-slate-100 border-slate-200` (`line 334`) and white header `bg-white` (`line 336`) inside the dark `#080e1c` shell, and clicking `Grade` (`lines 447-480`) opens a dark `bg-slate-900 border-slate-800` `AtsScorePanel` inside the light container.

---

## 3. Interaction & Accessibility Baseline (`web-design-guidelines` + `emilkowalski/skills`)

### 3.1 Interaction & Motion Review (`emil-design-eng` Table)

| Before | After | Why |
| :--- | :--- | :--- |
| `transition: all 0.3s cubic-bezier(...)` on `.glass-panel` (`src/app/globals.css:213`) | `transition: border-color 180ms cubic-bezier(0.23, 1, 0.32, 1), background-color 180ms cubic-bezier(0.23, 1, 0.32, 1)` | Specify exact composited/color properties; `transition: all` causes unintended layout/paint transitions. |
| Word-by-word `filter: blur(8px)` hero spring (`staggered-text.tsx:42-63`) & 72s background SVG drift (`globals.css:113`) | Static crisp hero heading (or single sub-200ms opacity/transform settle) & static subtle radial background | Blur animations cost paint frames and trigger dev-tool slop; infinite workspace drift creates ambient distraction. |
| Mouse-only `mousedown`/`mousemove` drag & resize on `AiAssistantWindow` (`ai-assistant-window.tsx:108-220`) | Pointer events (`onPointerDown` + `setPointerCapture`) + keyboard resize/dock fallback + `aria-label`/`aria-pressed` on mode controls (`lines 273-309`) | Supports touch, pen, and keyboard users instead of locking window controls to mouse only. |
| Custom fixed `<div>` modals without focus trap or `Escape` (`library-workspace.tsx:1045`, `quick-add-evidence-modal.tsx:81`, `apply-prep-sheet-modal.tsx:281`, `home-landing.tsx:694`, `job-detail-pane.tsx:664`, `keyboard-shortcuts-modal.tsx:62`) | Shared Radix `Dialog` / `Sheet` primitives (`src/components/ui/dialog.tsx`, `sheet.tsx`) with `scale(0.97) -> scale(1)` `ease-out` | Guarantees `role="dialog"`, `aria-modal`, `Escape` dismissal, backdrop click, and focus restoration. |
| `focus:outline-none` without ring replacement across form inputs (`resume-form-builder.tsx:533-890`, `managed-resume-form.tsx:59,86`, `ats-sandbox-section.tsx:364,648`, `quick-add-evidence-modal.tsx:132-180`, `practice-workspace.tsx:146`) | `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70` | Preserves keyboard focus visibility for WCAG 2.1 compliance. |
| Clicking `Cover Letter` tab sets `activeTab="overview"` and scrolls (`tailor-workspace.tsx:923-936`) | Separate dedicated tab panel or explicit anchor sub-nav inside Overview | Eliminates disorienting state jump where two tabs render identical content. |

### 3.2 Broken Controls, Pointer Traps & Skeleton Mismatches
- **Dead Notification Bell (`src/components/navigation/top-nav.tsx:137-143`):** `<button type="button" aria-label="Notifications">` has no `onClick`, state, or popover.
- **Duplicate Terminal Icon Link (`src/components/navigation/top-nav.tsx:144-150`):** `<Link href="/editor" aria-label="Terminal">` duplicates the `"Editor"` nav link (`line 31`).
- **Advertised Shortcuts Not Wired (`src/components/ui/keyboard-shortcuts-modal.tsx:14-23` vs `src/lib/editor/shortcut-handler.ts:1-52`):** `Ctrl + B` and `Alt + E/L/J/T` are displayed in the modal but unimplemented; only `?` and `Ctrl/Cmd + S` work.
- **Nav-less Route (`src/app/interview/dsa/page.tsx:13-20`):** Renders `<DsaWorkspace />` without `<AppShell>` or `<TopNav>`.
- **Nested Interactive Controls Inside `role="button"` (`src/components/tracker/job-list-row.tsx:85-277`):** Outer `<div role="button" tabIndex={0}>` wraps a `<select>` (`line 131`), `<Link>` (`line 165`), links/buttons (`lines 182, 193`), and `<button aria-label="More actions">` (`line 205`), violating WAI-ARIA 1.2.
- **Location Autocomplete `onBlur` Timer Trap (`src/components/tracker/tracker-feed.tsx:658-692`):** Uses `setTimeout(..., 250)` on blur and `onMouseDown` on options with no `role="combobox"`, `aria-expanded`, or ArrowUp/ArrowDown keyboard selection.
- **Blocking `window.confirm` / `window.alert` Calls:** `editor-workspace.tsx:740`, `code-editor.tsx:62,71,74,75`, `managed-resume-form.tsx:52`, `cover-letter-panel.tsx:84`, `tracker-feed.tsx:462`.
- **Skeleton Nav Mismatch (`src/components/editor/editor-workspace-skeleton.tsx:85` vs `top-nav.tsx:30-37`):** Skeleton shows `["Master Resume DB", "Editor", "Evidence Bank", "Jobs", "Tailor", "Settings"]`, shifting on hydration to `["Editor", "Evidence Bank", "Jobs", "Tailor", "Practice", "Settings"]`.

---

## 4. Layout & UX Bottlenecks (Prioritized by Severity)

1. **`[HIGH]` Mojibake / UTF-8 Encoding Corruption in `AiSidebar` (`src/components/editor/ai-sidebar.tsx:702, 903, 922, 938, 1048, 1136`)**
   - Garbled sequences (`âœ• Exit`, `â€¦`, `â†’`, `âˆ’`) appear directly in fullscreen close button, placeholders, loading state, and diff badges.
2. **`[HIGH]` Light-Mode Badges & Unstyled Border Inside Dark `TailorDiagnosticPanel` (`src/components/tailor/tailor-diagnostic-panel.tsx:266-356`)**
   - Uses `bg-red-100 text-red-800`, `bg-yellow-100 text-yellow-800`, `bg-blue-100 text-blue-800`, and `border-gray-200` on a dark navy workspace.
3. **`[HIGH]` Excessive Vertical Chrome Stacking & Light/Dark Clash in `/editor` (`app-shell.tsx:210-244`, `editor-workspace.tsx:790-1075`, `preview-panel.tsx:334-480`, `resume-form-builder.tsx:507-597`)**
   - 5–6 stacked bars consume 215px–265px of vertical space; `PreviewPanel` renders light `bg-slate-100`/`bg-white` between dark panes and injects dark `bg-slate-900` `AtsScorePanel` inside the light panel.
4. **`[HIGH]` Dual-Theme CSS Variable Mutation + 3 Competing Token Systems (`src/app/globals.css:6-76`, `tailwind.config.ts:75-169`, `job-detail-pane.tsx:317-645`)**
   - `body:has([data-workspace-theme])` mutates global variables while screens mix `rf-*`, Material 3 (`surface-variant`), shadcn (`bg-card`), and hardcoded hexes (`#0b1326`, `#060e20`, `#171f33`).
5. **`[HIGH]` Dead `TopNav` Controls, Unwired Shortcuts & Nav-less `/interview/dsa` (`top-nav.tsx:137-150`, `keyboard-shortcuts-modal.tsx:15-22`, `src/app/interview/dsa/page.tsx:13-20`)**
   - Unwired `<Bell>` button, duplicate `<Terminal>` link, 5 non-existent shortcuts in help modal, and `/interview/dsa` missing `AppShell`/`TopNav`.
6. **`[MEDIUM]` Landing Page "2022–2024 Dev-Tool" Slop & Contradictory Copy (`src/components/landing/*`)**
   - 30fps ASCII wave canvas, blur-slide hero text, 3D tilt fake Typst terminal, rainbow marquee, static `w-[70%]` progress bar, and contradictory local-only vs. hosted-database claims.
7. **`[MEDIUM]` Custom Modals Missing Dialog Semantics, Escape Handling & Focus Traps (`library-workspace.tsx:1045`, `quick-add-evidence-modal.tsx:81`, `apply-prep-sheet-modal.tsx:281`, `home-landing.tsx:697`, `job-detail-pane.tsx:664`)**
   - 5 custom modals bypass Radix `Dialog`/`Sheet`; `library-workspace.tsx:1046` lacks `role="dialog"` and `htmlFor` bindings.
8. **`[MEDIUM]` Redundant Tab Model in `/tailor` (`src/components/tailor/tailor-workspace.tsx:851-969, 1206-1250`)**
   - `Cover Letter` tab switches to `Overview` and scrolls, while `Overview` and `Workspace` duplicate `Target Role`, `PatchDiffReview`, and `AtsScorePanel`.
9. **`[MEDIUM]` Synthetic Browser Faux-Bold (`font-extrabold` / `800`) on `Hanken_Grotesk` (`src/app/layout.tsx:9` vs `tailwind.config.ts:43, 51`)**
   - Weights `800` and `900` are requested in tokens/components without being loaded from Google Fonts.
10. **`[LOW]` Blocking `window.confirm` / `window.alert` Dialogs (`editor-workspace.tsx:740`, `code-editor.tsx:62,71,74,75`, `managed-resume-form.tsx:52`, `cover-letter-panel.tsx:84`, `tracker-feed.tsx:462`)**
    - 8 synchronous browser dialogs block execution across workspaces.
11. **`[LOW]` Dead `src/app/discover/loading.tsx` & Legacy `/interview` Route (`src/app/discover/loading.tsx:1-5`, `src/app/interview/page.tsx:1-6`)**
    - `/discover` redirects immediately and `/interview` duplicates `/practice`.
