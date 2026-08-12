import { describe, it, expect } from "vitest";
import {
  parsePostedAgeDays,
  matchesPostedWithin,
  filterByPostedWithin,
  resolvePostedAgeDays,
} from "@/lib/jobs/posted-within";

describe("posted-within helpers", () => {
  const now = new Date("2026-08-12T12:00:00.000Z");

  it("parses relative day/week strings", () => {
    expect(parsePostedAgeDays("1 day ago", now)).toBe(1);
    expect(parsePostedAgeDays("3 days ago", now)).toBe(3);
    expect(parsePostedAgeDays("1 week ago", now)).toBe(7);
    expect(parsePostedAgeDays("2 weeks ago", now)).toBe(14);
    expect(parsePostedAgeDays("today", now)).toBe(0);
    expect(parsePostedAgeDays("yesterday", now)).toBe(1);
  });

  it("matches postedWithin windows for fresh relative strings", () => {
    expect(matchesPostedWithin("1 day ago", "1d", now)).toBe(true);
    expect(matchesPostedWithin("3 days ago", "1d", now)).toBe(false);
    expect(matchesPostedWithin("3 days ago", "3d", now)).toBe(true);
    expect(matchesPostedWithin("1 week ago", "7d", now)).toBe(true);
    expect(matchesPostedWithin("2 weeks ago", "7d", now)).toBe(false);
    expect(matchesPostedWithin("1 month ago", "30d", now)).toBe(true);
    expect(matchesPostedWithin(null, "all", now)).toBe(true);
  });

  it("ages relative strings using capture/createdAt so stale scrapes filter correctly", () => {
    // Scraped 5 days ago saying "1 day ago" → effective ~6 days old
    const captured = new Date("2026-08-07T12:00:00.000Z");
    expect(resolvePostedAgeDays("1 day ago", now, captured)).toBeCloseTo(6, 5);
    expect(matchesPostedWithin("1 day ago", "1d", now, captured)).toBe(false);
    expect(matchesPostedWithin("1 day ago", "3d", now, captured)).toBe(false);
    expect(matchesPostedWithin("1 day ago", "7d", now, captured)).toBe(true);
    expect(matchesPostedWithin("1 day ago", "30d", now, captured)).toBe(true);
  });

  it("falls back to createdAt when datePosted missing or garbage", () => {
    const recent = new Date("2026-08-11T12:00:00.000Z").toISOString();
    expect(matchesPostedWithin(null, "3d", now, recent)).toBe(true);
    const old = new Date("2026-07-01T12:00:00.000Z").toISOString();
    expect(matchesPostedWithin(null, "7d", now, old)).toBe(false);
    expect(matchesPostedWithin("Apply", "7d", now, recent)).toBe(true);
  });

  it("filters collections with capture-time aging", () => {
    const captured = new Date("2026-08-07T12:00:00.000Z");
    const rows = [
      { id: "a", datePosted: "1 day ago", createdAt: captured },
      { id: "b", datePosted: "2 weeks ago", createdAt: captured },
      { id: "c", datePosted: "1 day ago", createdAt: now },
    ];
    const kept = filterByPostedWithin(
      rows,
      "3d",
      (r) => r.datePosted,
      (r) => r.createdAt,
      now,
    );
    expect(kept.map((r) => r.id)).toEqual(["c"]);
  });
});
