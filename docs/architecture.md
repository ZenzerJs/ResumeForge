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
|                               LOCAL STORAGE LAYER                                 |
|     +-----------------------------------------------------------------------+     |
|     |                      Prisma ORM + SQLite (dev.db)                     |     |
|     | (Master Resume, Evidence Items, Jobs, Resume Variants, Patch History) |     |
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

### 6. Local Storage Module (`/src/lib/prisma.ts` & `/prisma`)
- Manages SQLite schema migrations, connection pooling, and database persistence.

---

## 3. Core Data Flow: "Job Posting In → Tailored Variant Out"

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
