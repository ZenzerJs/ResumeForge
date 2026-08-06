import { $typst } from "@myriaddreamin/typst.ts";

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

async function ensureTypstInitialized() {
  if (typeof window === "undefined") return;
  if (!isInitialized) {
    try {
      $typst.setCompilerInitOptions({
        getModule: () => "/wasm/typst_ts_web_compiler_bg.wasm",
      });
      $typst.setRendererInitOptions({
        getModule: () => "/wasm/typst_ts_renderer_bg.wasm",
      });
      isInitialized = true;
    } catch {
      // Ignore if already set or initialization fails softly
    }
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
    await ensureTypstInitialized();
    const svgResult = await $typst.svg({ mainContent: source });
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

  await ensureTypstInitialized();
  const pdfBytes = await $typst.pdf({ mainContent: source });
  if (!pdfBytes) {
    throw new Error("Failed to compile Typst document to PDF.");
  }
  return pdfBytes;
}
