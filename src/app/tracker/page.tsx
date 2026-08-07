import { TrackerFeed } from "@/components/tracker/tracker-feed";

export const metadata = {
  title: "Application Tracker — ResumeForge",
  description: "Track job applications, tailored resume variants, cover letters, and application lifecycle status.",
};

export default function TrackerPage() {
  return <TrackerFeed />;
}
