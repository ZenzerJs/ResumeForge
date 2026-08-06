import { Metadata } from "next";
import { TailorWorkspace } from "@/components/tailor/tailor-workspace";

export const metadata: Metadata = {
  title: "Job Tailoring & Requirement Matcher | ResumeForge",
  description: "Deterministic JD requirement extraction and Evidence Bank matching workspace",
};

export default function TailorPage() {
  return <TailorWorkspace />;
}
