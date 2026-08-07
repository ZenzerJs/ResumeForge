"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  FileText,
  Briefcase,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  X,
  Plus,
  ArrowRight,
  Database,
  Search,
  BookOpen,
  Loader2,
  Settings,
  Wand2,
} from "lucide-react";
import { JobRequirements } from "@/lib/jd-parser/types";
import { PatchDiffReview } from "./patch-diff-review";
import { AtsScorePanel } from "./ats-score-panel";
import { CoverLetterPanel } from "./cover-letter-panel";
import type { PatchProposal, Gap, RejectedPatch } from "@/lib/ai/patch-schema";

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

const SAMPLE_BACKEND_JD = `Senior Backend Engineer — Acme Corp

Role Overview:
We are looking for a Senior Backend Engineer to build high-performance distributed systems.

Required Qualifications:
- 4+ years of professional software engineering experience with Node.js, Python, or Go.
- Deep expertise in PostgreSQL database design, SQL query optimization, and Redis caching.
- Strong hands-on experience with Docker, Kubernetes, and AWS cloud architecture.
- Demonstrated experience building REST APIs and microservices.

Preferred Qualifications:
- Experience with GraphQL, TypeScript, and Kafka event streams.
- Background in System Design and Performance Optimization.`;

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
  const [company, setCompany] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [rawDescription, setRawDescription] = useState("");

  const [extractedRequirements, setExtractedRequirements] = useState<JobRequirements | null>(null);
  const [matches, setMatches] = useState<RankedMatch[]>([]);

  const [newRequiredTerm, setNewRequiredTerm] = useState("");
  const [newPreferredTerm, setNewPreferredTerm] = useState("");
  const [newDomainTerm, setNewDomainTerm] = useState("");

  const [isExtracting, setIsExtracting] = useState(false);
  const [isMatching, setIsMatching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Phase 4.2: AI Patch Generation state
  const [isGeneratingPatches, setIsGeneratingPatches] = useState(false);
  const [patchVerified, setPatchVerified] = useState<PatchProposal[]>([]);
  const [patchRejected, setPatchRejected] = useState<RejectedPatch[]>([]);
  const [patchGaps, setPatchGaps] = useState<Gap[]>([]);
  const [masterResumeId, setMasterResumeId] = useState<string | null>(null);
  const [masterTypstSource, setMasterTypstSource] = useState<string>("");
  const [activeVariantContent, setActiveVariantContent] = useState<string>("");
  const [patchError, setPatchError] = useState<string | null>(null);
  const [savedJobId, setSavedJobId] = useState<string | null>(null);

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
      } catch {
        // Fallback
      }

      try {
        const tRes = await fetch("/templates/starter-resume.typ");
        if (tRes.ok) {
          const text = await tRes.text();
          setMasterTypstSource(text);
          setActiveVariantContent(text);
          return;
        }
      } catch {
        // Fallback
      }

      const defaultSource = `#let resume-section(title) = [ === #title ]\n#resume-section("Skills")\nLanguages: TypeScript, Node.js, Python, PostgreSQL\n#resume-section("Experience")\n*Software Engineer* (2024 - Present)\n- Built REST APIs using Node.js and PostgreSQL.\n`;
      setMasterTypstSource(defaultSource);
      setActiveVariantContent(defaultSource);
    }

    loadMasterOrStarterResume();
  }, []);

  const handleGeneratePatches = async () => {
    if (!extractedRequirements) {
      setPatchError("Please extract requirements from a job description first.");
      return;
    }

    // Load AI settings from localStorage
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
      // Save job first if not already saved
      let jobId = savedJobId;
      if (!jobId) {
        const saveRes = await fetch("/api/jobs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            company: company.trim() || undefined,
            roleTitle: roleTitle.trim() || undefined,
            rawDescription,
            source: "pasted",
            extractedRequirements: extractedRequirements,
          }),
        });
        const saveJson = await saveRes.json();
        if (saveRes.ok && saveJson.success) {
          jobId = saveJson.data.id;
          setSavedJobId(jobId);
        } else {
          setPatchError("Failed to save job posting before patch generation.");
          setIsGeneratingPatches(false);
          return;
        }
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

      // Fetch master resume content for diff merge computation
      if (json.data.masterResumeId) {
        try {
          const masterRes = await fetch(`/api/resumes/${json.data.masterResumeId}`);
          const masterJson = await masterRes.json();
          if (masterRes.ok && masterJson.success) {
            setMasterTypstSource(masterJson.data.typstSource || "");
            setActiveVariantContent(masterJson.data.typstSource || "");
          }
        } catch {
          // Non-fatal — user can still review patches
        }
      }
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

      // Automatically trigger matching after successful extraction
      await fetchMatches(json.data);
    } catch (err) {
      setErrorMessage(String(err));
    } finally {
      setIsExtracting(false);
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

  const handleAddRequirement = (category: "required" | "preferred" | "domain") => {
    if (!extractedRequirements) return;

    let termToAdd = "";
    if (category === "required") {
      termToAdd = newRequiredTerm.trim();
      if (!termToAdd) return;
      if (!extractedRequirements.requiredSkills.includes(termToAdd)) {
        const updated = {
          ...extractedRequirements,
          requiredSkills: [...extractedRequirements.requiredSkills, termToAdd],
        };
        setExtractedRequirements(updated);
        fetchMatches(updated);
      }
      setNewRequiredTerm("");
    } else if (category === "preferred") {
      termToAdd = newPreferredTerm.trim();
      if (!termToAdd) return;
      if (!extractedRequirements.preferredSkills.includes(termToAdd)) {
        const updated = {
          ...extractedRequirements,
          preferredSkills: [...extractedRequirements.preferredSkills, termToAdd],
        };
        setExtractedRequirements(updated);
        fetchMatches(updated);
      }
      setNewPreferredTerm("");
    } else if (category === "domain") {
      termToAdd = newDomainTerm.trim();
      if (!termToAdd) return;
      if (!extractedRequirements.domainTerms.includes(termToAdd)) {
        const updated = {
          ...extractedRequirements,
          domainTerms: [...extractedRequirements.domainTerms, termToAdd],
        };
        setExtractedRequirements(updated);
        fetchMatches(updated);
      }
      setNewDomainTerm("");
    }
  };

  const handleSaveJob = async () => {
    if (!rawDescription.trim()) {
      setErrorMessage("Please enter a job description to save.");
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSaveStatus(null);

    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: company.trim() || undefined,
          roleTitle: roleTitle.trim() || undefined,
          rawDescription,
          source: "pasted",
          extractedRequirements: extractedRequirements || {
            requiredSkills: [],
            preferredSkills: [],
            domainTerms: [],
          },
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setErrorMessage(json.error || "Failed to save job posting.");
      } else {
        setSaveStatus("Job posting saved successfully!");
        if (json.data?.id) {
          setSavedJobId(json.data.id);
        }
      }
    } catch (err) {
      setErrorMessage(String(err));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Header Bar */}
      <header className="border-b border-slate-800 bg-slate-900/90 px-6 py-4 flex items-center justify-between sticky top-0 z-20 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Briefcase className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-semibold text-lg tracking-tight text-white flex items-center gap-2">
              Job Tailoring & Requirement Matcher
              <span className="text-xs font-mono bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-full">
                Phase 3 Rule-Based Engine
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Deterministic parsing & tag overlap recommendation — protected master resume
            </p>
          </div>
        </div>

        <nav className="flex items-center gap-4">
          <Link
            href="/editor"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition"
          >
            <FileText className="h-3.5 w-3.5" />
            Resume Editor
          </Link>
          <Link
            href="/library"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition"
          >
            <BookOpen className="h-3.5 w-3.5" />
            Evidence Bank
          </Link>
        </nav>
      </header>

      {/* Main Workspace Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Job Description Input & Sample Buttons */}
        <section className="lg:col-span-6 flex flex-col gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <FileText className="h-4 w-4 text-indigo-400" />
                Target Job Posting
              </h2>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>Quick Fill:</span>
                <button
                  type="button"
                  onClick={() => {
                    setRawDescription(SAMPLE_BACKEND_JD);
                    setCompany("Acme Corp");
                    setRoleTitle("Senior Backend Engineer");
                  }}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded text-xs font-medium transition"
                  data-testid="sample-backend-btn"
                >
                  Backend Posting
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRawDescription(SAMPLE_FRONTEND_JD);
                    setCompany("WebCraft Systems");
                    setRoleTitle("Frontend Engineer");
                  }}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded text-xs font-medium transition"
                  data-testid="sample-frontend-btn"
                >
                  Frontend Posting
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Company (Optional)</label>
                <input
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="e.g. Acme Corp"
                  className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Role Title (Optional)</label>
                <input
                  type="text"
                  value={roleTitle}
                  onChange={(e) => setRoleTitle(e.target.value)}
                  placeholder="e.g. Senior Backend Engineer"
                  className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Raw Job Description Text</label>
              <textarea
                value={rawDescription}
                onChange={(e) => setRawDescription(e.target.value)}
                placeholder="Paste the full job posting requirements and responsibilities here..."
                rows={12}
                data-testid="jd-textarea"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {errorMessage && (
              <div className="p-3 bg-red-950/50 border border-red-800/50 rounded-lg flex items-center gap-2 text-xs text-red-300">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {saveStatus && (
              <div className="p-3 bg-emerald-950/50 border border-emerald-800/50 rounded-lg flex items-center gap-2 text-xs text-emerald-300">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{saveStatus}</span>
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleExtract}
                disabled={isExtracting || !rawDescription.trim()}
                data-testid="extract-reqs-btn"
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-xs px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 transition"
              >
                <Sparkles className="h-4 w-4" />
                {isExtracting ? "Extracting Requirements..." : "Extract Requirements"}
              </button>

              <button
                type="button"
                onClick={handleSaveJob}
                disabled={isSaving || !rawDescription.trim()}
                data-testid="save-job-btn"
                className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs px-4 py-2.5 rounded-lg flex items-center gap-1.5 transition"
              >
                <Database className="h-3.5 w-3.5" />
                {isSaving ? "Saving..." : "Save Job"}
              </button>
            </div>
          </div>

          {/* Extracted Requirements Review Card */}
          {extractedRequirements && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Search className="h-4 w-4 text-emerald-400" />
                  Extracted Requirements Editor
                </h3>
                <span className="text-xs text-slate-400">Click &apos;X&apos; to remove incorrect terms</span>
              </div>

              {/* Required Skills */}
              <div>
                <label className="block text-xs font-semibold text-indigo-300 mb-2">
                  Required Skills & Technologies ({extractedRequirements.requiredSkills.length})
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {extractedRequirements.requiredSkills.map((term) => (
                    <span
                      key={term}
                      data-testid={`req-skill-${term}`}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-indigo-950 border border-indigo-800/60 text-indigo-200"
                    >
                      {term}
                      <button
                        type="button"
                        onClick={() => handleRemoveRequirement("required", term)}
                        data-testid={`remove-term-${term}`}
                        className="text-indigo-400 hover:text-indigo-100 transition"
                        title="Remove term"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  {extractedRequirements.requiredSkills.length === 0 && (
                    <span className="text-xs text-slate-500 italic">No required skills detected</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newRequiredTerm}
                    onChange={(e) => setNewRequiredTerm(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddRequirement("required")}
                    placeholder="Add custom required skill..."
                    className="flex-1 bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs text-white placeholder-slate-600 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddRequirement("required")}
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs flex items-center gap-1"
                  >
                    <Plus className="h-3 w-3" /> Add
                  </button>
                </div>
              </div>

              {/* Preferred Skills */}
              <div>
                <label className="block text-xs font-semibold text-amber-300 mb-2">
                  Preferred Skills / Nice to Have ({extractedRequirements.preferredSkills.length})
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {extractedRequirements.preferredSkills.map((term) => (
                    <span
                      key={term}
                      data-testid={`pref-skill-${term}`}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-amber-950/60 border border-amber-800/60 text-amber-200"
                    >
                      {term}
                      <button
                        type="button"
                        onClick={() => handleRemoveRequirement("preferred", term)}
                        data-testid={`remove-term-${term}`}
                        className="text-amber-400 hover:text-amber-100 transition"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  {extractedRequirements.preferredSkills.length === 0 && (
                    <span className="text-xs text-slate-500 italic">No preferred skills detected</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newPreferredTerm}
                    onChange={(e) => setNewPreferredTerm(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddRequirement("preferred")}
                    placeholder="Add custom preferred skill..."
                    className="flex-1 bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs text-white placeholder-slate-600 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddRequirement("preferred")}
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs flex items-center gap-1"
                  >
                    <Plus className="h-3 w-3" /> Add
                  </button>
                </div>
              </div>

              {/* Domain Terms */}
              <div>
                <label className="block text-xs font-semibold text-emerald-300 mb-2">
                  Domain Concepts & System Architecture ({extractedRequirements.domainTerms.length})
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {extractedRequirements.domainTerms.map((term) => (
                    <span
                      key={term}
                      data-testid={`domain-term-${term}`}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-950/60 border border-emerald-800/60 text-emerald-200"
                    >
                      {term}
                      <button
                        type="button"
                        onClick={() => handleRemoveRequirement("domain", term)}
                        data-testid={`remove-term-${term}`}
                        className="text-emerald-400 hover:text-emerald-100 transition"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  {extractedRequirements.domainTerms.length === 0 && (
                    <span className="text-xs text-slate-500 italic">No domain terms detected</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newDomainTerm}
                    onChange={(e) => setNewDomainTerm(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddRequirement("domain")}
                    placeholder="Add custom domain term..."
                    className="flex-1 bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs text-white placeholder-slate-600 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddRequirement("domain")}
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs flex items-center gap-1"
                  >
                    <Plus className="h-3 w-3" /> Add
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Right Column: Ranked Evidence Recommendations */}
        <section className="lg:col-span-6 flex flex-col gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-indigo-400" />
                  Ranked Evidence Bank Matches
                </h2>
                <p className="text-xs text-slate-400">
                  Matches derived from tag and bullet technology overlap with target JD
                </p>
              </div>
              <button
                type="button"
                onClick={() => extractedRequirements && fetchMatches(extractedRequirements)}
                disabled={isMatching || !extractedRequirements}
                data-testid="find-matches-btn"
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-200 rounded-md flex items-center gap-1 transition"
              >
                <Search className="h-3.5 w-3.5" />
                Re-Match
              </button>
            </div>

            {isMatching && (
              <div className="text-center py-12 text-slate-400 text-xs animate-pulse">
                Evaluating Evidence Bank items against extracted requirements...
              </div>
            )}

            {!isMatching && matches.length === 0 && (
              <div className="text-center py-12 text-slate-500 text-xs space-y-2">
                <BookOpen className="h-8 w-8 mx-auto text-slate-600" />
                <p>No matching evidence bank items found yet.</p>
                <p className="text-slate-600">
                  Extract requirements from a job posting to view ranked evidence recommendations.
                </p>
              </div>
            )}

            {!isMatching && matches.length > 0 && (
              <div className="space-y-4" data-testid="evidence-matches-list">
                {matches.map((item) => (
                  <div
                    key={item.id}
                    data-testid={`match-card-${item.id}`}
                    className="bg-slate-950 border border-slate-800/80 hover:border-slate-700 rounded-xl p-4 transition space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-sm text-white">{item.title}</h4>
                          {item.organization && (
                            <span className="text-xs text-slate-400">@ {item.organization}</span>
                          )}
                          <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                            {item.type}
                          </span>
                          {/* Unverified Draft Badge */}
                          {item.isDraft && (
                            <span
                              data-testid="draft-unverified-badge"
                              className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800/80 flex items-center gap-1"
                            >
                              <AlertTriangle className="h-3 w-3" /> Unverified Draft
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-300 mt-1">{item.verifiedSummary}</p>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="inline-block px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-950 text-indigo-300 border border-indigo-800">
                          {item.matchPercentage}% Match
                        </span>
                        <div className="text-[10px] text-slate-500 mt-1 font-mono">{item.score} pts</div>
                      </div>
                    </div>

                    {/* Satisfied Requirements Badges */}
                    <div>
                      <div className="text-[11px] font-medium text-slate-400 mb-1">
                        Satisfied Requirements:
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {item.matchedRequirements.map((req) => (
                          <span
                            key={req}
                            data-testid="matched-req-badge"
                            className="px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-950/80 text-emerald-300 border border-emerald-800/80 flex items-center gap-1"
                          >
                            <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                            {req}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Bullets */}
                    {item.matchedBullets.length > 0 && (
                      <div className="border-t border-slate-900 pt-2 space-y-1.5">
                        <div className="text-[11px] text-slate-400">Supporting Verified Bullets:</div>
                        {item.matchedBullets.map((bullet) => (
                          <div
                            key={bullet.id}
                            className="text-xs text-slate-300 bg-slate-900/60 p-2 rounded border border-slate-800/60 flex items-start gap-2"
                          >
                            <ArrowRight className="h-3.5 w-3.5 text-indigo-400 shrink-0 mt-0.5" />
                            <div className="space-y-1">
                              <p>{bullet.text}</p>
                              <div className="flex flex-wrap gap-1">
                                {bullet.technologies.map((tech) => (
                                  <span
                                    key={tech}
                                    className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded"
                                  >
                                    {tech}
                                  </span>
                                ))}
                                {!bullet.verified && (
                                  <span className="text-[10px] text-amber-400 bg-amber-950 px-1.5 py-0.5 rounded font-mono">
                                    unverified
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Phase 4.2: AI Patch Generation Section */}
      {extractedRequirements && (
        <div className="max-w-7xl w-full mx-auto px-6 pb-8 space-y-6">
          <div className="border-t border-slate-800 pt-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <Wand2 className="h-4 w-4 text-indigo-400" />
                AI Patch Generator
                <span className="text-xs font-mono bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-full">
                  Phase 4.2 BYOK AI
                </span>
              </h2>
              <div className="flex items-center gap-2">
                <Link
                  href="/settings"
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-300 rounded-md flex items-center gap-1.5 transition"
                >
                  <Settings className="h-3.5 w-3.5" />
                  AI Settings
                </Link>
                <button
                  type="button"
                  onClick={handleGeneratePatches}
                  disabled={isGeneratingPatches}
                  data-testid="generate-patches-btn"
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-xs px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg shadow-indigo-600/20 transition"
                >
                  {isGeneratingPatches ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating Patches...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Generate AI Patches
                    </>
                  )}
                </button>
              </div>
            </div>

            {patchError && (
              <div className="p-3 bg-red-950/50 border border-red-800/50 rounded-lg flex items-center gap-2 text-xs text-red-300 mb-4">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{patchError}</span>
              </div>
            )}

            {(patchVerified.length > 0 || patchRejected.length > 0 || patchGaps.length > 0) && masterResumeId && savedJobId && (
              <PatchDiffReview
                verified={patchVerified}
                rejected={patchRejected}
                gaps={patchGaps}
                masterResumeId={masterResumeId}
                masterTypstSource={masterTypstSource}
                jobId={savedJobId}
                onApplySuccess={(variantId, mergedContent) => {
                  setActiveVariantContent(mergedContent);
                }}
              />
            )}

            {extractedRequirements && (
              <div className="pt-6 space-y-6">
                <AtsScorePanel
                  typstContent={activeVariantContent || masterTypstSource || "// Master Resume"}
                  extractedRequirements={extractedRequirements}
                  roleTitle={roleTitle}
                />

                {savedJobId && (
                  <CoverLetterPanel
                    jobId={savedJobId}
                    company={company}
                    roleTitle={roleTitle}
                    rawDescription={rawDescription}
                    extractedRequirements={extractedRequirements}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
