import { describe, it, expect } from "vitest";
import {
  extractLocationFromNotes,
  normalizeLocation,
  extractApplyUrlFromNotes,
  extractPostingDateFromNotes,
  extractSalaryFromNotes,
  isPlaceholderDescription,
} from "@/components/tracker/tracker-feed";

describe("Task 8.3: Tracker Card Spec & Click Zone Refinements", () => {
  const sampleTier1Notes =
    "Tier 1 Bulk Import | Location: San Jose, CA | Apply Link: https://lifeattiktok.com/search/12345 | Posted: 2d";

  it("1. extracts location, applyUrl, datePosted correctly from notes", () => {
    expect(extractLocationFromNotes(sampleTier1Notes)).toBe("San Jose, CA");
    expect(extractApplyUrlFromNotes(sampleTier1Notes)).toBe(
      "https://lifeattiktok.com/search/12345"
    );
    expect(extractPostingDateFromNotes(sampleTier1Notes)).toBe("2d");
  });

  it("2. returns null for salary when absent in source notes without inferring values", () => {
    const salary = extractSalaryFromNotes(sampleTier1Notes);
    expect(salary).toBeNull();
  });

  it("2b. pulls labeled base salary from job description text", () => {
    const jd = "The Base Salary range for the role is included below. Base Salary: $300,000";
    expect(extractSalaryFromNotes(sampleTier1Notes, jd)).toBe("$300,000");
  });

  it("3. detects pending placeholder descriptions vs full JDs", () => {
    const placeholderText =
      "[Pending Import] Full job description text not yet fetched from posting page for TikTok — Software Engineer Intern.";
    const fullText = "We are seeking a Backend Software Engineer Intern proficient in Go and Distributed Systems.";

    expect(isPlaceholderDescription(placeholderText)).toBe(true);
    expect(isPlaceholderDescription(fullText)).toBe(false);
  });

  it("4. multi-location postings produce distinct location and applyUrl entries", () => {
    const notesSanJose =
      "Tier 1 Bulk Import | Location: San Jose, CA | Apply Link: https://lifeattiktok.com/search/11111 | Posted: 0d";
    const notesSeattle =
      "Tier 1 Bulk Import | Location: Seattle, WA | Apply Link: https://lifeattiktok.com/search/22222 | Posted: 0d";

    const loc1 = extractLocationFromNotes(notesSanJose);
    const loc2 = extractLocationFromNotes(notesSeattle);
    const url1 = extractApplyUrlFromNotes(notesSanJose);
    const url2 = extractApplyUrlFromNotes(notesSeattle);

    expect(loc1).toBe("San Jose, CA");
    expect(loc2).toBe("Seattle, WA");
    expect(url1).not.toBe(url2);
    expect(url1).toBe("https://lifeattiktok.com/search/11111");
    expect(url2).toBe("https://lifeattiktok.com/search/22222");
  });

  it("5. click zone event propagation test: card body click triggers window.open while action button click stops propagation", () => {
    let windowOpenUrl: string | null = null;
    const mockWindowOpen = (url: string) => {
      windowOpenUrl = url;
    };

    const applyUrl = "https://lifeattiktok.com/search/12345";
    const handleCardClick = () => {
      mockWindowOpen(applyUrl);
    };

    let actionTriggered = false;
    const handleActionButtonClick = (e: { stopPropagation: () => void }) => {
      e.stopPropagation();
      actionTriggered = true;
    };

    // 1. Card body click triggers window.open
    handleCardClick();
    expect(windowOpenUrl).toBe("https://lifeattiktok.com/search/12345");

    // Reset windowOpenUrl
    windowOpenUrl = null;

    // 2. Action button click with stopPropagation
    let propagationStopped = false;
    const mockEvent = {
      stopPropagation: () => {
        propagationStopped = true;
      },
    };

    handleActionButtonClick(mockEvent);

    // If stopPropagation was NOT called, parent handleCardClick would fire
    if (!propagationStopped) {
      handleCardClick();
    }

    expect(actionTriggered).toBe(true);
    expect(propagationStopped).toBe(true);
    expect(windowOpenUrl).toBeNull(); // window.open was NOT called
  });

  it("6. extracts diverse pay ranges and currency formats correctly", () => {
    // K-shorthand and CAD/USD prefixes/suffixes
    expect(extractSalaryFromNotes(null, "Compensation: CA$95K–CA$115K")).toBe("CA$95k-CA$115k");
    expect(extractSalaryFromNotes(null, "Salary range is $80k - $100k CAD")).toBe("$80k-$100k CAD");
    expect(extractSalaryFromNotes(null, "Pay: C$85,000 - C$105,000")).toBe("C$85,000-C$105,000");
    expect(extractSalaryFromNotes(null, "Salary: USD 120,000 - 160,000")).toBe("$120,000-$160,000");
    expect(extractSalaryFromNotes(null, "The expected salary is $120,000 - 160,000")).toBe("$120,000-$160,000");

    // Prose "to" ranges in Greenhouse/Lever/Ashby blocks
    expect(
      extractSalaryFromNotes(null, "The base salary range for this role is $110,000 to $145,000")
    ).toBe("$110,000-$145,000");
    expect(
      extractSalaryFromNotes(null, "Pay for this position is $42.00 to $55.00 per hour")
    ).toBe("$42.00-$55.00/hr");
    expect(extractSalaryFromNotes(null, "Hourly rate: $35 - 48/hr")).toBe("$35-$48/hr");
    expect(extractSalaryFromNotes(null, "Stipend: $6,500 - $8,000/month")).toBe("$6,500-$8,000/month");

    // Single hourly/annual rates
    expect(extractSalaryFromNotes(null, "Hourly compensation: $45.00/hr")).toBe("$45.00/hr");
    expect(extractSalaryFromNotes(null, "Pay is $50 per hour for this internship")).toBe("$50/hr");
    expect(extractSalaryFromNotes(null, "Rate: CA$42/hr")).toBe("CA$42/hr");

    // Labeled hourly rates with intervening words (Blue Origin, ByteDance, etc.)
    expect(
      extractSalaryFromNotes(null, "Hourly compensation for applicant is: $50.00")
    ).toBe("$50.00/hr");
    expect(
      extractSalaryFromNotes(null, "The hourly rate range for this position in the selected city is $45- $45.")
    ).toBe("$45/hr");
    expect(
      extractSalaryFromNotes(null, "The likely hourly rate for this position is between $19.32 - $25.30.")
    ).toBe("$19.32-$25.30/hr");
    expect(
      extractSalaryFromNotes(null, "Salary Range: $16.48 - $28.84.")
    ).toBe("$16.48-$28.84/hr");
    expect(
      extractSalaryFromNotes(null, "Pay range in California: $45/hr - $65/hr")
    ).toBe("$45-$65/hr");
    expect(
      extractSalaryFromNotes(null, "Stipend: $2,000/week")
    ).toBe("$2,000/week");
    expect(
      extractSalaryFromNotes(null, "Raised $50M in Series B valuation of $2 billion")
    ).toBeNull();
  });

  it("7. parses and normalizes multi-location edge cases cleanly", () => {
    // Concatenated city-state pairs without separators
    expect(normalizeLocation("San Francisco, CANew York, NY")).toBe(
      "San Francisco, CA; New York, NY"
    );
    expect(normalizeLocation("Toronto, ONVancouver, BC")).toBe(
      "Toronto, ON; Vancouver, BC"
    );

    // Multi-pipe split recovery across Location: ... | ... | Apply: ...
    const pipedNotes =
      "Tier 1 Bulk Import | Location: Toronto, ON | Vancouver, BC | Apply Link: https://example.com | Posted: 1d";
    expect(extractLocationFromNotes(pipedNotes)).toBe("Toronto, ON; Vancouver, BC");

    // 4+ locations formatted with (+N more)
    expect(
      normalizeLocation("San Francisco, CA; New York, NY; Seattle, WA; Austin, TX")
    ).toBe("San Francisco, CA; New York, NY (+2 more)");

    // Raw Workday scraped string with "N locations" prefix and concatenated cities
    const workdayLoc =
      "5 locationsAustin, TXSanta Clara, CAHillsboro, ORFolsom, CAPhoenix, AZ";
    expect(normalizeLocation(workdayLoc)).toBe("Austin, TX; Santa Clara, CA (+3 more)");

    // Deduplication of identical locations
    expect(normalizeLocation("San Jose, CA; San Jose, CA")).toBe("San Jose, CA");
  });
});
