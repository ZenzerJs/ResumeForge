import type { Metadata } from "next";
import Link from "next/link";
import { TopNav } from "@/components/navigation/top-nav";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms and conditions for using ResumeForge workspace and deterministic tools.",
};

export default function TermsPage() {
  return (
    <div className="min-h-dvh bg-background text-on-surface-variant">
      <TopNav />
      <main
        id="main-content"
        className="mx-auto w-full max-w-3xl px-4 pb-16 pt-[calc(6rem+env(safe-area-inset-top))] md:px-8"
      >
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">Legal</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">Terms of Service</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: August 14, 2026</p>

        <div className="mt-8 space-y-8 text-sm leading-relaxed text-on-surface-variant">
          <section>
            <h2 className="text-base font-semibold text-foreground">1. Service Overview</h2>
            <p className="mt-2">
              ResumeForge is an evidence-grounded resume tailoring and document compilation workspace.
              It operates on a guest-ready browser and hosted Postgres workspace with Bring-Your-Own-Key (BYOK)
              AI routing designed to guarantee user ownership of career data and prevent factual hallucination.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground">2. User Ownership of Content</h2>
            <p className="mt-2">
              You retain 100% ownership of your resume documents, evidence items, job tracking data,
              and generated variants. ResumeForge does not claim any intellectual property rights over
              your personal career records or documents.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground">3. BYOK &amp; API Usage</h2>
            <p className="mt-2">
              When you supply your own API keys (e.g. OpenAI, Anthropic, Gemini, or local models),
              you are responsible for complying with the respective provider terms. API keys remain in
              your browser storage and are never resold or used for training central models.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground">4. Evidence Grounding &amp; Accuracy</h2>
            <p className="mt-2">
              ResumeForge provides deterministic guardrails to prevent AI fabrication. However, you
              remain ultimately responsible for reviewing and certifying the accuracy of all resume
              submissions and job applications made with tailored documents.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground">5. Disclaimer of Warranties</h2>
            <p className="mt-2">
              The service is provided &ldquo;as is&rdquo; without warranties of any kind. ResumeForge does
              not guarantee specific interview offers or employment outcomes.
            </p>
          </section>
        </div>

        <p className="mt-10 text-xs text-muted-foreground">
          <Link
            href="/"
            className="text-primary hover:underline rounded-[4px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Back to home
          </Link>
        </p>
      </main>
    </div>
  );
}
