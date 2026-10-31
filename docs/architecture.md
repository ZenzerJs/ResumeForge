# Architecture Specification — ResumeForge

## 1. System Overview & Architecture Diagram

```
+-----------------------------------------------------------------------------------+
|                                 USER INTERFACE                                    |
|  +-----------------------+  +-----------------------+  +-----------------------+  |
|  | Master Resume Editor  |  | Evidence Bank Manager |  | Job Description Input |  |
|  +-----------------------+  +-----------------------+  +-----------------------+  |
|  +-----------------------------------------------------------------------------+  |
|  |             Tailoring Workspace & Patch Diff Review Component               |  |
|  +-----------------------------------------------------------------------------+  |
|  +---------------------------------+  +----------------------------------------+  |
|  |  ATS Quality Evaluator Panel    |  | Live Typst WASM Previewer & Exporter   |  |
|  +---------------------------------+  +----------------------------------------+  |
+------------------------------------------|----------------------------------------+
                                           |
                                           v
+-----------------------------------------------------------------------------------+
|                               APPLICATION CORE                                    |
|                                                                                   |
|  +-------------------------+   +----------------------+   +--------------------+  |
|  |  Requirement Matcher    |   |  ATS Scoring Engine  |   | Typst WASM Engine  |  |
|  |  (Deterministic Rules)  |   |  (100-Point Rubric)  |   | (typst.ts Browser) |  |
|  +-------------------------+   +----------------------+   +--------------------+  |
|                                           |                                       |
|  +----------------------------------------v------------------------------------+  |
|  |                       AI Provider Gateway Service                           |  |
|  |   (Translates prompts -> calls OpenAI/Anthropic/Gemini/Ollama BYOK API)     |  |
|  +-----------------------------------------------------------------------------+  |
+------------------------------------------|----------------------------------------+
                                           |
                                           v
+-----------------------------------------------------------------------------------+
|                              PERSISTENCE LAYER                                    |
|     +-----------------------------------------------------------------------+     |
|     |                         Prisma ORM + PostgreSQL                         |     |
|     | (Account-scoped resumes/evidence/variants; shared job catalog)        |     |
|     +-----------------------------------------------------------------------+     |
+-----------------------------------------------------------------------------------+
```

---

## 2. Module Boundaries

### 1. Editor Module (`/src/modules/editor`)
- Manages the master resume records and live Typst document AST.
- Interfaces with `typst.ts` for browser-side instant PDF rendering.

### 2. Evidence Bank Module (`/src/modules/evidence`)
- CRUD operations for verified accomplishment items, metric cards, skill usages, and project artifacts.
- Exposes retrieval methods for citation linking.

### 3. Application Workspace Module (`/src/modules/workspace`)
- Manages active job application sessions, job description ingestion, and variant drafting.

### 4. Resume Intelligence & Matcher Module (`/src/modules/intelligence`)
- Implements deterministic requirement extraction, skill tagging, evidence matching, and internship-focused 100-point ATS rubric scoring.

### 5. AI Provider Gateway Module (`/src/modules/ai`)
- Secure BYOK interface communicating with external LLM APIs or local proxies.
- Enforces strict JSON schema validation for generated `Patch` objects.

### 6. PostgreSQL Persistence Module (`/src/lib/prisma.ts` & `/prisma`)
- Manages PostgreSQL access through Prisma migrations and typed database queries. Browser localStorage holds guest/demo drafts only; it is not the persistent source of truth for self-hosted accounts.

---

## 3. Runtime modes and ownership

- PostgreSQL is the only source of truth for self-hosted persistent application data. Prisma and migrations own its schema.
- Signed-in self-hosted users own their resumes, evidence, variants, and application state. The shared job catalog is distinct from private application records.
- Public demo visitors have no database write access, including when carrying an old account session. Resume/evidence/job drafts use browser storage; sample content is synthetic and labeled.
- Demo AI requests use visitor-supplied BYOK only. Server environment provider keys are ignored in demo mode. Private-IP protections and provider host/path allowlists remain active.
- `prisma/seed.ts` is an optional development seed only; it is not run automatically on app startup. Demo samples are stored in browser state, not shared user evidence.

## 4. Core Data Flow: "Job Posting In → Tailored Variant Out"

```
[User Pastes Job Posting]
           |
           v
[Job Description Ingestion & Requirement Parser]
           |
           +---> (Extracts Required Skills, Experience, Role Profile)
           |
           v
[Deterministic Evidence Matcher]
           |
           +---> (Cross-references Evidence Bank: Matches vs Unverified Gaps)
           |
           v
[AI Provider Gateway (BYOK)]
           |
           +---> (Generates Evidence-Backed Patch Diffs)
           |
           v
[Patch Diff Review UI]
           |
           +---> (User Accepts / Rejects Each Proposed Patch)
           |
           v
[Resume Variant Compiler]
           |
           +---> (Applies Accepted Patches to Master Copy)
           |
           v
[ATS Evaluator & Typst WASM Engine]
           |
           +---> (Calculates 100-Point Score & Renders Tailored PDF)
```
