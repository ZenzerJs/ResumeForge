import { redirect } from "next/navigation";

/** Tracker Discover alias redirect -> /tracker/feed */
export default function TrackerDiscoverRedirectPage() {
  redirect("/tracker/feed");
}
