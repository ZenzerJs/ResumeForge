import { describe, it, expect } from 'vitest';
import { DSA_PROBLEMS } from '../src/lib/dsa-problems';
import type { DsaExecutionSummary } from '../src/lib/dsa-runner';
import {
  sanitizeSocraticResponse,
  analyzeComplexityHeuristically,
  auditDsaSubmission,
  askSocraticCoach,
  DsaInterviewStage,
} from '../src/lib/dsa-coach';

describe('WS10-A Socratic DSA Coach & Complexity Auditor', () => {
  const twoSumProblem = DSA_PROBLEMS.find((p) => p.slug === 'two-sum')!;
  const containerProblem = DSA_PROBLEMS.find((p) => p.slug === 'container-with-most-water')!;

  describe('1. Socratic Anti-Spoiler Guardrail (sanitizeSocraticResponse)', () => {
    const codeSnippet = '```typescript\nfunction solution() { return true; }\n```';
    const responseWithSnippet = `Consider this structure:\n${codeSnippet}\nWhat is the invariant?`;

    it('redacts fenced code blocks in CLARIFICATION stage', () => {
      const sanitized = sanitizeSocraticResponse(responseWithSnippet, 'CLARIFICATION');
      expect(sanitized).not.toContain('function solution()');
      expect(sanitized).toContain('[Code redacted by Socratic Guardrail — focus on the invariant and approach!]');
      expect(sanitized).toContain('What is the invariant?');
    });

    it('redacts fenced code blocks in APPROACH and CODING stages', () => {
      const stages: DsaInterviewStage[] = ['APPROACH', 'CODING', 'OPTIMIZATION'];
      for (const stage of stages) {
        const sanitized = sanitizeSocraticResponse(responseWithSnippet, stage);
        expect(sanitized).not.toContain('```typescript');
        expect(sanitized).toContain('[Code redacted by Socratic Guardrail — focus on the invariant and approach!]');
      }
    });

    it('preserves fenced code blocks in SCORECARD stage for reference explanations', () => {
      const scorecardOutput = sanitizeSocraticResponse(responseWithSnippet, 'SCORECARD');
      expect(scorecardOutput).toContain('function solution()');
      expect(scorecardOutput).toContain('```typescript');
    });

    it('preserves inline code backticks while redacting multi-line blocks', () => {
      const textWithInline = 'Check if `nums[i]` matches `target - x`:\n```ts\nreturn [i, j];\n```';
      const sanitized = sanitizeSocraticResponse(textWithInline, 'CODING');
      expect(sanitized).toContain('`nums[i]`');
      expect(sanitized).toContain('`target - x`');
      expect(sanitized).not.toContain('return [i, j];');
    });
  });

  describe('2. Hybrid Complexity Auditor (analyzeComplexityHeuristically)', () => {
    const bruteForceTwoSum = `
      function twoSum(nums: number[], target: number): number[] {
        for (let i = 0; i < nums.length; i++) {
          for (let j = i + 1; j < nums.length; j++) {
            if (nums[i] + nums[j] === target) {
              return [i, j];
            }
          }
        }
        return [];
      }
    `;

    const hashMapTwoSum = `
      function twoSum(nums: number[], target: number): number[] {
        const map = new Map<number, number>();
        for (let i = 0; i < nums.length; i++) {
          const complement = target - nums[i];
          if (map.has(complement)) {
            return [map.get(complement)!, i];
          }
          map.set(nums[i], i);
        }
        return [];
      }
    `;

    const twoPointersContainer = `
      function maxArea(height: number[]): number {
        let left = 0;
        let right = height.length - 1;
        let maxWater = 0;
        while (left < right) {
          const area = Math.min(height[left], height[right]) * (right - left);
          maxWater = Math.max(maxWater, area);
          if (height[left] < height[right]) {
            left++;
          } else {
            right--;
          }
        }
        return maxWater;
      }
    `;

    it('identifies O(n^2) nested loop brute-force solution as sub-optimal', () => {
      const audit = analyzeComplexityHeuristically(twoSumProblem, bruteForceTwoSum);
      expect(audit.detectedTimeComplexity).toBe('O(n^2)');
      expect(audit.optimalTimeComplexity).toBe('O(n)');
      expect(audit.isTimeOptimal).toBe(false);
      expect(audit.detectedSpaceComplexity).toBe('O(1)');
      expect(audit.isSpaceOptimal).toBe(true);
      expect(audit.actionableFeedback).toContain('sub-optimal');
    });

    it('identifies O(n) Hash Map solution as optimal for Two Sum', () => {
      const audit = analyzeComplexityHeuristically(twoSumProblem, hashMapTwoSum);
      expect(audit.detectedTimeComplexity).toBe('O(n)');
      expect(audit.optimalTimeComplexity).toBe('O(n)');
      expect(audit.isTimeOptimal).toBe(true);
      expect(audit.detectedSpaceComplexity).toBe('O(n)');
      expect(audit.isSpaceOptimal).toBe(true);
      expect(audit.actionableFeedback).toContain('Optimal');
    });

    it('identifies O(n) time and O(1) space two-pointer solution for Container With Most Water', () => {
      const audit = analyzeComplexityHeuristically(containerProblem, twoPointersContainer);
      expect(audit.detectedTimeComplexity).toBe('O(n)');
      expect(audit.optimalTimeComplexity).toBe('O(n)');
      expect(audit.isTimeOptimal).toBe(true);
      expect(audit.detectedSpaceComplexity).toBe('O(1)');
      expect(audit.optimalSpaceComplexity).toBe('O(1)');
      expect(audit.isSpaceOptimal).toBe(true);
    });

    it('detects missed edge cases based on failed execution results', () => {
      const failingExecution: DsaExecutionSummary = {
        status: 'Wrong Answer',
        passedCount: 2,
        totalCount: 4,
        totalTimeMs: 12,
        results: [
          {
            testCaseId: 'tc-1',
            passed: true,
            actual: [0, 1],
            expected: [0, 1],
            executionTimeMs: 2,
            stdout: '',
          },
          {
            testCaseId: 'tc-4', // tc-4 has negative numbers: [-1, -2, -3, -4, -5], target -8
            passed: false,
            actual: [],
            expected: [2, 4],
            executionTimeMs: 3,
            stdout: '',
          },
        ],
      };

      const audit = analyzeComplexityHeuristically(twoSumProblem, hashMapTwoSum, failingExecution);
      expect(audit.missedEdgeCases.length).toBeGreaterThan(0);
      expect(audit.missedEdgeCases.some((e) => e.toLowerCase().includes('negative'))).toBe(true);
    });
  });

  describe('3. DSA Submission Scorecard & Rubric (auditDsaSubmission)', () => {
    const acceptedExecution: DsaExecutionSummary = {
      status: 'Accepted',
      passedCount: 4,
      totalCount: 4,
      totalTimeMs: 8,
      results: twoSumProblem.testCases.map((tc) => ({
        testCaseId: tc.id,
        passed: true,
        actual: tc.expected,
        expected: tc.expected,
        executionTimeMs: 2,
        stdout: '',
      })),
    };

    const hashMapCode = `
      function twoSum(nums: number[], target: number): number[] {
        const map = new Map<number, number>();
        for (let i = 0; i < nums.length; i++) {
          const complement = target - nums[i];
          if (map.has(complement)) {
            return [map.get(complement)!, i];
          }
          map.set(nums[i], i);
        }
        return [];
      }
    `;

    it('awards Grade S for optimal solution with zero hints used', async () => {
      const scorecard = await auditDsaSubmission({
        problem: twoSumProblem,
        language: 'typescript',
        code: hashMapCode,
        execution: acceptedExecution,
        hintsUsed: 0,
      });

      expect(scorecard.passedTestsRatio).toBe('4/4');
      expect(scorecard.hintsUsed).toBe(0);
      expect(scorecard.hintPenalty).toBe(0);
      expect(scorecard.overallScore).toBeGreaterThanOrEqual(95);
      expect(scorecard.grade).toBe('S');
      expect(scorecard.complexityAudit.isTimeOptimal).toBe(true);
      expect(scorecard.strengths.length).toBeGreaterThan(0);
    });

    it('deducts 5 points per hint and adjusts letter grade accordingly', async () => {
      const scorecardWithHints = await auditDsaSubmission({
        problem: twoSumProblem,
        language: 'typescript',
        code: hashMapCode,
        execution: acceptedExecution,
        hintsUsed: 2,
      });

      expect(scorecardWithHints.hintsUsed).toBe(2);
      expect(scorecardWithHints.hintPenalty).toBe(10);
      expect(scorecardWithHints.overallScore).toBeLessThan(95);
      expect(['A', 'B']).toContain(scorecardWithHints.grade);
      expect(scorecardWithHints.growthAreas.some((g) => g.includes('hint'))).toBe(true);
    });
  });

  describe('4. Socratic Coach Interactions & Stage Transitions (askSocraticCoach)', () => {
    const starterCode = twoSumProblem.starterCode.typescript;

    it('returns stage-appropriate guidance in CLARIFICATION and advances to APPROACH on confirmation', async () => {
      const coachTurn = await askSocraticCoach({
        problem: twoSumProblem,
        stage: 'CLARIFICATION',
        language: 'typescript',
        code: starterCode,
        messages: [],
        userMessage: 'I understand the constraints and input boundaries. Ready to discuss the approach.',
      });

      expect(coachTurn.reply.length).toBeGreaterThan(15);
      expect(coachTurn.reply).not.toContain('```');
      expect(coachTurn.suggestedNextStage).toBe('APPROACH');
    });

    it('advances from APPROACH to CODING when candidate proposes a data structure approach', async () => {
      const coachTurn = await askSocraticCoach({
        problem: twoSumProblem,
        stage: 'APPROACH',
        language: 'typescript',
        code: starterCode,
        messages: [],
        userMessage: 'I plan to use a Hash Map to store seen numbers in O(n) time and O(n) space.',
      });

      expect(coachTurn.reply.length).toBeGreaterThan(15);
      expect(coachTurn.reply).not.toContain('```');
      expect(coachTurn.suggestedNextStage).toBe('CODING');
    });

    it('advances from CODING to SCORECARD or OPTIMIZATION when test execution is Accepted', async () => {
      const acceptedExecution: DsaExecutionSummary = {
        status: 'Accepted',
        passedCount: 4,
        totalCount: 4,
        totalTimeMs: 10,
        results: twoSumProblem.testCases.map((tc) => ({
          testCaseId: tc.id,
          passed: true,
          actual: tc.expected,
          expected: tc.expected,
          executionTimeMs: 2,
          stdout: '',
        })),
      };

      const hashMapCode = `
        function twoSum(nums: number[], target: number): number[] {
          const map = new Map<number, number>();
          for (let i = 0; i < nums.length; i++) {
            const complement = target - nums[i];
            if (map.has(complement)) return [map.get(complement)!, i];
            map.set(nums[i], i);
          }
          return [];
        }
      `;

      const coachTurn = await askSocraticCoach({
        problem: twoSumProblem,
        stage: 'CODING',
        language: 'typescript',
        code: hashMapCode,
        execution: acceptedExecution,
        messages: [],
        userMessage: 'I just ran the tests and all of them passed!',
      });

      expect(coachTurn.reply).not.toContain('```');
      expect(['SCORECARD', 'OPTIMIZATION']).toContain(coachTurn.suggestedNextStage);
    });

    it('stays in CODING stage when execution has failing test cases', async () => {
      const failingExecution: DsaExecutionSummary = {
        status: 'Wrong Answer',
        passedCount: 2,
        totalCount: 4,
        totalTimeMs: 10,
        results: [
          {
            testCaseId: 'tc-1',
            passed: true,
            actual: [0, 1],
            expected: [0, 1],
            executionTimeMs: 2,
            stdout: '',
          },
          {
            testCaseId: 'tc-2',
            passed: false,
            actual: [],
            expected: [1, 2],
            executionTimeMs: 2,
            stdout: '',
          },
        ],
      };

      const coachTurn = await askSocraticCoach({
        problem: twoSumProblem,
        stage: 'CODING',
        language: 'typescript',
        code: starterCode,
        execution: failingExecution,
        messages: [],
        userMessage: 'Test 2 is failing with empty array output.',
      });

      expect(coachTurn.suggestedNextStage).toBe('CODING');
      expect(coachTurn.reply).toContain('passed 2/4');
    });
  });
});
