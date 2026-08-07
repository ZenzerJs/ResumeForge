import { NextResponse } from "next/server";
import { parsePdfBuffer, convertTextToTypst } from "@/lib/pdf/parser";
import { createResume } from "@/lib/db/resumes";

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";

    let buffer: Buffer;
    let fileName = "Uploaded Resume";

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
    } else {
      const body = await request.json();
      if (!body.pdfBase64 && !body.rawText) {
        return NextResponse.json(
          { success: false, error: "Provide either multipart file, pdfBase64, or rawText" },
          { status: 400 }
        );
      }

      if (body.pdfBase64) {
        const base64Data = body.pdfBase64.replace(/^data:application\/pdf;base64,/, "");
        buffer = Buffer.from(base64Data, "base64");
      } else {
        // Direct text upload fallback — not saved as Master; user reviews first
        const rawTypst = convertTextToTypst(body.rawText, body.title || fileName);
        const typstSource = `// @pdf-conversion-draft: Review and edit before saving as Master Resume\n// Converted from raw text on ${new Date().toISOString().slice(0, 10)}\n\n${rawTypst}`;
        const newResume = await createResume({
          title: body.title || fileName,
          typstSource,
          isMaster: false,
        });

        return NextResponse.json(
          {
            success: true,
            data: newResume,
            extractedText: body.rawText,
          },
          { status: 201 }
        );
      }
    }

    // Parse PDF text from Buffer
    const parsedPdf = await parsePdfBuffer(buffer);
    if (!parsedPdf.text || parsedPdf.text.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "Could not extract readable text from PDF" },
        { status: 422 }
      );
    }

    const title = fileName.replace(/\.pdf$/i, "") || "Uploaded Resume";
    const rawTypst = convertTextToTypst(parsedPdf.text, title);
    // Prepend a review-flag comment so users know this is a draft conversion, not a verified master
    const typstSource = `// @pdf-conversion-draft: Review and edit before saving as Master Resume\n// PDF source: "${fileName}" — converted ${new Date().toISOString().slice(0, 10)}\n// Sections marked with [?] below may need manual verification\n\n${rawTypst}`;

    // Save as a non-master draft — user explicitly saves as Master after review
    const newResume = await createResume({
      title,
      typstSource,
      isMaster: false,
    });

    return NextResponse.json(
      {
        success: true,
        data: newResume,
        pageCount: parsedPdf.numpages,
        extractedLength: parsedPdf.text.length,
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
