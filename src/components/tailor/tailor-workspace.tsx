"use client";

import React, { useState, useEffect, useRef, useDeferredValue, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  X,
  Loader2,
  Briefcase,
  ClipboardCheck,
  FileText,
  Database,
  XCircle,
} from "lucide-react";
import { JobRequirements } from "@/lib/jd-parser/types";
import { RoleProfile, ROLE_PROFILES, AtsEvaluationResult } from "@/lib/ats-evaluator/types";
import { auditResume } from "@/lib/diagnostics/auditResume";
import { resolveClientProviderConfig } from "@/lib/byok-vault";
import { getDemoContextFromBrowser, initializeDemoSamples } from "@/lib/demo-client";
import { DEMO_JOB } from "@/lib/demo-samples";
import dynamic from "next/dynamic";
import { PatchDiffReview } from "./patch-diff-review";
import { AtsScorePanel } from "./ats-score-panel";

const CoverLetterPanel = dynamic(
  () => import("./cover-letter-panel").then((mod) => mod.CoverLetterPanel),
  {
    loading: () => (
      <div className="p-6 flex items-center justify-center text-slate-500 font-mono text-xs">
        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading Cover Letter Panel...
      </div>
    ),
    ssr: false,
  }
);

const TailorDiagnosticPanel = dynamic(
  () => import("./tailor-diagnostic-panel").then((mod) => mod.TailorDiagnosticPanel),
  {
    loading: () => (
      <div className="p-6 flex items-center justify-center text-slate-500 font-mono text-xs">
        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading Diagnostics...
      </div>
    ),
    ssr: false,
  }
);
import type { PatchProposal, Gap, RejectedPatch } from "@/lib/ai/patch-schema";
import { AppShell } from "@/components/design-system/app-shell";
import { PageSkeleton } from "@/components/design-system/page-skeleton";
import { isPlaceholderDescription } from "@/lib/ingestion/helpers";
import { JD_PASTE_TEMPLATE, convertHtmlToCleanMarkdown } from "@/lib/ingestion/jd-format";
import { AiProgress, type AiJobStage } from "@/components/ui/ai-progress";
import { QuickAddEvidenceModal } from "./quick-add-evidence-modal";
import {
  parseJobDescriptionDocument,
  createUserRequirement,
  JobDescriptionDocument,
  ProvenanceRequirement,
} from "@/lib/jd/document-pipeline";
import { Plus, Columns3 } from "lucide-react";
import { TechDiffPillList } from "@/components/tracker/tech-diff-pill-list";
import { tokenizeHighlightedJd } from "@/lib/jd/highlight-keywords";
import type { ResumeFacts } from "@/lib/facts/types";

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

function renderHighlightedJd(text: string, skills: string[]) {
  if (!text) return null;
  const tokens = tokenizeHighlightedJd(text, skills);

  return (
    <span className="whitespace-pre-wrap leading-relaxed">
      {tokens.map((token, idx) => {
        if (token.isMatch) {
          return (
            <mark
              key={idx}
              className="bg-amber-500/25 text-amber-300 font-semibold px-1 py-0.5 rounded border border-amber-500/40"
            >
              {token.text}
            </mark>
          );
        }
        return <span key={idx}>{token.text}</span>;
      })}
    </span>
  );
}

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

  const [selectedRoleProfile, setSelectedRoleProfile] = useState<RoleProfile>("Full-stack");
  const tabParam = searchParams.get("tab");
  type TailorWorkspaceTab = "overview" | "job-info" | "3-pane" | "diagnostic";
  const [activeTab, setActiveTab] = useState<TailorWorkspaceTab>(
    tabParam === "overview" || tabParam === "cover-letter"
      ? "overview"
      : tabParam === "3-pane"
      ? "3-pane"
      : tabParam === "diagnostic"
      ? "diagnostic"
      : "job-info"
  );
  const [previousTab, setPreviousTab] = useState<TailorWorkspaceTab>(
    tabParam === "3-pane" ? "3-pane" : "overview"
  );
  const [highlightCoverLetter, setHighlightCoverLetter] = useState(tabParam === "cover-letter");

  useEffect(() => {
    if (tabParam === "cover-letter") {
      setActiveTab("overview");
      setHighlightCoverLetter(true);
      const timer = setTimeout(() => {
        const el = document.getElementById("cover-letter-section");
        el?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
      return () => clearTimeout(timer);
    }
    if (tabParam === "overview" || tabParam === "3-pane" || tabParam === "job-info" || tabParam === "diagnostic") {
      setActiveTab(tabParam);
      setHighlightCoverLetter(false);
    }
  }, [tabParam]);
  const [jobInfoSubTab, setJobInfoSubTab] = useState<"structured" | "original" | "details">("original");
  const [newUserReqText, setNewUserReqText] = useState("");
  const [customUserReqs, setCustomUserReqs] = useState<ProvenanceRequirement[]>([]);

  const deferredDescription = useDeferredValue(rawDescription);
  const jobDoc = useMemo(() => {
    return parseJobDescriptionDocument({
      text: deferredDescription,
      sourceKind: "PASTED",
    });
  }, [deferredDescription]);

  const [gapSkillToResolve, setGapSkillToResolve] = useState<string | null>(null);
  const [isAutoScanning, setIsAutoScanning] = useState(false);
  const [matches, setMatches] = useState<RankedMatch[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isMatching, setIsMatching] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [isGeneratingPatches, setIsGeneratingPatches] = useState(false);
  const [patchStage, setPatchStage] = useState<AiJobStage>("done");
  const [patchVerified, setPatchVerified] = useState<PatchProposal[]>([]);
  const [patchRejected, setPatchRejected] = useState<RejectedPatch[]>([]);
  const [patchGaps, setPatchGaps] = useState<Gap[]>([]);
  const [patchBatch, setPatchBatch] = useState<{ batchId: string; revisionToken: string; baseTypstSource: string; jobId: string } | null>(null);
  const [patchReviewGeneration, setPatchReviewGeneration] = useState(0);
  const [demoPatchBaseSource, setDemoPatchBaseSource] = useState<string | null>(null);
  const [masterResumeId, setMasterResumeId] = useState<string | null>(null);
  const [masterTypstSource, setMasterTypstSource] = useState<string>("");
  const [masterFactsSnapshot, setMasterFactsSnapshot] = useState<ResumeFacts | null>(null);
  const [activeVariantContent, setActiveVariantContent] = useState<string>("");
  const [patchError, setPatchError] = useState<string | null>(null);
  const [savedJobId, setSavedJobId] = useState<string | null>(null);
  const savedJobIdRef = useRef<string | null>(null);
  const userEditedRef = useRef(false);
  const saveQueueRef = useRef(Promise.resolve());
  const roleTitleRef = useRef(roleTitle);
  const scanGenerationRef = useRef(0);
  roleTitleRef.current = roleTitle;

  const [isTier2Fetching, setIsTier2Fetching] = useState<boolean>(false);
  const [tier2Status, setTier2Status] = useState<{ type: "loading" | "success" | "error"; message: string } | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  const [, setAtsResult] = useState<AtsEvaluationResult | null>(null);

  const diagnosticReport = useMemo(() => {
    if (activeTab !== "diagnostic") return undefined;
    return auditResume({
      resumeText: activeVariantContent || masterTypstSource || "",
      requiredSkills: extractedRequirements?.requiredSkills || [],
      preferredSkills: extractedRequirements?.preferredSkills || [],
    });
  }, [activeTab, activeVariantContent, masterTypstSource, extractedRequirements]);

  useEffect(() => {
    async function loadMasterOrStarterResume() {
      try {
        const config = await (await fetch("/api/demo-config")).json();
        if (config?.demoMode) {
          initializeDemoSamples();
          setCompany(DEMO_JOB.company);
          setRoleTitle(DEMO_JOB.roleTitle);
          setRawDescription(DEMO_JOB.rawDescription);
          setExtractedRequirements({
            requiredSkills: ["TypeScript", "PostgreSQL"],
            preferredSkills: ["AWS"],
            domainTerms: ["product analytics"],
            roleTitle: DEMO_JOB.roleTitle,
            company: DEMO_JOB.company,
          });
        }
        if (config?.demoMode) {
          let localSource = localStorage.getItem("resumeforge_typst_source");
          if (!localSource) {
            const starterResponse = await fetch("/templates/starter-resume.typ").catch(() => null);
            localSource = starterResponse?.ok ? await starterResponse.text() : `// Local demo draft\n= Resume\n\n== Skills\nTypeScript, PostgreSQL\n`;
            localStorage.setItem("resumeforge_typst_source", localSource);
            localStorage.setItem("resumeforge_has_guest_draft", "true");
          }
          setMasterTypstSource(localSource);
          setActiveVariantContent(localSource);
          const frozen = localStorage.getItem("resumeforge_demo_master_facts");
          setMasterFactsSnapshot(frozen ? JSON.parse(frozen) as ResumeFacts : null);
          return;
        }
      } catch {}
      try {
        const res = await fetch("/api/resumes");
        const json = await res.json();
        if (res.ok && json.success && json.data.length > 0) {
          const master = json.data.find((r: { isMaster: boolean }) => r.isMaster) || json.data[0];
          setMasterResumeId(master.id);
          setMasterTypstSource(master.typstSource);
          setActiveVariantContent(master.typstSource);
          setMasterFactsSnapshot(master.factSnapshot ?? null);
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
        setRawDescription(convertHtmlToCleanMarkdown(json.data.rawDescription));
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
            "Couldn't extract automatically (page requires JavaScript rendering or login). Paste using the Role / Company / Requirements format below.",
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
        const demoConfig = await (await fetch("/api/demo-config")).json().catch(() => ({}));
        if (demoConfig?.demoMode) {
          const rawJobs = localStorage.getItem("resumeforge_guest_jobs");
          const jobs = rawJobs ? JSON.parse(rawJobs) : [];
          const localJob = Array.isArray(jobs) ? jobs.find((item) => item?.id === jobIdParam) : null;
          setSavedJobId(null);
          savedJobIdRef.current = null;
          if (localJob) {
            if (localJob.company) setCompany(localJob.company);
            if (localJob.roleTitle) setRoleTitle(localJob.roleTitle);
            if (localJob.rawDescription) setRawDescription(convertHtmlToCleanMarkdown(localJob.rawDescription));
          }
          return;
        }
        savedJobIdRef.current = jobIdParam;
        setSavedJobId(jobIdParam);
        const res = await fetch(`/api/jobs/${jobIdParam}`);
        const json = await res.json();
        if (res.ok && json.success && json.data) {
          const job = json.data;
          if (job.company) setCompany(job.company);
          if (job.roleTitle) setRoleTitle(job.roleTitle);
          if (job.rawDescription) setRawDescription(convertHtmlToCleanMarkdown(job.rawDescription));
          if (job.id) {
            savedJobIdRef.current = job.id;
            setSavedJobId(job.id);
          }
          sessionStorage.setItem("resumeforge_active_job_id", job.id);

          if (isPlaceholderDescription(job.rawDescription)) {
            triggerTier2Fetch(job.id);
          }
        }
      } catch {}
    }
    loadJobById();
  }, [jobIdParam]);

  const saveJobNow = async (opts?: {
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

    const existingId = savedJobIdRef.current;
    if (existingId) {
      if (opts?.forceUpdate !== false) {
        try {
          const updateRes = await fetch(`/api/jobs/${existingId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const updateJson = await updateRes.json();
          if (updateRes.ok && updateJson.success) {
            setSaveStatus("Job posting saved to database.");
            return existingId;
          }
        } catch {
          // fall through to create if update fails unexpectedly
        }
      }
      return existingId;
    }

    try {
      const saveRes = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          source: "pasted",
        }),
      });
      const saveJson = await saveRes.json().catch(() => ({}));
      if (saveRes.ok && saveJson.success) {
        savedJobIdRef.current = saveJson.data.id;
        setSavedJobId(saveJson.data.id);
        sessionStorage.setItem("resumeforge_active_job_id", saveJson.data.id);
        setSaveStatus("Job posting saved to database.");
        return saveJson.data.id as string;
      }
      if (saveRes.status === 401 || saveJson?.code === "GUEST_READ_ONLY") {
        const guestId = `guest-job-${Date.now()}`;
        savedJobIdRef.current = guestId;
        setSavedJobId(guestId);
        sessionStorage.setItem("resumeforge_active_job_id", guestId);
        try {
          const raw = localStorage.getItem("resumeforge_guest_jobs");
          const list = raw ? JSON.parse(raw) : [];
          const next = Array.isArray(list) ? list : [];
          next.unshift({
            id: guestId,
            company: payload.company || "Target Company",
            roleTitle: payload.roleTitle || "Target Role",
            rawDescription: payload.rawDescription,
            status: "SAVED",
          });
          localStorage.setItem("resumeforge_guest_jobs", JSON.stringify(next));
        } catch {}
        setSaveStatus("Job saved to local workspace.");
        return guestId;
      }
    } catch {}
    return null;
  };

  const ensureJobSaved = (opts?: {
    forceUpdate?: boolean;
    requirements?: JobRequirements | null;
  }): Promise<string | null> => {
    const run = saveQueueRef.current.then(() => saveJobNow(opts));
    saveQueueRef.current = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  };

  const handleGeneratePatches = async () => {
    if (!extractedRequirements) {
      setPatchError("Please extract requirements from a job description first.");
      setPatchStage("error");
      return;
    }

    const aiSettings = await resolveClientProviderConfig();

    if (!aiSettings) {
      setPatchError("No AI provider configured. Please configure your API key in Settings.");
      setPatchStage("error");
      return;
    }

    setIsGeneratingPatches(true);
    setPatchStage("connecting");
    setPatchError(null);
    setPatchVerified([]);
    setPatchRejected([]);
    setPatchGaps([]);
    setPatchBatch(null);
    setDemoPatchBaseSource(null);
    setPatchReviewGeneration((generation) => generation + 1);

    try {
      const demoConfig = await (await fetch("/api/demo-config")).json().catch(() => ({}));
      const isDemo = demoConfig?.demoMode === true;
      let jobId: string | null = null;
      let demoContext: ReturnType<typeof getDemoContextFromBrowser>;
      if (isDemo) {
        demoContext = getDemoContextFromBrowser();
        const currentSource = masterTypstSource || activeVariantContent;
        if (!demoContext?.masterTypst || demoContext.masterTypst !== currentSource) {
          throw new Error("The local resume changed. Reload the demo workspace before generating patches.");
        }
        setDemoPatchBaseSource(currentSource);
      } else {
        jobId = await ensureJobSaved();
        if (!jobId) throw new Error("Failed to save job posting before patch generation.");
      }

      setPatchStage("writing");
      const res = await fetch(isDemo ? "/api/demo/generate-patches" : "/api/ai/generate-patches", {
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
          ...(isDemo ? (demoContext || {}) : { jobId }),
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        setPatchError(json.error || "Failed to generate patches.");
        setPatchStage("error");
        setIsGeneratingPatches(false);
        return;
      }

      setPatchStage("verifying");
      setPatchVerified(json.data.verified || []);
      setPatchRejected(json.data.rejected || []);
      setPatchGaps(json.data.gaps || []);
      setPatchBatch(json.data.batch || null);
      setMasterResumeId(json.data.masterResumeId || (json.data.demo ? "demo-local" : null));
      setPatchStage("done");
    } catch (err) {
      setPatchError(`Error: ${err instanceof Error ? err.message : String(err)}`);
      setPatchStage("error");
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
      setActiveTab("overview");
    } else {
      setErrorMessage("Failed to save job posting.");
    }
  };

  const fetchMatches = async (reqs: JobRequirements, signal?: AbortSignal) => {
    setIsMatching(true);
    try {
      const res = await fetch("/api/jobs/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reqs),
        signal,
      });
      if (signal?.aborted) return;

      const json = await res.json();
      if (res.ok && json.success) {
        setMatches(json.data);
      }
    } catch (err) {
      if (signal?.aborted) return;
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
  // and keep company / role / description / requirements synced in PostgreSQL.
  useEffect(() => {
    if (!userEditedRef.current) return;
    if (!rawDescription.trim()) return;
    const timer = setTimeout(() => {
      void ensureJobSaved({ forceUpdate: true });
    }, 900);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawDescription, company, roleTitle, extractedRequirements]);

  // Auto-rescan debounce when rawDescription changes
  useEffect(() => {
    if (!userEditedRef.current) return;
    if (!rawDescription.trim() || rawDescription.length < 50) return;

    const generation = ++scanGenerationRef.current;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        setIsAutoScanning(true);
        const res = await fetch("/api/jobs/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rawDescription }),
          signal: controller.signal,
        });
        const json = await res.json();
        if (generation !== scanGenerationRef.current) return;
        if (res.ok && json.success && json.data) {
          setExtractedRequirements(json.data);
          if (json.data.roleTitle && !roleTitleRef.current) {
            setRoleTitle(json.data.roleTitle);
          }
          await fetchMatches(json.data, controller.signal);
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error("Auto-rescan error:", err);
      } finally {
        if (generation === scanGenerationRef.current) setIsAutoScanning(false);
      }
    }, 1200);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawDescription]);

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

  const selectedView = activeTab === "overview" && highlightCoverLetter ? "cover-letter" : activeTab;
  return (
    <AppShell variant="tailor">
      <div className="relative z-10 flex-1 pt-8 pb-12 px-4 md:px-8 max-w-[1280px] mx-auto w-full font-body-regular motion-reduce:[&_*]:transition-none motion-reduce:[&_.animate-spin]:animate-none motion-reduce:[&_.animate-pulse]:animate-none">
        <div className="flex justify-between items-end mb-8 gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-[32px] leading-tight font-semibold text-white mb-1">Tailor</h1>
              {isAutoScanning && (
                <span
                  data-testid="auto-scanning-indicator"
                  className="flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-mono text-amber-300 animate-pulse"
                >
                  <Loader2 className="h-3 w-3 animate-spin" /> Auto-rescanning...
                </span>
              )}
            </div>
            <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
              Analyze job requirements and forge targeted materials from your master resume + Evidence Bank.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex min-h-11 items-center gap-3 rounded-lg border border-slate-700 bg-slate-900 px-3">
              <label
                htmlFor="tailor-role-profile-select"
                className="text-sm text-slate-400 font-medium whitespace-nowrap"
              >
                Target Profile:
              </label>
              <select
                id="tailor-role-profile-select"
                value={selectedRoleProfile}
                onChange={(e) => setSelectedRoleProfile(e.target.value as RoleProfile)}
                className="min-h-11 bg-transparent text-sm font-medium text-slate-100 outline-none cursor-pointer focus-visible:ring-2 focus-visible:ring-amber-500"
                data-testid="tailor-role-profile-select"
              >
                {ROLE_PROFILES.map((p) => (
                  <option key={p} value={p} className="bg-slate-900 text-slate-200">
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleGeneratePatches}
              disabled={isGeneratingPatches}
              data-testid="generate-patches-btn"
              className="min-h-11 bg-amber-500 text-slate-950 font-semibold px-5 rounded-lg text-sm hover:bg-amber-400 transition-colors flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 disabled:opacity-60"
            >
              {isGeneratingPatches ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Generate AI patches
            </button>
          </div>
        </div>

        {(jobIdParam || savedJobId) && (
          <div
            data-testid="active-job-header-banner"
            className="mb-6 rounded-xl border border-slate-800 bg-slate-900 px-5 py-4"
          >
            <p className="text-xs font-medium text-slate-400">{company || "Untitled company"}</p>
            <p className="mt-1 break-words text-xl font-semibold leading-snug text-white">{roleTitle || "Untitled role"}</p>
          </div>
        )}

        {(isGeneratingPatches || (patchStage !== "done" && patchStage !== "queued") || patchError) && (
          <div className="mb-4">
            <AiProgress
              stage={patchStage}
              stages={["connecting", "writing", "verifying", "done"]}
              error={patchError}
              onDismissError={() => {
                setPatchError(null);
                setPatchStage("done");
              }}
            />
          </div>
        )}

        {(errorMessage || saveStatus) && (
          <div className="mb-4 space-y-2">
            {errorMessage && (
              <div className="rounded-lg border border-red-800/60 bg-red-950/40 px-3 py-2 text-xs text-red-300 flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5" /> {errorMessage}
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
            className={`mb-4 rounded-lg border px-3 py-2 text-xs flex items-start gap-2 ${
              tier2Status.type === "error"
                ? "border-red-800/60 bg-red-950/40 text-red-300"
                : tier2Status.type === "success"
                ? "border-emerald-800/60 bg-emerald-950/40 text-emerald-300"
                : "border-slate-700 bg-slate-900 text-slate-300"
            }`}
          >
            {isTier2Fetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            <span>{tier2Status.message}</span>
          </div>
        )}

        {/* Tab Navigation */}
        <div
          className="flex flex-wrap items-center gap-1 border-b border-slate-800 pb-2 mb-6 [&>button:focus-visible]:outline [&>button:focus-visible]:outline-2 [&>button:focus-visible]:outline-amber-400 [&>button:focus-visible]:outline-offset-2"
          role="tablist"
          aria-label="Tailor views"
          onKeyDown={(event) => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
            const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
            const current = tabs.indexOf(document.activeElement as HTMLButtonElement);
            if (current < 0) return;
            const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (current + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
            event.preventDefault();
            tabs[next].focus();
            tabs[next].click();
          }}
        >
          <button
            type="button"
            role="tab"
            id="tailor-tab-overview"
            aria-controls="tailor-view-panel"
            tabIndex={selectedView === "overview" ? 0 : -1}
            aria-selected={activeTab === "overview" && !highlightCoverLetter}
            onClick={() => { setHighlightCoverLetter(false); setActiveTab("overview"); }}
            data-testid="tailor-tab-overview"
            className={`flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium transition ${
              activeTab === "overview" && !highlightCoverLetter
                ? "bg-slate-800 text-white"
                : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Overview
          </button>

          <button
            type="button"
            role="tab"
            id="tailor-tab-3-pane"
            aria-controls="tailor-view-panel"
            tabIndex={selectedView === "3-pane" ? 0 : -1}
            aria-selected={activeTab === "3-pane"}
            onClick={() => { setHighlightCoverLetter(false); setActiveTab("3-pane"); }}
            data-testid="tailor-tab-3-pane"
            className={`flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium transition ${
              activeTab === "3-pane"
                ? "bg-slate-800 text-white"
                : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
            }`}
          >
            <Columns3 className="h-3.5 w-3.5" />
            Workspace
          </button>

          <button
            type="button"
            role="tab"
            id="tailor-tab-job-info"
            aria-controls="tailor-view-panel"
            tabIndex={selectedView === "job-info" ? 0 : -1}
            aria-selected={activeTab === "job-info"}
            onClick={() => { setHighlightCoverLetter(false); setActiveTab("job-info"); }}
            data-testid="tailor-tab-job-info"
            className={`flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium transition ${
              activeTab === "job-info"
                ? "bg-slate-800 text-white"
                : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
            }`}
          >
            <Briefcase className="h-3.5 w-3.5" />
            Job info
          </button>

          <button
            type="button"
            role="tab"
            id="tailor-tab-cover-letter"
            aria-controls="tailor-view-panel"
            tabIndex={selectedView === "cover-letter" ? 0 : -1}
            aria-selected={activeTab === "overview" && highlightCoverLetter}
            onClick={() => {
              setActiveTab("overview");
              setHighlightCoverLetter(true);
              setTimeout(() => {
                document.getElementById("cover-letter-section")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
              }, 60);
            }}
            data-testid="tailor-tab-cover-letter"
            className={`flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium transition ${
              activeTab === "overview" && highlightCoverLetter
                ? "bg-slate-800 text-white"
                : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            Cover Letter
          </button>

          <button
            type="button"
            role="tab"
            id="tailor-tab-diagnostic"
            aria-controls="tailor-view-panel"
            tabIndex={selectedView === "diagnostic" ? 0 : -1}
            aria-selected={activeTab === "diagnostic"}
            onClick={() => {
              setHighlightCoverLetter(false);
              setActiveTab("diagnostic");
            }}
            data-testid="tailor-tab-diagnostic"
            className={`flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium transition ${
              activeTab === "diagnostic"
                ? "bg-slate-800 text-white"
                : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
            }`}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            Diagnostics
          </button>
        </div>

        <div id="tailor-view-panel" role="tabpanel" tabIndex={0} aria-labelledby={`tailor-tab-${selectedView}`}>
        {activeTab === "3-pane" ? (
          /* 3-Pane Ergonomic Workspace View */
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6" data-testid="tailor-3pane-container">
            {/* Left Pane: Job Description with keyword highlights & TechDiffPillList */}
            <section
              className="min-w-0 rounded-xl border border-slate-800 bg-slate-900 p-5 flex flex-col gap-4"
              data-testid="tailor-pane-left"
            >
              <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2 min-w-0">
                  <Briefcase className="h-4 w-4 text-[#ff8c00] shrink-0" aria-hidden />
                  <div className="min-w-0">
                    <h2 className="break-words text-lg leading-snug text-white font-semibold">
                      {roleTitle || "Target Job Posting"}
                    </h2>
                    <span className="text-sm text-slate-400 block break-words">
                      {company || "Unspecified Company"}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPreviousTab("3-pane");
                    setActiveTab("job-info");
                  }}
                  data-testid="edit-job-info-btn"
                  className="min-h-11 text-sm text-amber-400 hover:underline shrink-0"
                >
                  Edit Job &amp; Reqs →
                </button>
              </div>

              {extractedRequirements && extractedRequirements.requiredSkills.length > 0 && (
                <div className="space-y-1.5 pb-3 border-b border-slate-800/60">
                  <span className="text-xs text-slate-400 font-medium block">
                    Required Skills &amp; Gaps
                  </span>
                  <TechDiffPillList
                    allRequiredSkills={extractedRequirements.requiredSkills}
                    verifiedSkillNames={extractedRequirements.requiredSkills.filter(skillIsCovered)}
                    missingSkillNames={extractedRequirements.requiredSkills.filter((s) => !skillIsCovered(s))}
                    maxDisplay={10}
                  />
                </div>
              )}

              <div className="flex-1 min-h-0 flex flex-col">
                <span className="text-xs text-slate-400 font-medium mb-2 block">
                  Job Description (Keywords Highlighted)
                </span>
                <div
                  data-testid="tailor-jd-highlighted-view"
                  className="flex-1 overflow-y-auto max-h-[600px] p-4 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-300 space-y-2 leading-relaxed break-words"
                >
                  {renderHighlightedJd(
                    rawDescription,
                    extractedRequirements?.requiredSkills ?? []
                  )}
                </div>
              </div>
            </section>

            {/* Center Pane: Typst AST / source preview & PatchDiffReview */}
            <section
              className="min-w-0 rounded-xl border border-slate-800 bg-slate-900 p-5 flex flex-col gap-4"
              data-testid="tailor-pane-center"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-800/60">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-[#ff8c00] shrink-0" aria-hidden />
                  <h2 className="text-lg text-white font-semibold">
                    Typst AST &amp; Tailoring
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={handleGeneratePatches}
                  disabled={isGeneratingPatches}
                  className="min-h-11 text-sm px-3 rounded-lg border border-slate-700 text-slate-200 font-medium hover:bg-slate-800 transition flex items-center gap-1.5"
                >
                  {isGeneratingPatches ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  Generate Patches
                </button>
              </div>

              {(patchVerified.length > 0 || patchRejected.length > 0 || patchGaps.length > 0) &&
              masterResumeId &&
              (savedJobId || masterResumeId === "demo-local") ? (
                <PatchDiffReview
                  key={`${patchReviewGeneration}-${patchBatch?.batchId || "local"}`}
                  verified={patchVerified}
                  rejected={patchRejected}
                  gaps={patchGaps}
                  masterTypstSource={masterTypstSource || activeVariantContent}
                  jobId={savedJobId || "demo-local-job"}
                  batch={patchBatch}
                  localOnly={masterResumeId === "demo-local"}
                  localBaseTypstSource={demoPatchBaseSource}
                  masterFactsSnapshot={masterFactsSnapshot}
                  onApplySuccess={(_variantId, mergedContent) => {
                    setActiveVariantContent(mergedContent);
                    setSaveStatus("Tailored variant applied — ATS will re-score against updated content.");
                    if (masterResumeId === "demo-local") {
                      setMasterTypstSource(mergedContent);
                      localStorage.setItem("resumeforge_typst_source", mergedContent);
                    }
                  }}
                />
              ) : (
                <div className="flex-1 min-h-0 flex flex-col space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                    <span>Active Buffer ({activeVariantContent ? "Tailored Variant" : "Master Resume"})</span>
                    <span>{(activeVariantContent || masterTypstSource).split("\n").length} lines</span>
                  </div>
                  <pre
                    data-testid="typst-ast-preview"
                    className="flex-1 overflow-y-auto max-h-[600px] p-4 bg-[#060e20] border border-slate-800 rounded font-mono text-[11px] text-slate-300 leading-relaxed whitespace-pre-wrap selection:bg-amber-500/30"
                  >
                    {activeVariantContent || masterTypstSource || "// Loading Typst source..."}
                  </pre>
                </div>
              )}
            </section>

            {/* Right Pane: Real-time deterministic AtsScorePanel */}
            <section
              className="min-w-0 rounded-xl border border-slate-800 bg-slate-900 p-5 flex flex-col gap-4"
              data-testid="tailor-pane-right"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-800/60">
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4 text-[#ff8c00] shrink-0" aria-hidden />
                  <h2 className="text-lg text-white font-semibold">
                    ATS Score &amp; Verification
                  </h2>
                </div>
              </div>

              {extractedRequirements && (activeVariantContent || masterTypstSource) ? (
                <div className="flex-1 min-h-0 overflow-y-auto max-h-[700px] pr-1">
                  <AtsScorePanel
                    appearance="tailor"
                    typstContent={activeVariantContent || masterTypstSource}
                    extractedRequirements={extractedRequirements}
                    roleTitle={roleTitle}
                    rawDescription={rawDescription}
                    initialProfile={selectedRoleProfile}
                    onProfileChange={setSelectedRoleProfile}
                    onEvaluationComplete={setAtsResult}
                    includeEvidenceBank
                    className="!bg-transparent !border-0 !shadow-none !p-0"
                  />
                </div>
              ) : (
                <div className="p-4 rounded border border-slate-800 bg-[#060e20] text-xs text-slate-400 font-mono">
                  Extract job requirements to calculate deterministic ATS match score.
                </div>
              )}
            </section>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)] gap-6">
          <div className="flex flex-col gap-6 min-w-0">
            {activeTab === "overview" ? (
              <>
                {/* Overview Summary Card */}
                <section className="rounded-xl border border-slate-800 bg-slate-900 p-5" data-testid="tailor-overview-panel">
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-4 pb-3 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <Briefcase className="h-4 w-4 text-[#ff8c00] shrink-0" aria-hidden />
                      <h2 className="break-words text-lg leading-snug text-white font-semibold">
                        Target Role: {roleTitle || "Untitled Role"}
                      </h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setPreviousTab("overview");
                        setActiveTab("job-info");
                      }}
                      data-testid="edit-job-info-btn"
                      className="min-h-11 text-sm text-amber-400 hover:underline"
                    >
                      Edit Job &amp; Reqs →
                    </button>
                  </div>

                  <div className="flex flex-col gap-3">
                    <div className="text-sm text-slate-300 break-words">
                      <span className="text-slate-400">Company:</span> {company || "Unspecified"}
                    </div>

                    {extractedRequirements && extractedRequirements.requiredSkills.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-xs text-slate-400 font-medium">
                          Key Required Skills &amp; Gaps:
                        </span>
                        <TechDiffPillList
                          allRequiredSkills={extractedRequirements.requiredSkills}
                          verifiedSkillNames={extractedRequirements.requiredSkills.filter(skillIsCovered)}
                          missingSkillNames={extractedRequirements.requiredSkills.filter((s) => !skillIsCovered(s))}
                          maxDisplay={8}
                        />
                      </div>
                    )}
                  </div>
                </section>

                {(patchVerified.length > 0 || patchRejected.length > 0 || patchGaps.length > 0) &&
                  masterResumeId &&
                  (savedJobId || masterResumeId === "demo-local") && (
                    <PatchDiffReview
                      key={`${patchReviewGeneration}-${patchBatch?.batchId || "local"}`}
                      verified={patchVerified}
                      rejected={patchRejected}
                      gaps={patchGaps}
                      masterTypstSource={masterTypstSource || activeVariantContent}
                      jobId={savedJobId || "demo-local-job"}
                      batch={patchBatch}
                      localOnly={masterResumeId === "demo-local"}
                      localBaseTypstSource={demoPatchBaseSource}
                      masterFactsSnapshot={masterFactsSnapshot}
                      onApplySuccess={(_variantId, mergedContent) => {
                        setActiveVariantContent(mergedContent);
                        setSaveStatus("Tailored variant applied — ATS will re-score against updated content.");
                        if (masterResumeId === "demo-local") {
                          setMasterTypstSource(mergedContent);
                          localStorage.setItem("resumeforge_typst_source", mergedContent);
                        }
                      }}
                    />
                  )}

                <section
                  id="cover-letter-section"
                  data-testid="tailor-cover-letter-section"
                  className={`rounded-xl border border-slate-800 bg-slate-900 p-5 flex flex-col ${
                    highlightCoverLetter ? "ring-2 ring-amber-500/60 border-amber-500/50" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-4 pb-2 border-b border-slate-800/60">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-[#ff8c00] shrink-0" aria-hidden />
                      <h2 className="text-lg text-white font-semibold">
                        Generated Cover Letter
                      </h2>
                    </div>
                    {highlightCoverLetter && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/40 text-amber-300">
                        Active Section
                      </span>
                    )}
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
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-slate-800 bg-[#060e20] p-4">
                      <p className="text-xs text-slate-300">
                        Save the current job posting to generate an evidence-grounded cover letter tailored to{" "}
                        <span className="text-amber-300 font-semibold">{company || "this role"}</span>.
                      </p>
                      <button
                        type="button"
                        onClick={() => void handleSaveJob()}
                        data-testid="unlock-cover-letter-btn"
                        className="shrink-0 rounded-md bg-[#ff8c00] px-3 py-1.5 font-mono text-xs font-bold text-slate-950 hover:bg-amber-400 transition"
                      >
                        Save Job &amp; Unlock Cover Letter
                      </button>
                    </div>
                  )}
                </section>
              </>
            ) : activeTab === "diagnostic" ? (
              <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
                <TailorDiagnosticPanel
                  report={diagnosticReport}
                  typstAst={activeVariantContent}
                  evidence={matches}
                  variantContext={{ masterResumeId, jobId: savedJobId }}
                  onPatchApplied={(patchedTypstAst) => {
                    setActiveVariantContent(patchedTypstAst);
                    setSaveStatus("Deterministic fix applied to working copy — review, then save or re-run guardrail.");
                  }}
                />
              </section>
            ) : (
              <>
                {/* Job Info & Requirements View */}
                <section className="rounded-xl border border-slate-800 bg-slate-900 p-5" data-testid="tailor-job-info-panel">
                  <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800/60">
                    <div className="flex items-center gap-2">
                      <Briefcase className="h-4 w-4 text-[#ff8c00] shrink-0" aria-hidden />
                      <h2 className="text-lg text-white font-semibold">Target Job Posting</h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setHighlightCoverLetter(false); setActiveTab(previousTab); }}
                      data-testid="back-to-overview-btn"
                      className="min-h-11 text-sm text-amber-400 hover:underline"
                    >
                      {previousTab === "3-pane" ? "← Back to 3-Pane Workspace" : "← Back to Overview"}
                    </button>
                  </div>

                  {/* Diagnostics / Confidence Banner */}
                  <div className="mb-4">
                    {jobDoc.diagnostics.status === "VERIFIED_ATS" && (
                      <div
                        data-testid="confidence-banner-verified-ats"
                        className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-800 text-sm text-emerald-300 flex items-start gap-2"
                      >
                        <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                        <span>Verified ATS Source: Loaded directly from official ATS endpoint. No action needed.</span>
                      </div>
                    )}
                    {jobDoc.diagnostics.status === "STRUCTURED_PAGE" && (
                      <div
                        data-testid="confidence-banner-structured-page"
                        className="p-3 rounded-lg bg-blue-950/60 border border-blue-800 text-sm text-blue-300 flex items-start gap-2"
                      >
                        <FileText className="size-4 text-blue-400 shrink-0" />
                        <span>Structured Page Extraction: Review extracted sections before tailoring.</span>
                      </div>
                    )}
                    {jobDoc.diagnostics.status === "PARTIAL_EXTRACTION" && (
                      <div
                        data-testid="confidence-banner-partial-extraction"
                        className="p-3 rounded-lg bg-amber-950/60 border border-amber-800 text-sm text-amber-300 flex items-start gap-2"
                      >
                        <AlertTriangle className="size-4 text-amber-400 shrink-0" />
                        <span>Partial Extraction: Description may be incomplete. Paste full description below.</span>
                      </div>
                    )}
                    {jobDoc.diagnostics.status === "USER_PASTED" && (
                      <div
                        data-testid="confidence-banner-user-pasted"
                        className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-sm text-slate-300 flex items-start gap-2"
                      >
                        <FileText className="size-4 text-slate-400 shrink-0" />
                        <span>User Pasted: Review and edit the job description as needed.</span>
                      </div>
                    )}
                  </div>

                  {/* Sub-tab Selector */}
                  <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-950 p-1 mb-5">
                    <button
                      type="button"
                      onClick={() => setJobInfoSubTab("structured")}
                      data-testid="job-subtab-structured"
                      className={`min-h-11 px-3 text-sm rounded-md transition-colors ${
                        jobInfoSubTab === "structured"
                          ? "bg-slate-800 text-white font-medium"
                          : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                      }`}
                    >
                      Breakdown
                    </button>
                    <button
                      type="button"
                      onClick={() => setJobInfoSubTab("original")}
                      data-testid="job-subtab-original"
                      className={`min-h-11 px-3 text-sm rounded-md transition-colors ${
                        jobInfoSubTab === "original"
                          ? "bg-slate-800 text-white font-medium"
                          : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                      }`}
                    >
                      Original source
                    </button>
                    <button
                      type="button"
                      onClick={() => setJobInfoSubTab("details")}
                      data-testid="job-subtab-details"
                      className={`min-h-11 px-3 text-sm rounded-md transition-colors ${
                        jobInfoSubTab === "details"
                          ? "bg-slate-800 text-white font-medium"
                          : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                      }`}
                    >
                      Extraction details
                    </button>
                  </div>

                  {/* Subtab 1: Structured Breakdown */}
                  {jobInfoSubTab === "structured" && (
                    <div className="space-y-4 text-sm">
                      {/* Sections breakdown */}
                      <div className="space-y-2.5">
                        <span className="text-xs font-medium text-slate-400 block">
                          Document Sections ({jobDoc.sections.length})
                        </span>
                        {jobDoc.sections.map((sec) => (
                          <div
                            key={sec.id}
                            className="p-3 rounded bg-[#060e20] border border-slate-800 space-y-1.5"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-[#ffb77d]">{sec.heading}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-semibold uppercase">
                                {sec.kind}
                              </span>
                            </div>
                            <div className="text-slate-300 text-sm whitespace-pre-wrap leading-relaxed break-words">
                              {sec.markdown}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Add Custom User Requirement */}
                      <div className="p-3 rounded bg-[#060e20] border border-slate-800 space-y-2">
                        <span className="font-semibold text-slate-300 block">
                          Add Custom Requirement (User-Added)
                        </span>
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            type="text"
                            value={newUserReqText}
                            onChange={(e) => setNewUserReqText(e.target.value)}
                            placeholder="e.g. 5+ years Go microservices experience"
                            data-testid="add-user-requirement-input"
                            className="min-w-0 min-h-11 flex-1 bg-slate-900 border border-slate-700 px-3 text-sm text-slate-200 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (!newUserReqText.trim()) return;
                              const newReq = createUserRequirement(newUserReqText.trim());
                              setCustomUserReqs((prev) => [...prev, newReq]);
                              if (extractedRequirements) {
                                setExtractedRequirements({
                                  ...extractedRequirements,
                                  requiredSkills: Array.from(
                                    new Set([...extractedRequirements.requiredSkills, newReq.label])
                                  ),
                                });
                              }
                              setNewUserReqText("");
                            }}
                            data-testid="add-user-requirement-btn"
                            className="min-h-11 px-3 rounded-lg border border-slate-700 text-slate-200 font-medium text-sm hover:bg-slate-800"
                          >
                            Add Requirement
                          </button>
                        </div>
                        {customUserReqs.length > 0 && (
                          <div className="pt-2 space-y-1">
                            <span className="text-[10px] text-slate-400">Custom User Requirements:</span>
                            <div className="flex flex-wrap gap-1.5">
                              {customUserReqs.map((req) => (
                                <span
                                  key={req.id}
                                  className="px-2 py-0.5 rounded bg-amber-950/60 border border-amber-800 text-[11px] text-amber-300 flex items-center gap-1"
                                >
                                  <span>{req.label}</span>
                                  <span className="text-[9px] px-1 rounded bg-amber-900 text-amber-100 font-bold">
                                    USER_ADDED
                                  </span>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Subtab 2: Original Source */}
                  {jobInfoSubTab === "original" && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="tailor-company" className="block text-xs font-medium text-slate-400 mb-2">Company</label>
                          <input
                            id="tailor-company"
                            name="company"
                            type="text"
                            autoComplete="organization"
                            value={company}
                            onChange={(e) => {
                              userEditedRef.current = true;
                              setCompany(e.target.value);
                            }}
                            className="w-full min-h-11 bg-slate-950 border border-slate-700 px-3 text-base sm:text-sm text-slate-100 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
                          />
                        </div>
                        <div>
                          <label htmlFor="tailor-role" className="block text-xs font-medium text-slate-400 mb-2">Role</label>
                          <input
                            id="tailor-role"
                            name="role"
                            type="text"
                            autoComplete="off"
                            value={roleTitle}
                            onChange={(e) => {
                              userEditedRef.current = true;
                              setRoleTitle(e.target.value);
                            }}
                            className="w-full min-h-11 bg-slate-950 border border-slate-700 px-3 text-base sm:text-sm text-slate-100 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
                          />
                          {roleTitle.length > 32 && (
                            <p className="mt-2 break-words text-sm leading-relaxed text-slate-400">{roleTitle}</p>
                          )}
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-400 mb-2 flex flex-wrap items-center justify-between gap-2">
                          <span>Raw Description</span>
                          <button
                            type="button"
                            onClick={handleExtract}
                            disabled={isExtracting}
                            data-testid="extract-reqs-btn"
                            className="min-h-11 text-sm text-amber-400 hover:underline"
                          >
                            {isExtracting ? "Scanning..." : "Extract Requirements"}
                          </button>
                        </label>
                        <textarea
                          value={rawDescription}
                          onChange={(e) => {
                            userEditedRef.current = true;
                            setRawDescription(e.target.value);
                          }}
                          rows={8}
                          data-testid="jd-textarea"
                          aria-label="Job description"
                          placeholder={JD_PASTE_TEMPLATE}
                          className="w-full bg-slate-950 text-slate-200 text-base sm:text-sm p-4 rounded-lg border border-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 resize-y leading-relaxed"
                        />
                        {tier2Status?.type === "error" ? (
                          <pre className="mt-2 whitespace-pre-wrap rounded border border-slate-800 bg-[#060e20] p-3 font-mono text-[10px] leading-relaxed text-slate-500">
                            {JD_PASTE_TEMPLATE}
                          </pre>
                        ) : null}
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            type="button"
                            data-testid="sample-backend-btn"
                            onClick={() => {
                              userEditedRef.current = true;
                              setCompany("Nova Labs");
                              setRoleTitle("Senior Backend Engineer");
                              setRawDescription(SAMPLE_BACKEND_JD);
                            }}
                            className="min-h-11 text-sm px-3 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
                          >
                            Sample Backend JD
                          </button>
                          <button
                            type="button"
                            data-testid="sample-frontend-btn"
                            onClick={() => {
                              userEditedRef.current = true;
                              setCompany("WebCraft Systems");
                              setRoleTitle("Frontend Engineer");
                              setRawDescription(SAMPLE_FRONTEND_JD);
                            }}
                            className="min-h-11 text-sm px-3 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
                          >
                            Sample Frontend JD
                          </button>
                          <button
                            type="button"
                            data-testid="save-job-btn"
                            onClick={() => void handleSaveJob()}
                            className="min-h-11 text-sm px-3 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
                          >
                            Save Job
                          </button>
                          <button
                            type="button"
                            data-testid="open-3pane-tailor-btn"
                            onClick={() => {
                              setPreviousTab("job-info");
                              setActiveTab("3-pane");
                            }}
                            className="min-h-11 text-sm px-3 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white transition"
                          >
                            Open in 3-Pane Tailor →
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Subtab 3: Extraction Details */}
                  {jobInfoSubTab === "details" && (
                    <div className="space-y-3 font-mono text-xs">
                      <div className="p-3 rounded bg-[#060e20] border border-slate-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Ingestion Source Kind:</span>
                          <span className="px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800 font-bold text-[10px]">
                            {jobDoc.sourceKind}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Acquired At:</span>
                          <span className="text-slate-200 text-[11px]">{jobDoc.acquiredAt}</span>
                        </div>
                        <div className="space-y-1">
                          <span className="text-slate-400 block">Content Hash (SHA-256):</span>
                          <code className="block p-1.5 rounded bg-slate-950 border border-slate-800 text-[10px] text-emerald-400 break-all">
                            {jobDoc.contentHash}
                          </code>
                        </div>
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-slate-400">Diagnostics Status:</span>
                          <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold text-[10px]">
                            {jobDoc.diagnostics.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </section>

                <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
                  <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800/60">
                    <div className="flex items-center gap-2">
                      <ClipboardCheck className="h-4 w-4 text-[#ff8c00] shrink-0" aria-hidden />
                      <h2 className="text-lg text-white font-semibold">Extracted Requirements</h2>
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
                              <div
                                key={skill}
                                className={`flex items-center gap-1.5 px-2.5 py-1 bg-[#171f33] rounded text-xs font-mono border ${
                                  covered ? "border-[#4edea3]/40 text-slate-300" : "border-red-500/40 text-slate-300"
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => handleRemoveRequirement("required", skill)}
                                  title="Click to remove"
                                  data-testid={`req-skill-${skill}`}
                                  className="flex items-center gap-1.5 hover:text-white"
                                >
                                  {covered ? (
                                    <CheckCircle2 className="h-3.5 w-3.5 text-[#4edea3] shrink-0" aria-hidden />
                                  ) : (
                                    <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" aria-hidden />
                                  )}
                                  {skill}
                                  <span data-testid={`remove-term-${skill}`} className="inline-flex">
                                    <X className="h-3 w-3 opacity-50" />
                                  </span>
                                </button>
                                {!covered && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setGapSkillToResolve(skill);
                                    }}
                                    data-testid={`resolve-gap-${skill}`}
                                    className="ml-1 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300 hover:bg-amber-500/30 transition-colors flex items-center gap-0.5"
                                    title="Add evidence for this missing skill"
                                  >
                                    <Plus className="h-2.5 w-2.5" />
                                    Add
                                  </button>
                                )}
                              </div>
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
              </>
            )}
          </div>

          <div className="flex flex-col gap-6 min-w-0">
            {extractedRequirements && (activeVariantContent || masterTypstSource) ? (
              <section className="rounded-xl border border-slate-800 bg-slate-900 p-5 min-w-0">
                <AtsScorePanel
                  appearance="tailor"
                  typstContent={activeVariantContent || masterTypstSource}
                  extractedRequirements={extractedRequirements}
                  roleTitle={roleTitle}
                  rawDescription={rawDescription}
                  initialProfile={selectedRoleProfile}
                  onProfileChange={setSelectedRoleProfile}
                  onEvaluationComplete={setAtsResult}
                  includeEvidenceBank
                  className="!bg-transparent !border-0 !shadow-none !p-0"
                />
              </section>
            ) : (
              <section className="rounded-xl border border-slate-800 bg-slate-900 p-5 text-sm text-slate-400">
                Extract job requirements to run ATS scoring against your master resume and Evidence Bank.
              </section>
            )}

            <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-800/60">
                <Database className="h-4 w-4 text-[#ff8c00] shrink-0" aria-hidden />
                <h2 className="text-lg text-white font-semibold">Evidence Matches</h2>
              </div>
              <div className="space-y-3">
                {isMatching && (
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Matching Evidence Bank...
                  </div>
                )}
                {!isMatching && matches.length === 0 && (
                  <p className="text-sm text-slate-400">No evidence matches yet. Re-scan after updating the Evidence Bank.</p>
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
                    <p className="text-sm text-slate-400 mb-2">
                      {m.organization ? `@ ${m.organization}` : ""}
                      {m.dates ? ` • ${m.dates}` : ""}
                      {m.isDraft ? " · draft" : ""}
                    </p>
                    <p className="text-sm leading-relaxed text-slate-300 line-clamp-2">{m.verifiedSummary}</p>
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
        )}
        </div>
      </div>
      <QuickAddEvidenceModal
        isOpen={Boolean(gapSkillToResolve)}
        onClose={() => setGapSkillToResolve(null)}
        initialSkill={gapSkillToResolve || ""}
        onEvidenceCreated={async () => {
          if (extractedRequirements) {
            await fetchMatches(extractedRequirements);
          }
        }}
      />
    </AppShell>
  );
}
