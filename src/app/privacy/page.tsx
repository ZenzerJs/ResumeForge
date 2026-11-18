import type { Metadata } from "next";
import Link from "next/link";
import { TopNav } from "@/components/navigation/top-nav";
import { WorkspaceAtmosphere } from "@/components/design-system/workspace-atmosphere";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How ResumeForge handles resume data, guest sessions, accounts, and AI API keys you provide.",
};

export default function PrivacyPage() {
  return (
    <div className="relative min-h-dvh bg-background text-on-surface-variant">
      <WorkspaceAtmosphere variant="quiet" />
      <TopNav />
      <main
        id="main-content"
        tabIndex={-1}
        className="relative z-10 mx-auto w-full max-w-3xl px-4 pb-16 pt-[calc(6rem+env(safe-area-inset-top))] outline-none scroll-mt-16 md:px-8"
      >
        <p className="font-mono text-sm uppercase tracking-[0.2em] text-primary">Legal</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">Privacy Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: August 12, 2026</p>

        <div className="mt-8 space-y-8 text-sm leading-relaxed text-on-surface-variant">
          <section>
            <h2 className="text-base font-semibold text-foreground">What ResumeForge is</h2>
            <p className="mt-2">
              ResumeForge is an open-source resume workspace built by a Wilfrid Laurier University CS
              student. You can inspect the source code on{" "}
              <a
                href="https://github.com/ZenzerJs/ResumeForge"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline rounded-[4px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                GitHub
              </a>
              , use it as a guest in this browser, or create an optional account so resumes, evidence,
              and jobs persist in our hosted database.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground">Data we store</h2>
            <ul className="mt-2 list-disc space-y-1.5 pl-5">
              <li>
                <span className="font-semibold text-foreground">Account data</span> — if you sign up: email, username, and a
                hashed password. We do not store plaintext passwords.
              </li>
              <li>
                <span className="font-semibold text-foreground">Workspace data</span> — master resumes, evidence items, job
                postings, tailored variants, and cover-letter drafts you save while signed in.
              </li>
              <li>
                <span className="font-semibold text-foreground">Guest data</span> — guest work stays in this browser session.
                It is not written to the hosted database until you sign in.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground">AI keys you provide</h2>
            <p className="mt-2">
              API keys you provide are encrypted in this browser’s IndexedDB vault using a
              non-extractable Web Crypto key, and are never stored in our database. Keys are sent to
              your chosen provider only when you run an AI action (extract, tailor, cover letter, ATS
              review). We do not sell keys or resume content.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground">How AI requests work</h2>
            <p className="mt-2">
              When you opt in to an AI feature, relevant resume or job text is sent to the provider you
              configured (for example OpenAI, Anthropic, Gemini, or a custom endpoint). We do not use that
              content to train ResumeForge models. Provider retention is governed by that provider’s own
              policy.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground">Cookies and sessions</h2>
            <p className="mt-2">
              A session cookie keeps you signed in. It is HttpOnly and used only for authentication. We do
              not use advertising trackers or sell personal information.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground">Your choices</h2>
            <p className="mt-2">
              You can continue as a guest, sign in, edit or delete saved workspace items in the app, and
              sign out. Clearing site data in your browser removes local keys and guest drafts.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground">Contact &amp; source code</h2>
            <p className="mt-2">
              Questions, bug reports, or privacy requests can be opened on{" "}
              <a
                href="https://github.com/ZenzerJs/ResumeForge/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline rounded-[4px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                GitHub Issues
              </a>{" "}
              or reviewed in the{" "}
              <a
                href="https://github.com/ZenzerJs/ResumeForge"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline rounded-[4px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                ResumeForge repository
              </a>
              .
            </p>
          </section>
        </div>

        <p className="mt-10 text-sm text-muted-foreground">
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
