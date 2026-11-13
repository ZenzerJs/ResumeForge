import type { TypstWorkerRequest, TypstWorkerResponse } from "./compiler.worker";

export interface CompileSuccessResult {
  success: true;
  svg: string;
}

export interface CompileErrorResult {
  success: false;
  superseded?: boolean;
  error: {
    message: string;
    line?: number;
  };
}

export type CompileResult = CompileSuccessResult | CompileErrorResult;

export interface CompileRequestOptions {
  callerId?: string;
  mode?: "live" | "export";
}

export class SupersededCompileError extends Error {
  constructor(message = "Compilation superseded by a newer request.") {
    super(message);
    this.name = "SupersededCompileError";
  }
}

export interface TypstWorkerLike {
  onmessage: ((event: MessageEvent<TypstWorkerResponse>) => void) | null;
  onerror: ((event: ErrorEvent | Event) => void) | null;
  onmessageerror?: ((event: MessageEvent) => void) | null;
  postMessage: (message: TypstWorkerRequest) => void;
  terminate: () => void;
}

export interface TypstCompilerClientConfig {
  createWorker?: () => TypstWorkerLike;
  timeoutMs?: number;
  maxPending?: number;
  isBrowser?: () => boolean;
}

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_PENDING = 4;

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
  const cleanedMessage = errorMessage
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

type QueuedJob =
  | {
      id: number;
      kind: "svg";
      source: string;
      callerId?: string;
      mode: "live" | "export";
      resolve: (value: CompileResult) => void;
    }
  | {
      id: number;
      kind: "pdf";
      source: string;
      callerId?: string;
      mode: "live" | "export";
      resolve: (value: Uint8Array) => void;
      reject: (reason?: unknown) => void;
    };

export function createTypstCompilerClient(config: TypstCompilerClientConfig = {}) {
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxPending = config.maxPending ?? DEFAULT_MAX_PENDING;
  const isBrowser = config.isBrowser ?? (() => typeof window !== "undefined");
  const createWorker =
    config.createWorker ??
    (() =>
      new Worker(new URL("./compiler.worker.ts", import.meta.url), {
        type: "module",
      }) as unknown as TypstWorkerLike);

  let worker: TypstWorkerLike | null = null;
  let nextJobId = 1;
  let activeJob: QueuedJob | null = null;
  let activeTimer: ReturnType<typeof setTimeout> | null = null;
  const pendingQueue: QueuedJob[] = [];

  function clearActiveTimer() {
    if (activeTimer !== null) {
      clearTimeout(activeTimer);
      activeTimer = null;
    }
  }

  function detachAndTerminateWorker() {
    clearActiveTimer();
    if (!worker) return;
    const current = worker;
    worker = null;
    current.onmessage = null;
    current.onerror = null;
    if ("onmessageerror" in current) {
      current.onmessageerror = null;
    }
    try {
      current.terminate();
    } catch {
      // Ignore worker termination errors during teardown.
    }
  }

  function settleInfraFailure(job: QueuedJob, message: string, superseded = false) {
    if (job.kind === "svg") {
      job.resolve({
        success: false,
        ...(superseded ? { superseded: true } : {}),
        error: { message },
      });
      return;
    }
    job.reject(superseded ? new SupersededCompileError(message) : new Error(message));
  }

  function failWorkerAndAffected(message: string) {
    detachAndTerminateWorker();
    const current = activeJob;
    activeJob = null;
    const queued = pendingQueue.splice(0, pendingQueue.length);
    if (current) {
      settleInfraFailure(current, message);
    }
    for (const job of queued) {
      settleInfraFailure(job, message);
    }
  }

  function ensureWorker(): TypstWorkerLike {
    if (worker) return worker;
    const instance = createWorker();
    instance.onmessage = (event: MessageEvent<TypstWorkerResponse>) => {
      const data = event.data;
      if (!data || typeof data.id !== "number") return;
      if (!activeJob || data.id !== activeJob.id) {
        // Ignore late or mismatched responses from superseded/timed-out work.
        return;
      }

      clearActiveTimer();
      const job = activeJob;
      activeJob = null;

      if (job.kind === "svg") {
        if (data.ok && data.kind === "svg") {
          if (!data.svg) {
            job.resolve({
              success: false,
              error: { message: "Compilation produced empty output." },
            });
          } else {
            job.resolve({
              success: true,
              svg: data.svg,
            });
          }
        } else {
          job.resolve({
            success: false,
            error: parseTypstError(
              !data.ok ? data.errorMessage : "Compilation produced invalid output.",
            ),
          });
        }
      } else {
        if (data.ok && data.kind === "pdf" && data.pdf) {
          const bytes = data.pdf instanceof Uint8Array ? data.pdf : new Uint8Array(data.pdf);
          job.resolve(bytes);
        } else {
          job.reject(
            new Error(
              !data.ok && data.errorMessage
                ? data.errorMessage
                : "Failed to compile Typst document to PDF.",
            ),
          );
        }
      }

      dispatchNext();
    };

    instance.onerror = () => {
      failWorkerAndAffected("Typst compiler worker failed.");
    };

    if ("onmessageerror" in instance) {
      instance.onmessageerror = () => {
        failWorkerAndAffected("Typst compiler worker returned an unreadable response.");
      };
    }

    worker = instance;
    return instance;
  }

  function dispatchNext() {
    if (activeJob || pendingQueue.length === 0) return;
    const next = pendingQueue.shift();
    if (!next) return;

    activeJob = next;
    const dispatchedId = next.id;
    activeTimer = setTimeout(() => {
      if (!activeJob || activeJob.id !== dispatchedId) return;
      const timedOut = activeJob;
      activeJob = null;
      detachAndTerminateWorker();
      settleInfraFailure(timedOut, "Typst compilation timed out after 15 seconds.");
      dispatchNext();
    }, timeoutMs);

    try {
      const instance = ensureWorker();
      instance.postMessage({
        id: next.id,
        kind: next.kind,
        source: next.source,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to dispatch Typst compilation.";
      failWorkerAndAffected(message);
    }
  }

  function enqueueSvg(source: string, options?: CompileRequestOptions): Promise<CompileResult> {
    if (!isBrowser()) {
      return Promise.resolve({
        success: false,
        error: { message: "Typst compiler can only run in browser environment." },
      });
    }

    const mode = options?.mode ?? "live";
    const callerId = options?.callerId;

    return new Promise<CompileResult>((resolve) => {
      const job: QueuedJob = {
        id: nextJobId++,
        kind: "svg",
        source,
        callerId,
        mode,
        resolve,
      };

      if (activeJob === null && pendingQueue.length === 0) {
        pendingQueue.push(job);
        dispatchNext();
        return;
      }

      if (mode === "live" && callerId) {
        const existingIndex = pendingQueue.findIndex(
          (pending) =>
            pending.kind === job.kind &&
            pending.mode === "live" &&
            pending.callerId === callerId,
        );
        if (existingIndex >= 0) {
          const replaced = pendingQueue[existingIndex];
          pendingQueue[existingIndex] = job;
          settleInfraFailure(replaced, "Compilation superseded by a newer request.", true);
          return;
        }
      }

      if (pendingQueue.length >= maxPending) {
        settleInfraFailure(
          job,
          "Typst compiler queue is full. Please wait for current compilations to finish.",
        );
        return;
      }

      pendingQueue.push(job);
    });
  }

  function enqueuePdf(source: string, options?: CompileRequestOptions): Promise<Uint8Array> {
    if (!isBrowser()) {
      return Promise.reject(new Error("PDF compilation requires browser environment."));
    }

    const mode = options?.mode ?? "export";
    const callerId = options?.callerId;

    return new Promise<Uint8Array>((resolve, reject) => {
      const job: QueuedJob = {
        id: nextJobId++,
        kind: "pdf",
        source,
        callerId,
        mode,
        resolve,
        reject,
      };

      if (activeJob === null && pendingQueue.length === 0) {
        pendingQueue.push(job);
        dispatchNext();
        return;
      }

      if (mode === "live" && callerId) {
        const existingIndex = pendingQueue.findIndex(
          (pending) =>
            pending.kind === job.kind &&
            pending.mode === "live" &&
            pending.callerId === callerId,
        );
        if (existingIndex >= 0) {
          const replaced = pendingQueue[existingIndex];
          pendingQueue[existingIndex] = job;
          settleInfraFailure(replaced, "Compilation superseded by a newer request.", true);
          return;
        }
      }

      if (pendingQueue.length >= maxPending) {
        settleInfraFailure(
          job,
          "Typst compiler queue is full. Please wait for current compilations to finish.",
        );
        return;
      }

      pendingQueue.push(job);
    });
  }

  function dispose() {
    failWorkerAndAffected("Typst compiler was disposed.");
  }

  return {
    compileTypstToSvg: enqueueSvg,
    compileTypstToPdf: enqueuePdf,
    dispose,
  };
}

const defaultCompilerClient = createTypstCompilerClient();

/**
 * Compiles Typst source markup string to SVG image output for live preview.
 */
export async function compileTypstToSvg(
  source: string,
  options?: CompileRequestOptions,
): Promise<CompileResult> {
  return defaultCompilerClient.compileTypstToSvg(source, options);
}

/**
 * Compiles Typst source markup string to PDF binary Uint8Array for export.
 */
export async function compileTypstToPdf(
  source: string,
  options?: CompileRequestOptions,
): Promise<Uint8Array> {
  return defaultCompilerClient.compileTypstToPdf(source, options);
}
/** Compile and measure the exact source; optionally render each PDF page for preview. */
export async function measureTypstDocument(
  source: string,
  renderPages = false,
  options?: CompileRequestOptions,
) {
  const pdf = await compileTypstToPdf(source, options);
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

/** Render the exact PDF and expose conservative, normalized text-item rectangles. */
export async function renderTypstReview(
  source: string,
  renderPages = true,
  options?: CompileRequestOptions,
) {
  const pdf = await compileTypstToPdf(source, options);
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = "/workers/pdf.worker.min.mjs";
  const task = pdfjs.getDocument({ data: new Uint8Array(pdf) });
  try {
    const document = await task.promise;
    const pages: string[] = [];
    const items: import("@/lib/typst/preview-mapping").PreviewTextItem[] = [];
    for (let index = 1; index <= document.numPages; index++) {
      const page = await document.getPage(index);
      const viewport = page.getViewport({ scale: 1.5 });
      if (renderPages) {
        const canvas = window.document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Could not render document preview.");
        await page.render({ canvas, canvasContext: context, viewport }).promise;
        pages.push(canvas.toDataURL("image/png"));
      }
      const content = await page.getTextContent();
      for (const item of content.items) {
        if (!("str" in item) || !item.str.trim() || Math.abs(item.transform[1]) > 0.01 || Math.abs(item.transform[2]) > 0.01) continue;
        const [x1, y1] = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
        const [x2, y2] = viewport.convertToViewportPoint(item.transform[4] + item.width, item.transform[5] + item.height);
        items.push({ text: item.str, page: index - 1, left: Math.min(x1, x2) / viewport.width * 100, top: Math.min(y1, y2) / viewport.height * 100, width: Math.abs(x2 - x1) / viewport.width * 100, height: Math.abs(y2 - y1) / viewport.height * 100 });
      }
    }
    return { pages, items };
  } finally { await task.destroy(); }
}
