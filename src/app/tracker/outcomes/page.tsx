import { OutcomesPanel } from "@/components/tracker/outcomes-panel";

export const metadata = {
  title: "Outcomes — ResumeForge Tracker",
  description: "Pipeline funnel and interview rate for each resume variant.",
};

export default function TrackerOutcomesPage() {
  return <OutcomesPanel />;
}
