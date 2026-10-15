import { redirect } from "next/navigation";

type DsaSearchParams = {
  problem?: string;
  slug?: string;
  jd?: string;
};

export default async function DsaPage({
  searchParams,
}: {
  searchParams: Promise<DsaSearchParams>;
}) {
  const params = await searchParams;
  const next = new URLSearchParams();
  next.set("tab", "runner");
  const problem = params.problem || params.slug;
  if (problem) next.set("problem", problem);
  if (params.jd) next.set("jd", params.jd);
  redirect(`/practice?${next.toString()}`);
}
