import { DiscoverFeed } from "@/components/tracker/discover-feed";

import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata = buildPageMetadata({
  path: "/tracker/feed",
  title: "Job Feed",
  description: "Browse Pitt CSC / Simplify internship listings and save roles into your tracker.",
});

export default function TrackerFeedPage() {
  return <DiscoverFeed />;
}
