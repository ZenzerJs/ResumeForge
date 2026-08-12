import { describe, it, expect, beforeEach } from "vitest";
import {
  saveMasterResume,
  restoreMasterSnapshot,
  getLatestSnapshot,
  createResume,
  getMasterResume,
} from "@/lib/db/resumes";
import { authedRequest, createTestUser } from "./helpers/auth";

describe("Task 7.9: Save as Master + Revert Safety & Snapshot Protocol", () => {
  beforeEach(async () => {
    // Reset or ensure a master resume exists for testing
    const existing = await getMasterResume();
    if (!existing) {
      await createResume({
        title: "Initial Master Resume",
        typstSource: "= Initial Master Content\n- Original bullet 1\n",
        isMaster: true,
      });
    }
  });

  it("1. save+snapshot: saving as master creates a snapshot before overwriting", async () => {
    const master = await getMasterResume();
    expect(master).not.toBeNull();
    const originalContent = master!.typstSource;

    const newContent = "= Overwritten Master Content\n- New bullet 1\n";
    const result = await saveMasterResume({
      id: master!.id,
      title: "Updated Master",
      typstSource: newContent,
      confirmOverwrite: true,
    });

    expect(result.success).toBe(true);
    expect(result.snapshotId).toBeDefined();

    // Verify snapshot preserved pre-overwrite content
    const snapshot = await getLatestSnapshot(master!.id);
    expect(snapshot).not.toBeNull();
    expect(snapshot?.typstSource).toBe(originalContent);
  });

  it("2. unconfirmed overwrite is blocked", async () => {
    const master = await getMasterResume();
    expect(master).not.toBeNull();

    await expect(
      saveMasterResume({
        id: master!.id,
        title: "Unconfirmed Overwrite Attempt",
        typstSource: "= Unconfirmed Content\n",
        confirmOverwrite: false,
      })
    ).rejects.toThrow(/Unconfirmed/);
  });

  it("3. undo restores prior master content", async () => {
    const master = await getMasterResume();
    expect(master).not.toBeNull();
    const beforeContent = master!.typstSource;

    // Overwrite master with new content
    const saveResult = await saveMasterResume({
      id: master!.id,
      title: "Temporary Overwrite",
      typstSource: "= Temporary Overwrite Content\n",
      confirmOverwrite: true,
    });

    expect(saveResult.snapshotId).toBeDefined();

    // Perform Undo Overwrite
    const restored = await restoreMasterSnapshot(saveResult.snapshotId!);
    expect(restored.typstSource).toBe(beforeContent);

    // Verify master resume in DB now matches beforeContent
    const currentMaster = await getMasterResume();
    expect(currentMaster?.typstSource).toBe(beforeContent);
  });

  it("4. API route blocks unconfirmed save-master requests with 400", async () => {
    const { POST: saveMasterHandler } = await import("@/app/api/resumes/save-master/route");
    const { user, cookie } = await createTestUser();
    await createResume({
      title: "Initial Master Resume",
      typstSource: "= Initial Master Content\n",
      isMaster: true,
      userId: user.id,
    });

    const req = authedRequest(
      "http://localhost/api/resumes/save-master",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          typstSource: "= Unconfirmed Overwrite\n",
          confirmOverwrite: false,
        }),
      },
      cookie
    );

    const res = await saveMasterHandler(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toContain("Unconfirmed Master Resume overwrite blocked");
  });

  it("5. API route handles confirmed save-master and undo-master flow", async () => {
    const { POST: saveMasterHandler } = await import("@/app/api/resumes/save-master/route");
    const { POST: undoMasterHandler } = await import("@/app/api/resumes/undo-master/route");
    const { user, cookie } = await createTestUser();

    const priorSource = "= Test Master Typst";
    await saveMasterResume({
      title: "Test Master",
      typstSource: priorSource,
      confirmOverwrite: true,
      userId: user.id,
    });

    const saveReq = authedRequest(
      "http://localhost/api/resumes/save-master",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          typstSource: "= Save via API\n- Bullet 1\n",
          confirmOverwrite: true,
        }),
      },
      cookie
    );

    const saveRes = await saveMasterHandler(saveReq);
    expect(saveRes.status).toBe(200);
    const saveJson = await saveRes.json();
    expect(saveJson.success).toBe(true);
    expect(saveJson.snapshotId).toBeDefined();

    const undoReq = authedRequest(
      "http://localhost/api/resumes/undo-master",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          snapshotId: saveJson.snapshotId,
        }),
      },
      cookie
    );

    const undoRes = await undoMasterHandler(undoReq);
    expect(undoRes.status).toBe(200);
    const undoJson = await undoRes.json();
    expect(undoJson.success).toBe(true);
    expect(undoJson.data.typstSource).toBe(priorSource);
  });
});

