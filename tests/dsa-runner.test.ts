import { describe, it, expect } from 'vitest';
import {
  DSA_PROBLEMS,
  recommendProblemsForJob,
  DsaProblem,
} from '../src/lib/dsa-problems';
import {
  executeDsaCode,
  deepEqual,
  sanitizeTypeScriptCode,
} from '../src/lib/dsa-runner';

describe('WS9 DSA Engine & Problem Catalog', () => {
  describe('Step 1: Problem Catalog Schema Integrity', () => {
    it('seeds exactly 8 high-signal problems covering distinct patterns', () => {
      expect(DSA_PROBLEMS).toHaveLength(8);

      const patterns = new Set(DSA_PROBLEMS.map((p) => p.pattern));
      expect(patterns.size).toBe(8);
      expect(patterns).toContain('Two Pointers');
      expect(patterns).toContain('Sliding Window');
      expect(patterns).toContain('Hash Map & Sets');
      expect(patterns).toContain('Trees & Graphs');
      expect(patterns).toContain('Heap / Priority Queue');
      expect(patterns).toContain('Dynamic Programming');
      expect(patterns).toContain('Intervals & Greedy');
      expect(patterns).toContain('Stack & Monotonic Stack');
    });

    it('ensures each problem conforms strictly to DsaProblem interface', () => {
      for (const p of DSA_PROBLEMS) {
        expect(p.id).toBeDefined();
        expect(p.slug).toMatch(/^[a-z0-9-]+$/);
        expect(p.title.length).toBeGreaterThan(0);
        expect(['Easy', 'Medium', 'Hard']).toContain(p.difficulty);
        expect(p.categoryTags.length).toBeGreaterThan(0);
        expect(p.jdKeywords.length).toBeGreaterThan(0);
        expect(p.description.length).toBeGreaterThan(20);
        expect(p.constraints.length).toBeGreaterThan(0);
        expect(p.examples.length).toBeGreaterThan(0);

        // Starter code
        expect(p.starterCode.javascript).toContain(p.entryFunctionName);
        expect(p.starterCode.typescript).toContain(p.entryFunctionName);
        expect(p.starterCode.python).toContain(p.entryFunctionName);

        // Hints tuple of 3
        expect(p.hints).toHaveLength(3);
        expect(p.hints.every((h) => typeof h === 'string' && h.length > 10)).toBe(true);

        // Test cases
        expect(p.testCases.length).toBeGreaterThanOrEqual(3);
        for (const tc of p.testCases) {
          expect(tc.id).toBeDefined();
          expect(tc.input).toBeDefined();
          expect(tc.expected).toBeDefined();
          for (const param of p.parameterNames) {
            expect(tc.input).toHaveProperty(param);
          }
        }

        // Complexity
        expect(p.optimalTimeComplexity).toMatch(/^O\(/);
        expect(p.optimalSpaceComplexity).toMatch(/^O\(/);
      }
    });
  });

  describe('Step 1.1: JD-to-DSA Recommender', () => {
    it('recommends backend/systems problems for backend infrastructure JDs', () => {
      const backendJd = `
        Senior Backend Systems Engineer
        Requirements:
        - Design distributed systems, microservices, and graph traversal algorithms.
        - Experience with database query optimization, key-value caching, and job scheduling.
        - Concurrency control and resource allocation mechanisms.
      `;

      const recommendations = recommendProblemsForJob(backendJd, 5);
      expect(recommendations).toHaveLength(5);

      const slugs = recommendations.map((r) => r.problem.slug);
      // Graph (number-of-islands) and Scheduling/Intervals (merge-intervals) should rank top
      expect(slugs.slice(0, 3)).toEqual(
        expect.arrayContaining(['number-of-islands', 'merge-intervals'])
      );

      const top = recommendations[0];
      expect(top.relevanceScore).toBeGreaterThan(50);
      expect(top.matchReason.length).toBeGreaterThan(15);
    });

    it('recommends frontend/parsing problems for UI engineer JDs', () => {
      const frontendJd = `
        Frontend UI Platform Engineer
        Requirements:
        - Deep expertise in React, DOM event models, and state management.
        - Experience building AST compiler tools, syntax linters, and bracket matching.
        - Real-time client-side streaming buffer windowing.
      `;

      const recommendations = recommendProblemsForJob(frontendJd, 5);
      expect(recommendations).toHaveLength(5);

      const slugs = recommendations.map((r) => r.problem.slug);
      // Valid parentheses (stack/parsing) and Longest substring (sliding window) should rank high
      expect(slugs.slice(0, 3)).toEqual(
        expect.arrayContaining(['valid-parentheses', 'longest-substring-without-repeating-characters'])
      );

      const top = recommendations[0];
      expect(top.relevanceScore).toBeGreaterThan(50);
      expect(top.matchReason).toContain('pattern');
    });

    it('provides deterministic baseline fallback for blank or generic JDs', () => {
      const emptyRecs = recommendProblemsForJob('');
      expect(emptyRecs).toHaveLength(5);
      expect(emptyRecs[0].relevanceScore).toBe(75);
      expect(emptyRecs[1].relevanceScore).toBe(70);
    });
  });

  describe('Step 2: DSA Execution Runner', () => {
    const twoSumProblem = DSA_PROBLEMS.find((p) => p.slug === 'two-sum')!;
    const longestSubstringProblem = DSA_PROBLEMS.find(
      (p) => p.slug === 'longest-substring-without-repeating-characters'
    )!;

    it('deepEqual utility validates primitives, nested objects, and arrays', () => {
      expect(deepEqual([0, 1], [0, 1])).toBe(true);
      expect(deepEqual([1, 2], [2, 1])).toBe(false);
      expect(deepEqual([[1, 2], [3, 4]], [[3, 4], [2, 1]])).toBe(true);
      expect(deepEqual([], {})).toBe(false);
      expect(deepEqual({ a: 1, b: [2, 3] }, { a: 1, b: [2, 3] })).toBe(true);
      expect(deepEqual(NaN, NaN)).toBe(true);
      expect(deepEqual([0, 1], [0, 2])).toBe(false);
      expect(deepEqual({ a: 1 }, { b: 1 })).toBe(false);
    });

    it('sanitizeTypeScriptCode strips type annotations safely', () => {
      const tsCode = `
        interface Result {
          indices: number[];
        }
        export function twoSum(nums: number[], target: number): number[] {
          const map: Map<number, number> = new Map<number, number>();
          const obj = { a: 1, b: 2 };
          if (left < right || nums[left] > target) {
            return [0, 1];
          }
          return [0, 1] as number[];
        }
      `;
      const sanitized = sanitizeTypeScriptCode(tsCode);
      expect(sanitized).not.toContain('interface Result');
      expect(sanitized).not.toContain(': number[]');
      expect(sanitized).not.toContain('as number[]');
      expect(sanitized).toContain('function twoSum(nums, target)');
      expect(sanitized).toContain('{ a: 1, b: 2 }');
      expect(sanitized).toContain('if (left < right || nums[left] > target)');
    });

    it('returns Accepted for a valid JavaScript solution', async () => {
      const jsCode = `
        function twoSum(nums, target) {
          const seen = new Map();
          for (let i = 0; i < nums.length; i++) {
            const diff = target - nums[i];
            if (seen.has(diff)) {
              return [seen.get(diff), i];
            }
            seen.set(nums[i], i);
          }
          return [];
        }
      `;

      const result = await executeDsaCode({
        problem: twoSumProblem,
        language: 'javascript',
        code: jsCode,
      });

      expect(result.status).toBe('Accepted');
      expect(result.passedCount).toBe(twoSumProblem.testCases.length);
      expect(result.totalCount).toBe(twoSumProblem.testCases.length);
      expect(result.results.every((r) => r.passed)).toBe(true);
    });

    it('returns Accepted for a valid TypeScript solution with type annotations', async () => {
      const tsCode = `
        function lengthOfLongestSubstring(s: string): number {
          const map: Map<string, number> = new Map<string, number>();
          let left: number = 0;
          let maxLen: number = 0;
          for (let right: number = 0; right < s.length; right++) {
            const char: string = s[right]!;
            if (map.has(char) && map.get(char)! >= left) {
              left = map.get(char)! + 1;
            }
            map.set(char, right);
            maxLen = Math.max(maxLen, right - left + 1);
          }
          return maxLen;
        }
      `;

      const result = await executeDsaCode({
        problem: longestSubstringProblem,
        language: 'typescript',
        code: tsCode,
      });

      expect(result.status).toBe('Accepted');
      expect(result.passedCount).toBe(longestSubstringProblem.testCases.length);
      expect(result.results.every((r) => r.passed)).toBe(true);
    });

    it('returns Accepted for a valid Python solution', async () => {
      const pyCode = `
def twoSum(nums, target):
    seen = {}
    for i, num in enumerate(nums):
        diff = target - num
        if diff in seen:
            return [seen[diff], i]
        seen[num] = i
    return []
`;

      const result = await executeDsaCode({
        problem: twoSumProblem,
        language: 'python',
        code: pyCode,
      });

      expect(result.status).toBe('Accepted');
      expect(result.passedCount).toBe(twoSumProblem.testCases.length);
      expect(result.results.every((r) => r.passed)).toBe(true);
    });

    it('returns Wrong Answer with accurate diffs and captured stdout', async () => {
      const wrongJsCode = `
        function twoSum(nums, target) {
          console.log("Examining target:", target);
          return [0, 0];
        }
      `;

      const result = await executeDsaCode({
        problem: twoSumProblem,
        language: 'javascript',
        code: wrongJsCode,
      });

      expect(result.status).toBe('Wrong Answer');
      expect(result.passedCount).toBe(0);
      expect(result.results[0].passed).toBe(false);
      expect(result.results[0].actual).toEqual([0, 0]);
      expect(result.results[0].expected).toEqual([0, 1]);
      expect(result.results[0].stdout).toContain('Examining target: 9');
    });

    it('returns Syntax Error on malformed JavaScript', async () => {
      const invalidSyntaxCode = `
        function twoSum(nums, target {
          return [0, 1];
      `;

      const result = await executeDsaCode({
        problem: twoSumProblem,
        language: 'javascript',
        code: invalidSyntaxCode,
      });

      expect(result.status).toBe('Syntax Error');
      expect(result.errorMessage).toBeDefined();
    });

    it('returns Syntax Error on malformed Python', async () => {
      const invalidPyCode = `
def twoSum(nums, target
    return [0, 1]
`;

      const result = await executeDsaCode({
        problem: twoSumProblem,
        language: 'python',
        code: invalidPyCode,
      });

      expect(result.status).toBe('Syntax Error');
      expect(result.errorMessage).toBeDefined();
    });

    it('returns Runtime Error on unhandled exception in solution', async () => {
      const throwingCode = `
        function twoSum(nums, target) {
          throw new Error("Fatal computation overflow");
        }
      `;

      const result = await executeDsaCode({
        problem: twoSumProblem,
        language: 'javascript',
        code: throwingCode,
      });

      expect(result.status).toBe('Runtime Error');
      expect(result.results[0].error).toContain('Fatal computation overflow');
    });

    it('enforces timeout guard returning Time Limit Exceeded on infinite loops', async () => {
      const infiniteLoopCode = `
        function twoSum(nums, target) {
          while (true) {}
        }
      `;

      const result = await executeDsaCode({
        problem: twoSumProblem,
        language: 'javascript',
        code: infiniteLoopCode,
        timeoutMs: 300,
      });

      expect(result.status).toBe('Time Limit Exceeded');
      expect(result.errorMessage).toMatch(/timed out/i);
    });

    it('enforces timeout guard returning Time Limit Exceeded on infinite loop in Python', async () => {
      const infinitePyCode = `
def twoSum(nums, target):
    while True:
        pass
`;

      const result = await executeDsaCode({
        problem: twoSumProblem,
        language: 'python',
        code: infinitePyCode,
        timeoutMs: 500,
      });

      expect(result.status).toBe('Time Limit Exceeded');
      expect(result.errorMessage).toMatch(/timed out/i);
    });
  });
});
