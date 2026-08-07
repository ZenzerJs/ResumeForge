import { describe, it, expect, beforeEach } from "vitest";
import { POST as uploadPdfHandler } from "@/app/api/resumes/upload-pdf/route";
import { POST as clearMasterHandler } from "@/app/api/resumes/clear-master/route";
import { getMasterResume } from "@/lib/db/resumes";

describe("PDF Upload & Master Resume Clearing API", () => {
  it("rejects request if no payload provided", async () => {
    const req = new Request("http://localhost/api/resumes/upload-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const res = await uploadPdfHandler(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
  });

  it("handles rawText upload and creates a reviewable draft (not auto-Master)", async () => {
    const sampleText = "Jane Smith\nBackend Developer\n- Built microservices using Go and Node.js";
    const req = new Request("http://localhost/api/resumes/upload-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Jane Resume",
        rawText: sampleText,
      }),
    });

    const res = await uploadPdfHandler(req);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.title).toBe("Jane Resume");
    // Task 7.4: PDF upload must NOT auto-promote to Master; user reviews first
    expect(json.data.isMaster).toBe(false);
    // Verify draft conversion comment header is present
    expect(json.data.typstSource).toContain("@pdf-conversion-draft");
  });


  it("clears current master resume", async () => {
    const req = new Request("http://localhost/api/resumes/clear-master", {
      method: "POST",
    });

    const res = await clearMasterHandler();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);

    const master = await getMasterResume();
    expect(master).toBeNull();
  });
});
