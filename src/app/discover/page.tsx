import { redirect } from "next/navigation";

/** Discover merged into Tracker → /tracker/feed */
export default function DiscoverRedirectPage() {
  redirect("/tracker/feed");
}
