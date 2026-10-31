import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/resumes/upload-pdf/route";

afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

describe("Independent PDF upload boundary audit", () => {
  it("rejects unsupported methods before parsing a body", async () => {
    const response = await POST(new Request("http://localhost/api/resumes/upload-pdf", { method: "GET" }));
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST");
  });

  it("expires an unfinished request stream and cancels its reader", async () => {
    vi.stubEnv("DEMO_MODE", "true");
    vi.useFakeTimers();
    const cancel = vi.fn();
    const request = new Request("http://localhost/api/resumes/upload-pdf", {
      method: "POST",
      headers: { Origin: "http://localhost", "Content-Type": "application/json" },
      body: new ReadableStream<Uint8Array>({ cancel }),
      duplex: "half",
    } as RequestInit);
    const pending = POST(request);
    await vi.advanceTimersByTimeAsync(30_001);
    const response = await pending;
    expect(response.status).toBe(408);
    expect((await response.json()).error).toBe("Request body timed out");
    expect(cancel).toHaveBeenCalledOnce();
  });

  it.each([undefined, ""])('rejects missing browser origin in public demo: %j', async (origin) => {
    vi.stubEnv("DEMO_MODE", "true");
    const headers = new Headers({ "Content-Type": "application/json" });
    if (origin !== undefined) headers.set("Origin", origin);
    const response = await POST(new Request("http://localhost/api/resumes/upload-pdf", {
      method: "POST", headers, body: JSON.stringify({ rawText: "Alex Rivera" }),
    }));
    expect(response.status).toBe(403);
  });
});
