import { describe, expect, it } from "vitest";
import { UsernameSchema, isEmailIdentifier, normalizeUsername } from "@/lib/security/usernames";

describe("usernames", () => {
  it("normalizes and accepts valid usernames", () => {
    expect(UsernameSchema.parse("Jayde_01")).toBe("jayde_01");
    expect(normalizeUsername("  Forge-User  ")).toBe("forge-user");
  });

  it("rejects usernames that start with a number or contain spaces", () => {
    expect(UsernameSchema.safeParse("1forge").success).toBe(false);
    expect(UsernameSchema.safeParse("jay de").success).toBe(false);
    expect(UsernameSchema.safeParse("ab").success).toBe(false);
  });

  it("treats identifiers with @ as emails", () => {
    expect(isEmailIdentifier("jayde@resumeforge.test")).toBe(true);
    expect(isEmailIdentifier("jayde")).toBe(false);
  });
});
