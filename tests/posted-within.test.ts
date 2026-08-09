import { describe, it, expect } from "vitest";
import {
  parsePostedAgeDays,
  matchesPostedWithin,
  filterByPostedWithin,
} from "@/lib/jobs/posted-within";

describe("posted-within helpers", () => {
  const now = new Date("2026-08-09T12:00:00.000Z");

  it("parses relative day/week strings", () => {
    expect(parsePostedAgeDays("1 day ago", now)).toBe(1);
    expect(parsePostedAgeDays("3 days ago", now)).toBe(3);
    expect(parsePostedAgeDays("1 week ago", now)).toBe(7);
    expect(parsePostedAgeDays("2 weeks ago", now)).toBe(14);
    expect(parsePostedAgeDays("today", now)).toBe(0);
    expect(parsePostedAgeDays("yesterday", now)).toBe(1);
  });

  it("matches postedWithin windows", () => {
    expect(matchesPostedWithin("1 day ago", "1d", now)).toBe(true);
    expect(matchesPostedWithin("3 days ago", "1d", now)).toBe(false);
    expect(matchesPostedWithin("3 days ago", "3d", now)).toBe(true);
    expect(matchesPostedWithin("1 week ago", "7d", now)).toBe(true);
    expect(matchesPostedWithin("2 weeks ago", "7d", now)).toBe(false);
    expect(matchesPostedWithin("1 month ago", "30d", now)).toBe(true);
    expect(matchesPostedWithin(null, "all", now)).toBe(true);
  });

  it("falls back to createdAt when datePosted missing", () => {
    const recent = new Date("2026-08-08T12:00:00.000Z").toISOString();
    expect(matchesPostedWithin(null, "3d", now, recent)).toBe(true);
    const old = new Date("2026-07-01T12:00:00.000Z").toISOString();
    expect(matchesPostedWithin(null, "7d", now, old)).toBe(false);
  });

  it("filters collections", () => {
    const rows = [
      { id: "a", datePosted: "1 day ago" },
      { id: "b", datePosted: "2 weeks ago" },
    ];
    const kept = filterByPostedWithin(rows, "3d", (r) => r.datePosted);
    expect(kept.map((r) => r.id)).toEqual(["a"]);
  });
});
