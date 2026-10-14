import { runCodeAgainstTestCases } from "./code-runner";
import type { ExecutionResult, TestCase } from "./types";

type CodeWorker = {
  postMessage: (data: unknown) => void;
  terminate: () => void;
  onmessage: ((event: MessageEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
};

function timeoutResult(testCases: TestCase[], started: number): ExecutionResult {
  return {
    status: "ERROR",
    totalTests: testCases.length,
    passedTests: 0,
    executionTimeMs: Date.now() - started,
    testResults: [],
    error: "Time limit exceeded",
  };
}

/**
 * Runs practice code in a browser Worker and kills it if it exceeds the time limit.
 * Node tests keep the synchronous runner.
 */
export function runUserCode(
  userCode: string,
  testCases: TestCase[],
  functionName?: string,
  options?: { timeoutMs?: number; createWorker?: () => CodeWorker }
): Promise<ExecutionResult> {
  const timeoutMs = options?.timeoutMs ?? 2000;
  const started = Date.now();
  const canUseBrowserWorker = typeof window !== "undefined" && typeof Worker !== "undefined";
  if (!options?.createWorker && !canUseBrowserWorker) {
    return Promise.resolve(runCodeAgainstTestCases(userCode, testCases, functionName));
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: ExecutionResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      worker.terminate();
      resolve(result);
    };
    const worker = options?.createWorker
      ? options.createWorker()
      : (new Worker(new URL("./code-runner.worker.ts", import.meta.url)) as CodeWorker);
    const timer = setTimeout(() => finish(timeoutResult(testCases, started)), timeoutMs);
    worker.onmessage = (event: MessageEvent) => finish(event.data as ExecutionResult);
    worker.onerror = () => finish(timeoutResult(testCases, started));
    worker.postMessage({ userCode, testCases, functionName });
  });
}
