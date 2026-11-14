import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  DSA_PROBLEMS,
  recommendProblemsForJob,
  DsaProblem,
} from '../src/lib/dsa-problems';
import {
  executeDsaCode,
  deepEqual,
  sanitizeTypeScriptCode,
  DSA_MAX_STDOUT_CHARS,
  DSA_SANDBOX_CSP,
  buildSandboxSrcdoc,
  buildSandboxWorkerSource,
  type DsaExecutionSummary,
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

  const twoSumProblem = DSA_PROBLEMS.find((p) => p.slug === 'two-sum')!;
  const longestSubstringProblem = DSA_PROBLEMS.find(
    (p) => p.slug === 'longest-substring-without-repeating-characters'
  )!;

  describe('Step 2: DSA Execution Runner', () => {

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

    it('returns unsupported Runtime Error summary in non-browser Node context', async () => {
      const result = await executeDsaCode({
        problem: twoSumProblem,
        language: 'javascript',
        code: 'function twoSum(nums, target) { return [0, 1]; }',
      });

      expect(result.status).toBe('Runtime Error');
      expect(result.passedCount).toBe(0);
      expect(result.totalCount).toBe(twoSumProblem.testCases.length);
      expect(result.results).toEqual([]);
      expect(result.errorMessage).toMatch(/browser sandbox/i);
    });

    it('returns unsupported Runtime Error summary for python without spawning child_process', async () => {
      const result = await executeDsaCode({
        problem: twoSumProblem,
        language: 'python',
        code: 'def twoSum(nums, target):\n    return [0, 1]',
      });

      expect(result.status).toBe('Runtime Error');
      expect(result.passedCount).toBe(0);
      expect(result.totalCount).toBe(twoSumProblem.testCases.length);
      expect(result.results).toEqual([]);
      expect(result.errorMessage).toContain('Python runner requires Python runtime or Pyodide environment.');
    });

    it('places strict CSP meta tag before any script in sandbox srcdoc', () => {
      const srcdoc = buildSandboxSrcdoc('boot-token-123');
      const cspIndex = srcdoc.indexOf('<meta http-equiv="Content-Security-Policy"');
      const scriptIndex = srcdoc.indexOf('<script>');
      expect(cspIndex).toBeGreaterThan(-1);
      expect(scriptIndex).toBeGreaterThan(cspIndex);
      expect(DSA_SANDBOX_CSP).toContain("default-src 'none'");
      expect(DSA_SANDBOX_CSP).toContain("connect-src 'none'");
      expect(DSA_SANDBOX_CSP).toContain("frame-src 'none'");
      expect(DSA_SANDBOX_CSP).toContain("form-action 'none'");
      expect(DSA_SANDBOX_CSP).toContain("base-uri 'none'");
      expect(DSA_SANDBOX_CSP).toContain('worker-src blob:');
      expect(() => buildSandboxSrcdoc('bad<script>token')).toThrow(/Invalid sandbox bootstrap token/);
    });
  });

  describe('Step 3: Sandboxed Iframe + MessageChannel Lifecycle', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    });

    function installDomSandboxMock() {
      const windowListeners = new Map<string, Set<(e: MessageEvent) => void>>();
      const createdIframes: Array<{
        attrs: Record<string, string>;
        srcdoc: string;
        removed: boolean;
        tabIndex: number;
        style: Record<string, string>;
        listeners: Map<string, Set<() => void>>;
        contentWindow: { postMessage: ReturnType<typeof vi.fn> };
      }> = [];
      const createdChannels: Array<{
        port1: {
          onmessage: ((e: MessageEvent) => void) | null;
          postMessage: ReturnType<typeof vi.fn>;
          close: ReturnType<typeof vi.fn>;
        };
        port2: {
          close: ReturnType<typeof vi.fn>;
        };
      }> = [];

      const mockWindow = {
        addEventListener: (type: string, cb: (e: MessageEvent) => void) => {
          if (!windowListeners.has(type)) windowListeners.set(type, new Set());
          windowListeners.get(type)!.add(cb);
        },
        removeEventListener: (type: string, cb: (e: MessageEvent) => void) => {
          windowListeners.get(type)?.delete(cb);
        },
      };

      const mockDocument = {
        body: {
          appendChild: vi.fn((iframe: (typeof createdIframes)[number]) => {
            const match = iframe.srcdoc.match(/BOOTSTRAP_TOKEN = "([^"]+)"/);
            const bootstrapToken = match ? match[1] : '';
            queueMicrotask(() => {
              const evt = {
                source: iframe.contentWindow,
                data: { type: 'dsa:ready', bootstrapToken },
              } as unknown as MessageEvent;
              windowListeners.get('message')?.forEach((fn) => fn(evt));
            });
          }),
        },
        createElement: vi.fn((tag: string) => {
          expect(tag).toBe('iframe');
          const attrs: Record<string, string> = {};
          const listeners = new Map<string, Set<() => void>>();
          const iframe = {
            attrs,
            srcdoc: '',
            removed: false,
            tabIndex: 0,
            style: {} as Record<string, string>,
            listeners,
            contentWindow: {
              postMessage: vi.fn(),
            },
            setAttribute: (k: string, v: string) => {
              attrs[k] = v;
            },
            getAttribute: (k: string) => attrs[k],
            addEventListener: (t: string, cb: () => void) => {
              if (!listeners.has(t)) listeners.set(t, new Set());
              listeners.get(t)!.add(cb);
            },
            removeEventListener: (t: string, cb: () => void) => {
              listeners.get(t)?.delete(cb);
            },
            remove: vi.fn(() => {
              iframe.removed = true;
            }),
          };
          createdIframes.push(iframe);
          return iframe;
        }),
      };

      class MockMessageChannel {
        port1 = {
          onmessage: null as ((e: MessageEvent) => void) | null,
          postMessage: vi.fn(),
          close: vi.fn(),
        };
        port2 = {
          close: vi.fn(),
        };
        constructor() {
          createdChannels.push(this);
        }
      }

      vi.stubGlobal('window', mockWindow);
      vi.stubGlobal('document', mockDocument);
      vi.stubGlobal('MessageChannel', MockMessageChannel);

      return { createdIframes, createdChannels, windowListeners };
    }

    it('creates opaque sandbox="allow-scripts" iframe, validates runId, and cleans up after result', async () => {
      const { createdIframes, createdChannels, windowListeners } = installDomSandboxMock();
      const userCode = 'function twoSum(nums, target) { return [0, 1]; }';

      const pending = executeDsaCode({
        problem: twoSumProblem,
        language: 'javascript',
        code: userCode,
        timeoutMs: 1000,
      });

      await new Promise((r) => setTimeout(r, 10));

      expect(createdIframes).toHaveLength(1);
      const iframe = createdIframes[0];
      expect(iframe.attrs.sandbox).toBe('allow-scripts');
      expect(iframe.attrs.sandbox).not.toContain('allow-same-origin');
      expect(iframe.srcdoc).not.toContain(userCode);
      expect(iframe.contentWindow.postMessage).toHaveBeenCalledTimes(1);

      const [postedMsg, targetOrigin, transfer] = iframe.contentWindow.postMessage.mock.calls[0];
      expect(targetOrigin).toBe('*');
      expect(postedMsg.type).toBe('dsa:execute');
      expect(typeof postedMsg.runId).toBe('string');
      expect(transfer).toHaveLength(1);

      const channel = createdChannels[0];
      // Mismatched runId must be ignored
      channel.port1.onmessage?.({
        data: {
          type: 'dsa:result',
          runId: 'wrong-run-id',
          summary: {
            status: 'Accepted',
            passedCount: twoSumProblem.testCases.length,
            totalCount: twoSumProblem.testCases.length,
            totalTimeMs: 1,
            results: [],
          },
        },
      } as MessageEvent);
      expect(iframe.removed).toBe(false);

      // Matching runId resolves and removes iframe
      const expectedSummary: DsaExecutionSummary = {
        status: 'Accepted',
        passedCount: twoSumProblem.testCases.length,
        totalCount: twoSumProblem.testCases.length,
        totalTimeMs: 4,
        results: twoSumProblem.testCases.map((tc) => ({
          testCaseId: tc.id,
          passed: true,
          actual: tc.expected,
          expected: tc.expected,
          executionTimeMs: 1,
          stdout: '',
        })),
      };

      channel.port1.onmessage?.({
        data: {
          type: 'dsa:result',
          runId: postedMsg.runId,
          summary: expectedSummary,
        },
      } as MessageEvent);

      const result = await pending;
      expect(result).toEqual(expectedSummary);
      expect(iframe.removed).toBe(true);
      expect(channel.port1.close).toHaveBeenCalled();
      expect(channel.port2.close).toHaveBeenCalled();
      expect(windowListeners.get('message')?.size ?? 0).toBe(0);
    });

    it('rejects malformed summary payloads from sandbox port', async () => {
      const { createdIframes, createdChannels } = installDomSandboxMock();

      const pending = executeDsaCode({
        problem: twoSumProblem,
        language: 'javascript',
        code: 'function twoSum() {}',
      });

      await new Promise((r) => setTimeout(r, 10));
      const { runId } = createdIframes[0].contentWindow.postMessage.mock.calls[0][0];

      createdChannels[0].port1.onmessage?.({
        data: {
          type: 'dsa:result',
          runId,
          summary: { status: 'UnknownStatus', passedCount: 'nope' },
        },
      } as MessageEvent);

      const result = await pending;
      expect(result.status).toBe('Runtime Error');
      expect(result.errorMessage).toMatch(/invalid execution summary/i);
      expect(createdIframes[0].removed).toBe(true);
    });

    it('terminates on timeout, sends dsa:abort, and cleans up DOM/channel resources', async () => {
      vi.useFakeTimers();
      const { createdIframes, createdChannels } = installDomSandboxMock();

      const pending = executeDsaCode({
        problem: twoSumProblem,
        language: 'javascript',
        code: 'function twoSum() { while (true) {} }',
        timeoutMs: 250,
      });

      await vi.advanceTimersByTimeAsync(250);
      const result = await pending;

      expect(result.status).toBe('Time Limit Exceeded');
      expect(result.errorMessage).toMatch(/timed out after 250ms/i);
      expect(createdChannels[0].port1.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'dsa:abort' })
      );
      expect(createdIframes[0].removed).toBe(true);
      expect(createdChannels[0].port1.close).toHaveBeenCalled();
    });

    it('cleans up active iframe run when AbortSignal aborts on unmount', async () => {
      const { createdIframes, createdChannels } = installDomSandboxMock();
      const controller = new AbortController();

      const pending = executeDsaCode({
        problem: twoSumProblem,
        language: 'javascript',
        code: 'function twoSum() { while (true) {} }',
        timeoutMs: 5000,
        signal: controller.signal,
      });

      await new Promise((r) => setTimeout(r, 10));
      controller.abort();

      const result = await pending;
      expect(result.status).toBe('Runtime Error');
      expect(result.errorMessage).toMatch(/cancelled/i);
      expect(createdChannels[0].port1.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'dsa:abort' })
      );
      expect(createdIframes[0].removed).toBe(true);
    });
  });

  describe('Step 4: Sandbox Worker Script Semantics (Ported & Extended)', () => {
    function runWorkerHarness(params: {
      sanitizedCode: string;
      entryFunctionName: string;
      parameterNames: string[];
      testCases: DsaProblem['testCases'];
    }): DsaExecutionSummary {
      const mockSelf: {
        onmessage?: (e: { data: Record<string, unknown> }) => void;
        postMessage: (msg: { runId: string; summary: DsaExecutionSummary }) => void;
      } = {
        postMessage: () => {},
      };
      let captured: DsaExecutionSummary | null = null;
      mockSelf.postMessage = (msg) => {
        captured = msg.summary;
      };

      const workerFactory = new Function('self', buildSandboxWorkerSource());
      workerFactory(mockSelf);
      mockSelf.onmessage?.({
        data: {
          runId: 'worker-test-run',
          ...params,
        },
      });
      if (!captured) {
        throw new Error('Worker harness did not post a summary');
      }
      return captured;
    }

    it('returns Accepted for valid JS and stripped TS solutions', () => {
      const jsSummary = runWorkerHarness({
        sanitizedCode: `
          function twoSum(nums, target) {
            const seen = new Map();
            for (let i = 0; i < nums.length; i++) {
              const diff = target - nums[i];
              if (seen.has(diff)) return [seen.get(diff), i];
              seen.set(nums[i], i);
            }
            return [];
          }
        `,
        entryFunctionName: twoSumProblem.entryFunctionName,
        parameterNames: twoSumProblem.parameterNames,
        testCases: twoSumProblem.testCases,
      });
      expect(jsSummary.status).toBe('Accepted');
      expect(jsSummary.passedCount).toBe(twoSumProblem.testCases.length);

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
      const tsSummary = runWorkerHarness({
        sanitizedCode: sanitizeTypeScriptCode(tsCode),
        entryFunctionName: longestSubstringProblem.entryFunctionName,
        parameterNames: longestSubstringProblem.parameterNames,
        testCases: longestSubstringProblem.testCases,
      });
      expect(tsSummary.status).toBe('Accepted');
      expect(tsSummary.passedCount).toBe(longestSubstringProblem.testCases.length);
    });

    it('captures stdout, enforces stdout truncation cap, and reports Wrong Answer diffs', () => {
      const wrongSummary = runWorkerHarness({
        sanitizedCode: `
          function twoSum(nums, target) {
            console.log("Examining target:", target);
            console.log("X".repeat(6000));
            return [0, 0];
          }
        `,
        entryFunctionName: twoSumProblem.entryFunctionName,
        parameterNames: twoSumProblem.parameterNames,
        testCases: twoSumProblem.testCases,
      });

      expect(wrongSummary.status).toBe('Wrong Answer');
      expect(wrongSummary.passedCount).toBe(0);
      expect(wrongSummary.results[0].actual).toEqual([0, 0]);
      expect(wrongSummary.results[0].stdout).toContain('Examining target: 9');
      expect(wrongSummary.results[0].stdout.length).toBeLessThanOrEqual(DSA_MAX_STDOUT_CHARS);
      expect(wrongSummary.results[0].stdout).toContain('[stdout truncated]');
    });

    it('returns Syntax Error on malformed JS and Runtime Error on unhandled exceptions', () => {
      const syntaxSummary = runWorkerHarness({
        sanitizedCode: 'function twoSum(nums, target { return [0, 1];',
        entryFunctionName: twoSumProblem.entryFunctionName,
        parameterNames: twoSumProblem.parameterNames,
        testCases: twoSumProblem.testCases,
      });
      expect(syntaxSummary.status).toBe('Syntax Error');
      expect(syntaxSummary.errorMessage).toBeDefined();

      const runtimeSummary = runWorkerHarness({
        sanitizedCode: 'function twoSum() { throw new Error("Fatal computation overflow"); }',
        entryFunctionName: twoSumProblem.entryFunctionName,
        parameterNames: twoSumProblem.parameterNames,
        testCases: twoSumProblem.testCases,
      });
      expect(runtimeSummary.status).toBe('Runtime Error');
      expect(runtimeSummary.results[0].error).toContain('Fatal computation overflow');
    });

    it('reports missing entry function error and respects explicit entryFunctionName over helper functions', () => {
      const missingFnSummary = runWorkerHarness({
        sanitizedCode: 'const x = 42;',
        entryFunctionName: '',
        parameterNames: ['nums', 'target'],
        testCases: twoSumProblem.testCases,
      });
      expect(missingFnSummary.status).toBe('Runtime Error');
      expect(missingFnSummary.errorMessage).toContain('Could not find a valid entry function');

      const helperPrecedesMain = runWorkerHarness({
        sanitizedCode: `
          function helper(x) { return x + 1; }
          function twoSum(nums, target) {
            const seen = new Map();
            for (let i = 0; i < nums.length; i++) {
              if (seen.has(target - nums[i])) return [seen.get(target - nums[i]), i];
              seen.set(nums[i], i);
            }
            return [];
          }
        `,
        entryFunctionName: 'twoSum',
        parameterNames: twoSumProblem.parameterNames,
        testCases: twoSumProblem.testCases,
      });
      expect(helperPrecedesMain.status).toBe('Accepted');
    });

    it('shadows dangerous Node and DOM globals inside submitted user code', () => {
      const shadowSummary = runWorkerHarness({
        sanitizedCode: `
          function twoSum() {
            const checks = [
              typeof process,
              typeof require,
              typeof module,
              typeof exports,
              typeof global,
              typeof importScripts,
              typeof window,
              typeof document,
              typeof parent,
              typeof top,
            ];
            console.log(checks.join(","));
            return [0, 1];
          }
        `,
        entryFunctionName: 'twoSum',
        parameterNames: twoSumProblem.parameterNames,
        testCases: [twoSumProblem.testCases[0]],
      });
      expect(shadowSummary.status).toBe('Accepted');
      expect(shadowSummary.results[0].stdout).toBe(
        Array(10).fill('undefined').join(',')
      );
    });

    it('prevents submitted code from tampering with deepEqual or self.postMessage', () => {
      const tamperSummary = runWorkerHarness({
        sanitizedCode: `
          function twoSum() {
            if (typeof self !== "undefined") {
              self.deepEqual = () => true;
              self.postMessage = () => {};
            }
            return [999, 999];
          }
        `,
        entryFunctionName: 'twoSum',
        parameterNames: twoSumProblem.parameterNames,
        testCases: [twoSumProblem.testCases[0]],
      });
      expect(tamperSummary.status).toBe('Wrong Answer');
      expect(tamperSummary.passedCount).toBe(0);
    });
  });
});
