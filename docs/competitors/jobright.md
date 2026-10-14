# Comprehensive Competitor Teardown: Jobright.ai

**Date of Investigation:** September 13, 2026  
**Investigator:** ResumeForge Architecture & Intelligence Unit  
**Target Platform:** [https://jobright.ai](https://jobright.ai)  
**Artifact Location:** `docs/competitors/jobright.md` & `C:\Users\jayde\Downloads\jobright-teardown.md`  
**Investigation Scope:** Landing page, product tours, guest/auth boundaries, candidate onboarding architecture (`/onboarding-v3/*`), Turbo subscription & metered credit engine, 1:1 Live Career Coaching, B2B TNT Network & ATS Fraud Detection Chrome extension, Interview Question Bank, Voice Chat Copilot, and Programmatic SEO Comparison Matrix.

---

## Executive Summary

Jobright.ai publicly markets itself as an **"AI Job Search Copilot"** that is **"100% free with no hidden costs"**, claiming to solve job search friction through automated job matching, an ATS autofill Chrome extension, an AI resume builder/tailor, an insider referral network finder, and a 24/7 conversational agent named **Orion**.

However, deep technical inspection of Jobright’s production Next.js application, client-side JavaScript bundles (`chunks/26673-905e2a494bd3a883.js`, `chunks/92466-b9174043fbe1e776.js`), DOM trees (`/jobs/recommend`), legal agreements (`/legal/refund`, `/legal/sales`, `/legal/service`), and unblocked routing architecture (`/onboarding-v3/*`) reveals that **Jobright operates a sophisticated multi-tiered commercial ecosystem** far beyond a "free tool":

1. **Consumer Metered Credit Quota & "Jobright Turbo" ($39.99/month)**:
   - The "free" candidate tier is strictly **rate-limited by a 4-category metered credit balance**: `Customize Resume` (`tailor`), `Cover Letter` (`coverLetter`), `Autofill` (`autofill`), and `Email Lookup` (`email`).
   - When credits expire, users are blocked by an `out_of_credits_popup` or `greenhouse-out-of-credit-modal` and forced to upgrade to **Jobright Turbo** ($39.99/mo standard) for unlimited credits and multiple saved job filters.
2. **1:1 Live Career Coaching & Group Deep Dives ($70–$120 / session, $119.99–$134.99 list price)**:
   - Operates a human-in-the-loop monetization arm offering 30-minute to 60-minute 1:1 live resume and career coaching sessions (`/coach-landing`, `/coaching-policy`), integrated with Google Docs live editing, strict cancellation penalties, and group Deep Dive sessions.
3. **B2B Sourcing & Autonomous AI Recruiter ($499/month per active role)**:
   - Sells candidate resumes and behavioral application graphs to tech employers via dedicated AI sourcing bots that autonomously crawl, vet, and outreach to candidates across Jobright's 2M user pool and 200M external profiles.
4. **B2B TNT (Top Talent Network) & ATS Fraud Detection Extension (`/tnt`, `/fake-candidate-detection`)**:
   - Offers an exclusive, vetted two-sided marketplace connecting the "Top 3% of talent" to 150+ top AI startups.
   - Distributes a free ATS Chrome extension (Greenhouse, Lever, Ashby) to recruiters to detect "fake candidates" across 230+ risk signals, functioning as a strategic trojan horse to capture recruiter workflow and candidate application fraud data.
5. **Candidate Onboarding Pipeline (`/onboarding-v3/*`)**:
   - Candidate onboarding is fully exposed without edge authentication redirects, featuring an interactive 6-step questionnaire funneling job seekers into urgency modes, career goal archetypes, and company stage preferences.
6. **Programmatic SEO Dominance & Comparison Engine (`/compare/[slug]`, `/tools/*`, `/interview-landing`)**:
   - Massive programmatic SEO footprint with 11+ competitor comparison matrices (vs. Teal, Simplify, Huntr, Jobscan, Sonara), a 6,650+ real interview question repository across 328+ companies (`/interview/[companyId]`), and 20+ micro-tools routing back into the core signup engine.

---

## 1. Visual Walkthrough & Inline Screenshot Evidence

All screenshots were captured directly in headless Chromium (viewport 1440x900) and saved in both [`docs/competitors/screenshots/jobright/`](screenshots/jobright/) and [`C:\Users\jayde\Downloads\screenshots\jobright\`](file:///C:/Users/jayde/Downloads/screenshots/jobright/).

### 1.1 Core Consumer Surfaces & Feature Tours

| Surface | Screenshot Reference | Visual & Technical Description |
| :--- | :--- | :--- |
| **Landing Hero** | ![Landing Hero](screenshots/jobright/01_landing_hero.png) | High-contrast headline (*"No More Solo Job Hunting — Do it with AI"*), social proof metrics (`2,000,000 trusted users`, `3x interviews`, `80% time saved`), primary dark pill CTA, and real-time live job ticker ribbon. |
| **Landing Page (Full)** | ![Landing Full](screenshots/jobright/landing_full.png) | Five key feature blocks (Job Match, 1-Click Autofill, Tailored Resume, Insider Referrals, Orion Copilot), user reviews, live job feed, and comprehensive SEO directory footer. |
| **Auth / Onboarding Modal** | ![Auth Modal](screenshots/jobright/03_auth_modal.png) | Ant Design modal dialogue with Google One-Tap/SSO, Apple Sign-In, or Email/Password registration. Gated on every interactive CTA. |
| **AI Agent Page** | ![AI Agent](screenshots/jobright/ai_agent_full.png) | Explains the "always-on" agent concept: auto-matching roles, customizing resumes, and submitting applications on autopilot. |
| **AI Resume Builder** | ![Resume Builder](screenshots/jobright/ai_resume_builder_full.png) | Details "Fast Mode" (<3 min resume generation), "Guided AI Refinement" using "AI graph technology", and instant ATS report card scoring. |
| **AI Job Matcher** | ![AI Job Match](screenshots/jobright/ai_job_match_full.png) | Demonstrates Match Score calculation, multi-dimensional alignment (Skills, Experience, Seniority, Industry), and target role preferences. |
| **Insider Connections** | ![Insider Connections](screenshots/jobright/job_referral_full.png) | Pitch for discovering colleagues/alumni within hiring teams, auto-generating outreach templates, and extracting contact emails. |
| **Orion AI Copilot** | ![Orion Copilot](screenshots/jobright/orion_copilot_full.png) | 24/7 conversational assistant for resume tuning, interview prep, company research, and career advice. Contains cost FAQ claiming platform is free. |
| **Job Autofill Extension** | ![Job Autofill](screenshots/jobright/job_autofill_full.png) | Highlights 1-click ATS form filling across Workday, Greenhouse, Lever, iCIMS, Ashby, and Workable with match score preview in extension popup. |
| **Public Job Detail Page** | ![Job Detail Page](screenshots/jobright/04_job_detail_full.png) | Public job view showing company funding ($405M, Series A, investors), DOL H1B visa sponsorship history, and leadership details. |
| **Terms of Service** | ![Legal Service](screenshots/jobright/legal_service_full.png) | Discloses paid subscription tiers, auto-renewal rules, and candidate data usage rights. |

### 1.2 Newly Discovered Verticals, Paywalls & Onboarding Surfaces

| Surface | Screenshot Reference | Visual & Technical Description |
| :--- | :--- | :--- |
| **Jobright Turbo Refund Policy** | ![Turbo Refund](screenshots/jobright/legal_refund_turbo.png) | Concrete proof of paid consumer tiers: details the Jobright Turbo weekly, monthly, quarterly, and 6-month subscription refund windows, renewal policies, and credit consumption rules. |
| **Metered Credits DOM & Turbo Badge** | ![Recommend Turbo & Credits](screenshots/jobright/jobs_recommend_turbo_credits.png) | Production `/jobs/recommend` interface revealing the `Free Plan` Turbo tag (`.index_turbo-tag-free`) and the metered credits popover icon (`.index_credits-icon`). |
| **1:1 Live Career Coaching** | ![Career Coaching Landing](screenshots/jobright/coach_landing_full.png) | Comprehensive landing page for 1:1 live coaching and group Deep Dives (`5k+ sessions completed`, `4.8/5 rating`, `12+ years experience`). |
| **Coaching Booking & Refund Policy** | ![Coaching Policy](screenshots/jobright/coaching_policy_full.png) | Contract terms for 30-min live coaching: Google Docs live editing, 2-day advance booking, strict 100%/50%/0% refund windows, and 10-minute no-show penalties. |
| **Onboarding: Step 1 Signup** | ![Onboarding Signup](screenshots/jobright/onboarding_signup_full.png) | Full onboarding entry point displaying conversion metrics: *"2X More Qualified Matches"*, *"60% Time Savings"*, *"50% More Interview Invites"*. |
| **Onboarding: Step 2 Urgency Mode** | ![Onboarding Mode](screenshots/jobright/onboarding_mode_selection.png) | Candidate pacing segmentation: *"I'm looking for jobs in a rush"* vs. *"I'm open to new opportunities, no rush"*. |
| **Onboarding: Step 3 Career Goals** | ![Onboarding Goals](screenshots/jobright/onboarding_career_goals.png) | Multi-branch aspirational goal selector: Advance (Senior, Manager, Compensation), Shift (Industry, Role, Skills), Lifestyle (WLB, Security, Flexibility). |
| **Onboarding: Step 4 Preferences** | ![Onboarding Preferences](screenshots/jobright/onboarding_advanced_preferences.png) | Granular filtering for Company Stage (Early, Growth, Late, Public), Industry tags, and Core Skills tags. |
| **Onboarding: Step 5 Resume Upload** | ![Onboarding Upload](screenshots/jobright/onboarding_resume_upload.png) | Document ingest step supporting PDF/Word up to 10MB with explicit candidate data privacy pledge (*"never shared with third parties"*). |
| **TNT Top Talent Network** | ![TNT Network](screenshots/jobright/tnt_network_full.png) | Exclusive private network for Top Talent x Top AI Startups (OpenArt, etc.) claiming 200k+ elite candidates and 150+ funded startups. |
| **ATS Fraud Detection Extension** | ![Fake Candidate Detection](screenshots/jobright/fake_candidate_detection_full.png) | Free Chrome Extension for Greenhouse/Lever/Ashby recruiters claiming to catch deep fakes and stolen identities across 230+ signals. |
| **Interview Question Bank** | ![Interview Landing](screenshots/jobright/interview_landing_full.png) | Directory of 6,656+ real interview questions from Google, Meta, Amazon, OpenAI, and 328+ companies categorized by topic and seniority. |
| **Company Interview View (Google)** | ![Google Interview Questions](screenshots/jobright/interview_company_google.png) | Dedicated company preparation hub showing role filters (SWE, ML, Research) and difficulty tags. |
| **Comparison: Jobright vs Simplify** | ![Compare Simplify](screenshots/jobright/compare_simplify_full.png) | Programmatic comparison claiming Jobright wins 13/20 features over Simplify, pitting full copilot against pure form autofill. |
| **Comparison: Jobright vs Teal** | ![Compare Teal](screenshots/jobright/compare_teal_full.png) | Programmatic comparison claiming Jobright wins 13/20 features over Teal, contrasting active AI application with manual tracking. |

---

## 2. Full Feature Inventory

The following table comprehensively catalogs every verified feature across Jobright's consumer, employer, internal app, and programmatic SEO surfaces:

| Feature | Surface / URL | Claimed Functionality | Demonstrated Functionality | Spin vs. Reality Assessment |
| :--- | :--- | :--- | :--- | :--- |
| **Personalized AI Job Matches** | [`/ai-job-match`](https://jobright.ai/ai-job-match), `/jobs/recommend` | Matches candidate profile/resume across skills, seniority, industry, and preferences. | Live recommendation feed with circular match score (e.g. 92%), skill tags, and compensation benchmarks. | **Moderate Spin**: Uses standard vector similarity/keyword matching against scraped feeds. Guest view is static; full interactive feed requires login. |
| **1-Click Application Autofill** | [`/job-autofill`](https://jobright.ai/job-autofill) | Browser extension that detects ATS platforms (Workday, Greenhouse, Lever, Ashby) and auto-populates all form fields. | Extension injects content script into ATS DOM and maps stored candidate JSON to input selectors. | **Demonstrated**: Extension exists on Chrome Web Store. However, claims of "100% error-free" are marketing exaggeration given frequent ATS DOM mutations. |
| **Jobright Turbo Subscription** | [`/legal/refund`](https://jobright.ai/legal/refund), [`/legal/sales`](https://jobright.ai/legal/sales), `/jobs/recommend` | Premium paid plan unlocking unlimited credits, priority AI agent runs, and advanced multi-filter management. | Direct code in React chunk `26673`: sets `isTurbo: true`, unlocks `"Unlimited"` across all credit pools, and bypasses popover upgrade walls. Standard price is **$39.99/mo**. | **Hidden Commercial Core**: Jobright completely conceals this subscription from public marketing pages, claiming everywhere that Jobright is "100% free". |
| **Metered Credit Quota System** | `/jobs/recommend` DOM, client chunk `26673` | Allocates monthly credits for heavy AI actions; displays live balance in user dashboard popover. | Code defines 4 discrete credit meters: `Customize Resume` (`tailor`), `Cover Letter` (`coverLetter`), `Autofill` (`autofill`), `Email Lookup` (`email`). Triggers `OUT_OF_CREDITS_POPUP` when depleted. | **Verified Reality**: Jobright is **not** truly free. It operates on a strict freemium metered quota that forces upgrades once candidates actively apply. |
| **Job-Specific Tailored Resume** | [`/ai-resume-builder`](https://jobright.ai/ai-resume-builder) | Generates tailored, ATS-compliant resumes matching specific job descriptions in <1 min using "AI graph technology". | Split-screen visual editor with ATS keyword checklist, bullet point optimizer, and PDF export. | **Heavy Spin**: "Advanced AI graph technology" is promotional spin for standard LLM prompt rewriting with injected job description keywords. |
| **Fast Mode Resume Builder** | [`/ai-resume-builder`](https://jobright.ai/ai-resume-builder) | Build a professional resume from scratch in under 3 minutes with pre-approved ATS templates. | Single-column, clean ATS-compatible form-to-document generator. | **Demonstrated**: Standard form-based document generator. |
| **Insider Referral Discovery & Email Lookup** | [`/job-referral`](https://jobright.ai/job-referral), `/jobs/recommend` | Discovers past colleagues and alumni at hiring firms; provides verified contact email addresses and cold outreach drafts. | Displays employee cards at target companies with unlocked email addresses (deducts 1 `email` credit). | **Moderate Spin**: Enriches contact data via third-party B2B data providers (Apollo/Hunter style APIs). Claims of "4x referral interview guarantee" are marketing correlation. |
| **Orion AI Copilot** | [`/orion-copilot`](https://jobright.ai/orion-copilot) | 24/7 conversational career assistant for resume tuning, interview prep, company research, and career advice. | LLM chat interface configured with system instructions for career coaching and access to candidate profile context. | **Demonstrated**: Well-tuned conversational agent, but completely gated behind authentication. |
| **1:1 Live Career Coaching** | [`/coach-landing`](https://jobright.ai/coach-landing), [`/coaching-policy`](https://jobright.ai/coaching-policy) | 30-to-60-minute live 1:1 resume critique and interview prep session with an experienced human coach. | Full booking funnel with coach selection, Google Docs collaborative live editing, and post-session roadmap. Priced at **$70–$120/session** ($119.99–$134.99 list price). | **Verified Commercial Vertical**: Standalone paid human-service vertical directly contradicting "100% free" branding. |
| **Group Deep Dive Sessions** | [`/coach-landing`](https://jobright.ai/coach-landing) | Live group masterclasses led by industry tech leaders focusing on ML, SWE, and Data career tactics. | Scheduled group video webinars with interactive Q&A. | **Demonstrated**: Real live webinar series used as top-of-funnel lead generation for 1:1 coaching packages. |
| **Candidate Onboarding Pipeline** | [`/onboarding-v3/*`](https://jobright.ai/onboarding-v3/signup) | 6-step interactive onboarding flow capturing urgency, career trajectory, company stage preferences, and resume. | Publicly navigable without auth barriers; cleanly guides users through multi-dimensional job preference capture. | **Fully Demonstrated**: High-converting, responsive multi-step funnel that stores profile state for downstream matching. |
| **TNT (Top Talent Network)** | [`/tnt`](https://jobright.ai/tnt) | Private, vetted talent network for the top 3% of candidates connecting directly with 150+ top AI startups. | Vetted candidate pool (71% top universities, 58% Big Tech) bypassed from regular job boards; fast-tracks interviews with founders. | **Commercial Core**: Serves as Jobright's high-margin executive search / curated marketplace arm. |
| **ATS Fraud Detection Extension** | [`/fake-candidate-detection`](https://jobright.ai/fake-candidate-detection) | Free Chrome Extension for Greenhouse, Lever, and Ashby recruiters to catch fake candidates, stolen identities, and deep fakes. | In-ATS overlay that cross-references candidate resumes against 230+ signals (LinkedIn, public records, email/phone verification). | **Strategic Trojan Horse**: Free tool provided to recruiters to capture ATS recruiter interaction and application fraud signals. |
| **Real Interview Question Bank** | [`/interview-landing`](https://jobright.ai/interview-landing), `/interview/[companyId]` | Searchable repository of 6,656+ verified interview questions across 328+ companies (Google, Meta, OpenAI, etc.). | Filterable question cards by topic (System Design, ML, Behavioral, Coding) and seniority level with step-by-step rubrics. | **Demonstrated (Behind Auth)**: Extensive question database; guest view shows question titles and metadata, but full rubrics require sign-in. |
| **Voice Chat Copilot** | [`/voice-chat`](https://jobright.ai/voice-chat) | Real-time speech-to-speech AI interface for conversational mock interviews and career practice. | Next.js dynamic client chunk (`pages/voice-chat-0b8aaffb1605d0a0.js`) loading WebRTC / audio streaming interfaces. | **Demonstrated**: Web-based speech-enabled mock interview practice interface. |
| **Programmatic Comparison Matrix** | [`/compare/[slug]`](https://jobright.ai/compare/simplify) | Feature-by-feature comparison matrices pitting Jobright against 11 competitors (Simplify, Teal, Huntr, Jobscan, etc.). | Highly structured tables scoring platforms across 20 criteria; claims Jobright wins 13/20 features on average. | **SEO Acquisition Engine**: Aggressive programmatic SEO designed to capture competitor search volume on Google. |
| **Programmatic Micro-Tools Suite** | `/tools/*` (20+ routes) | Dedicated landing pages for niche search terms (Bullet Point Generator, ATS Checker, Headline Generator, etc.). | Marketing landing pages with interactive copy previews that funnel users directly into the auth modal or Orion chat. | **SEO Funnel**: Not standalone micro-apps; each page is an SEO gateway routing candidates into the central platform. |
| **Department of Labor H1B Visa Intel** | Public Job Pages (`/jobs/info/...`), `/h1b-jobs` | Real-time and historical H1B visa sponsorship filings by company, year, and role. | Rendered factual LCA filing counts (e.g. 2024, 2025, 2026) directly embedded on job listings. | **Legitimate Feature**: Highly valuable, verified public dataset integration with zero marketing distortion. |
| **Company Funding & Leadership Intel** | Public Job Pages (`/jobs/info/...`) | Venture funding stages, valuations, lead investors, and executive leadership data. | Factual Crunchbase API data embedded directly on job cards. | **Legitimate Feature**: High-value metadata integration providing instant company stability context. |
| **Autonomous AI Recruiter** | [`/employers/pricing`](https://jobright.ai/employers/pricing) | Autonomous AI agent that sources candidates across 2M Jobright users + 200M external profiles for $499/month. | Employer portal with automated search filters, candidate verification, and AI-drafted candidate outreach. | **Primary B2B Monetization**: Candidates are the inventory; employers pay $499/mo per role for access. |

---

## 3. Layout & UX Patterns

### 3.1 Dual-Audience Navigation & In-App Workspace
- **Segmented Top-Level Switch**: The public header bifurcates audiences with an explicit segmented toggle: `Job seekers` (default) vs. `Employers`.
- **In-App Authenticated Navigation**: Once inside the application workspace (`/jobs/recommend`, `/jobs/profile`, `/interview`), the navigation transitions into a unified productivity sidebar/navbar:
  - `Jobs` (with badge counter, e.g. `1000+`)
  - `Resume` (AI builder & tailoring workspace)
  - `Profile` (Career goals, skills, and resume bank)
  - `Agent` (Automated application pipeline)
  - `Coaching` (1:1 session management and booking)
  - `Interview` (Company-specific question bank and practice)
- **Persistent Header & Metered Counter**: On internal pages, the top-right header displays user avatar, account tier badge (`Free Plan` vs `Turbo`), and the interactive `Credits` trigger icon. Hovering or clicking opens the credit balance popover.

### 3.2 Candidate Onboarding Architecture (`/onboarding-v3/*`)
Unlike most AI tools that immediately force a Google login before gathering any intent, Jobright maintains an unblocked 6-step onboarding architecture:

```
/onboarding-v3/signup
  └─► /onboarding-v3/mode-selection
        └─► /onboarding-v3/career-goals
              └─► /onboarding-v3/advanced-preferences
                    └─► /onboarding-v3/resume-upload
                          └─► /onboarding-v3/diagnostics ──► /jobs/recommend
```

1. **Step 1: Value Anchoring & Signup (`/onboarding-v3/signup`)**:
   - Anchors conversion with 3 bold metrics: `2X More Qualified Job Matches`, `60% Time Savings`, and `50% More Interview Invites`.
   - Offers Google SSO, Apple Sign-In, and Email/Password registration.
2. **Step 2: Urgency Pacing (`/onboarding-v3/mode-selection`)**:
   - Paces matching algorithms based on immediate candidate intent:
     - *"I'm looking for jobs in a rush"* (prioritizes high-response ATS postings and urgent hiring tags).
     - *"I'm open to new opportunities, no rush"* (prioritizes quality match percentage and passive alerts).
3. **Step 3: Career Goal Taxonomy (`/onboarding-v3/career-goals`)**:
   - Employs a 3x3 category grid:
     - **Advance My Career**: *To A Senior Role*, *To A Manager Role*, *To Higher Compensation*.
     - **Shift My Career Path**: *Transit To A New Industry*, *Transit To A New Role*, *Explore New Skill*.
     - **Enjoy Better Work Style**: *Work & Life Balance*, *Work Security*, *Work Flexibility*.
4. **Step 4: Advanced Filters (`/onboarding-v3/advanced-preferences`)**:
   - Allows multi-select pills for **Company Stage** (*Early Stage*, *Growth Stage*, *Late Stage*, *Public Company*), custom industry tags, and core skill tags.
5. **Step 5: Resume Ingest (`/onboarding-v3/resume-upload`)**:
   - Clean drag-and-drop zone accepting PDF/Word up to 10MB. Reassures users with a prominent data privacy badge: *"Your resume will only be used for job matching and will never be shared with third parties."*
6. **Step 6: Diagnostic Persona (`/onboarding-v3/diagnostics`)**:
   - Orion AI initializes the user’s career profile, establishes baseline matching vectors, and transitions seamlessly into the live job recommendation feed.

### 3.3 Match Score Presentation & Resume Tailoring UX
- **Circular Percentage Score**: Jobs display a prominent circular badge (`85%`, `92%`, `98%`).
- **Multi-Dimensional Decomposition**: Clicking into a score breaks alignment into 4 distinct bars:
  1. *Skills Match* (green chips for detected candidate skills, outlined red chips for missing job description keywords).
  2. *Experience Fit* (years required vs. years extracted from resume).
  3. *Seniority Level* (intern, new grad, mid, senior, lead, staff).
  4. *Industry & Domain Alignment*.
- **Split-Screen Resume Tailoring**:
  - Left panel: Target Job Description with highlighted keywords.
  - Center panel: Typographic resume editor with instant AI diff markup.
  - Right panel: Instant ATS Report Card detailing missing critical skills and recommended impact metric rewrites.

### 3.4 Multi-Tier Pricing & Monetization Model

Jobright employs a 4-tier monetization matrix spanning candidate freemium, consumer subscriptions, human services, and B2B SaaS:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         JOBRIGHT COMMERCIAL MATRIX                          │
├───────────────────┬───────────────────┬───────────────────┬─────────────────┤
│ Free Candidate    │ Jobright Turbo    │ Career Coaching   │ AI Recruiter    │
│ Tier ($0)         │ ($39.99 / mo)     │ ($70–$120 / sess) │ ($499 / mo/role)│
├───────────────────┼───────────────────┼───────────────────┼─────────────────┤
│ • Basic Job Feed  │ • Unlimited       │ • 30-60 min live  │ • Dedicated bot │
│ • Metered Credits:│   Resume Tailoring│   human session   │ • Ingests 2M    │
│   - Customize Res │ • Unlimited       │ • Google Docs live│   Jobright pool │
│   - Cover Letter  │   Cover Letters   │   editing         │ • 200M external │
│   - Autofill Apps │ • Unlimited Auto- │ • Career strategy │   profiles      │
│   - Email Lookup  │   fill / EasyApply│   roadmap         │ • Candidate     │
│ • Single Filter   │ • Unlimited Email │ • Deep Dive group │   fraud filter  │
│ • Gated Popovers  │ • Multiple Filters│   webinars        │ • Direct email  │
│   on Quota Limits │ • Priority Agent  │ • 100/50% refunds │   under brand   │
└───────────────────┴───────────────────┴───────────────────┴─────────────────┘
```

#### Detailed Price Points Discovered in Production Code:
- **Free Tier**: 0 dollars upfront; strictly capped by metered credits in 4 buckets.
- **Jobright Turbo**: **$39.99 / month** standard pricing (with promotional introductory offers such as `$0.00 / first month` trial or `$1.00` activation tests found in chunk `26673`).
- **Live Career Coaching**:
  - 30-minute session: **$70.00** promotional rate (list price **$119.99 / 60 min** equivalent).
  - 60-minute deep dive: **$120.00** promotional rate (list price **$134.99**).
- **AI Recruiter for Employers**: **$499.00 / month per active role** (delivers 10 verified candidates in 24 hours, then 10–20 weekly).

---

## 4. Design System Breakdown

Jobright utilizes a custom-themed **Ant Design (v5.x)** component foundation tightly integrated with **Tailwind CSS** utility patterns, creating an aesthetic best described as **"High-Tech Fintech meets Cyberpunk Copilot"**.

### 4.1 Color Tokens & Semantics

| Token Name | Hex Value | CSS Variable / Token | Usage |
| :--- | :--- | :--- | :--- |
| **Primary Electric Mint** | `#00F0A0` | `--ant-color-primary: #00f0a0` | High-voltage neon accent. Hero CTAs, active pills, match badges, and highlight borders. |
| **Primary Hover** | `#28FCAF` | `--ant-color-primary-hover: #28fcaf` | Hover state for interactive primary buttons. |
| **Primary Active** | `#00C98D` | `--ant-color-primary-active: #00c98d` | Pressed button state and focus rings. |
| **Surface Dark / Obsidian** | `#001529` / `#0B1120` | `--ant-layout-header-bg` | Header background, high-contrast dark cards, and hero contrast sections. |
| **Surface Light / Pure White** | `#FFFFFF` | `--ant-color-bg-container: #ffffff` | Clean card surfaces, modal dialog backgrounds, and editor sheets. |
| **Background Base** | `#F5F5F5` | `--ant-color-bg-layout: #f5f5f5` | Page body background gray. |
| **Text Primary** | `#000000` / `#111827` | `--ant-color-text: #000000` | High-contrast headline typography and primary body copy. |
| **Text Muted** | `rgba(0,0,0,0.45)` | `--ant-color-text-description` | Subheadings, metadata labels, timestamps, and tooltips. |
| **Border Subtle** | `#D9D9D9` / `rgba(5,5,5,0.06)` | `--ant-color-border` | Minimal card dividers and container outlines. |
| **Turbo Purple (Accent)** | `#722ED1` | `--ant-purple: #722ED1` | Used for special Turbo promotional banners and premium upgrade highlights. |

### 4.2 Typography Hierarchy
- **Display & Headings**: `"Titillium Web", -apple-system, sans-serif`
  - High-tech, condensed, geometric character shapes.
  - Used prominently in uppercase for main page titles (`H1: 38px, font-weight: 600, line-height: 46px`; `H2 Display: 80px, font-weight: 400`).
- **Body & Interactive UI**: `"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
  - Neutral, highly legible humanist sans-serif for UI labels, form controls, job descriptions, and FAQ accordions.

### 4.3 Component Styling & Ergonomics
- **Extreme Pill Geometry**:
  - Buttons and interactive tags use dramatic pill border radii: `22px` for nav buttons, `28px` for secondary CTAs, and `36px` for primary landing action buttons.
  - High-contrast button styling: pitch black (`#000000`) buttons with crisp white text, complemented by electric mint (`#00F0A0`) pills with black text.
- **Elevation & Depth**:
  - Soft, multi-layered shadows (`box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08)` and `0 3px 6px -4px rgba(0, 0, 0, 0.12)`).
- **Accordions & Modals**:
  - Custom borderless Ant Design collapse panels (`.ant-collapse`) with animated rotating chevrons.
  - Clean floating modal dialogs (`.ant-modal-content`) with `border-radius: 16px`.

---

## 5. Paywall & Auth Boundary Analysis

Technical inspection reveals clear boundaries dividing public access, authentication requirements, metered credit limits, and commercial paywalls:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. PUBLIC (ZERO AUTH)                                                       │
│    • Landing page, Feature tours (/ai-agent, /ai-job-match, /ai-resume)     │
│    • Public job postings (/jobs/info/...), Crunchbase funding, DOL H1B stats│
│    • Candidate Onboarding Funnel (/onboarding-v3/*)                         │
│    • Competitor Comparison Matrices (/compare/[slug])                       │
│    • Programmatic SEO Micro-Tools (/tools/*)                                │
│    • 1:1 Career Coaching Landing & Policy (/coach-landing, /coaching-policy)│
│    • TNT Network Landing (/tnt), Fake Candidate Detection (/fake-candidate) │
│    • Employer Portal & Pricing (/employers/pricing)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│ 2. GATED BEHIND FREE SIGNUP (HARD AUTH WALL)                                │
│    • Full interactive Job Recommendation Dashboard (/jobs/recommend)        │
│    • Interactive AI Resume Builder & Tailoring Engine                       │
│    • Personal Match Score calculation against uploaded resume               │
│    • Orion AI Copilot chat conversations                                    │
│    • 1-Click Autofill Extension session sync                                │
│    • Full Interview Question Rubrics & Solutions                            │
├─────────────────────────────────────────────────────────────────────────────┤
│ 3. GATED BY METERED CREDITS (FREE TIER QUOTA)                               │
│    • Resume Customization actions (`tailor`)                                │
│    • Cover Letter Generations (`coverLetter`)                               │
│    • ATS 1-Click Autofills (`autofill`)                                     │
│    • Contact Email Lookups (`email`)                                        │
│    • Additional Saved Job Filters (Blocked by `add-saved-filter-turbo-modal`)│
├─────────────────────────────────────────────────────────────────────────────┤
│ 4. BEHIND PAID CONSUMER PAYWALL: JOBRIGHT TURBO ($39.99/MO)                 │
│    • Unlimited Resume Customizations                                        │
│    • Unlimited Cover Letters & Autofill Applications                        │
│    • Unlimited Insider Referral Email Lookups                               │
│    • Multiple Saved Job Search Filters                                      │
│    • Priority AI Agent auto-apply execution                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│ 5. BEHIND SEPARATE HUMAN SERVICE PAYWALL ($70–$120 / SESSION)               │
│    • 30-min or 60-min 1:1 live resume coaching session with human coach     │
│    • Google Docs collaborative live editing                                 │
│    • Personalized job search and interview strategy roadmap                 │
├─────────────────────────────────────────────────────────────────────────────┤
│ 6. BEHIND EMPLOYER B2B PAYWALL ($499/MO PER ACTIVE ROLE)                    │
│    • Autonomous AI Recruiter bot deployment                                 │
│    • Direct sourcing access to 2M Jobright profiles + 200M external profiles│
│    • Candidate authenticity and fraud risk scoring                          │
│    • Automated candidate cold outreach and interview scheduling             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Marketing Spin vs. Actually Demonstrated Functionality

| Claimed Marketing Pitch | Demonstrated Reality | Spin Severity | Technical Teardown |
| :--- | :--- | :--- | :--- |
| **"100% Free With No Hidden Costs"** | Strict metered credit limits + **$39.99/mo Jobright Turbo** paywall | **Severe (Deceptive)** | Jobright's consumer landing page FAQ explicitly claims the platform is completely free. In reality, heavy actions (`tailor`, `coverLetter`, `autofill`, `email`) are capped by metered credits that block candidates with `OUT_OF_CREDITS_POPUP` unless they pay $39.99/mo for Turbo. |
| **"Advanced AI Graph Technology" for Resumes** | Standard LLM prompt parsing + keyword extraction constraints | **High** | Promotional branding designed to sound like proprietary graph neural networks. In practice, the platform performs PDF text extraction and sends prompt payloads to OpenAI/Anthropic APIs with target job description keywords as constraints. |
| **"AI That Sees Through Deep Fakes Across 230+ Signals"** | LinkedIn cross-referencing, email domain validation, and basic ATS profile checks | **High** | Marketing hype leveraging AI fear. The ATS extension simply checks whether a candidate's email domain is disposable, compares declared job dates against LinkedIn profiles, and flags generic resumes. |
| **"Guaranteed 3x Interviews & 4x Referral Success"** | Statistical correlation / self-reported user surveys | **High** | Classic correlation-causation spin. Candidates who submit referral applications historically have higher callback rates across the recruitment industry regardless of software platform. Stating it as a guaranteed platform outcome is marketing puffery. |
| **"10,000,000 Jobs Our AI is Trained On"** | Pre-trained commercial LLMs (GPT-4o/Claude) + RAG retrieval | **Moderate** | Conflates training with ingestion. Jobright does not pre-train multi-billion parameter foundation models from scratch on raw job boards; they use foundation models augmented with job board embeddings and prompt few-shot examples. |
| **"Autofill on 90% of All ATS Platforms in 1 Click"** | Chrome Extension DOM form mapping | **Low** | Legitimate capability, though inherently fragile. The extension maps stored candidate data fields to standard HTML input selectors across Workday, Greenhouse, and Lever, but frequently requires manual adjustment on custom company application questions. |
| **"Department of Labor H1B Data"** | Real, verified public US DOL LCA filing dataset | **None (Legitimate)** | Jobright genuinely aggregates public US Department of Labor LCA filing statistics, displaying sponsorship historical trends by year and role. Highly factual and useful. |
| **"Crunchbase Funding & Valuation Intel"** | Real, verified Crunchbase API data | **None (Legitimate)** | Jobright genuinely integrates Crunchbase venture funding data, giving candidates authentic insights into company valuations, investors, and funding stages. |

---

## 7. Strategic Architectural Takeaways for ResumeForge

### 1. Disrupt the Deceptive "Free" Model with Honest Transparency
Jobright claims to be "100% free" but blindsides job seekers with sudden `OUT_OF_CREDITS_POPUP` paywalls and $39.99/mo Turbo subscriptions. ResumeForge can win immediate candidate trust by offering **predictable, honest pricing** and a **frictionless Guest Sandbox** where candidates can paste a job description, see an ATS Rubric score, and test the Typst PDF engine before ever being asked to sign up or pay.

### 2. Rigorous Evidence Bank vs. Hallucinated "1-Minute Resumes"
Jobright encourages candidates to generate tailored resumes in under 60 seconds using generic LLM rewriting, which regularly fabricates achievements and leads to severe interview disqualification. ResumeForge’s strict **Patch-Only AI Contract** (`docs/ai-guardrails.md`) and **Evidence Bank** architecture—requiring every tailored bullet point to cite verified evidence—provides a vastly superior, defensible value proposition for serious career professionals.

### 3. Integrate Public Metadata into Job Matching
Jobright's standout positive feature is embedding **Department of Labor H1B visa history** and **Crunchbase venture funding** directly on job listings. ResumeForge should incorporate similar metadata connectors into its job search and tailoring pipeline (e.g., funding stage, tech stack verification, visa sponsorship probability).

### 4. Build a Native Technical Interview Practice Workspace
Jobright has expanded heavily into technical and behavioral interview preparation with its 6,656+ question bank (`/interview-landing`) and Voice Chat Copilot (`/voice-chat`). ResumeForge should continue expanding its native technical interview preparation workspace, integrating real coding problem runners, system design rubrics, and tailored practice problems linked directly to target job requirements.

### 5. Adopt High-Contrast, Data-Dense Ergonomics
Jobright's visual identity—high-contrast dark obsidian headers paired with electric mint (`#00F0A0`), geometric headers (`Titillium Web`), and extreme pill geometry—creates a sleek, high-tech impression. ResumeForge can leverage similar clean elevation hierarchies, crisp typography, and high-visibility status indicators while ensuring strict WCAG accessibility compliance.

---

## 8. Complete File & Asset Inventory

- **Primary Teardown Report**: [`docs/competitors/jobright.md`](file:///c:/Users/jayde/.gemini/config/projects/Resume-Forge/docs/competitors/jobright.md)
- **Local Mirror Export**: [`C:\Users\jayde\Downloads\jobright-teardown.md`](file:///C:/Users/jayde/Downloads/jobright-teardown.md)
- **Screenshots Directory (Workspace)**: [`docs/competitors/screenshots/jobright/`](file:///c:/Users/jayde/.gemini/config/projects/Resume-Forge/docs/competitors/screenshots/jobright/)
- **Screenshots Directory (Downloads Mirror)**: [`C:\Users\jayde\Downloads\screenshots\jobright\`](file:///C:/Users/jayde/Downloads/screenshots/jobright/)

### Complete Screenshot Manifest (35 Assets):
1. `01_landing_hero.png` — Hero section with 2M user social proof and live job ticker.
2. `01_landing_view.png` — Viewport capture of landing hero.
3. `02_landing_full.png` / `landing_full.png` — Full landing page capture.
4. `03_auth_modal.png` / `07_auth_modal_signup.png` — Ant Design authentication modal.
5. `04_job_detail_full.png` — Public job detail view with DOL H1B stats and Crunchbase funding.
6. `05_orion_copilot_full.png` / `orion_copilot_full.png` — Orion AI career copilot feature tour.
7. `06_job_referral_full.png` / `job_referral_full.png` — Insider connections and email lookup tour.
8. `ai_agent_full.png` — Autonomous AI job search agent tour.
9. `ai_job_match_full.png` — AI job matching and fit score engine tour.
10. `ai_resume_builder_full.png` — AI resume builder and ATS report card tour.
11. `job_autofill_full.png` — Chrome extension 1-click application autofill tour.
12. `employers_pricing_full.png` — B2B Recruiter pricing ($499/mo per role).
13. `employers_landing_full.png` — B2B Employer sourcing portal tour.
14. `cover_letter_tool_full.png` — AI Cover Letter generator tool page.
15. `resume_helper_tool_full.png` — AI Resume helper tool page.
16. `legal_service_full.png` — Terms of Service legal contract.
17. `legal_refund_turbo.png` — Jobright Turbo Refund and Cancellation Policy (**NEW**).
18. `jobs_recommend_turbo_credits.png` — Recommendation DOM showing Free Plan badge & Credits popover (**NEW**).
19. `coach_landing_full.png` — 1:1 Live Career Coaching & Deep Dive Sessions landing (**NEW**).
20. `coaching_policy_full.png` — Career Coaching Booking, Cancellation & Refund Policy (**NEW**).
21. `onboarding_signup_full.png` — Candidate Onboarding Step 1: Signup & value metrics (**NEW**).
22. `onboarding_mode_selection.png` — Candidate Onboarding Step 2: Rush vs Open mode selection (**NEW**).
23. `onboarding_career_goals.png` — Candidate Onboarding Step 3: Career goals 3x3 taxonomy (**NEW**).
24. `onboarding_advanced_preferences.png` — Candidate Onboarding Step 4: Company stage & skill preferences (**NEW**).
25. `onboarding_resume_upload.png` — Candidate Onboarding Step 5: Resume upload & privacy pledge (**NEW**).
26. `tnt_network_full.png` — Top Talent Network (TNT) landing page (**NEW**).
27. `fake_candidate_detection_full.png` — ATS Fraud Detection Chrome Extension landing page (**NEW**).
28. `interview_landing_full.png` — 6,656+ Real Interview Questions Bank landing page (**NEW**).
29. `interview_company_google.png` — Google-specific interview question repository (**NEW**).
30. `compare_simplify_full.png` — Jobright vs Simplify comparison matrix (**NEW**).
31. `compare_teal_full.png` — Jobright vs Teal comparison matrix (**NEW**).
