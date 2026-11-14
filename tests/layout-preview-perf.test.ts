import { describe, it, expect, vi, beforeEach } from "vitest";

const renderedPagesSpy: number[] = [];
let getDocumentCallCount = 0;

vi.mock("pdfjs-dist/legacy/build/pdf.mjs", () => ({
  GlobalWorkerOptions: { workerSrc: "" },
  getDocument: () => {
    getDocumentCallCount += 1;
    return {
      promise: Promise.resolve({
        numPages: 3,
        getPage: async (pageNumber: number) => ({
          getViewport: () => ({ width: 850, height: 1100 }),
          render: () => {
            renderedPagesSpy.push(pageNumber);
            return { promise: Promise.resolve() };
          },
        }),
      }),
      destroy: async () => {},
    };
  },
}));

describe("PERF-02b compiler measurement deduplication and selective page rendering", () => {
  beforeEach(() => {
    renderedPagesSpy.length = 0;
    getDocumentCallCount = 0;
  });

  it("shares one in-flight PDF measurement per exact source and skips canvas rasterization", async () => {
    const originalWindow = globalThis.window;
    const originalWorker = globalThis.Worker;
    let workerPostCount = 0;
    const fakePdf = new Uint8Array([37, 80, 68, 70]);

    class FakeWorker {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;
      onmessageerror: ((event: MessageEvent) => void) | null = null;
      postMessage(msg: { id: number; kind: string; source: string }) {
        workerPostCount += 1;
        setTimeout(() => {
          if (msg.source === "bad-source") {
            this.onmessage?.({
              data: { id: msg.id, ok: false, kind: "pdf", errorMessage: "broken typst" },
            } as MessageEvent);
            return;
          }
          this.onmessage?.({
            data: { id: msg.id, ok: true, kind: "pdf", pdf: fakePdf },
          } as MessageEvent);
        }, 10);
      }
      terminate() {}
    }

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {},
    });
    Object.defineProperty(globalThis, "Worker", {
      configurable: true,
      value: FakeWorker,
    });

    try {
      vi.resetModules();
      const { measureTypstPageCount, measureTypstDocument } = await import("@/lib/typst/compiler");

      // Concurrent measureTypstPageCount + measureTypstDocument(false) for exact same source share 1 worker compile
      const [m1, m2, m3] = await Promise.all([
        measureTypstPageCount("same-source", { callerId: "editor-preview-measure", mode: "live" }),
        measureTypstPageCount("same-source", { callerId: "editor-preview-measure", mode: "export" }),
        measureTypstDocument("same-source", false, { callerId: "editor-preview-measure", mode: "live" }),
      ]);
      expect(workerPostCount).toBe(1);
      expect(m1.pageCount).toBe(3);
      expect(m2.pageCount).toBe(3);
      expect(m3.pageCount).toBe(3);
      expect(m3.pageImages).toEqual([]);
      expect(m1.pdf).toEqual(fakePdf);
      expect(renderedPagesSpy).toEqual([]);

      // Failed measurement cleans up inFlightMeasurements so a retry dispatches again
      await expect(measureTypstPageCount("bad-source")).rejects.toThrow("broken typst");
      await expect(measureTypstPageCount("bad-source")).rejects.toThrow("broken typst");
      expect(workerPostCount).toBe(3);
    } finally {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: originalWindow,
      });
      Object.defineProperty(globalThis, "Worker", {
        configurable: true,
        value: originalWorker,
      });
    }
  });

  it("rasterizes only requested pages in renderPdfPages without recompiling", async () => {
    const originalWindow = globalThis.window;
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        document: {
          createElement: () => ({
            width: 0,
            height: 0,
            getContext: () => ({}),
            toDataURL: () => "data:image/png;base64,PAGE",
          }),
        },
      },
    });
    try {
      const { renderPdfPages } = await import("@/lib/typst/compiler");
      const out1 = await renderPdfPages(new Uint8Array([1, 2, 3]), [1]);
      expect(Object.keys(out1)).toEqual(["1"]);
      expect(renderedPagesSpy).toEqual([1]);

      const out2 = await renderPdfPages(new Uint8Array([1, 2, 3]), [2, 2, 99]);
      expect(Object.keys(out2)).toEqual(["2"]);
      expect(renderedPagesSpy).toEqual([1, 2]);
      expect(getDocumentCallCount).toBe(2);
    } finally {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: originalWindow,
      });
    }
  });
});
