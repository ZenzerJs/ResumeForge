import { TrackerFeed } from "@/components/tracker/tracker-feed";

import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata = buildPageMetadata({
  path: "/tracker/saved",
  title: "Saved Jobs — Tracker",
  description: "Your saved job postings you haven't applied to yet.",
  noIndex: true,
});

export default function TrackerSavedPage() {
  return <TrackerFeed filterStatuses={["SAVED"]} />;
}
