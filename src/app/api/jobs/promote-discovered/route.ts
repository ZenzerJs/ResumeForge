import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sanitizeError } from "@/lib/ai/redact";
import { isSafeHref } from "@/lib/security/safe-fetch";
import { requireUserId } from "@/lib/security/auth-request";

export async function POST(req: Request) {
  try {
    const gated = await requireUserId(req);
    if (gated instanceof NextResponse) return gated;

    const { discoveredJobId } = await req.json();

    if (!discoveredJobId) {
      return NextResponse.json({ error: "discoveredJobId is required" }, { status: 400 });
    }

    const discovered = await prisma.discoveredJob.findUnique({
      where: { id: discoveredJobId },
    });

    if (!discovered) {
      return NextResponse.json({ error: "Discovered job not found" }, { status: 404 });
    }

    // Create active job record for tailoring & tracking
    const activeJob = await prisma.job.create({
      data: {
        company: discovered.company,
        roleTitle: discovered.roleTitle,
        rawDescription: `${discovered.roleTitle} at ${discovered.company} (${discovered.location}).${isSafeHref(discovered.applyUrl) ? ` Application Link: ${discovered.applyUrl}` : ""}`,
        source: "pittcsc_auto",
        status: "SAVED",
      },
    });

    return NextResponse.json({ success: true, jobId: activeJob.id, data: activeJob });
  } catch (err) {
    console.error("Promote discovered job error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to promote job", message: sanitizeError(err) },
      { status: 500 }
    );
  }
}
