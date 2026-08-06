# SECURITY.md — Security Model & Data Privacy Specification

## 1. Overview & Threat Model

ResumeForge operates under a **local-first, single-user, Bring-Your-Own-Key (BYOK)** security architecture.

Because resumes contain sensitive personal details (contact numbers, physical address, full employment history) and LLM API keys carry monetary value, ResumeForge enforces strict data isolation, complete log redaction, and zero-telemetry rules.

---

## 2. Bring-Your-Own-Key (BYOK) Security Policy & Client Storage

### Key Storage Mechanisms & Trade-offs

1. **Browser Local Storage (`localStorage`)**:
   - **Mechanism**: The Settings UI persists configured API keys, selected provider choices, and custom base URLs in browser `localStorage` (`resumeforge_ai_settings`) to provide persistent key configuration across page navigations and reloads.
   - **Trade-off Analysis**: For a local-first single-user application executing on `localhost`, `localStorage` provides zero-latency key access without requiring background server daemons.
   - **Scope Limit**: This pattern is strictly designed for local single-user operations. Any future multi-user or hosted SaaS deployment MUST revisit this storage strategy and migrate credential storage to encrypted session cookies or vault storage.
2. **Environment Variables (`.env.local`)**:
   - API keys and endpoint overrides may also be configured via `.env.local` for server-side resolution.
3. **OS Keychain Integration (Future Enhancement)**:
   - For native desktop application packaging (e.g. Electron / Tauri shell), API keys will be stored encrypted via native OS keychain APIs (`keytar`).
4. **NEVER in SQLite Database**:
   - API keys and secrets are strictly forbidden from being written to the local SQLite database (`dev.db`). Verified by automated security unit tests (`tests/db-security.test.ts`).
5. **NEVER Committed to Version Control**:
   - `.env` and `.env.local` files are strictly gitignored and excluded from version control.

### Key Redaction Policy

- All error handling, stack trace loggers, network debug tools, and response payloads run through an automated key sanitization utility (`src/lib/ai/redact.ts`).
- Any string matching key patterns (`sk-proj-*`, `sk-ant-*`, `AIzaSy*`, Bearer tokens, query param keys) is automatically scrubbed to `[REDACTED_KEY]`.
- API keys are never included in API responses, server logs, crash dumps, or DOM error state displays.

---

## 3. Network Isolation & Custom Endpoint Policy

- **Generic Custom Endpoint Support**:
  - ResumeForge supports any **Custom OpenAI-compatible endpoint** or **Local / self-hosted endpoint (Bring Your Own)**.
  - Custom endpoints are described generically by their protocol behavior (`/v1/models` and `/models`) rather than specific third-party tool brands.
- **Direct Provider Requests**:
  - Cloud provider requests are routed strictly to official API endpoints (`api.openai.com`, `api.anthropic.com`, `generativelanguage.googleapis.com`) or the user's explicitly configured custom base URL.
- **Zero Telemetry**:
  - ResumeForge contains zero tracking scripts, telemetry pingers, analytics, or remote logging SDKs.

---

## 4. Master Resume Data Integrity

- The **Master Resume** is protected by immutability flags in the local storage layer.
- AI operations run against transient working copies or variant proposals.
- Write operations to master records require explicit user confirmation via UI actions.
