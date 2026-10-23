import { DEMO_EVIDENCE, DEMO_JOB, DEMO_RESUME_SOURCE } from "@/lib/demo-samples";
import { extractResumeFacts } from "@/lib/facts/extract";

export function initializeDemoSamples(): void {
  if (typeof window === "undefined") return;
  const hasResume = Boolean(localStorage.getItem("resumeforge_typst_source"));
  const hasEvidence = Boolean(localStorage.getItem("resumeforge_guest_evidence"));
  const hasJobs = Boolean(localStorage.getItem("resumeforge_guest_jobs"));
  if (hasResume || hasEvidence || hasJobs) return;
  localStorage.setItem("resumeforge_typst_source", DEMO_RESUME_SOURCE);
  localStorage.setItem("resumeforge_has_guest_draft", "true");
  localStorage.setItem("resumeforge_guest_evidence", JSON.stringify(DEMO_EVIDENCE));
  localStorage.setItem("resumeforge_guest_jobs", JSON.stringify([DEMO_JOB]));
  localStorage.setItem("resumeforge_demo_master_facts", JSON.stringify(extractResumeFacts(DEMO_RESUME_SOURCE, DEMO_EVIDENCE)));
}

export function clearDemoSamplesForPersonalResume(source: string): void {
  if (typeof window === "undefined" || !source.trim()) return;
  if (source.includes("// Synthetic sample. This is not a real person's resume or experience.")) return;
  try {
    const raw = localStorage.getItem("resumeforge_guest_evidence");
    const items = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(items) || !items.some((item) => String(item?.id || "").startsWith("demo-sample-"))) return;
    const remaining = items.filter((item) => !String(item?.id || "").startsWith("demo-sample-"));
    localStorage.setItem("resumeforge_guest_evidence", JSON.stringify(remaining));
    localStorage.removeItem("resumeforge_demo_master_facts");
    const jobsRaw = localStorage.getItem("resumeforge_guest_jobs");
    const jobs = jobsRaw ? JSON.parse(jobsRaw) : [];
    if (Array.isArray(jobs)) {
      localStorage.setItem("resumeforge_guest_jobs", JSON.stringify(jobs.filter((job) => job?.id !== "demo-sample-job")));
    }
  } catch {}
}

export function getDemoContextFromBrowser() {
  if (typeof window === "undefined") return undefined;
  try {
    const masterTypst = localStorage.getItem("resumeforge_typst_source");
    const rawEvidence = localStorage.getItem("resumeforge_guest_evidence");
    const evidenceItems = rawEvidence ? JSON.parse(rawEvidence) : [];
    if (!masterTypst || !Array.isArray(evidenceItems)) return undefined;
    return {
      masterTypst,
      evidenceItems: evidenceItems
        .filter((item) => item && item.status === "verified")
        .map((item) => ({
          id: String(item.id || ""),
          type: String(item.type || "project"),
          title: String(item.title || ""),
          organization: item.organization ? String(item.organization) : null,
          dates: item.dates ? String(item.dates) : null,
          verifiedSummary: String(item.verifiedSummary || ""),
          tags: Array.isArray(item.tags) ? item.tags.map(String) : [],
          status: "verified" as const,
          bullets: Array.isArray(item.bullets) ? item.bullets.map((bullet: Record<string, unknown>, index: number) => ({
            id: String(bullet.id || `${item.id}-bullet-${index}`),
            text: String(bullet.text || ""),
            technologies: Array.isArray(bullet.technologies) ? bullet.technologies.map(String) : [],
            verified: bullet.verified === true,
          })).filter((bullet: { text: string; verified: boolean }) => bullet.text.length > 0 && bullet.verified) : [],
        }))
        .filter((item) => item.id && item.title && item.verifiedSummary),
    };
  } catch {
    return undefined;
  }
}
