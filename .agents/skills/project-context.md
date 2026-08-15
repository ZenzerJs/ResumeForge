# ResumeForge Project Context

## Overview
ResumeForge is a local-first, Bring-Your-Own-Key (BYOK), evidence-grounded resume tailoring and compilation workspace.

## Core Principles
1. **Zero Hallucination**: Every claim, metric, and bullet must be grounded in verified Evidence Bank items.
2. **Immutable Master Facts**: Candidate's master facts (employers, titles, dates, metrics, skills) are snapshotted and guarded.
3. **Fail-Closed Mechanical Guardrail**: Tailoring and manual edits are verified against the master fact snapshot. Hard violations block export and variant application.
4. **Privacy & Local Ownership**: Candidate career data is owned by the user. BYOK keys are stored in browser localStorage and never logged or resold.
5. **ATS-Compliant DOCX & Typst WASM PDF**: Single-column semantic DOCX exporter and sub-second WebAssembly Typst PDF preview.
