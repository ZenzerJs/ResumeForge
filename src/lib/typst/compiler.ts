import { $typst, loadFonts } from "@myriaddreamin/typst.ts";

export interface CompileSuccessResult {
  success: true;
  svg: string;
}

export interface CompileErrorResult {
  success: false;
  error: {
    message: string;
    line?: number;
  };
}

export type CompileResult = CompileSuccessResult | CompileErrorResult;

/**
 * Parses error line number and message from Typst compiler error message string.
 */
export function parseTypstError(rawError: unknown): { message: string; line?: number } {
  const errorMessage = rawError instanceof Error ? rawError.message : String(rawError);

  // Match common Typst line error patterns:
  // e.g. "error: unexpected token at line 14", "14:5: error: ...", "at line 14, column 3"
  const lineMatch =
    errorMessage.match(/line\s+(\d+)/i) ||
    errorMessage.match(/^(\d+):/m) ||
    errorMessage.match(/:(\d+):/) ||
    errorMessage.match(/line:?\s*(\d+)/i);

  let line = lineMatch ? parseInt(lineMatch[1], 10) : undefined;

  // Clean readable message from raw WASM diagnostic string
  let cleanedMessage = errorMessage
    .replace(/^error:\s*/i, "")
    .replace(/\[SourceDiagnostic\s*\{[^}]*message:\s*"([^"]+)"[^}]*\}\]/g, "$1")
    .trim();

  // Fallback to line 1 if compilation error occurred without explicit line citation
  if (!line && cleanedMessage.length > 0) {
    line = 1;
  }

  return {
    message: cleanedMessage || "Failed to compile Typst document",
    line,
  };
}

let isInitialized = false;
let compileQueue: Promise<void> = Promise.resolve();
function serialized<T>(work: () => Promise<T>): Promise<T> {
  const result = compileQueue.then(work);
  compileQueue = result.then(() => undefined, () => undefined);
  return result;
}

async function ensureTypstInitialized() {
  if (typeof window === "undefined") return;
  if (!isInitialized) {
    $typst.setCompilerInitOptions({
        getModule: () => "/wasm/typst_ts_web_compiler_bg.wasm",
        beforeBuild: [
          loadFonts([
            "/fonts/typst/LibertinusSerif-Regular.otf",
            "/fonts/typst/LibertinusSerif-Bold.otf",
            "/fonts/typst/LibertinusSerif-Italic.otf",
            "/fonts/typst/LibertinusSerif-BoldItalic.otf",
            "/fonts/typst/LibertinusSerif-Semibold.otf",
            "/fonts/typst/LibertinusSerif-SemiboldItalic.otf",
            "/fonts/typst/NewCM10-Regular.otf",
            "/fonts/typst/NewCM10-Bold.otf",
            "/fonts/typst/NewCM10-Italic.otf",
            "/fonts/typst/NewCM10-BoldItalic.otf",
            "/fonts/typst/NewCMMath-Regular.otf",
            "/fonts/typst/NewCMMath-Book.otf",
            "/fonts/typst/NewCMMath-Bold.otf",
            "/fonts/typst/DejaVuSansMono.ttf",
            "/fonts/typst/DejaVuSansMono-Bold.ttf",
            "/fonts/typst/DejaVuSansMono-Oblique.ttf",
            "/fonts/typst/DejaVuSansMono-BoldOblique.ttf",
          ], { assets: false }),
        ],
      });
      $typst.setRendererInitOptions({
        getModule: () => "/wasm/typst_ts_renderer_bg.wasm",
      });
    isInitialized = true;
  }
}

/**
 * Compiles Typst source markup string to SVG image output for live preview.
 */
export async function compileTypstToSvg(source: string): Promise<CompileResult> {
  if (typeof window === "undefined") {
    return {
      success: false,
      error: { message: "Typst compiler can only run in browser environment." },
    };
  }

  try {
    const svgResult = await serialized(async () => {
      await ensureTypstInitialized();
      return $typst.svg({ mainContent: source });
    });
    if (!svgResult) {
      return {
        success: false,
        error: { message: "Compilation produced empty output." },
      };
    }
    return {
      success: true,
      svg: svgResult,
    };
  } catch (err) {
    return {
      success: false,
      error: parseTypstError(err),
    };
  }
}

/**
 * Compiles Typst source markup string to PDF binary Uint8Array for export.
 */
export async function compileTypstToPdf(source: string): Promise<Uint8Array> {
  if (typeof window === "undefined") {
    throw new Error("PDF compilation requires browser environment.");
  }

  const pdfBytes = await serialized(async () => {
    await ensureTypstInitialized();
    return $typst.pdf({ mainContent: source });
  });
  if (!pdfBytes) {
    throw new Error("Failed to compile Typst document to PDF.");
  }
  return pdfBytes;
}
/** Compile and measure the exact source; optionally render each PDF page for preview. */
export async function measureTypstDocument(source: string, renderPages = false) {
  const pdf = await compileTypstToPdf(source);
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = "/workers/pdf.worker.min.mjs";
  const task = pdfjs.getDocument({ data: new Uint8Array(pdf) });
  try {
    const document = await task.promise;
    const pageCount = document.numPages;
    const pageImages: string[] = [];
    if (renderPages) for (let index = 1; index <= pageCount; index++) {
      const page = await document.getPage(index);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = window.document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Could not render document preview.");
      await page.render({ canvas, canvasContext: context, viewport }).promise;
      pageImages.push(canvas.toDataURL("image/png"));
    }
    return { source, pageCount, pdf, pageImages };
  } finally { await task.destroy(); }
}
