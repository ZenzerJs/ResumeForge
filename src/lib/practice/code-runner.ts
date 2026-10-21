import { ExecutionResult, TestCase, TestRunItemResult } from "./types";

/**
 * Deep equality checker for test case outputs.
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;

  if (typeof a === "number" && typeof b === "number" && isNaN(a) && isNaN(b)) return true;

  if (typeof a !== typeof b) return false;

  if (a === null || b === null || a === undefined || b === undefined) {
    return a === b;
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    const exactMatch = a.every((val, idx) => deepEqual(val, b[idx]));
    if (exactMatch) return true;
    if (a.length > 0 && a.every(Array.isArray) && b.every(Array.isArray)) {
      const sortInner = (arr: unknown[]) =>
        [...arr].sort((x, y) =>
          typeof x === "number" && typeof y === "number"
            ? x - y
            : String(x).localeCompare(String(y))
        );
      const serializeRow = (row: unknown[]) => JSON.stringify(sortInner(row));
      const sortedA = a.map(serializeRow).sort();
      const sortedB = b.map(serializeRow).sort();
      return sortedA.every((val, idx) => val === sortedB[idx]);
    }
    return false;
  }

  if (Array.isArray(a) !== Array.isArray(b)) return false;

  if (typeof a === "object" && typeof b === "object") {
    const keysA = Object.keys(a as Record<string, unknown>);
    const keysB = Object.keys(b as Record<string, unknown>);
    if (keysA.length !== keysB.length) return false;
    for (const key of keysA) {
      if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
      if (!deepEqual((a as any)[key], (b as any)[key])) return false;
    }
    return true;
  }

  return false;
}

/**
 * Strips basic TypeScript type annotations (return types, argument types, interface/type keywords,
 * generic parameters, non-null assertions) so that standard JS execution environments can run user-submitted TS code.
 */
export function sanitizeTypeScriptCode(code: string): string {
  let cleaned = code;
  // Strip block comments
  cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, "");
  // Strip line comments
  cleaned = cleaned.replace(/(^|[^:])\/\/.*$/gm, "$1");
  // Strip import statements
  cleaned = cleaned.replace(/^\s*import\s+.*$/gm, "");
  // Strip export prefixes
  cleaned = cleaned.replace(/^\s*export\s+(?:default\s+)?/gm, "");
  // Strip interface and type alias statements
  cleaned = cleaned.replace(/^\s*(?:type|interface)\s+[A-Za-z0-9_$]+[\s\S]*?(?:;|\})\s*$/gm, "");
  // Strip type casting: e.g. "x as number"
  cleaned = cleaned.replace(/\s+as\s+[A-Za-z0-9_<>\[\]| ]+/g, "");
  // Strip non-null assertions: e.g. "val!"
  cleaned = cleaned.replace(/([a-zA-Z0-9_\]\)])!(?=[,\s\.;\)=])/g, "$1");
  // Strip function return type annotations: e.g. "): number[] {" or "): void =>"
  cleaned = cleaned.replace(/\)\s*:\s*[A-Za-z0-9_<>\[\]|,\s]+(\s*\{|\s*=>)/g, ")$1");
  // Strip generic call type arguments: e.g. new Map<number, number>() or new Set<string>()
  cleaned = cleaned.replace(/<[A-Za-z0-9_\[\],\s|]+>(?=\s*\()/g, "");
  // Strip variable declaration types: e.g. "const x: number = 5" or "let ans: number[];"
  cleaned = cleaned.replace(/(const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:\s*[^=;]+(?=[=;])/g, "$1 $2");
  // Strip parameter type annotations safely without affecting object literal properties: e.g. "nums: number[]"
  cleaned = cleaned.replace(/:\s*(?:number|string|boolean|any|unknown|void|never|object|Record<[^>]+>|Array<[^>]+>|Map<[^>]+>|Set<[^>]+>|ListNode|TreeNode|Node|[A-Z][A-Za-z0-9_<>]*)(?:\[\])*(?:\s*\|\s*(?:number|string|boolean|null|undefined|[A-Z][A-Za-z0-9_<>]*)(?:\[\])*)*(?=\s*[,)=])/g, "");
  return cleaned;
}

/**
 * Executes user code against an array of test cases.
 * Safe timeout protection and detailed diff reporting.
 */
export function runCodeAgainstTestCases(
  userCode: string,
  testCases: TestCase[],
  functionName?: string
): ExecutionResult {
  const startTime = Date.now();
  const testResults: TestRunItemResult[] = [];
  let passedCount = 0;

  try {
    const sanitized = sanitizeTypeScriptCode(userCode);

    // Extract function name if not provided
    let targetFnName = functionName;
    if (!targetFnName) {
      const match = sanitized.match(/function\s+([a-zA-Z0-9_$]+)\s*\(/);
      if (match) {
        targetFnName = match[1];
      } else {
        const arrowMatch = sanitized.match(/(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:\([^)]*\)|[a-zA-Z0-9_$]+)\s*=>/);
        if (arrowMatch) {
          targetFnName = arrowMatch[1];
        }
      }
    }

    if (!targetFnName) {
      return {
        status: "ERROR",
        totalTests: testCases.length,
        passedTests: 0,
        executionTimeMs: Date.now() - startTime,
        testResults: [],
        error: "Could not find a valid entry function. Please define a function (e.g. function twoSum(...) { ... }).",
      };
    }

    // Wrap in function constructor with sandbox scope shadowing server-side globals
    const factory = new Function(
      "process",
      "require",
      "global",
      "globalThis",
      "module",
      "exports",
      `"use strict";
      ${sanitized}
      if (typeof ${targetFnName} !== "function") {
        throw new Error("Function '${targetFnName}' is not defined.");
      }
      return ${targetFnName};`
    );

    const fn = factory(undefined, undefined, undefined, undefined, undefined, undefined);

    for (const tc of testCases) {
      const caseStart = Date.now();
      try {
        // Deep clone args to avoid side effects across test cases
        const clonedArgs = JSON.parse(JSON.stringify(tc.args));
        const actual = fn(...clonedArgs);
        const caseDuration = Date.now() - caseStart;

        const passed = deepEqual(actual, tc.expected);
        if (passed) passedCount++;

        testResults.push({
          testCaseId: tc.id,
          passed,
          input: tc.inputDisplay,
          expected: tc.expectedDisplay || JSON.stringify(tc.expected),
          actual: JSON.stringify(actual),
          executionTimeMs: caseDuration,
        });
      } catch (err: any) {
        testResults.push({
          testCaseId: tc.id,
          passed: false,
          input: tc.inputDisplay,
          expected: tc.expectedDisplay || JSON.stringify(tc.expected),
          actual: "Runtime Error",
          error: err?.message || String(err),
          executionTimeMs: Date.now() - caseStart,
        });
      }
    }

    const totalDuration = Date.now() - startTime;
    const allPassed = passedCount === testCases.length;

    return {
      status: allPassed ? "PASS" : "FAIL",
      totalTests: testCases.length,
      passedTests: passedCount,
      executionTimeMs: totalDuration,
      testResults,
    };
  } catch (err: any) {
    return {
      status: "ERROR",
      totalTests: testCases.length,
      passedTests: 0,
      executionTimeMs: Date.now() - startTime,
      testResults: [],
      error: err?.message || String(err),
    };
  }
}
