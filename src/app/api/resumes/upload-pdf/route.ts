import { NextResponse } from "next/server";
import { parsePdfBuffer, convertTextToTypst, classifyPdfTextFallback } from "@/lib/pdf/parser";
import { buildResumeDocument, renderResumeDocument, isResumeLayoutV2Enabled, type ResumeDocument } from "@/lib/typst/resume-document";
import { createInlineRenderer } from "@/lib/typst/inline-content";
import { createResume } from "@/lib/db/resumes";
import { convertPdfTextToTypst } from "@/lib/ai/gateway";
import { ProviderConfig, ProviderConfigSchema } from "@/lib/ai/types";
import { sanitizeTypstSource } from "@/lib/typst/sanitizer";
import { ensureTypstLinks } from "@/lib/typst/ensure-links";
import { redactError, sanitizeError } from "@/lib/ai/redact";
import { requireUserId } from "@/lib/security/auth-request";
import { isDemoMode } from "@/lib/demo-mode";
import { originAllowed } from "@/lib/security/session";

const MAX_PDF_BYTES = 10 * 1024 * 1024;
const MAX_DEMO_REQUEST_BYTES = MAX_PDF_BYTES + 64 * 1024;
const MAX_AUTH_REQUEST_BYTES = Math.ceil(MAX_PDF_BYTES * 4 / 3) + 64 * 1024;
const REQUEST_BODY_TIMEOUT_MS = 30_000;

class RequestBodyTimeoutError extends Error {}

async function readBodyWithinLimit(request: Request, maxBytes: number): Promise<Request | null> {
  if (!request.body) return new Request(request.url, { method: request.method, headers: request.headers });
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      reject(new RequestBodyTimeoutError("Request body timed out"));
      void reader.cancel().catch(() => {});
    }, REQUEST_BODY_TIMEOUT_MS);
  });
  try {
    while (true) {
      const { done, value } = await Promise.race([reader.read(), deadline]);
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        void reader.cancel().catch(() => {});
        return null;
      }
      chunks.push(value);
    }
  } finally {
    clearTimeout(timeout);
    reader.releaseLock();
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const headers = new Headers(request.headers);
  headers.delete("content-length");
  headers.set("content-length", String(totalBytes));
  return new Request(request.url, { method: request.method, headers, body });
}

function isPdfMagic(buffer: Buffer): boolean {
  return buffer.subarray(0, 5).toString("utf8") === "%PDF-";
}

export async function POST(request: Request) {
  if (request.method !== "POST") {
    return NextResponse.json({ success: false, error: "Method not allowed" }, { status: 405, headers: { Allow: "POST" } });
  }
  try {
    const demoMode = isDemoMode();
    let uploadRequest = request;
    let userId: string | null = null;
    if (demoMode) {
      const hasOrigin = Boolean(request.headers.get("origin") || request.headers.get("referer"));
      if (!hasOrigin || !originAllowed(request)) {
        return NextResponse.json({ success: false, error: "Invalid request origin" }, { status: 403 });
      }
      const contentLengthHeader = request.headers.get("content-length");
      const contentLength = contentLengthHeader ? Number(contentLengthHeader) : Number.NaN;
      if (Number.isFinite(contentLength) && contentLength > MAX_DEMO_REQUEST_BYTES) {
        return NextResponse.json({ success: false, error: "Upload exceeds the 10 MB request limit" }, { status: 413 });
      }
      const boundedRequest = await readBodyWithinLimit(request, MAX_DEMO_REQUEST_BYTES);
      if (!boundedRequest) {
        return NextResponse.json({ success: false, error: "Upload exceeds the 10 MB request limit" }, { status: 413 });
      }
      uploadRequest = boundedRequest;
    } else {
      const authenticatedUserId = await requireUserId(request);
      if (authenticatedUserId instanceof NextResponse) return authenticatedUserId;
      userId = authenticatedUserId;
      if ((request.headers.has("origin") || request.headers.has("referer")) && !originAllowed(request)) {
        return NextResponse.json({ success: false, error: "Invalid request origin" }, { status: 403 });
      }
      const contentLength = Number(request.headers.get("content-length"));
      if (Number.isFinite(contentLength) && contentLength > MAX_AUTH_REQUEST_BYTES) {
        return NextResponse.json({ success: false, error: "Upload exceeds the request limit" }, { status: 413 });
      }
      const boundedRequest = await readBodyWithinLimit(request, MAX_AUTH_REQUEST_BYTES);
      if (!boundedRequest) return NextResponse.json({ success: false, error: "Upload exceeds the request limit" }, { status: 413 });
      uploadRequest = boundedRequest;
    }

    const contentType = uploadRequest.headers.get("content-type") || "";

    let buffer: Buffer | null = null;
    let fileName = "Uploaded Resume";
    let rawTextFromPayload: string | null = null;
    let providerConfig: ProviderConfig | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await uploadRequest.formData();
      const file = formData.get("file");

      if (!(file instanceof File)) {
        return NextResponse.json(
          { success: false, error: "No PDF file provided in formData 'file' field" },
          { status: 400 }
        );
      }

      if (file.size > MAX_PDF_BYTES) {
        return NextResponse.json(
          { success: false, error: "PDF exceeds the 10 MB upload limit" },
          { status: 413 }
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
      let body: unknown;
      try { body = await uploadRequest.json(); } catch {
        return NextResponse.json({ success: false, error: "Invalid JSON payload" }, { status: 400 });
      }
      if (!body || typeof body !== "object" || Array.isArray(body)) {
        return NextResponse.json({ success: false, error: "Invalid request payload" }, { status: 400 });
      }
      const payload = body as Record<string, unknown>;
      if ((payload.title !== undefined && typeof payload.title !== "string") ||
          (payload.rawText !== undefined && typeof payload.rawText !== "string") ||
          (payload.pdfBase64 !== undefined && typeof payload.pdfBase64 !== "string")) {
        return NextResponse.json({ success: false, error: "Invalid request payload" }, { status: 400 });
      }
      const bodyData = payload as { pdfBase64?: string; rawText?: string; title?: string; providerConfig?: unknown };
      if (!bodyData.pdfBase64 && !bodyData.rawText) {
        return NextResponse.json(
          { success: false, error: "Provide either multipart file, pdfBase64, or rawText" },
          { status: 400 }
        );
      }

      if (bodyData.providerConfig) {
        const safe = ProviderConfigSchema.safeParse(bodyData.providerConfig);
        if (safe.success) providerConfig = safe.data;
      }

      if (bodyData.title) fileName = bodyData.title;

      if (bodyData.pdfBase64) {
        const base64Data = bodyData.pdfBase64.replace(/^data:application\/pdf;base64,/, "");
        if (base64Data.length > Math.ceil((MAX_PDF_BYTES * 4) / 3) + 16) {
          return NextResponse.json(
            { success: false, error: "PDF exceeds the 10 MB upload limit" },
            { status: 413 }
          );
        }
        buffer = Buffer.from(base64Data, "base64");
      } else if (typeof bodyData.rawText === "string") {
        if (bodyData.rawText.length > 200_000) {
          return NextResponse.json(
            { success: false, error: "rawText exceeds the 200 KB limit" },
            { status: 413 }
          );
        }
        rawTextFromPayload = bodyData.rawText;
      }
    }

    // Check header fallback for providerConfig if not in body/formData
    if (!providerConfig) {
      const headerConfigStr = uploadRequest.headers.get("x-ai-provider-config");
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
    let extractedLinks: import("@/lib/pdf/parser").ExtractedPdfLink[] = [];
    let pageCount = 1;

    if (buffer) {
      if (buffer.length > MAX_PDF_BYTES) {
        return NextResponse.json(
          { success: false, error: "PDF exceeds the 10 MB upload limit" },
          { status: 413 }
        );
      }
      if (!isPdfMagic(buffer)) {
        return NextResponse.json(
          { success: false, error: "File is not a valid PDF" },
          { status: 400 }
        );
      }
      const parsedPdf = await parsePdfBuffer(buffer);
      if (!parsedPdf.text || parsedPdf.text.trim().length === 0) {
        return NextResponse.json(
          { success: false, error: "Could not extract readable text from PDF" },
          { status: 422 }
        );
      }
      extractedText = parsedPdf.text;
      extractedLinks = parsedPdf.links || [];
      pageCount = parsedPdf.numpages;
    } else if (rawTextFromPayload?.trim()) {
      extractedText = rawTextFromPayload;
    } else {
      return NextResponse.json(
        { success: false, error: "Invalid request payload or missing PDF data" },
        { status: 400 }
      );
    }

    // Fallback to server-side environment variables if client did not supply providerConfig
    if (!isDemoMode() && (!providerConfig || (!providerConfig.apiKey && providerConfig.provider !== "custom"))) {
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
    const layoutV2 = isResumeLayoutV2Enabled();
    const sourceText = extractedText;
    let conversionPath: "ai" | "fallback" = "fallback";
    let convertedSource: string | null = null;
    let structuredDocument: ResumeDocument | undefined;
    let assignments: unknown;

    // Attempt AI conversion if providerConfig is provided or server env key exists
    if (providerConfig) {
      try {
        const aiResult = await convertPdfTextToTypst({
          providerConfig,
          rawText: sourceText,
          fileName: title,
          links: extractedLinks,
          ...(layoutV2 ? { formattingVersion: 2 as const } : {}),
        });

        if (layoutV2 && aiResult.success && aiResult.assignments) {
          assignments = aiResult.assignments;
          conversionPath = "ai";
        } else if (!layoutV2 && aiResult.success && aiResult.typstSource && aiResult.typstSource.trim().length > 0) {
          conversionPath = "ai";
          convertedSource = aiResult.typstSource;
        }
      } catch (aiErr) {
        console.warn("AI PDF conversion failed, falling back to heuristic parser:", redactError(aiErr));
      }
    }

    // Deterministic fallback path
    if (layoutV2) {
      structuredDocument = buildResumeDocument(sourceText, assignments ?? classifyPdfTextFallback(sourceText));
      structuredDocument.issues.push(...createInlineRenderer(extractedLinks).issues);
      convertedSource = renderResumeDocument(structuredDocument, "comfortable", extractedLinks);
    } else if (!convertedSource) {
      conversionPath = "fallback";
      convertedSource = convertTextToTypst(extractedText, title, extractedLinks);
    }

    // Sanitize, enforce Experience→Education→Projects→Skills order, and keep scraped links
    const sanitized = layoutV2 ? convertedSource : ensureTypstLinks(
      sanitizeTypstSource(convertedSource),
      extractedLinks
    );

    // Prepend header comments for status tracking and non-master draft labeling
    const safeFileName = fileName.replace(/[\r\n\u2028\u2029]/g, " ");
    const typstSource = `// @pdf-conversion-draft: Review and edit before saving as Master Resume\n// @conversion-path: ${conversionPath}\n// PDF source: "${safeFileName}" — converted ${new Date().toISOString().slice(0, 10)}\n\n${sanitized}`;

    // Always create as non-master draft (isMaster: false)
    if (demoMode) {
      return NextResponse.json({
        success: true,
        data: { title, typstSource, isMaster: false },
        ...(structuredDocument ? { structuredDocument, importIssues: structuredDocument.issues, formattingVersion: 2 } : {}),
        conversionPath,
        pageCount,
        extractedLength: extractedText.length,
        persistence: "browser-local",
      });
    }

    const newResume = await createResume({ title, typstSource, isMaster: false, userId: userId! });

    return NextResponse.json(
      {
        success: true,
        data: newResume,
        ...(structuredDocument ? { structuredDocument, importIssues: structuredDocument.issues, formattingVersion: 2 } : {}),
        conversionPath,
        pageCount,
        extractedLength: extractedText.length,
      },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof RequestBodyTimeoutError) {
      return NextResponse.json({ success: false, error: "Request body timed out" }, { status: 408 });
    }
    console.error("PDF upload error:", redactError(err));
    return NextResponse.json(
      {
        success: false,
        error: "Failed to parse and upload PDF resume",
        message: sanitizeError(err),
      },
      { status: 500 }
    );
  }
}
