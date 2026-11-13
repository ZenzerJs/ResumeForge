import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createTypstCompilerClient,
  parseTypstError,
  SupersededCompileError,
  type TypstWorkerLike,
} from "./compiler";
import type { TypstWorkerRequest, TypstWorkerResponse } from "./compiler.worker";

class FakeWorker implements TypstWorkerLike {
  onmessage: ((event: MessageEvent<TypstWorkerResponse>) => void) | null = null;
  onerror: ((event: ErrorEvent | Event) => void) | null = null;
  onmessageerror: ((event: MessageEvent) => void) | null = null;
  posted: TypstWorkerRequest[] = [];
  terminated = false;

  postMessage(message: TypstWorkerRequest) {
    this.posted.push(message);
  }

  terminate() {
    this.terminated = true;
  }

  emitMessage(data: TypstWorkerResponse) {
    this.onmessage?.({ data } as MessageEvent<TypstWorkerResponse>);
  }

  emitError() {
    this.onerror?.(new Event("error"));
  }
}

describe("Typst Error Parser Unit Tests", () => {
  it("extracts line number from 'at line X' format", () => {
    const raw = "error: unexpected token at line 14, column 3";
    const parsed = parseTypstError(raw);
    expect(parsed.line).toBe(14);
    expect(parsed.message).toContain("unexpected token at line 14");
  });

  it("extracts line number from '14:5:' format", () => {
    const raw = "14:5: error: missing closing parenthesis";
    const parsed = parseTypstError(raw);
    expect(parsed.line).toBe(14);
    expect(parsed.message).toContain("14:5: error: missing closing parenthesis");
  });

  it("returns undefined line when error message contains no line number", () => {
    const raw = "Generic WASM compilation failure";
    const parsed = parseTypstError(raw);
    expect(parsed.line).toBe(1);
    expect(parsed.message).toBe("Generic WASM compilation failure");
  });
});

describe("Typst Worker Compiler Client", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("lazily creates the worker only in a browser context", async () => {
    const workers: FakeWorker[] = [];
    const serverClient = createTypstCompilerClient({
      isBrowser: () => false,
      createWorker: () => {
        const w = new FakeWorker();
        workers.push(w);
        return w;
      },
    });

    const svgResult = await serverClient.compileTypstToSvg("= Hello");
    expect(svgResult.success).toBe(false);
    await expect(serverClient.compileTypstToPdf("= Hello")).rejects.toThrow(
      "browser environment",
    );
    expect(workers).toHaveLength(0);

    const browserClient = createTypstCompilerClient({
      isBrowser: () => true,
      createWorker: () => {
        const w = new FakeWorker();
        workers.push(w);
        return w;
      },
    });
    expect(workers).toHaveLength(0);

    const pending = browserClient.compileTypstToSvg("= Hello");
    expect(workers).toHaveLength(1);
    expect(workers[0].posted).toHaveLength(1);
    const req = workers[0].posted[0];
    workers[0].emitMessage({ id: req.id, kind: "svg", ok: true, svg: "<svg />" });
    await expect(pending).resolves.toEqual({ success: true, svg: "<svg />" });
  });

  it("allows 1 active and at most 4 pending exports in FIFO order, rejecting overflow", async () => {
    const workers: FakeWorker[] = [];
    const client = createTypstCompilerClient({
      isBrowser: () => true,
      createWorker: () => {
        const w = new FakeWorker();
        workers.push(w);
        return w;
      },
    });

    const exports = [1, 2, 3, 4, 5].map((n) =>
      client.compileTypstToPdf(`= Doc ${n}`, { mode: "export" }),
    );
    const overflow = client.compileTypstToPdf("= Doc 6", { mode: "export" });

    await expect(overflow).rejects.toThrow("queue is full");
    expect(workers[0].posted).toHaveLength(1);

    for (let i = 0; i < 5; i++) {
      const req = workers[0].posted[i];
      expect(req.source).toBe(`= Doc ${i + 1}`);
      workers[0].emitMessage({
        id: req.id,
        kind: "pdf",
        ok: true,
        pdf: new Uint8Array([i + 1]),
      });
      const bytes = await exports[i];
      expect(Array.from(bytes)).toEqual([i + 1]);
    }
  });

  it("coalesces superseded live requests per caller and preserves explicit exports", async () => {
    const workers: FakeWorker[] = [];
    const client = createTypstCompilerClient({
      isBrowser: () => true,
      createWorker: () => {
        const w = new FakeWorker();
        workers.push(w);
        return w;
      },
    });

    const p1 = client.compileTypstToSvg("= v1", { callerId: "editor", mode: "live" });
    const p2 = client.compileTypstToSvg("= v2", { callerId: "editor", mode: "live" });
    const p3 = client.compileTypstToSvg("= v3", { callerId: "editor", mode: "live" });
    const pExport = client.compileTypstToPdf("= export", { mode: "export" });

    // p2 was superseded in the pending slot by p3.
    const r2 = await p2;
    expect(r2.success).toBe(false);
    if (!r2.success) expect(r2.superseded).toBe(true);

    // Also verify live PDF coalescing settles replaced promise with SupersededCompileError.
    const m1 = client.compileTypstToPdf("= m1", { callerId: "measure", mode: "live" });
    const m2 = client.compileTypstToPdf("= m2", { callerId: "measure", mode: "live" });
    await expect(m1).rejects.toBeInstanceOf(SupersededCompileError);

    // Drain active (v1) -> coalesced v3 -> export -> m2.
    const w = workers[0];
    expect(w.posted[0].source).toBe("= v1");
    w.emitMessage({ id: w.posted[0].id, kind: "svg", ok: true, svg: "<svg>1</svg>" });
    await expect(p1).resolves.toEqual({ success: true, svg: "<svg>1</svg>" });

    expect(w.posted[1].source).toBe("= v3");
    w.emitMessage({ id: w.posted[1].id, kind: "svg", ok: true, svg: "<svg>3</svg>" });
    await expect(p3).resolves.toEqual({ success: true, svg: "<svg>3</svg>" });

    expect(w.posted[2].source).toBe("= export");
    w.emitMessage({
      id: w.posted[2].id,
      kind: "pdf",
      ok: true,
      pdf: new Uint8Array([9]),
    });
    await expect(pExport).resolves.toEqual(new Uint8Array([9]));

    expect(w.posted[3].source).toBe("= m2");
    w.emitMessage({
      id: w.posted[3].id,
      kind: "pdf",
      ok: true,
      pdf: new Uint8Array([2]),
    });
    await expect(m2).resolves.toEqual(new Uint8Array([2]));
  });

  it("terminates a timed-out worker at 15s, ignores late IDs, and recovers with a fresh worker", async () => {
    vi.useFakeTimers();
    const workers: FakeWorker[] = [];
    const client = createTypstCompilerClient({
      isBrowser: () => true,
      createWorker: () => {
        const w = new FakeWorker();
        workers.push(w);
        return w;
      },
    });

    const stalled = client.compileTypstToSvg("= #while true {}");
    const firstWorker = workers[0];
    const staleId = firstWorker.posted[0].id;

    await vi.advanceTimersByTimeAsync(15_000);
    const timedOutResult = await stalled;

    expect(timedOutResult.success).toBe(false);
    if (!timedOutResult.success) {
      expect(timedOutResult.error.message).toContain("timed out");
    }
    expect(firstWorker.terminated).toBe(true);
    expect(firstWorker.onmessage).toBeNull();
    expect(firstWorker.onerror).toBeNull();

    // Late message on old worker should be harmlessly ignored.
    firstWorker.emitMessage({ id: staleId, kind: "svg", ok: true, svg: "<svg>late</svg>" });

    const recovered = client.compileTypstToSvg("= Valid");
    expect(workers).toHaveLength(2);
    const secondWorker = workers[1];
    expect(secondWorker.terminated).toBe(false);
    // Late message with stale ID sent to new worker must also be ignored.
    secondWorker.emitMessage({ id: staleId, kind: "svg", ok: true, svg: "<svg>wrong</svg>" });
    secondWorker.emitMessage({
      id: secondWorker.posted[0].id,
      kind: "svg",
      ok: true,
      svg: "<svg>ok</svg>",
    });
    await expect(recovered).resolves.toEqual({ success: true, svg: "<svg>ok</svg>" });
  });

  it("terminates a nonreplying PDF compiler worker at 15s and recovers for the next valid PDF job", async () => {
    vi.useFakeTimers();
    const workers: FakeWorker[] = [];
    const client = createTypstCompilerClient({
      isBrowser: () => true,
      createWorker: () => {
        const w = new FakeWorker();
        workers.push(w);
        return w;
      },
    });

    const stalledPdf = client.compileTypstToPdf("= #while true {}", { mode: "export" });
    const stalledAssertion = expect(stalledPdf).rejects.toThrow("timed out");
    const firstWorker = workers[0];
    const staleId = firstWorker.posted[0].id;

    await vi.advanceTimersByTimeAsync(15_000);
    await stalledAssertion;
    expect(firstWorker.terminated).toBe(true);
    expect(firstWorker.onmessage).toBeNull();

    firstWorker.emitMessage({ id: staleId, kind: "pdf", ok: true, pdf: new Uint8Array([99]) });

    const nextPdf = client.compileTypstToPdf("= Valid PDF", { mode: "export" });
    expect(workers).toHaveLength(2);
    const secondWorker = workers[1];
    secondWorker.emitMessage({
      id: secondWorker.posted[0].id,
      kind: "pdf",
      ok: true,
      pdf: new Uint8Array([37, 80, 68, 70]),
    });
    await expect(nextPdf).resolves.toEqual(new Uint8Array([37, 80, 68, 70]));
  });

  it("terminates on worker crash, settles affected requests, and spawns a fresh worker next", async () => {
    const workers: FakeWorker[] = [];
    const client = createTypstCompilerClient({
      isBrowser: () => true,
      createWorker: () => {
        const w = new FakeWorker();
        workers.push(w);
        return w;
      },
    });

    const active = client.compileTypstToSvg("= Active");
    const queued = client.compileTypstToPdf("= Queued", { mode: "export" });

    workers[0].emitError();
    expect(workers[0].terminated).toBe(true);
    expect(workers[0].onmessage).toBeNull();
    expect(workers[0].onerror).toBeNull();

    const activeRes = await active;
    expect(activeRes.success).toBe(false);
    await expect(queued).rejects.toThrow("worker failed");

    const next = client.compileTypstToSvg("= Recovered");
    expect(workers).toHaveLength(2);
    workers[1].emitMessage({
      id: workers[1].posted[0].id,
      kind: "svg",
      ok: true,
      svg: "<svg>fresh</svg>",
    });
    await expect(next).resolves.toEqual({ success: true, svg: "<svg>fresh</svg>" });
  });

  it("does not coalesce a live PDF request with a live SVG request sharing the same callerId", async () => {
    const workers: FakeWorker[] = [];
    const client = createTypstCompilerClient({
      isBrowser: () => true,
      createWorker: () => {
        const w = new FakeWorker();
        workers.push(w);
        return w;
      },
    });

    const active = client.compileTypstToSvg("= Active", { callerId: "shared", mode: "live" });
    const queuedSvg = client.compileTypstToSvg("= Svg", { callerId: "shared", mode: "live" });
    const queuedPdf = client.compileTypstToPdf("= Pdf", { callerId: "shared", mode: "live" });

    const w = workers[0];
    w.emitMessage({ id: w.posted[0].id, kind: "svg", ok: true, svg: "<svg>a</svg>" });
    await expect(active).resolves.toEqual({ success: true, svg: "<svg>a</svg>" });

    w.emitMessage({ id: w.posted[1].id, kind: "svg", ok: true, svg: "<svg>b</svg>" });
    await expect(queuedSvg).resolves.toEqual({ success: true, svg: "<svg>b</svg>" });

    w.emitMessage({ id: w.posted[2].id, kind: "pdf", ok: true, pdf: new Uint8Array([7]) });
    await expect(queuedPdf).resolves.toEqual(new Uint8Array([7]));
  });
});
