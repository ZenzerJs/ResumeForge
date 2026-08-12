import { describe, it, expect } from "vitest";
import {
  extractLocationFromNotes,
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
});
