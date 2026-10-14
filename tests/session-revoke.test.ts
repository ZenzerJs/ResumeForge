import { afterAll, describe, expect, it } from "vitest";
import { POST as logout } from "@/app/api/auth/logout/route";
import { getRequestUserId } from "@/lib/security/auth-request";
import { prisma } from "@/lib/prisma";
import { authedRequest, createTestUser } from "./helpers/auth";

describe("session revocation", () => {
  const userIds: string[] = [];

  afterAll(async () => {
    if (userIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
  });

  it("logout increments sessionVersion so the old cookie no longer authenticates", async () => {
    const { user, cookie } = await createTestUser();
    userIds.push(user.id);

    const before = await getRequestUserId(authedRequest("http://localhost/api/auth/me", { method: "GET" }, cookie));
    expect(before).toBe(user.id);

    const res = await logout(authedRequest("http://localhost/api/auth/logout", { method: "POST" }, cookie));
    expect(res.status).toBe(200);

    const row = await prisma.user.findUnique({ where: { id: user.id } });
    expect(row?.sessionVersion).toBe(1);

    const after = await getRequestUserId(authedRequest("http://localhost/api/auth/me", { method: "GET" }, cookie));
    expect(after).toBeNull();
  });

  it("handles logout call without request argument safely", async () => {
    const res = await logout();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });
});
