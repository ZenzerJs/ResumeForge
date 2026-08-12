"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  X,
  Loader2,
} from "lucide-react";
import { JobRequirements } from "@/lib/jd-parser/types";
import { PatchDiffReview } from "./patch-diff-review";
import { AtsScorePanel } from "./ats-score-panel";
import { CoverLetterPanel } from "./cover-letter-panel";
import type { PatchProposal, Gap, RejectedPatch } from "@/lib/ai/patch-schema";
import { AppShell } from "@/components/design-system/app-shell";
import { PageSkeleton } from "@/components/design-system/page-skeleton";
import { isPlaceholderDescription } from "@/lib/ingestion/helpers";

interface RankedMatch {
  id: string;
  title: string;
  type: string;
  organization: string | null;
  dates: string | null;
  status: string;
  isDraft: boolean;
  verifiedSummary: string;
  tags: string[];
  score: number;
  matchPercentage: number;
  matchedRequirements: string[];
  matchedBullets: {
    id: string;
    text: string;
    technologies: string[];
    verified: boolean;
    matchedRequirements: string[];
  }[];
}

const SAMPLE_BACKEND_JD = `Senior Backend Engineer — Nova Labs

We are looking for a Senior Backend Engineer to join our core infrastructure team. 
You will be responsible for designing and building highly scalable microservices 
using Go and Python.

Requirements:
- 5+ years of experience in backend development.
- Strong proficiency in Go and Python.
- Experience with Kubernetes and Docker.
- Solid understanding of distributed systems and RESTful APIs.
- Familiarity with PostgreSQL and Redis.

Preferred:
- Experience with AWS or GCP.
- Knowledge of GraphQL.
- Open-source contributions.`;

const SAMPLE_FRONTEND_JD = `Frontend Engineer — WebCraft Systems

Responsibilities:
Build modern, accessible web application interfaces using React and Next.js.

Must Have Requirements:
- 3+ years experience with TypeScript, JavaScript, HTML, and CSS.
- Strong UI component styling experience with Tailwind CSS.
- Experience writing automated tests using Vitest, Jest, or Playwright.

Nice to Have:
- Knowledge of WebAssembly (WASM) and Web performance.
- Experience with state management and Front-End Development best practices.`;

export function TailorWorkspace() {
  const searchParams = useSearchParams();
  const jobIdParam = searchParams.get("jobId");

  const [company, setCompany] = useState("Nova Labs");
  const [roleTitle, setRoleTitle] = useState("Senior Backend Engineer");
  const [rawDescription, setRawDescription] = useState(SAMPLE_BACKEND_JD);

  const [extractedRequirements, setExtractedRequirements] = useState<JobRequirements | null>({
    requiredSkills: ["Go", "Python", "Kubernetes", "Docker", "RESTful APIs", "PostgreSQL"],
    preferredSkills: ["AWS/GCP", "GraphQL"],
    domainTerms: ["Distributed Systems", "Microservices"],
    roleTitle: "Senior Backend Engineer",
    company: "Nova Labs",
  });

  const [matches, setMatches] = useState<RankedMatch[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isMatching, setIsMatching] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [isGeneratingPatches, setIsGeneratingPatches] = useState(false);
  const [patchVerified, setPatchVerified] = useState<PatchProposal[]>([]);
  const [patchRejected, setPatchRejected] = useState<RejectedPatch[]>([]);
  const [patchGaps, setPatchGaps] = useState<Gap[]>([]);
  const [masterResumeId, setMasterResumeId] = useState<string | null>(null);
  const [masterTypstSource, setMasterTypstSource] = useState<string>("");
  const [activeVariantContent, setActiveVariantContent] = useState<string>("");
  const [patchError, setPatchError] = useState<string | null>(null);
  const [savedJobId, setSavedJobId] = useState<string | null>(null);

  const [isTier2Fetching, setIsTier2Fetching] = useState<boolean>(false);
  const [tier2Status, setTier2Status] = useState<{ type: "loading" | "success" | "error"; message: string } | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  useEffect(() => {
    async function loadMasterOrStarterResume() {
      try {
        const res = await fetch("/api/resumes");
        const json = await res.json();
        if (res.ok && json.success && json.data.length > 0) {
          const master = json.data.find((r: { isMaster: boolean }) => r.isMaster) || json.data[0];
          setMasterResumeId(master.id);
          setMasterTypstSource(master.typstSource);
          setActiveVariantContent(master.typstSource);
          return;
        }
      } catch {}

      try {
        const tRes = await fetch("/templates/starter-resume.typ");
        if (tRes.ok) {
          const text = await tRes.text();
          setMasterTypstSource(text);
          setActiveVariantContent(text);
          return;
        }
      } catch {}

      const defaultSource = `#let resume-section(title) = [ === #title ]\n#resume-section("Skills")\nLanguages: TypeScript, Node.js, Python, PostgreSQL\n#resume-section("Experience")\n*Software Engineer* (2024 - Present)\n- Built REST APIs using Node.js and PostgreSQL.\n`;
      setMasterTypstSource(defaultSource);
      setActiveVariantContent(defaultSource);
    }

    void loadMasterOrStarterResume().finally(() => setIsBootstrapping(false));
  }, []);

  const triggerTier2Fetch = async (jobIdToFetch: string) => {
    setIsTier2Fetching(true);
    setTier2Status({
      type: "loading",
      message: "Attempting Tier 2 on-demand full-text fetch from posting page...",
    });

    try {
      const res = await fetch(`/api/jobs/${jobIdToFetch}/fetch-fulltext`, {
        method: "POST",
      });
      const json = await res.json();

      if (res.ok && json.success && json.data) {
        setRawDescription(json.data.rawDescription);
        setTier2Status({
          type: "success",
          message: json.cached
            ? "Loaded full job description from cache."
            : "Successfully extracted full job description text from external posting page!",
        });
      } else {
        setTier2Status({
          type: "error",
          message:
            json.error ||
            "Couldn't extract automatically (page requires JavaScript rendering or login) — please paste the description manually below.",
        });
      }
    } catch {
      setTier2Status({
        type: "error",
        message: "Network error during fetch — please paste the description manually below.",
      });
    } finally {
      setIsTier2Fetching(false);
    }
  };

  useEffect(() => {
    if (!jobIdParam) return;
    async function loadJobById() {
      try {
        const res = await fetch(`/api/jobs/${jobIdParam}`);
        const json = await res.json();
        if (res.ok && json.success && json.data) {
          const job = json.data;
          if (job.company) setCompany(job.company);
          if (job.roleTitle) setRoleTitle(job.roleTitle);
          if (job.rawDescription) setRawDescription(job.rawDescription);
          if (job.id) setSavedJobId(job.id);
          sessionStorage.setItem("resumeforge_active_job_id", job.id);

          if (isPlaceholderDescription(job.rawDescription)) {
            triggerTier2Fetch(job.id);
          }
        }
      } catch {}
    }
    loadJobById();
  }, [jobIdParam]);

  const ensureJobSaved = async (opts?: {
    forceUpdate?: boolean;
    requirements?: JobRequirements | null;
  }): Promise<string | null> => {
    if (!rawDescription.trim()) return null;

    const payload = {
      company: company.trim() || undefined,
      roleTitle: roleTitle.trim() || undefined,
      rawDescription,
      extractedRequirements: opts?.requirements ?? extractedRequirements ?? undefined,
    };

    // Update existing saved job with latest posting fields (safe to keep in SQLite)
    if (savedJobId) {
      if (opts?.forceUpdate !== false) {
        try {
          const updateRes = await fetch(`/api/jobs/${savedJobId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const updateJson = await updateRes.json();
          if (updateRes.ok && updateJson.success) {
            setSaveStatus("Job posting saved to database.");
            return savedJobId;
          }
        } catch {
          // fall through to create if update fails unexpectedly
        }
      }
      return savedJobId;
    }

    const saveRes = await fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        source: "pasted",
      }),
    });
    const saveJson = await saveRes.json();
    if (saveRes.ok && saveJson.success) {
      setSavedJobId(saveJson.data.id);
      sessionStorage.setItem("resumeforge_active_job_id", saveJson.data.id);
      setSaveStatus("Job posting saved to database.");
      return saveJson.data.id as string;
    }
    return null;
  };

  const handleGeneratePatches = async () => {
    if (!extractedRequirements) {
      setPatchError("Please extract requirements from a job description first.");
      return;
    }

    let aiSettings;
    try {
      const stored = localStorage.getItem("resumeforge_ai_settings");
      aiSettings = stored ? JSON.parse(stored) : null;
    } catch {
      aiSettings = null;
    }

    if (!aiSettings?.provider || !aiSettings?.apiKey) {
      setPatchError("No AI provider configured. Please configure your API key in Settings.");
      return;
    }

    setIsGeneratingPatches(true);
    setPatchError(null);
    setPatchVerified([]);
    setPatchRejected([]);
    setPatchGaps([]);

    try {
      const jobId = await ensureJobSaved();
      if (!jobId) {
        setPatchError("Failed to save job posting before patch generation.");
        setIsGeneratingPatches(false);
        return;
      }

      const res = await fetch("/api/ai/generate-patches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerConfig: {
            provider: aiSettings.provider,
            apiKey: aiSettings.apiKey,
            baseUrl: aiSettings.baseUrl || undefined,
            model: aiSettings.model || undefined,
          },
          jobRequirements: {
            requiredSkills: extractedRequirements.requiredSkills,
            preferredSkills: extractedRequirements.preferredSkills,
            domainTerms: extractedRequirements.domainTerms,
            roleTitle: roleTitle || undefined,
            company: company || undefined,
          },
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        setPatchError(json.error || "Failed to generate patches.");
        setIsGeneratingPatches(false);
        return;
      }

      setPatchVerified(json.data.verified || []);
      setPatchRejected(json.data.rejected || []);
      setPatchGaps(json.data.gaps || []);
      setMasterResumeId(json.data.masterResumeId || null);
    } catch (err) {
      setPatchError(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsGeneratingPatches(false);
    }
  };

  const handleExtract = async () => {
    if (!rawDescription.trim()) {
      setErrorMessage("Please paste a job description before extracting requirements.");
      return;
    }

    setErrorMessage(null);
    setIsExtracting(true);

    try {
      const res = await fetch("/api/jobs/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawDescription }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setErrorMessage(json.error || "Failed to extract requirements.");
        setIsExtracting(false);
        return;
      }

      setExtractedRequirements(json.data);
      if (json.data.roleTitle && !roleTitle) {
        setRoleTitle(json.data.roleTitle);
      }

      // Persist posting + extracted requirements into SQLite (safe to keep)
      await ensureJobSaved({ forceUpdate: true, requirements: json.data });

      await fetchMatches(json.data);
    } catch (err) {
      setErrorMessage(String(err));
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSaveJob = async () => {
    const id = await ensureJobSaved({ forceUpdate: true });
    if (id) {
      setSaveStatus("Job posting saved successfully!");
    } else {
      setErrorMessage("Failed to save job posting.");
    }
  };

  const fetchMatches = async (reqs: JobRequirements) => {
    setIsMatching(true);
    try {
      const res = await fetch("/api/jobs/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reqs),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setMatches(json.data);
      }
    } catch (err) {
      console.error("Match error:", err);
    } finally {
      setIsMatching(false);
    }
  };

  const handleRemoveRequirement = (category: "required" | "preferred" | "domain", termToRemove: string) => {
    if (!extractedRequirements) return;

    const updated: JobRequirements = {
      ...extractedRequirements,
      requiredSkills:
        category === "required"
          ? extractedRequirements.requiredSkills.filter((t) => t !== termToRemove)
          : extractedRequirements.requiredSkills,
      preferredSkills:
        category === "preferred"
          ? extractedRequirements.preferredSkills.filter((t) => t !== termToRemove)
          : extractedRequirements.preferredSkills,
      domainTerms:
        category === "domain"
          ? extractedRequirements.domainTerms.filter((t) => t !== termToRemove)
          : extractedRequirements.domainTerms,
    };

    setExtractedRequirements(updated);
    fetchMatches(updated);
  };

  const skillIsCovered = (skill: string) => {
    const needle = skill.toLowerCase();
    return matches.some(
      (m) =>
        m.matchedRequirements.some((r) => r.toLowerCase().includes(needle) || needle.includes(r.toLowerCase())) ||
        m.verifiedSummary.toLowerCase().includes(needle) ||
        m.matchedBullets.some((b) => b.text.toLowerCase().includes(needle))
    );
  };

  // Ensure a job record exists so CoverLetterPanel can generate,
  // and keep company / role / description / requirements synced in SQLite.
  useEffect(() => {
    if (!rawDescription.trim()) return;
    const timer = setTimeout(() => {
      void ensureJobSaved({ forceUpdate: true });
    }, 900);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawDescription, company, roleTitle, extractedRequirements]);

  // Refresh matches when requirements present on mount
  useEffect(() => {
    if (extractedRequirements) {
      void fetchMatches(extractedRequirements);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isBootstrapping) {
    return <PageSkeleton variant="tailor" />;
  }

  return (
    <AppShell variant="tailor">
      <div className="relative z-10 flex-1 pt-8 pb-12 px-4 md:px-8 max-w-7xl mx-auto w-full">
        <div className="flex justify-between items-end mb-8 gap-4 flex-wrap">
          <div>
            <h1 className="font-page-title text-4xl font-extrabold text-[#ff8c00] tracking-tighter mb-1">Tailor</h1>
            <p className="font-body-regular text-slate-400 text-sm">
              Analyze job requirements and forge targeted materials from your master resume + Evidence Bank.
            </p>
          </div>
          <button
            type="button"
            onClick={handleGeneratePatches}
            disabled={isGeneratingPatches}
            data-testid="generate-patches-btn"
            className="bg-[#ff8c00] text-black font-bold px-6 py-2.5 rounded font-mono text-xs uppercase hover:shadow-[0_0_15px_rgba(255,140,0,0.4)] transition-shadow flex items-center gap-2"
          >
            {isGeneratingPatches ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Generate AI Patches
          </button>
        </div>

        {(jobIdParam || savedJobId) && (
          <div
            data-testid="active-job-header-banner"
            className="mb-4 rounded-lg border border-amber-800/50 bg-amber-950/30 px-3 py-2 text-xs text-amber-200"
          >
            Active job: {company || "Untitled"} — {roleTitle || "Role"}
          </div>
        )}

        {(errorMessage || patchError || saveStatus) && (
          <div className="mb-4 space-y-2">
            {errorMessage && (
              <div className="rounded-lg border border-red-800/60 bg-red-950/40 px-3 py-2 text-xs text-red-300 flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5" /> {errorMessage}
              </div>
            )}
            {patchError && (
              <div className="rounded-lg border border-red-800/60 bg-red-950/40 px-3 py-2 text-xs text-red-300 flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5" /> {patchError}
              </div>
            )}
            {saveStatus && (
              <div className="rounded-lg border border-emerald-800/60 bg-emerald-950/40 px-3 py-2 text-xs text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5" /> {saveStatus}
              </div>
            )}
          </div>
        )}

        {tier2Status && (
          <div
            className={`mb-4 rounded-lg border px-3 py-2 text-xs flex items-center gap-2 ${
              tier2Status.type === "error"
                ? "border-red-800/60 bg-red-950/40 text-red-300"
                : tier2Status.type === "success"
                ? "border-emerald-800/60 bg-emerald-950/40 text-emerald-300"
                : "border-slate-700 bg-slate-900 text-slate-300"
            }`}
          >
            {isTier2Fetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {tier2Status.message}
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          <div className="xl:col-span-8 flex flex-col gap-6">
            <section className="glass-panel rounded-lg p-5 glow-hover transition-shadow">
              <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-800/60">
                <span className="material-symbols-outlined text-[#ff8c00] text-sm" data-icon="work">work</span>
                <h2 className="font-mono text-xs text-[#ff8c00] uppercase tracking-wider font-bold">Target Job Posting</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label htmlFor="tailor-company" className="block font-mono text-xs text-slate-400 mb-1">Company</label>
                  <input
                    id="tailor-company"
                    name="company"
                    type="text"
                    autoComplete="organization"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    className="w-full bg-[#060e20] border-b border-slate-700 p-2 text-xs font-mono text-[#ffb77d] rounded-t outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
                  />
                </div>
                <div>
                  <label htmlFor="tailor-role" className="block font-mono text-xs text-slate-400 mb-1">Role</label>
                  <input
                    id="tailor-role"
                    name="role"
                    type="text"
                    autoComplete="off"
                    value={roleTitle}
                    onChange={(e) => setRoleTitle(e.target.value)}
                    className="w-full bg-[#060e20] border-b border-slate-700 p-2 text-xs font-mono text-[#ffb77d] rounded-t outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
                  />
                </div>
              </div>
              <div>
                <label className="block font-mono text-xs text-slate-400 mb-1 flex justify-between">
                  <span>Raw Description</span>
                  <button
                    type="button"
                    onClick={handleExtract}
                    disabled={isExtracting}
                    data-testid="extract-reqs-btn"
                    className="text-xs text-[#4edea3] hover:underline font-mono"
                  >
                    {isExtracting ? "Scanning..." : "Extract Requirements"}
                  </button>
                </label>
                <textarea
                  value={rawDescription}
                  onChange={(e) => setRawDescription(e.target.value)}
                  rows={8}
                  data-testid="jd-textarea"
                  aria-label="Job description"
                  className="w-full bg-[#060e20] text-slate-200 font-mono text-xs p-4 rounded border border-slate-800 focus:border-[#ff8c00] focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 resize-none leading-relaxed"
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    data-testid="sample-backend-btn"
                    onClick={() => {
                      setCompany("Nova Labs");
                      setRoleTitle("Senior Backend Engineer");
                      setRawDescription(SAMPLE_BACKEND_JD);
                    }}
                    className="text-[10px] font-mono px-2 py-1 rounded border border-slate-700 text-slate-400 hover:text-white"
                  >
                    Sample Backend JD
                  </button>
                  <button
                    type="button"
                    data-testid="sample-frontend-btn"
                    onClick={() => {
                      setCompany("WebCraft Systems");
                      setRoleTitle("Frontend Engineer");
                      setRawDescription(SAMPLE_FRONTEND_JD);
                    }}
                    className="text-[10px] font-mono px-2 py-1 rounded border border-slate-700 text-slate-400 hover:text-white"
                  >
                    Sample Frontend JD
                  </button>
                  <button
                    type="button"
                    data-testid="save-job-btn"
                    onClick={() => void handleSaveJob()}
                    className="text-[10px] font-mono px-2 py-1 rounded border border-emerald-700/60 text-emerald-300 hover:text-white"
                  >
                    Save Job
                  </button>
                </div>
              </div>
            </section>

            <section className="glass-panel rounded-lg p-5 glow-hover transition-shadow">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800/60">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#ff8c00] text-sm" data-icon="fact_check">fact_check</span>
                  <h2 className="font-mono text-xs text-[#ff8c00] uppercase tracking-wider font-bold">Extracted Requirements</h2>
                </div>
                <button
                  type="button"
                  onClick={handleExtract}
                  className="text-[#4edea3] text-xs hover:underline font-mono"
                >
                  {isExtracting ? "Scanning..." : isMatching ? "Matching..." : "Re-Scan"}
                </button>
              </div>

              {extractedRequirements && (
                <>
                  <div className="mb-4">
                    <h3 className="font-mono text-xs text-slate-400 mb-2">Required Skills</h3>
                    <div className="flex flex-wrap gap-2">
                      {extractedRequirements.requiredSkills.map((skill) => {
                        const covered = skillIsCovered(skill);
                        return (
                          <button
                            type="button"
                            key={skill}
                            onClick={() => handleRemoveRequirement("required", skill)}
                            title="Click to remove"
                            data-testid={`req-skill-${skill}`}
                            className={`px-2.5 py-1 bg-[#171f33] rounded text-xs font-mono border flex items-center gap-1.5 ${
                              covered ? "border-[#4edea3]/40 text-slate-300" : "border-red-500/40 text-slate-300"
                            }`}
                          >
                            <span
                              className={`material-symbols-outlined text-sm ${
                                covered ? "text-[#4edea3]" : "text-red-400"
                              }`}
                              data-icon={covered ? "check_circle" : "cancel"}
                            >
                              {covered ? "check_circle" : "cancel"}
                            </span>
                            {skill}
                            <span data-testid={`remove-term-${skill}`} className="inline-flex">
                              <X className="h-3 w-3 opacity-50" />
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-mono text-xs text-slate-400 mb-2">Preferred Skills</h3>
                    <div className="flex flex-wrap gap-2">
                      {extractedRequirements.preferredSkills.map((skill) => (
                        <button
                          type="button"
                          key={skill}
                          onClick={() => handleRemoveRequirement("preferred", skill)}
                          className="px-2.5 py-1 bg-[#171f33] rounded text-xs font-mono border border-slate-700 text-slate-400 flex items-center gap-1"
                        >
                          {skill}
                          <X className="h-3 w-3 opacity-50" />
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </section>

            {(patchVerified.length > 0 || patchRejected.length > 0 || patchGaps.length > 0) &&
              masterResumeId &&
              savedJobId && (
                <PatchDiffReview
                  verified={patchVerified}
                  rejected={patchRejected}
                  gaps={patchGaps}
                  masterResumeId={masterResumeId}
                  masterTypstSource={masterTypstSource || activeVariantContent}
                  jobId={savedJobId}
                  onApplySuccess={(_variantId, mergedContent) => {
                    setActiveVariantContent(mergedContent);
                    setSaveStatus("Tailored variant applied — ATS will re-score against updated content.");
                  }}
                />
              )}

            <section className="glass-panel rounded-lg p-5 flex flex-col glow-hover transition-shadow">
              <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-800/60">
                <span className="material-symbols-outlined text-[#ff8c00] text-sm" data-icon="edit_document">edit_document</span>
                <h2 className="font-mono text-xs text-[#ff8c00] uppercase tracking-wider font-bold">Generated Cover Letter</h2>
              </div>
              {savedJobId ? (
                <CoverLetterPanel
                  jobId={savedJobId}
                  company={company}
                  roleTitle={roleTitle}
                  rawDescription={rawDescription}
                  extractedRequirements={extractedRequirements || undefined}
                />
              ) : (
                <p className="text-xs text-slate-400">
                  Paste a job description to create a saved job, then generate an evidence-grounded cover letter.
                </p>
              )}
            </section>
          </div>

          <div className="xl:col-span-4 flex flex-col gap-6">
            {extractedRequirements && (activeVariantContent || masterTypstSource) ? (
              <section className="glass-panel rounded-lg p-5 overflow-hidden">
                <AtsScorePanel
                  typstContent={activeVariantContent || masterTypstSource}
                  extractedRequirements={extractedRequirements}
                  roleTitle={roleTitle}
                  rawDescription={rawDescription}
                  includeEvidenceBank
                  className="!bg-transparent !border-0 !shadow-none !p-0"
                />
              </section>
            ) : (
              <section className="glass-panel rounded-lg p-5 text-xs text-slate-400">
                Extract job requirements to run ATS scoring against your master resume and Evidence Bank.
              </section>
            )}

            <section className="glass-panel rounded-lg p-5">
              <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-800/60">
                <span className="material-symbols-outlined text-[#ff8c00] text-sm" data-icon="database">database</span>
                <h2 className="font-mono text-xs text-[#ff8c00] uppercase tracking-wider font-bold">Evidence Matches</h2>
              </div>
              <div className="space-y-3">
                {isMatching && (
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Matching Evidence Bank...
                  </div>
                )}
                {!isMatching && matches.length === 0 && (
                  <p className="text-xs text-slate-500">No evidence matches yet. Re-scan after updating the Evidence Bank.</p>
                )}
                {matches.slice(0, 6).map((m) => (
                  <div
                    key={m.id}
                    className="p-3 bg-[#171f33] border border-slate-700/60 rounded hover:border-[#ff8c00]/50 transition-colors"
                  >
                    <div className="flex justify-between items-start mb-1 gap-2">
                      <h4 className="font-bold text-sm text-white">{m.title}</h4>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                          m.matchPercentage >= 60
                            ? "bg-[#062c24] border-[#065f46] text-[#34d399]"
                            : "bg-slate-800 text-slate-400 border-slate-700"
                        }`}
                      >
                        {m.matchPercentage}% · {m.matchPercentage >= 60 ? "High" : "Low"} Match
                      </span>
                    </div>
                    <p className="font-mono text-xs text-slate-400 mb-2">
                      {m.organization ? `@ ${m.organization}` : ""}
                      {m.dates ? ` • ${m.dates}` : ""}
                      {m.isDraft ? " · draft" : ""}
                    </p>
                    <p className="text-xs text-slate-300 line-clamp-2">{m.verifiedSummary}</p>
                    {m.matchedRequirements.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {m.matchedRequirements.slice(0, 4).map((req) => (
                          <span
                            key={req}
                            data-testid="matched-req-badge"
                            className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700"
                          >
                            {req}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
