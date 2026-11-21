import { TrackerFeed } from "@/components/tracker/tracker-feed";

import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata = buildPageMetadata({
  path: "/tracker/applied",
  title: "Applied Jobs — Tracker",
  description: "Track your applied, interviewing, and offer-stage job applications.",
  noIndex: true,
});

export default function TrackerAppliedPage() {
  return (
    <TrackerFeed
      filterStatuses={["APPLIED", "INTERVIEWING", "OFFER", "REJECTED"]}
    />
  );
}
