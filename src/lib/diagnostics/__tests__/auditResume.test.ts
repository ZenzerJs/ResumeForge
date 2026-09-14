import { describe, it, expect } from "vitest";
import { auditResume } from "../auditResume";

describe("auditResume", () => {
  it("Missing required skill -> emits urgent item", () => {
    const report = auditResume({
      resumeText: "Experience and Education",
      requiredSkills: ["React"],
    });
    const item = report.items.find(i => i.category === "missing_hard_requirement" && i.message.includes("React"));
    expect(item).toBeDefined();
    expect(item?.severity).toBe("urgent");
  });

  it("All required skills present -> no urgent missing_hard_requirement items", () => {
    const report = auditResume({
      resumeText: "Experience with React and Node.js. Education.",
      requiredSkills: ["React", "Node.js"],
    });
    const missingItems = report.items.filter(i => i.category === "missing_hard_requirement" && i.id.startsWith("missing-"));
    expect(missingItems.length).toBe(0);
  });

  it("Bullet without evidenceId -> emits unsubstantiated_claim", () => {
    const report = auditResume({
      resumeText: "Experience Education",
      requiredSkills: [],
      bullets: [{ id: "b1", text: "Did 50% more work" }],
    });
    const item = report.items.find(i => i.category === "unsubstantiated_claim");
    expect(item).toBeDefined();
    expect(item?.severity).toBe("urgent");
  });

  it("Bullet with evidenceId -> no unsubstantiated_claim", () => {
    const report = auditResume({
      resumeText: "Experience Education",
      requiredSkills: [],
      bullets: [{ id: "b1", text: "Did 50% more work", evidenceId: "ev1" }],
    });
    const item = report.items.find(i => i.category === "unsubstantiated_claim");
    expect(item).toBeUndefined();
  });

  it("Passive verb 'Responsible for' in bullet -> emits passive_tone", () => {
    const report = auditResume({
      resumeText: "Experience Education",
      requiredSkills: [],
      bullets: [{ id: "b1", text: "Responsible for 50 users", evidenceId: "ev1" }],
    });
    const item = report.items.find(i => i.category === "passive_tone");
    expect(item).toBeDefined();
  });

  it("Bullet with no number/metric -> emits weak_quantification", () => {
    const report = auditResume({
      resumeText: "Experience Education",
      requiredSkills: [],
      bullets: [{ id: "b1", text: "Fixed bugs", evidenceId: "ev1" }],
    });
    const item = report.items.find(i => i.category === "weak_quantification");
    expect(item).toBeDefined();
  });

  it("Mixed date formats (Jan 2024 + 01/2024) -> emits formatting_overflow", () => {
    const report = auditResume({
      resumeText: "Experience Jan 2024 to 01/2024 Education",
      requiredSkills: [],
    });
    const item = report.items.find(i => i.category === "formatting_overflow" && i.id === "mixed-dates");
    expect(item).toBeDefined();
  });

  it("Clean resume -> overallScore === 100", () => {
    const report = auditResume({
      resumeText: "Experience Education React",
      requiredSkills: ["React"],
      bullets: [{ id: "b1", text: "Led project increasing revenue by 20%.", evidenceId: "ev1" }],
    });
    expect(report.overallScore).toBe(100);
    expect(report.items.length).toBe(0);
  });
});
