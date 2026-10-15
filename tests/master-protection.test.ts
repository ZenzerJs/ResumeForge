import { describe, it, expect, afterEach } from "vitest";
import { PUT } from "@/app/api/resumes/[id]/route";
import { POST as generatePatches } from "@/app/api/ai/generate-patches/route";
import { createResume, getMasterResume, saveMasterResume } from "@/lib/db/resumes";
import { prisma } from "@/lib/prisma";
import { authedRequest, createTestUser } from "./helpers/auth";

describe("master resume protection", () => {
  const createdIds: string[] = [];

  afterEach(async () => {
    if (createdIds.length === 0) return;
    const ids = createdIds.splice(0, createdIds.length);
    await prisma.resume.deleteMany({ where: { id: { in: ids } } });
  });

  it("rejects unauthenticated PUT with 401", async () => {
    const created = await createResume({
      title: "Protected Master",
      typstSource: "= Master\n",
      isMaster: true,
    });
    createdIds.push(created.id);

    const req = new Request(`http://localhost/api/resumes/${created.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ typstSource: "= Hijacked\n" }),
    });
    const res = await PUT(req, { params: Promise.resolve({ id: created.id }) });
    expect(res.status).toBe(401);
  });

  it("rejects PUT updates to a protected master resume", async () => {
    const { user, cookie } = await createTestUser();
    const created = await createResume({
      title: "Protected Master",
      typstSource: "= Master\n",
      isMaster: true,
      userId: user.id,
    });
    createdIds.push(created.id);

    const req = authedRequest(
      `http://localhost/api/resumes/${created.id}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ typstSource: "= Hijacked\n" }),
      },
      cookie
    );
    const res = await PUT(req, { params: Promise.resolve({ id: created.id }) });
    expect(res.status).toBe(403);

    const current = await getMasterResume(user.id);
    expect(current?.typstSource).toBe("= Master\n");
  });

  it("does not auto-create a master from generate-patches", async () => {
    const { user, cookie } = await createTestUser();
    const req = authedRequest(
      "http://localhost/api/ai/generate-patches",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerConfig: { provider: "openai", apiKey: "sk-test" },
          jobRequirements: { requiredSkills: ["Go"], preferredSkills: [], domainTerms: [] },
        }),
      },
      cookie
    );
    const res = await generatePatches(req);
    expect(res.status).toBe(404);
    expect(await getMasterResume(user.id)).toBeNull();
  });

  it("save-master still overwrites with confirmation", async () => {
    const { user } = await createTestUser();
    const created = await createResume({
      title: "Protected Master",
      typstSource: "= Master\n",
      isMaster: true,
      userId: user.id,
    });
    createdIds.push(created.id);
    const result = await saveMasterResume({
      id: created.id,
      title: "Protected Master",
      typstSource: "= Updated\n",
      confirmOverwrite: true,
      userId: user.id,
    });
    expect(result.success).toBe(true);
    expect(result.data.typstSource).toBe("= Updated\n");
  });
});
