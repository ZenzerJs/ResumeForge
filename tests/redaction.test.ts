import { describe, it, expect, vi } from "vitest";
import { redactKeys, sanitizeError } from "../src/lib/ai/redact";

const mockIngestedJobCount = vi.hoisted(() => vi.fn());
const mockGetAllProblems = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: {
    ingestedJob: { count: mockIngestedJobCount },
    connectorSyncLog: { findMany: vi.fn(async () => []) },
    interviewProblem: { findMany: vi.fn(async () => []) },
  },
}));

vi.mock("@/lib/practice/practice-curriculum", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/practice/practice-curriculum")>();
  return {
    ...actual,
    getAllProblems: mockGetAllProblems,
  };
});

describe("API Key Redaction Utility", () => {
  it("redacts OpenAI API keys", () => {
    const secretKey = "sk-proj-1234567890abcdefABCDEF1234567890";
    const rawError = `Failed to connect with key ${secretKey}: unauthorized`;
    const redacted = redactKeys(rawError);

    expect(redacted).not.toContain(secretKey);
    expect(redacted).toContain("[REDACTED_KEY]");
  });

  it("redacts Anthropic API keys", () => {
    const secretKey = "sk-ant-api03-abcdef1234567890";
    const rawError = `Error 401: Invalid key ${secretKey}`;
    const redacted = redactKeys(rawError);

    expect(redacted).not.toContain(secretKey);
    expect(redacted).toContain("[REDACTED_KEY]");
  });

  it("redacts Gemini API keys in URL query params", () => {
    const secretKey = "AIzaSyA1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q";
    const rawUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${secretKey}`;
    const redacted = redactKeys(rawUrl);

    expect(redacted).not.toContain(secretKey);
    expect(redacted).toContain("key=[REDACTED_KEY]");
  });

  it("redacts AQ.-prefixed Gemini API keys", () => {
    const aqKey = "AQ.Ab8RN6J2kLmNoPqRsTuVwXyZ0123456789";
    const rawError = `Gemini API rejected key ${aqKey} on https://generativelanguage.googleapis.com/v1beta/models?key=${aqKey}`;
    const redacted = redactKeys(rawError);

    expect(redacted).not.toContain(aqKey);
    expect(redacted).toContain("[REDACTED_KEY]");
    expect(redacted).toContain("key=[REDACTED_KEY]");
    expect(sanitizeError(new Error(`Failed with ${aqKey}`))).toBe("Failed with [REDACTED_KEY]");
  });

  it("redacts Bearer tokens in headers", () => {
    const rawHeader = "Authorization: Bearer sk-1234567890abcdefABCDEF1234567890";
    const redacted = redactKeys(rawHeader);

    expect(redacted).not.toContain("sk-1234567890");
    expect(redacted).toContain("Bearer [REDACTED_KEY]");
  });

  it("sanitizeError converts Error objects and redacts keys safely", () => {
    const secretKey = "sk-proj-999999999999999999999999";
    const err = new Error(`Connection timeout using ${secretKey}`);
    const sanitized = sanitizeError(err);

    expect(sanitized).not.toContain(secretKey);
    expect(sanitized).toBe("Connection timeout using [REDACTED_KEY]");
  });

  it("proves console log output scrubs leaked keys when wrapped", () => {
    const secretKey = "sk-ant-secretkey1234567890";
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Log through redactKeys filter
    console.error(redactKeys(`Critical exception: ${secretKey}`));

    expect(consoleSpy).toHaveBeenCalled();
    const loggedMessage = consoleSpy.mock.calls[0][0];
    expect(loggedMessage).not.toContain(secretKey);
    expect(loggedMessage).toContain("[REDACTED_KEY]");

    consoleSpy.mockRestore();
  });
});

describe("Public API Error Redaction (SEC-08)", () => {
  it("returns generic 500 error from /api/connectors/status and /api/practice/problems without leaking exception details", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockIngestedJobCount.mockRejectedValueOnce(
      new Error("DB connection failed using sk-proj-secretleak1234567890")
    );

    const { GET: getStatus } = await import("../src/app/api/connectors/status/route");
    const statusRes = await getStatus();
    expect(statusRes.status).toBe(500);
    const statusJson = await statusRes.json();
    expect(statusJson).toEqual({ success: false, error: "Failed to fetch status" });
    expect(consoleSpy).toHaveBeenCalled();
    expect(consoleSpy.mock.calls.flat().join(" ")).not.toContain("sk-proj-secretleak");

    mockGetAllProblems.mockImplementationOnce(() => {
      throw new Error("Internal leak: postgres://user:pass@10.0.1.2/db sk-ant-secret1234567890");
    });

    const { GET: getProblems } = await import("../src/app/api/practice/problems/route");
    const problemsRes = await getProblems(
      new Request("http://localhost/api/practice/problems") as never
    );
    expect(problemsRes.status).toBe(500);
    const problemsJson = await problemsRes.json();
    expect(problemsJson).toEqual({
      success: false,
      error: "Failed to fetch practice curriculum",
    });

    consoleSpy.mockRestore();
  });
});
