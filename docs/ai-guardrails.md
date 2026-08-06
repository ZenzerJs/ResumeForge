# AI Guardrails & Patch Contract — ResumeForge

## 1. The Patch-Object Contract Specification

ResumeForge enforces a strict structural contract on all AI LLM output. AI agents must NEVER return unstructured prose or unreviewed full resume rewrites. AI agents MUST return a valid JSON array of `PatchProposal` objects adhering to the TypeScript / JSON schema below.

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "PatchProposalList",
  "type": "object",
  "properties": {
    "patches": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "operation": { 
            "type": "string", 
            "enum": ["MODIFY_BULLET", "ADD_SKILL", "REORDER_BULLETS", "TWEAK_SUMMARY", "REPORT_GAP"] 
          },
          "targetSection": { "type": "string" },
          "targetId": { "type": "string" },
          "before": { "type": "string" },
          "after": { "type": "string" },
          "evidenceIds": { 
            "type": "array", 
            "items": { "type": "string" } 
          },
          "rationale": { "type": "string" },
          "confidence": { "type": "number", "minimum": 0, "maximum": 1 }
        },
        "required": ["id", "operation", "targetSection", "before", "after", "evidenceIds", "rationale", "confidence"]
      }
    },
    "gaps": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "requirement": { "type": "string" },
          "severity": { "type": "string", "enum": ["CRITICAL", "MODERATE", "MINOR"] },
          "recommendation": { "type": "string" }
        },
        "required": ["requirement", "severity", "recommendation"]
      }
    }
  },
  "required": ["patches", "gaps"]
}
```

---

## 2. Evidence Citation Rules

1. Every proposed change in `after` MUST cite one or more valid `evidenceIds` from the user's verified Evidence Bank.
2. The claims, metrics, technologies, and roles present in `after` must be logically derived from the cited evidence items.
3. If an edit synthesizes multiple evidence items, all referenced `evidenceIds` must be included in the array.

---

## 3. Gap Reporting Contract

If a job requirement cannot be backed by any verified item in the user's Evidence Bank:
- The AI agent MUST NOT invent or extrapolate false experience.
- The AI agent MUST create an entry in the `gaps` array specifying the requirement, severity, and a truthful recommendation (e.g., "Highlight transferable skills in Python" or "Flag as unverified gap").

---

## 4. Adversarial Example & Expected Output

### Scenario
- **Job Posting Requirement**: "5+ years managing enterprise Kubernetes clusters in production."
- **User Evidence Bank**: Contains Python, Next.js, Docker containerization, PostgreSQL experience. ZERO evidence related to Kubernetes or k8s.

### Expected AI Agent Output (Strict Compliance)

```json
{
  "patches": [
    {
      "id": "patch-docker-01",
      "operation": "MODIFY_BULLET",
      "targetSection": "Experience",
      "targetId": "bullet-102",
      "before": "Built and containerized web applications using Docker.",
      "after": "Containerized multi-service microservices using Docker and orchestrated local development environments.",
      "evidenceIds": ["EVID-DOCKER-2023"],
      "rationale": "Emphasized containerization depth using verified Docker evidence without claiming unverified Kubernetes expertise.",
      "confidence": 0.92
    }
  ],
  "gaps": [
    {
      "requirement": "5+ years managing enterprise Kubernetes clusters in production",
      "severity": "CRITICAL",
      "recommendation": "Candidate lacks verified Kubernetes experience. Do not fabricate k8s claims. Highlight strong Docker containerization foundation and container orchestration concepts instead."
    }
  ]
}
```
