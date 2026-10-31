import { describe, expect, it } from "vitest";
import {
  InvalidPatchCitationError,
  normalizePatchCitations,
} from "@/lib/ai/patch-citations";

const ownerId = "owner-1";
const evidence = [
  {
    id: "evidence-1",
    userId: ownerId,
    status: "verified",
    bullets: [
      { id: "bullet-1", evidenceId: "evidence-1", verified: true },
      { id: "bullet-unverified", evidenceId: "evidence-1", verified: false },
    ],
  },
  {
    id: "evidence-2",
    userId: ownerId,
    status: "verified",
    bullets: [{ id: "bullet-2", evidenceId: "evidence-2", verified: true }],
  },
  {
    id: "archived",
    userId: ownerId,
    status: "archived",
    bullets: [{ id: "archived-bullet", evidenceId: "archived", verified: true }],
  },
  {
    id: "foreign",
    userId: "owner-2",
    status: "verified",
    bullets: [{ id: "foreign-bullet", evidenceId: "foreign", verified: true }],
  },
];

describe("normalized patch citations", () => {
  it("resolves exact evidence, bullet, and matching paired references", () => {
    expect(normalizePatchCitations(
      ["evidence-1", "bullet-1", { evidenceId: "evidence-1", bulletId: "bullet-1" }],
      evidence,
      ownerId
    )).toEqual([
      { evidenceId: "evidence-1" },
      { bulletId: "bullet-1" },
      { evidenceId: "evidence-1", bulletId: "bullet-1" },
    ]);
  });

  it("rejects empty references", () => {
    expect(() => normalizePatchCitations([], evidence, ownerId)).toThrow(InvalidPatchCitationError);
    expect(() => normalizePatchCitations([{}], evidence, ownerId)).toThrow(InvalidPatchCitationError);
  });

  it("rejects mismatched bullet and evidence pairs", () => {
    expect(() => normalizePatchCitations(
      [{ evidenceId: "evidence-1", bulletId: "bullet-2" }],
      evidence,
      ownerId
    )).toThrow("does not belong");
  });

  it("rejects foreign, archived, unavailable, and unverified citations", () => {
    for (const id of [
      "foreign", "foreign-bullet", "archived", "archived-bullet",
      "bullet-unverified", "missing",
    ]) {
      expect(() => normalizePatchCitations([id], evidence, ownerId)).toThrow(
        InvalidPatchCitationError
      );
    }
  });
});
