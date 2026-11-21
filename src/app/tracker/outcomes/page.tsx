import { OutcomesPanel } from "@/components/tracker/outcomes-panel";

import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata = buildPageMetadata({
  path: "/tracker/outcomes",
  title: "Outcomes — Tracker",
  description: "Pipeline funnel and interview rate for each resume variant.",
  noIndex: true,
});

export default function TrackerOutcomesPage() {
  return <OutcomesPanel />;
}
