import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 text-center bg-slate-50">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
        ResumeForge — local-first AI resume workspace
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        Craft truthful, job-specific resume variants from one protected master resume.
      </p>
      <Link
        href="/editor"
        className="mt-6 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-indigo-700 transition-colors"
      >
        Open Typst Workspace
      </Link>
    </main>
  );
}

