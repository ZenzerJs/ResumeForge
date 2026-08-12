import { cookies } from "next/headers";
import { getDashboardStats, emptyGuestStats } from "@/lib/db/stats";
import { HomeLanding } from "@/components/landing/home-landing";
import { getSessionCookieName, readSessionToken } from "@/lib/security/session";

export const dynamic = "force-dynamic";

export default async function Home() {
  const token = (await cookies()).get(getSessionCookieName())?.value;
  const session = await readSessionToken(token);
  const stats = session?.userId
    ? await getDashboardStats(session.userId)
    : emptyGuestStats();
  return <HomeLanding initialStats={stats} />;
}
