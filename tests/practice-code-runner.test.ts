import { describe, it, expect } from "vitest";
import {
  deepEqual,
  runCodeAgainstTestCases,
  sanitizeTypeScriptCode,
} from "@/lib/practice/code-runner";
import { getProblemBySlug } from "@/lib/practice/practice-curriculum";

describe("Practice Code Runner & Test Execution Engine", () => {
  describe("deepEqual", () => {
    it("compares primitive values correctly", () => {
      expect(deepEqual(1, 1)).toBe(true);
      expect(deepEqual(1, 2)).toBe(false);
      expect(deepEqual("abc", "abc")).toBe(true);
      expect(deepEqual(true, true)).toBe(true);
      expect(deepEqual(true, false)).toBe(false);
      expect(deepEqual(null, null)).toBe(true);
      expect(deepEqual(undefined, undefined)).toBe(true);
      expect(deepEqual(null, undefined)).toBe(false);
    });

    it("compares arrays recursively", () => {
      expect(deepEqual([1, 2, 3], [1, 2, 3])).toBe(true);
      expect(deepEqual([1, 2], [1, 2, 3])).toBe(false);
      expect(deepEqual([[1, 2], [3, 4]], [[1, 2], [3, 4]])).toBe(true);
      expect(deepEqual([[1, 2], [3, 4]], [[1, 2], [3, 5]])).toBe(false);
    });

    it("compares objects recursively", () => {
      expect(deepEqual({ a: 1, b: "2" }, { a: 1, b: "2" })).toBe(true);
      expect(deepEqual({ a: 1, b: "2" }, { a: 1, b: "3" })).toBe(false);
      expect(deepEqual({ a: [1, 2] }, { a: [1, 2] })).toBe(true);
    });
  });

  describe("sanitizeTypeScriptCode", () => {
    it("strips TypeScript parameter and return types", () => {
      const tsCode = `function twoSum(nums: number[], target: number): number[] {
        return [0, 1];
      }`;
      const sanitized = sanitizeTypeScriptCode(tsCode);
      expect(sanitized).toContain("function twoSum(nums, target)");
      expect(sanitized).not.toContain(": number[]");
    });
  });

  describe("runCodeAgainstTestCases", () => {
    const twoSum = getProblemBySlug("two-sum")!;

    it("evaluates a correct solution as PASS with all test cases passing", () => {
      const correctCode = `function twoSum(nums: number[], target: number): number[] {
        const map = new Map<number, number>();
        for (let i = 0; i < nums.length; i++) {
          const complement = target - nums[i];
          if (map.has(complement)) {
            return [map.get(complement)!, i];
          }
          map.set(nums[i], i);
        }
        return [];
      }`;

      const result = runCodeAgainstTestCases(correctCode, twoSum.testCases);
      expect(result.status).toBe("PASS");
      expect(result.totalTests).toBe(twoSum.testCases.length);
      expect(result.passedTests).toBe(twoSum.testCases.length);
      expect(result.testResults.every((t) => t.passed)).toBe(true);
      expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
    });

    it("evaluates an incorrect solution as FAIL with diff details", () => {
      const incorrectCode = `function twoSum(nums: number[], target: number): number[] {
        return [0, 0];
      }`;

      const result = runCodeAgainstTestCases(incorrectCode, twoSum.testCases);
      expect(result.status).toBe("FAIL");
      expect(result.passedTests).toBe(0);
      expect(result.testResults[0].passed).toBe(false);
      expect(result.testResults[0].actual).toBe("[0,0]");
    });

    it("handles syntax and runtime exceptions gracefully with ERROR status", () => {
      const errorCode = `function twoSum(nums, target) {
        throw new Error("Deliberate test failure");
      }`;

      const result = runCodeAgainstTestCases(errorCode, twoSum.testCases);
      expect(result.status).toBe("FAIL");
      expect(result.testResults[0].error).toContain("Deliberate test failure");
    });

    it("handles missing function definition with descriptive error", () => {
      const badCode = `const x = 42;`;
      const result = runCodeAgainstTestCases(badCode, twoSum.testCases);
      expect(result.status).toBe("ERROR");
      expect(result.error).toContain("Could not find a valid entry function");
    });
  });
});
