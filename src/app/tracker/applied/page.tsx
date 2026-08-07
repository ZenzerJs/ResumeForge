import { TrackerFeed } from "@/components/tracker/tracker-feed";

export const metadata = {
  title: "Applied Jobs — ResumeForge Tracker",
  description: "Track your applied, interviewing, and offer-stage job applications.",
};

export default function TrackerAppliedPage() {
  return (
    <TrackerFeed
      filterStatuses={["APPLIED", "INTERVIEWING", "OFFER", "REJECTED"]}
    />
  );
}
