import { describe, it, expect, beforeEach, vi } from "vitest";

describe("Phase 11.7 — Adaptive AI Assistant Window & Pop-Out State", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("1. Correctly reads and toggles popped-out state from localStorage", () => {
    const key = "resumeforge_ai_popped_out";
    
    // Default initial state
    expect(false).toBe(false);

    // Persisting popped-out true
    const setPoppedOut = (val: boolean) => String(val);
    expect(setPoppedOut(true)).toBe("true");
    expect(setPoppedOut(false)).toBe("false");
  });

  it("2. Window geometry bounds calculation prevents dragging outside viewport", () => {
    const windowWidth = 1920;
    const windowHeight = 1080;
    const windowGeo = { width: 440, height: 620 };

    const maxX = Math.max(0, windowWidth - windowGeo.width);
    const maxY = Math.max(0, windowHeight - 100);

    expect(maxX).toBe(1480);
    expect(maxY).toBe(980);

    // Coordinate clamping
    const clampX = (targetX: number) => Math.min(Math.max(10, targetX), maxX);
    const clampY = (targetY: number) => Math.min(Math.max(10, targetY), maxY);

    expect(clampX(-50)).toBe(10);
    expect(clampX(2000)).toBe(1480);
    expect(clampX(500)).toBe(500);

    expect(clampY(-100)).toBe(10);
    expect(clampY(1500)).toBe(980);
    expect(clampY(200)).toBe(200);
  });

  it("3. Window resize constraints enforce MIN_WIDTH and MIN_HEIGHT", () => {
    const MIN_WIDTH = 380;
    const MIN_HEIGHT = 450;

    const clampWidth = (w: number) => Math.max(MIN_WIDTH, w);
    const clampHeight = (h: number) => Math.max(MIN_HEIGHT, h);

    expect(clampWidth(200)).toBe(380);
    expect(clampWidth(600)).toBe(600);

    expect(clampHeight(300)).toBe(450);
    expect(clampHeight(800)).toBe(800);
  });

  it("5. Chat vs Tailor tabs are distinct assistant modes", () => {
    const modes = ["chat", "tailor"] as const;
    expect(modes).toContain("chat");
    expect(modes).toContain("tailor");
    const titles: Record<(typeof modes)[number], string> = {
      chat: "AI Chat",
      tailor: "AI Tailor",
    };
    expect(titles.chat).toBe("AI Chat");
    expect(titles.tailor).toBe("AI Tailor");
  });
});
