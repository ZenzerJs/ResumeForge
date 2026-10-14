import { describe, it, expect } from "vitest";
import { getEvidenceItems, createEvidenceItem, updateEvidenceItem } from "@/lib/db/evidence";
import { resetMockStore } from "@/lib/db-mock";

// Regression: updateEvidenceItem previously had an unreachable
// `return await getEvidenceItemById(id)` after
// `return await prisma.$transaction(...)`, so PUT /api/evidence/[id]
// resolved with `data: undefined`. These tests pin the fixed behavior.

describe("updateEvidenceItem returns updated record", () => {
  it("returns the persisted item with recreated bullets after update", async () => {
    resetMockStore();
    const created = await createEvidenceItem({
      type: "experience",
      title: "Backend Engineer",
      verifiedSummary: "Built APIs",
      status: "verified",
      bullets: [{ text: "Built REST APIs", verified: true }],
    });

    const updated = await updateEvidenceItem(created.id, {
      title: "Senior Backend Engineer",
      bullets: [{ text: "Designed gRPC services", verified: true }],
    });

    expect(updated).toBeDefined();
    expect(updated?.id).toBe(created.id);
    expect(updated?.title).toBe("Senior Backend Engineer");
    expect(updated?.bullets).toHaveLength(1);
    expect(updated?.bullets[0].text).toBe("Designed gRPC services");
  });

  it("persists status change and remains readable via getEvidenceItems", async () => {
    resetMockStore();
    const created = await createEvidenceItem({
      type: "skill",
      title: "Stack",
      verifiedSummary: "TS, Node",
      status: "draft",
      bullets: [],
    });

    await updateEvidenceItem(created.id, { status: "verified" });

    const list = await getEvidenceItems("verified");
    expect(list.some((i) => i.id === created.id)).toBe(true);
  });
});
