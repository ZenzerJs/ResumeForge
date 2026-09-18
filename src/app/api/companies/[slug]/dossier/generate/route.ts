import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateDossier } from "@/lib/company-dossier";

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ slug: string }> }
) {
  const params = await props.params;
  const slug = params.slug;

  if (!slug) {
    return NextResponse.json({ found: false, error: "Company slug is required" }, { status: 400 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const existing = await prisma.companyDossier.findUnique({
    where: { companySlug: slug },
  });

  try {
    const dossier = await generateDossier({
      companyName: body.companyName || existing?.displayName || slug,
      jobTitle: body.jobTitle,
      referenceNotes: existing?.referenceNotes ?? undefined,
      processNotes: existing?.processNotes ?? undefined,
      providerConfig: body.providerConfig,
    });

    const data = {
      displayName: dossier.companyName,
      interviewStyle: dossier.interviewStyle as any,
      cultureMetrics: dossier.engineeringCulture as any,
      recentSignals: dossier.recentSignals,
      source: existing?.referenceNotes || existing?.processNotes ? "seed+llm" : "llm",
      lastUpdated: new Date(),
    };

    // Upsert: two parallel generates for the same slug must not crash
    const saved = await prisma.companyDossier.upsert({
      where: { companySlug: slug },
      update: data,
      create: { companySlug: slug, ...data },
    });

    return NextResponse.json({ found: true, dossier: saved, stale: false });
  } catch (err: any) {
    if (err?.code === "P2002") {
      // Lost race — another request wrote it first. Re-read and return
      const dossier = await prisma.companyDossier.findUnique({
        where: { companySlug: slug },
      });
      return NextResponse.json({ found: true, dossier, stale: false });
    }

    return NextResponse.json(
      { found: false, error: err instanceof Error ? err.message : "Failed to synthesize company dossier" },
      { status: 500 }
    );
  }
}
