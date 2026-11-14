import { redirect } from "next/navigation";

type InterviewSearchParams = Record<string, string | string[] | undefined>;

export default async function InterviewPage({
  searchParams,
}: {
  searchParams: Promise<InterviewSearchParams>;
}) {
  const params = await searchParams;
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (key === "tab") continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item) next.append(key, item);
      }
    } else if (typeof value === "string" && value) {
      next.set(key, value);
    }
  }
  next.set("tab", "questions");
  redirect(`/practice?${next.toString()}`);
}
