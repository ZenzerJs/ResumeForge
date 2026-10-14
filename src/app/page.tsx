import { cookies } from "next/headers";
import { getDashboardStats } from "@/lib/db/stats";
import { HomeLanding } from "@/components/landing/home-landing";
import { sessionIsCurrent } from "@/lib/security/auth-request";
import { getSessionCookieName, readSessionToken } from "@/lib/security/session";

export const dynamic = "force-dynamic";

export default async function Home() {
  const token = (await cookies()).get(getSessionCookieName())?.value;
  const session = await sessionIsCurrent(await readSessionToken(token));
  const stats = await getDashboardStats(session?.userId);
  return <HomeLanding initialStats={stats} />;
}
