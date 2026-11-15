import { $typst, loadFonts } from "@myriaddreamin/typst.ts";

export interface TypstWorkerRequest {
  id: number;
  kind: "svg" | "pdf";
  source: string;
}

export type TypstWorkerResponse =
  | {
      id: number;
      kind: "svg";
      ok: true;
      svg: string;
    }
  | {
      id: number;
      kind: "pdf";
      ok: true;
      pdf: Uint8Array;
    }
  | {
      id: number;
      kind: "svg" | "pdf";
      ok: false;
      errorMessage: string;
    };

interface WorkerGlobalLike {
  location?: { origin?: string };
  onmessage: ((event: MessageEvent<TypstWorkerRequest>) => void) | null;
  postMessage: (message: TypstWorkerResponse, transfer?: Transferable[]) => void;
}

const workerScope = self as unknown as WorkerGlobalLike;

let isInitialized = false;
let workerQueue: Promise<void> = Promise.resolve();

function resolveAssetUrl(path: string): string {
  const origin = workerScope.location?.origin;
  if (origin && origin !== "null") {
    return new URL(path, origin).toString();
  }
  return path;
}

function serialized<T>(work: () => Promise<T>): Promise<T> {
  const result = workerQueue.then(work);
  workerQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

type WasmBindgenModuleOption = { module_or_path: string };

async function ensureTypstInitialized() {
  if (isInitialized) return;
  $typst.setCompilerInitOptions({
    getModule: () =>
      ({
        module_or_path: resolveAssetUrl("/wasm/typst_ts_web_compiler_bg.wasm"),
      }) satisfies WasmBindgenModuleOption as unknown as string,
    beforeBuild: [
      loadFonts(
        [
          resolveAssetUrl("/fonts/typst/LibertinusSerif-Regular.otf"),
          resolveAssetUrl("/fonts/typst/LibertinusSerif-Bold.otf"),
          resolveAssetUrl("/fonts/typst/LibertinusSerif-Italic.otf"),
          resolveAssetUrl("/fonts/typst/LibertinusSerif-BoldItalic.otf"),
          resolveAssetUrl("/fonts/typst/LibertinusSerif-Semibold.otf"),
          resolveAssetUrl("/fonts/typst/LibertinusSerif-SemiboldItalic.otf"),
          resolveAssetUrl("/fonts/typst/NewCM10-Regular.otf"),
          resolveAssetUrl("/fonts/typst/NewCM10-Bold.otf"),
          resolveAssetUrl("/fonts/typst/NewCM10-Italic.otf"),
          resolveAssetUrl("/fonts/typst/NewCM10-BoldItalic.otf"),
          resolveAssetUrl("/fonts/typst/NewCMMath-Regular.otf"),
          resolveAssetUrl("/fonts/typst/NewCMMath-Book.otf"),
          resolveAssetUrl("/fonts/typst/NewCMMath-Bold.otf"),
          resolveAssetUrl("/fonts/typst/DejaVuSansMono.ttf"),
          resolveAssetUrl("/fonts/typst/DejaVuSansMono-Bold.ttf"),
          resolveAssetUrl("/fonts/typst/DejaVuSansMono-Oblique.ttf"),
          resolveAssetUrl("/fonts/typst/DejaVuSansMono-BoldOblique.ttf"),
        ],
        { assets: false },
      ),
    ],
  });
  $typst.setRendererInitOptions({
    getModule: () =>
      ({
        module_or_path: resolveAssetUrl("/wasm/typst_ts_renderer_bg.wasm"),
      }) satisfies WasmBindgenModuleOption as unknown as string,
  });
  isInitialized = true;
}

workerScope.onmessage = (event: MessageEvent<TypstWorkerRequest>) => {
  const request = event.data;
  if (!request || typeof request.id !== "number") return;

  void serialized(async () => {
    try {
      await ensureTypstInitialized();
      if (request.kind === "svg") {
        const svgResult = await $typst.svg({ mainContent: request.source });
        if (!svgResult) {
          workerScope.postMessage({
            id: request.id,
            kind: "svg",
            ok: false,
            errorMessage: "Compilation produced empty output.",
          });
          return;
        }
        workerScope.postMessage({
          id: request.id,
          kind: "svg",
          ok: true,
          svg: svgResult,
        });
        return;
      }

      const pdfBytes = await $typst.pdf({ mainContent: request.source });
      if (!pdfBytes) {
        workerScope.postMessage({
          id: request.id,
          kind: "pdf",
          ok: false,
          errorMessage: "Failed to compile Typst document to PDF.",
        });
        return;
      }

      // Copy into an owned Uint8Array so transferring never detaches WASM memory.
      const ownedBytes = pdfBytes.slice();
      workerScope.postMessage(
        {
          id: request.id,
          kind: "pdf",
          ok: true,
          pdf: ownedBytes,
        },
        [ownedBytes.buffer],
      );
    } catch (err) {
      workerScope.postMessage({
        id: request.id,
        kind: request.kind,
        ok: false,
        errorMessage: err instanceof Error ? err.message : String(err),
      });
    }
  });
};
