import { describe, it, expect, vi } from "vitest";
import { redactKeys, sanitizeError } from "../src/lib/ai/redact";

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
