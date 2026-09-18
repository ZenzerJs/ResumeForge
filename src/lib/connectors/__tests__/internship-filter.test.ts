import { describe, it, expect } from "vitest";
import {
  isInternshipOrCoopTitle,
  filterInternshipListings,
} from "../internship-filter";

describe("Internship & Co-op Title Matcher", () => {
  describe("isInternshipOrCoopTitle", () => {
    it("matches standard 'intern' and 'internship' titles", () => {
      expect(isInternshipOrCoopTitle("Software Engineer Intern")).toBe(true);
      expect(isInternshipOrCoopTitle("Software Engineering Internship")).toBe(true);
      expect(isInternshipOrCoopTitle("Frontend Developer Intern (Summer 2026)")).toBe(true);
      expect(isInternshipOrCoopTitle("INTERN - Cloud Operations")).toBe(true);
      expect(isInternshipOrCoopTitle("Data Science Internship - Canada")).toBe(true);
      expect(isInternshipOrCoopTitle("2026 Summer Interns")).toBe(true);
      expect(isInternshipOrCoopTitle("Graduate Internships")).toBe(true);
    });

    it("matches 'co-op', 'coop', and 'co_op' title variants", () => {
      expect(isInternshipOrCoopTitle("Co-op Software Engineer")).toBe(true);
      expect(isInternshipOrCoopTitle("Software Developer Co-op (Fall 2026)")).toBe(true);
      expect(isInternshipOrCoopTitle("Coop Student - Platform Team")).toBe(true);
      expect(isInternshipOrCoopTitle("Engineering Coop")).toBe(true);
      expect(isInternshipOrCoopTitle("Backend Developer Co_op")).toBe(true);
      expect(isInternshipOrCoopTitle("Co_Op Engineer")).toBe(true);
      expect(isInternshipOrCoopTitle("Fall 2026 Co-ops")).toBe(true);
      expect(isInternshipOrCoopTitle("Engineering Coops")).toBe(true);
      expect(isInternshipOrCoopTitle("Student Co_ops")).toBe(true);
      expect(isInternshipOrCoopTitle("SWE Intern/Co-op")).toBe(true);
      expect(isInternshipOrCoopTitle("Software Engineer (Intern/Co-op)")).toBe(true);
    });

    it("rejects non-internship words with similar prefixes (word boundary enforcement)", () => {
      expect(isInternshipOrCoopTitle("Internal Tools Engineer")).toBe(false);
      expect(isInternshipOrCoopTitle("Internet Systems Architect")).toBe(false);
      expect(isInternshipOrCoopTitle("International Expansion Lead")).toBe(false);
      expect(isInternshipOrCoopTitle("Cooperation Specialist")).toBe(false);
      expect(isInternshipOrCoopTitle("Co-operative Society Manager")).toBe(false);
      expect(isInternshipOrCoopTitle("Cooperative Developer")).toBe(false);
      expect(isInternshipOrCoopTitle("Senior Software Engineer")).toBe(false);
      expect(isInternshipOrCoopTitle("Junior Full Stack Developer")).toBe(false);
      expect(isInternshipOrCoopTitle("Staff Reliability Engineer")).toBe(false);
    });

    it("handles empty, invalid, and edge case inputs", () => {
      expect(isInternshipOrCoopTitle("")).toBe(false);
      expect(isInternshipOrCoopTitle("   ")).toBe(false);
      expect(isInternshipOrCoopTitle(null as unknown as string)).toBe(false);
      expect(isInternshipOrCoopTitle(undefined as unknown as string)).toBe(false);
    });
  });

  describe("filterInternshipListings", () => {
    const mockJobs = [
      { id: "1", title: "Software Engineer Intern", company: "Company A" },
      { id: "2", title: "Senior Backend Developer", company: "Company B" },
      { id: "3", title: "Co-op Frontend Developer", company: "Company C" },
      { id: "4", title: "Internal Tools Lead", company: "Company D" },
      { id: "5", title: "Data Analyst Co_op", company: "Company E" },
      { id: "6", title: null, company: "Company F" },
    ];

    it("filters out non-internship and non-co-op roles by default", () => {
      const filtered = filterInternshipListings(mockJobs);
      expect(filtered.map((j) => j.id)).toEqual(["1", "3", "5"]);
    });

    it("returns all roles when includeAllRoles is true", () => {
      const all = filterInternshipListings(mockJobs, { includeAllRoles: true });
      expect(all.length).toBe(mockJobs.length);
      expect(all).toEqual(mockJobs);
    });

    it("handles empty arrays gracefully", () => {
      expect(filterInternshipListings([])).toEqual([]);
      expect(filterInternshipListings([], { includeAllRoles: true })).toEqual([]);
    });
  });
});
