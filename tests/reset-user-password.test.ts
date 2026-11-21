import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { resetUserPassword } from "../scripts/reset-user-password";
import { prisma } from "@/lib/prisma";
import { resetMockStore } from "@/lib/db-mock";
import { hashPassword, verifyPassword } from "@/lib/security/passwords";

describe("Operator CLI password reset (scripts/reset-user-password.ts)", () => {
  beforeEach(() => {
    resetMockStore();
  });

  afterAll(() => {
    resetMockStore();
  });

  it("updates scrypt passwordHash and increments sessionVersion to revoke existing sessions", async () => {
    const oldHash = await hashPassword("OldPassword123!");
    const created = await prisma.user.create({
      data: {
        email: "reset-me@example.com",
        username: "reset_user",
        passwordHash: oldHash,
      },
    });

    const res = await resetUserPassword({
      email: "  RESET-ME@EXAMPLE.COM ",
      newPassword: "NewStrongPassword456!",
    });

    expect(res.userId).toBe(created.id);
    expect(res.email).toBe("reset-me@example.com");
    expect(res.previousSessionVersion).toBe(0);
    expect(res.newSessionVersion).toBe(1);

    const refreshed = await prisma.user.findUnique({ where: { id: created.id } });
    expect(refreshed).not.toBeNull();
    expect(refreshed?.sessionVersion).toBe(1);
    expect(await verifyPassword("NewStrongPassword456!", refreshed!.passwordHash)).toBe(true);
    expect(await verifyPassword("OldPassword123!", refreshed!.passwordHash)).toBe(false);
  });

  it("rejects short passwords and unknown emails without mutating records", async () => {
    await expect(
      resetUserPassword({ email: "missing@example.com", newPassword: "short" })
    ).rejects.toThrow(/between 8 and 200/i);

    await expect(
      resetUserPassword({ email: "missing@example.com", newPassword: "ValidPassword123!" })
    ).rejects.toThrow(/No user found/i);
  });
});
