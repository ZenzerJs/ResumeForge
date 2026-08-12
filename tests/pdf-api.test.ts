import { describe, it, expect } from "vitest";
import { POST as uploadPdfHandler } from "@/app/api/resumes/upload-pdf/route";
import { POST as clearMasterHandler } from "@/app/api/resumes/clear-master/route";
import { getMasterResume } from "@/lib/db/resumes";
import { authedRequest, createTestUser } from "./helpers/auth";

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
