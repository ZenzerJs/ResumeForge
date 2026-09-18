import { buildComposedSystemPrompt } from "./master-prompt";

export interface JdFormatPromptInput {
  rawDescription: string;
  roleTitle?: string;
  company?: string;
}

export function buildJdFormatSystemPrompt(): string {
  const taskInstructions = `## TASK-SPECIFIC: JOB DESCRIPTION FORMATTER & TAXONOMY EXTRACTOR

Your task is to analyze the provided raw Job Description text and extract structured technical taxonomy and role classification.

### HARD GUARDRAIL RULES
1. **ZERO HALLUCINATION**: Extract ONLY skills, tools, and requirements explicitly stated in or directly inferred from the job description text. NEVER invent non-existent requirements.
2. **STRICT JSON OUTPUT CONTRACT**: Return ONE raw JSON object conforming exactly to the schema. No markdown fences, no explanatory text.
3. **TARGET ROLE PROFILE ID**: Classify the role strictly into one of:
   - "fullstack" (Full-stack engineering, web application development across client and server)
   - "backend" (Server-side, microservices, databases, distributed systems, APIs)
   - "ai_llm" (LLM applications, RAG, prompt engineering, agentic systems, generative AI)
   - "ml" (Machine learning, model training, deep learning, PyTorch/TensorFlow, CV/NLP)
   - "frontend" (Client-side, React/Vue/Next.js, UI/UX, CSS, web performance)
   - "data_platform" (Data pipelines, ETL, data warehouse, Spark, Kafka, Airflow, Snowflake)
4. **SENIORITY**: Classify strictly into one of:
   - "intern" (Co-op, internship, student)
   - "entry" (Junior, new grad, 0-2 years)
   - "mid" (Intermediate, Software Engineer, 2-5 years)
   - "senior" (Senior, 5+ years)
   - "lead" (Staff, Lead, Principal, Architect, Director)
   - "unknown"

### CANONICAL JSON RESPONSE SHAPE
{
  "roleTitle": "Senior Backend Engineer",
  "seniority": "senior",
  "team": "Core Platform Infrastructure",
  "mustHaves": [
    "5+ years backend software engineering experience with Go or Python",
    "Deep understanding of distributed systems and microservices architecture",
    "Hands-on production experience with Docker and Kubernetes container orchestration",
    "Proficiency with relational databases (PostgreSQL) and query optimization"
  ],
  "niceToHaves": [
    "Experience with AWS or GCP cloud architecture",
    "Familiarity with GraphQL API gateways"
  ],
  "tools": ["Go", "Python", "Kubernetes", "Docker", "PostgreSQL", "REST", "AWS", "GraphQL"],
  "domain": ["Distributed Systems", "Cloud Infrastructure", "Microservices"],
  "tone": "Technical, engineering-centric, high-scale focus",
  "keywords": ["Golang", "Kubernetes", "Postgres", "Distributed", "Microservices", "Scalability"],
  "targetRoleProfileId": "backend"
}`;

  return buildComposedSystemPrompt(taskInstructions);
}

export function buildJdFormatUserPrompt(input: JdFormatPromptInput): string {
  return `Please analyze and format the following job description:

${input.company ? `COMPANY: ${input.company}\n` : ""}${input.roleTitle ? `TARGET ROLE TITLE: ${input.roleTitle}\n` : ""}
RAW JOB DESCRIPTION TEXT:
---
${input.rawDescription.trim()}
---

Output the structured JSON response now.`;
}
