import { TrackerFeed } from "@/components/tracker/tracker-feed";

export const metadata = {
  title: "Saved Jobs — ResumeForge Tracker",
  description: "Your saved job postings you haven't applied to yet.",
};

export default function TrackerSavedPage() {
  return <TrackerFeed filterStatuses={["SAVED"]} />;
}
