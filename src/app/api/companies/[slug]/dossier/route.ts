import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  props: { params: Promise<{ slug: string }> }
) {
  try {
    const params = await props.params;
    const slug = params.slug;

    if (!slug) {
      return NextResponse.json({ found: false, error: "Company slug required" }, { status: 400 });
    }

    const dossier = await prisma.companyDossier.findUnique({
      where: { companySlug: slug },
    });

    if (!dossier) {
      return NextResponse.json({ found: false }, { status: 404 });
    }

    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const isStale = dossier.lastUpdated < ninetyDaysAgo;

    return NextResponse.json({
      found: true,
      dossier,
      stale: isStale,
    });
  } catch (err) {
    return NextResponse.json(
      { found: false, error: "Failed to fetch company dossier" },
      { status: 500 }
    );
  }
}
