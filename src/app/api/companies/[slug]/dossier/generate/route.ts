import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { generateDossier } from "@/lib/company-dossier";
import { requireUserId } from "@/lib/security/auth-request";
import { ProviderConfigSchema } from "@/lib/ai/types";

const DOSSIER_REGEN_COOLDOWN_MS = 24 * 60 * 60 * 1000;

const GenerateDossierBodySchema = z.object({
  companyName: z.string().trim().min(1).max(120).optional(),
  jobTitle: z.string().trim().min(1).max(160).optional(),
  referenceNotes: z.string().optional(),
  processNotes: z.string().optional(),
  providerConfig: ProviderConfigSchema.optional(),
});

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ slug: string }> }
) {
  const auth = await requireUserId(req);
  if (typeof auth !== "string") {
    return auth;
  }

  const params = await props.params;
  const slug = params.slug;

  if (!slug) {
    return NextResponse.json({ found: false, error: "Company slug is required" }, { status: 400 });
  }

  let raw: unknown = {};
  try {
    raw = await req.json();
  } catch {
    raw = {};
  }

  const parsed = GenerateDossierBodySchema.safeParse(raw && typeof raw === "object" ? raw : {});
  if (!parsed.success) {
    return NextResponse.json(
      { found: false, error: "Invalid dossier request" },
      { status: 400 }
    );
  }

  const existing = await prisma.companyDossier.findUnique({
    where: { companySlug: slug },
  });

  if (existing && Date.now() - new Date(existing.lastUpdated).getTime() < DOSSIER_REGEN_COOLDOWN_MS) {
    return NextResponse.json({ found: true, dossier: existing, stale: false, cooldown: true });
  }

  try {
    const dossier = await generateDossier({
      companyName: parsed.data.companyName || existing?.displayName || slug,
      jobTitle: parsed.data.jobTitle,
      referenceNotes: parsed.data.referenceNotes ?? existing?.referenceNotes ?? undefined,
      processNotes: parsed.data.processNotes ?? existing?.processNotes ?? undefined,
      providerConfig: parsed.data.providerConfig,
    });

    const isLlm = Boolean(dossier.llmUsed);
    const source = isLlm
      ? existing?.referenceNotes || existing?.processNotes
        ? "seed+llm"
        : "llm"
      : "seed";

    const data = {
      displayName: dossier.companyName,
      interviewStyle: dossier.interviewStyle as any,
      cultureMetrics: dossier.engineeringCulture as any,
      recentSignals: dossier.recentSignals,
      source,
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
