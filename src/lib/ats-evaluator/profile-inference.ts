import { RoleProfile } from "./types";

export function inferRoleProfile(
  roleTitle?: string | null,
  rawDescription?: string | null
): RoleProfile {
  const combined = `${roleTitle || ""} ${rawDescription || ""}`.toLowerCase();

  if (!combined.trim()) {
    return "Full-stack";
  }

  // 1. AI/LLM check
  if (
    /llm|agent|gpt|prompt|langchain|llamaindex|rag|retrieval|genai|generative ai|claude|openai/i.test(
      combined
    )
  ) {
    return "AI/LLM";
  }

  // 2. ML check
  if (
    /machine learning|ml engineer|deep learning|pytorch|tensorflow|scikit|model training|nlp|computer vision/i.test(
      combined
    )
  ) {
    return "ML";
  }

  // 3. Data/Platform check
  if (
    /data engineer|platform engineer|infrastructure|etl|data pipeline|snowflake|spark|kafka|airflow|bigquery/i.test(
      combined
    )
  ) {
    return "Data/Platform";
  }

  // 4. Frontend check
  if (
    /frontend|front-end|ui\/ux|react|next\.js|vue|angular|css|tailwind|accessibility|web performance/i.test(
      combined
    ) &&
    !/backend|back-end|api|distributed/i.test(roleTitle || "")
  ) {
    return "Frontend";
  }

  // 5. Backend check
  if (
    /backend|back-end|distributed systems|microservices|database|postgres|golang|node\.js|python engineer|java/i.test(
      combined
    ) &&
    !/fullstack|full-stack/i.test(combined)
  ) {
    return "Backend";
  }

  // Default fallback
  return "Full-stack";
}
