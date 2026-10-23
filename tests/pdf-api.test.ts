import { afterEach, describe, it, expect, vi } from "vitest";
import { POST as uploadPdfHandler } from "@/app/api/resumes/upload-pdf/route";
import { POST as clearMasterHandler } from "@/app/api/resumes/clear-master/route";
import * as resumesDb from "@/lib/db/resumes";
import { getMasterResume } from "@/lib/db/resumes";
import { authedRequest, createTestUser } from "./helpers/auth";

const originalDemoMode = process.env.DEMO_MODE;

afterEach(() => {
  vi.restoreAllMocks();
  if (originalDemoMode === undefined) delete process.env.DEMO_MODE;
  else process.env.DEMO_MODE = originalDemoMode;
});

describe("PDF Upload & Master Resume Clearing API", () => {
  it("rejects request if no payload provided", async () => {
    const { cookie } = await createTestUser();
    const req = authedRequest(
      "http://localhost/api/resumes/upload-pdf",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      },
      cookie
    );

    const res = await uploadPdfHandler(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
  });

  it("handles rawText upload and creates a reviewable draft (not auto-Master)", async () => {
    const { cookie } = await createTestUser();
    const sampleText = "Jane Smith\nBackend Developer\n- Built microservices using Go and Node.js";
    const req = authedRequest(
      "http://localhost/api/resumes/upload-pdf",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Jane Resume",
          rawText: sampleText,
        }),
      },
      cookie
    );

    const res = await uploadPdfHandler(req);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.title).toBe("Jane Resume");
    expect(json.data.isMaster).toBe(false);
    expect(json.data.typstSource).toContain("@pdf-conversion-draft");
  });

  it("converts a public demo upload to a browser-local draft without auth or database writes", async () => {
    process.env.DEMO_MODE = "true";
    const createResume = vi.spyOn(resumesDb, "createResume");
    const request = new Request("http://localhost/api/resumes/upload-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost", Cookie: "rf_session=existing-signed-cookie" },
      body: JSON.stringify({ title: "Local Draft", rawText: "Jane Smith\nBackend Engineer\n- Built APIs with TypeScript." }),
    });

    const response = await uploadPdfHandler(request);
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json).toMatchObject({ success: true, persistence: "browser-local", data: { title: "Local Draft", isMaster: false } });
    expect(json.data.typstSource).toContain("@pdf-conversion-draft");
    expect(json.data.id).toBeUndefined();
    expect(createResume).not.toHaveBeenCalled();
  });

  it("rejects demo uploads without a same-origin browser header", async () => {
    process.env.DEMO_MODE = "true";
    const request = new Request("http://localhost/api/resumes/upload-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://attacker.example" },
      body: JSON.stringify({ rawText: "resume text" }),
    });
    const response = await uploadPdfHandler(request);
    expect(response.status).toBe(403);
  });

  it("bounds chunked demo request bodies before multipart parsing", async () => {
    process.env.DEMO_MODE = "true";
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(10 * 1024 * 1024));
        controller.enqueue(new Uint8Array(64 * 1024 + 1));
        controller.close();
      },
    });
    const request = new Request("http://localhost/api/resumes/upload-pdf", {
      method: "POST",
      headers: { Origin: "http://localhost", "Content-Type": "multipart/form-data; boundary=demo" },
      body,
      duplex: "half",
    } as RequestInit);
    const response = await uploadPdfHandler(request);
    expect(response.status).toBe(413);
  });

  it("rejects oversized PDF uploads", async () => {
    const { cookie } = await createTestUser();
    const oversized = new File([new Uint8Array(10 * 1024 * 1024 + 24)], "huge.pdf", {
      type: "application/pdf",
    });
    const form = new FormData();
    form.append("file", oversized);
    const req = authedRequest(
      "http://localhost/api/resumes/upload-pdf",
      {
        method: "POST",
        body: form,
      },
      cookie
    );
    const res = await uploadPdfHandler(req);
    expect(res.status).toBe(413);
  });

  it("clears current master resume", async () => {
    const { cookie, user } = await createTestUser();
    const req = authedRequest("http://localhost/api/resumes/clear-master", { method: "POST" }, cookie);

    const res = await clearMasterHandler(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);

    const master = await getMasterResume(user.id);
    expect(master).toBeNull();
  });
});
