import { TrackerFeed } from "@/components/tracker/tracker-feed";

import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata = buildPageMetadata({
  path: "/tracker",
  title: "Application Tracker",
  description: "Track job applications, tailored resume variants, cover letters, and application lifecycle status.",
  noIndex: true,
});

export default function TrackerPage() {
  return <TrackerFeed />;
}
