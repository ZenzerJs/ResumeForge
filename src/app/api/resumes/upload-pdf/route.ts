import { NextResponse } from "next/server";
import { parsePdfBuffer, convertTextToTypst } from "@/lib/pdf/parser";
import { createResume } from "@/lib/db/resumes";
import { convertPdfTextToTypst } from "@/lib/ai/gateway";
import { ProviderConfig, ProviderConfigSchema } from "@/lib/ai/types";

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";

    let buffer: Buffer | null = null;
    let fileName = "Uploaded Resume";
    let rawTextFromPayload: string | null = null;
    let providerConfig: ProviderConfig | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;

      if (!file) {
        return NextResponse.json(
          { success: false, error: "No PDF file provided in formData 'file' field" },
          { status: 400 }
        );
      }

      fileName = file.name || fileName;
      const arrayBuffer = await file.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);

      const rawConfigStr = formData.get("providerConfig") as string | null;
      if (rawConfigStr) {
        try {
          const parsed = JSON.parse(rawConfigStr);
          const safe = ProviderConfigSchema.safeParse(parsed);
          if (safe.success) {
            providerConfig = safe.data;
          }
        } catch {
          // invalid json string ignored
        }
      }
    } else {
      const body = await request.json();
      if (!body.pdfBase64 && !body.rawText) {
        return NextResponse.json(
          { success: false, error: "Provide either multipart file, pdfBase64, or rawText" },
          { status: 400 }
        );
      }

      if (body.providerConfig) {
        const safe = ProviderConfigSchema.safeParse(body.providerConfig);
        if (safe.success) providerConfig = safe.data;
      }

      if (body.title) fileName = body.title;

      if (body.pdfBase64) {
        const base64Data = body.pdfBase64.replace(/^data:application\/pdf;base64,/, "");
        buffer = Buffer.from(base64Data, "base64");
      } else if (body.rawText) {
        rawTextFromPayload = body.rawText;
      }
    }

    // Check header fallback for providerConfig if not in body/formData
    if (!providerConfig) {
      const headerConfigStr = request.headers.get("x-ai-provider-config");
      if (headerConfigStr) {
        try {
          const parsed = JSON.parse(headerConfigStr);
          const safe = ProviderConfigSchema.safeParse(parsed);
          if (safe.success) providerConfig = safe.data;
        } catch {
          // ignore invalid header
        }
      }
    }

    let extractedText = "";
    let pageCount = 1;

    if (buffer) {
      const parsedPdf = await parsePdfBuffer(buffer);
      if (!parsedPdf.text || parsedPdf.text.trim().length === 0) {
        return NextResponse.json(
          { success: false, error: "Could not extract readable text from PDF" },
          { status: 422 }
        );
      }
      extractedText = parsedPdf.text;
      pageCount = parsedPdf.numpages;
    } else if (rawTextFromPayload) {
      extractedText = rawTextFromPayload;
    } else {
      return NextResponse.json(
        { success: false, error: "Invalid request payload or missing PDF data" },
        { status: 400 }
      );
    }

    // Fallback to server-side environment variables if client did not supply providerConfig
    if (!providerConfig || (!providerConfig.apiKey && providerConfig.provider !== "custom")) {
      if (process.env.OPENAI_API_KEY?.trim()) {
        providerConfig = { provider: "openai" };
      } else if (process.env.ANTHROPIC_API_KEY?.trim()) {
        providerConfig = { provider: "anthropic" };
      } else if (process.env.GEMINI_API_KEY?.trim()) {
        providerConfig = { provider: "gemini" };
      } else if (process.env.CUSTOM_OPENAI_API_KEY?.trim()) {
        providerConfig = { provider: "custom" };
      }
    }

    const title = fileName.replace(/\.pdf$/i, "") || "Uploaded Resume";
    let conversionPath: "ai" | "fallback" = "fallback";
    let convertedSource: string | null = null;

    // Attempt AI conversion if providerConfig is provided or server env key exists
    if (providerConfig) {
      try {
        const aiResult = await convertPdfTextToTypst({
          providerConfig,
          rawText: extractedText,
          fileName: title,
        });

        if (aiResult.success && aiResult.typstSource && aiResult.typstSource.trim().length > 0) {
          conversionPath = "ai";
          convertedSource = aiResult.typstSource;
        }
      } catch (aiErr) {
        console.warn("AI PDF conversion failed, falling back to heuristic parser:", aiErr);
      }
    }

    // Deterministic fallback path
    if (!convertedSource) {
      conversionPath = "fallback";
      convertedSource = convertTextToTypst(extractedText, title);
    }

    // Prepend header comments for status tracking and non-master draft labeling
    const typstSource = `// @pdf-conversion-draft: Review and edit before saving as Master Resume\n// @conversion-path: ${conversionPath}\n// PDF source: "${fileName}" — converted ${new Date().toISOString().slice(0, 10)}\n\n${convertedSource}`;

    // Always create as non-master draft (isMaster: false)
    const newResume = await createResume({
      title,
      typstSource,
      isMaster: false,
    });

    return NextResponse.json(
      {
        success: true,
        data: newResume,
        conversionPath,
        pageCount,
        extractedLength: extractedText.length,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("PDF upload error:", err);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to parse and upload PDF resume",
        message: String(err),
      },
      { status: 500 }
    );
  }
}
