import type { DsaProblem, DsaLanguage, DsaTestCase } from './dsa-problems';

export interface DsaTestResult {
  testCaseId: string;
  passed: boolean;
  actual: unknown;
  expected: unknown;
  executionTimeMs: number;
  stdout: string;
  error?: string;
}

export interface DsaExecutionSummary {
  status: 'Accepted' | 'Wrong Answer' | 'Time Limit Exceeded' | 'Runtime Error' | 'Syntax Error';
  passedCount: number;
  totalCount: number;
  totalTimeMs: number;
  results: DsaTestResult[];
  errorMessage?: string;
}

export const DSA_MAX_STDOUT_CHARS = 4096;
export const DSA_MAX_ERROR_CHARS = 2048;

export const DSA_SANDBOX_CSP =
  "default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' blob:; worker-src blob:; connect-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none';";

const IDENTIFIER_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const SAFE_TOKEN_RE = /^[A-Za-z0-9-]+$/;

const VALID_STATUSES = new Set<DsaExecutionSummary['status']>([
  'Accepted',
  'Wrong Answer',
  'Time Limit Exceeded',
  'Runtime Error',
  'Syntax Error',
]);

function clampText(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value;
  const suffix = '\n...[truncated]';
  if (maxChars <= suffix.length) return value.slice(0, maxChars);
  return `${value.slice(0, maxChars - suffix.length)}${suffix}`;
}

function unsupportedSummary(totalCount: number, errorMessage: string): DsaExecutionSummary {
  return {
    status: 'Runtime Error',
    passedCount: 0,
    totalCount,
    totalTimeMs: 0,
    results: [],
    errorMessage: clampText(errorMessage, DSA_MAX_ERROR_CHARS),
  };
}

function generateRandomToken(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * Deep equality check supporting nested arrays, unordered 2D arrays (common in groupAnagrams, subsets, etc.),
 * objects, primitives, null, and undefined.
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;

  if (typeof a === 'number' && typeof b === 'number' && Number.isNaN(a) && Number.isNaN(b)) {
    return true;
  }

  if (a === null || b === null || a === undefined || b === undefined) {
    return a === b;
  }

  if (typeof a !== typeof b) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    const exactMatch = a.every((item, i) => deepEqual(item, b[i]));
    if (exactMatch) return true;

    if (a.length > 0 && a.every((x) => Array.isArray(x)) && b.every((x) => Array.isArray(x))) {
      const sortInner = (arr: unknown[]) =>
        [...arr].sort((x, y) => {
          if (typeof x === 'number' && typeof y === 'number') return x - y;
          return String(x).localeCompare(String(y));
        });
      const serializedA = a.map((row) => JSON.stringify(sortInner(row as unknown[]))).sort();
      const serializedB = b.map((row) => JSON.stringify(sortInner(row as unknown[]))).sort();
      return serializedA.every((val, i) => val === serializedB[i]);
    }
    return false;
  }

  if (Array.isArray(a) !== Array.isArray(b)) return false;

  if (typeof a === 'object' && typeof b === 'object') {
    const objA = a as Record<string, unknown>;
    const objB = b as Record<string, unknown>;
    const keysA = Object.keys(objA);
    const keysB = Object.keys(objB);
    if (keysA.length !== keysB.length) return false;
    return keysA.every(
      (k) => Object.prototype.hasOwnProperty.call(objB, k) && deepEqual(objA[k], objB[k])
    );
  }

  return false;
}

/**
 * Lightweight regex-based TypeScript stripper for browser/worker DSA execution.
 * Removes type annotations, interfaces, type aliases, generics, and `as` assertions
 * so pure JS runtimes can evaluate TypeScript LeetCode-style starter code.
 */
export function sanitizeTypeScriptCode(code: string): string {
  let js = code;
  js = js.replace(/\/\*[\s\S]*?\*\//g, '');
  js = js.replace(/(^|[^:])\/\/.*$/gm, '$1');
  js = js.replace(/^\s*import\s+.*$/gm, '');
  js = js.replace(/^\s*export\s+(?:default\s+)?/gm, '');
  js = js.replace(/^\s*(?:interface|type)\s+\w+[\s\S]*?(?:\n\}|;)\s*$/gm, '');
  js = js.replace(/\s+as\s+(?:const|[A-Za-z_]\w*(?:<[^>]+>)?(?:\[\])*)/g, '');
  js = js.replace(/:\s*(?:[A-Za-z_]\w*(?:<[^>]+>)?(?:\[\])*|\{[^}]+\}|\[[^\]]+\])(?=\s*(?:[,)=]))/g, '');
  js = js.replace(/\)\s*:\s*[A-Za-z_]\w*(?:<[^>]+>)?(?:\[\])*(?:\s*\|\s*[A-Za-z_]\w*(?:<[^>]+>)?(?:\[\])*)*(?=\s*(?:\{|=>))/g, ')');
  js = js.replace(/<[A-Za-z0-9_,\s\[\]|]+>(?=\s*\()/g, '');
  js = js.replace(/(const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:\s*[^=;]+(?=[=;])/g, '$1 $2');
  js = js.replace(/([a-zA-Z0-9_\]\)])!(?=[,\s.;)=])/g, '$1');
  return js;
}

export function buildSandboxWorkerSource(): string {
  return `
(function () {
"use strict";
const postWorkerMessage = self.postMessage.bind(self);
const MAX_STDOUT_CHARS = ${DSA_MAX_STDOUT_CHARS};
const MAX_ERROR_CHARS = ${DSA_MAX_ERROR_CHARS};
const IDENTIFIER_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

function clamp(text, maxChars) {
  if (typeof text !== "string") text = String(text);
  if (text.length <= maxChars) return text;
  const suffix = "\\n...[truncated]";
  if (maxChars <= suffix.length) return text.slice(0, maxChars);
  return text.slice(0, maxChars - suffix.length) + suffix;
}

function formatLogArg(arg) {
  if (typeof arg === "string") return arg;
  if (arg === undefined) return "undefined";
  if (arg === null) return "null";
  if (typeof arg === "object") {
    try { return JSON.stringify(arg); } catch { return String(arg); }
  }
  return String(arg);
}

function toCloneableValue(val) {
  if (
    val === undefined ||
    val === null ||
    typeof val === "boolean" ||
    typeof val === "number" ||
    typeof val === "string"
  ) {
    return val;
  }
  if (typeof val === "bigint" || typeof val === "symbol" || typeof val === "function") {
    return String(val);
  }
  try {
    return JSON.parse(JSON.stringify(val));
  } catch {
    return String(val);
  }
}

function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a === "number" && typeof b === "number" && Number.isNaN(a) && Number.isNaN(b)) {
    return true;
  }
  if (a === null || b === null || a === undefined || b === undefined) {
    return a === b;
  }
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    if (a.every((item, i) => deepEqual(item, b[i]))) return true;
    if (a.length > 0 && a.every((x) => Array.isArray(x)) && b.every((x) => Array.isArray(x))) {
      const sortInner = (arr) =>
        [...arr].sort((x, y) =>
          typeof x === "number" && typeof y === "number"
            ? x - y
            : String(x).localeCompare(String(y))
        );
      const sA = a.map((row) => JSON.stringify(sortInner(row))).sort();
      const sB = b.map((row) => JSON.stringify(sortInner(row))).sort();
      return sA.every((val, i) => val === sB[i]);
    }
    return false;
  }
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (typeof a === "object" && typeof b === "object") {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    return keysA.every(
      (k) => Object.prototype.hasOwnProperty.call(b, k) && deepEqual(a[k], b[k])
    );
  }
  return false;
}

function extractEntryFunctionName(code) {
  const fnMatch = code.match(/function\\s+([a-zA-Z0-9_$]+)\\s*\\(/);
  if (fnMatch) return fnMatch[1];
  const arrowMatch = code.match(/(?:const|let|var)\\s+([a-zA-Z0-9_$]+)\\s*=\\s*(?:\\([^)]*\\)|[a-zA-Z0-9_$]+)\\s*=>/);
  if (arrowMatch) return arrowMatch[1];
  return "";
}

self.onmessage = function (e) {
  const payload = e.data || {};
  const runId = payload.runId;
  const sanitizedCode = typeof payload.sanitizedCode === "string" ? payload.sanitizedCode : "";
  const requestedFn = typeof payload.entryFunctionName === "string" ? payload.entryFunctionName.trim() : "";
  const parameterNames = Array.isArray(payload.parameterNames) ? payload.parameterNames : [];
  const testCases = Array.isArray(payload.testCases) ? payload.testCases : [];
  const runStart = performance.now();

  let targetFnName = requestedFn || extractEntryFunctionName(sanitizedCode);
  if (!targetFnName) {
    postWorkerMessage({
      runId,
      summary: {
        status: "Runtime Error",
        passedCount: 0,
        totalCount: testCases.length,
        totalTimeMs: 0,
        results: [],
        errorMessage: "Could not find a valid entry function. Please define a function (e.g. function twoSum(...) { ... }).",
      },
    });
    return;
  }

  if (!IDENTIFIER_RE.test(targetFnName)) {
    postWorkerMessage({
      runId,
      summary: {
        status: "Runtime Error",
        passedCount: 0,
        totalCount: testCases.length,
        totalTimeMs: 0,
        results: [],
        errorMessage: "Invalid entry function name.",
      },
    });
    return;
  }

  let factory;
  try {
    factory = new Function(
      "process",
      "require",
      "module",
      "exports",
      "global",
      "importScripts",
      "window",
      "document",
      "parent",
      "top",
      '"use strict";\\n' +
        sanitizedCode +
        '\\nif (typeof ' + targetFnName + ' !== "function") { throw new Error("Function \\'' + targetFnName + '\\' is not defined."); }' +
        '\\nreturn ' + targetFnName + ';'
    );
  } catch (err) {
    const isSyntax = err && (err.name === "SyntaxError" || String(err).includes("SyntaxError"));
    postWorkerMessage({
      runId,
      summary: {
        status: isSyntax ? "Syntax Error" : "Runtime Error",
        passedCount: 0,
        totalCount: testCases.length,
        totalTimeMs: Math.round((performance.now() - runStart) * 100) / 100,
        results: [],
        errorMessage: clamp(err && err.message ? err.message : String(err), MAX_ERROR_CHARS),
      },
    });
    return;
  }

  let fn;
  try {
    fn = factory(undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined);
  } catch (err) {
    const isSyntax = err && (err.name === "SyntaxError" || String(err).includes("SyntaxError"));
    postWorkerMessage({
      runId,
      summary: {
        status: isSyntax ? "Syntax Error" : "Runtime Error",
        passedCount: 0,
        totalCount: testCases.length,
        totalTimeMs: Math.round((performance.now() - runStart) * 100) / 100,
        results: [],
        errorMessage: clamp(err && err.message ? err.message : String(err), MAX_ERROR_CHARS),
      },
    });
    return;
  }

  const results = [];
  let passedCount = 0;

  const origLog = console.log;
  const origInfo = console.info;
  const origWarn = console.warn;
  const origDebug = console.debug;

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    const logs = [];
    let logChars = 0;
    let truncated = false;

    const capture = function () {
      if (truncated) return;
      const line = Array.prototype.slice.call(arguments).map(formatLogArg).join(" ");
      const marker = "...[stdout truncated]";
      if (logChars + line.length + 1 > MAX_STDOUT_CHARS) {
        const remaining = Math.max(0, MAX_STDOUT_CHARS - logChars - marker.length - 2);
        if (remaining > 0) logs.push(line.slice(0, remaining));
        logs.push(marker);
        truncated = true;
        return;
      }
      logs.push(line);
      logChars += line.length + 1;
    };

    console.log = capture;
    console.info = capture;
    console.warn = capture;
    console.debug = capture;

    const caseStart = performance.now();
    try {
      const args = parameterNames.map((name) => {
        const raw = tc && tc.input ? tc.input[name] : undefined;
        return raw === undefined ? undefined : JSON.parse(JSON.stringify(raw));
      });
      const actual = fn.apply(undefined, args);
      const duration = Math.round((performance.now() - caseStart) * 100) / 100;
      const passed = deepEqual(actual, tc.expected);
      if (passed) passedCount++;
      results.push({
        testCaseId: tc.id,
        passed,
        actual: toCloneableValue(actual),
        expected: tc.expected,
        executionTimeMs: duration,
        stdout: clamp(logs.join("\\n"), MAX_STDOUT_CHARS),
      });
    } catch (err) {
      results.push({
        testCaseId: tc.id,
        passed: false,
        actual: undefined,
        expected: tc.expected,
        executionTimeMs: Math.round((performance.now() - caseStart) * 100) / 100,
        stdout: clamp(logs.join("\\n"), MAX_STDOUT_CHARS),
        error: clamp(err && err.message ? err.message : String(err), MAX_ERROR_CHARS),
      });
    } finally {
      console.log = origLog;
      console.info = origInfo;
      console.warn = origWarn;
      console.debug = origDebug;
    }
  }

  const totalTimeMs = Math.round((performance.now() - runStart) * 100) / 100;
  const hasRuntimeError = results.some((r) => Boolean(r.error));
  const status = hasRuntimeError
    ? "Runtime Error"
    : passedCount === testCases.length
      ? "Accepted"
      : "Wrong Answer";

  postWorkerMessage({
    runId,
    summary: {
      status,
      passedCount,
      totalCount: testCases.length,
      totalTimeMs,
      results,
      errorMessage: hasRuntimeError ? results.find((r) => r.error)?.error : undefined,
    },
  });
};
})();
`;
}

export function buildSandboxSrcdoc(bootstrapToken: string): string {
  if (!SAFE_TOKEN_RE.test(bootstrapToken)) {
    throw new Error('Invalid sandbox bootstrap token');
  }
  const workerSourceLiteral = JSON.stringify(buildSandboxWorkerSource()).replace(/</g, '\\u003c');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${DSA_SANDBOX_CSP}">
</head>
<body>
<script>
(function () {
  "use strict";
  var WORKER_SOURCE = ${workerSourceLiteral};
  var BOOTSTRAP_TOKEN = ${JSON.stringify(bootstrapToken)};
  var started = false;
  var activeWorker = null;
  var activeBlobUrl = null;
  var activePort = null;

  function teardown() {
    if (activeWorker) {
      try { activeWorker.terminate(); } catch (_) {}
      activeWorker = null;
    }
    if (activeBlobUrl) {
      try { URL.revokeObjectURL(activeBlobUrl); } catch (_) {}
      activeBlobUrl = null;
    }
    if (activePort) {
      try { activePort.close(); } catch (_) {}
      activePort = null;
    }
  }

  window.addEventListener("message", function (event) {
    if (event.source !== window.parent) return;
    if (started) return;
    var data = event.data;
    if (!data || data.type !== "dsa:execute" || typeof data.runId !== "string") return;
    var port = event.ports && event.ports[0];
    if (!port) return;

    started = true;
    activePort = port;
    var runId = data.runId;
    var payload = data.payload || {};
    var totalCount = Array.isArray(payload.testCases) ? payload.testCases.length : 0;

    port.onmessage = function (portEvent) {
      var msg = portEvent.data;
      if (msg && msg.type === "dsa:abort" && msg.runId === runId) {
        teardown();
      }
    };

    try {
      var blob = new Blob([WORKER_SOURCE], { type: "application/javascript" });
      activeBlobUrl = URL.createObjectURL(blob);
      activeWorker = new Worker(activeBlobUrl);
    } catch (err) {
      try {
        port.postMessage({
          type: "dsa:result",
          runId: runId,
          summary: {
            status: "Runtime Error",
            passedCount: 0,
            totalCount: totalCount,
            totalTimeMs: 0,
            results: [],
            errorMessage: err && err.message ? err.message : "Failed to start sandbox worker.",
          },
        });
      } catch (_) {}
      teardown();
      return;
    }

    activeWorker.onmessage = function (workerEvent) {
      var msg = workerEvent.data;
      if (!msg || msg.runId !== runId || !msg.summary) return;
      try {
        port.postMessage({
          type: "dsa:result",
          runId: runId,
          summary: msg.summary,
        });
      } catch (_) {}
      teardown();
    };

    activeWorker.onerror = function (err) {
      try {
        port.postMessage({
          type: "dsa:result",
          runId: runId,
          summary: {
            status: "Runtime Error",
            passedCount: 0,
            totalCount: totalCount,
            totalTimeMs: 0,
            results: [],
            errorMessage: (err && err.message) || "Worker execution error",
          },
        });
      } catch (_) {}
      teardown();
    };

    activeWorker.postMessage({
      runId: runId,
      sanitizedCode: payload.sanitizedCode,
      entryFunctionName: payload.entryFunctionName,
      parameterNames: payload.parameterNames,
      testCases: payload.testCases,
    });
  });

  window.parent.postMessage({ type: "dsa:ready", bootstrapToken: BOOTSTRAP_TOKEN }, "*");
})();
</script>
</body>
</html>`;
}

function normalizeSummary(raw: unknown, expectedTotalCount: number): DsaExecutionSummary | null {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = raw as Record<string, unknown>;
  if (typeof candidate.status !== 'string' || !VALID_STATUSES.has(candidate.status as DsaExecutionSummary['status'])) {
    return null;
  }
  if (
    typeof candidate.passedCount !== 'number' ||
    !Number.isFinite(candidate.passedCount) ||
    typeof candidate.totalCount !== 'number' ||
    !Number.isFinite(candidate.totalCount) ||
    typeof candidate.totalTimeMs !== 'number' ||
    !Number.isFinite(candidate.totalTimeMs) ||
    !Array.isArray(candidate.results)
  ) {
    return null;
  }

  const results: DsaTestResult[] = [];
  for (const item of candidate.results) {
    if (!item || typeof item !== 'object') return null;
    const r = item as Record<string, unknown>;
    if (
      typeof r.testCaseId !== 'string' ||
      typeof r.passed !== 'boolean' ||
      typeof r.executionTimeMs !== 'number' ||
      !Number.isFinite(r.executionTimeMs)
    ) {
      return null;
    }
    results.push({
      testCaseId: r.testCaseId,
      passed: r.passed,
      actual: r.actual,
      expected: r.expected,
      executionTimeMs: r.executionTimeMs,
      stdout: clampText(typeof r.stdout === 'string' ? r.stdout : '', DSA_MAX_STDOUT_CHARS),
      ...(typeof r.error === 'string' ? { error: clampText(r.error, DSA_MAX_ERROR_CHARS) } : {}),
    });
  }

  return {
    status: candidate.status as DsaExecutionSummary['status'],
    passedCount: Math.max(0, Math.min(expectedTotalCount, Math.trunc(candidate.passedCount))),
    totalCount: expectedTotalCount,
    totalTimeMs: Math.max(0, candidate.totalTimeMs),
    results,
    ...(typeof candidate.errorMessage === 'string'
      ? { errorMessage: clampText(candidate.errorMessage, DSA_MAX_ERROR_CHARS) }
      : {}),
  };
}

async function runInSandboxedIframe(
  sanitizedCode: string,
  entryFunctionName: string,
  parameterNames: string[],
  testCases: DsaTestCase[],
  timeoutMs: number,
  signal?: AbortSignal
): Promise<DsaExecutionSummary> {
  if (
    typeof window === 'undefined' ||
    typeof document === 'undefined' ||
    typeof MessageChannel === 'undefined'
  ) {
    return unsupportedSummary(testCases.length, 'Browser sandbox is required for DSA execution.');
  }

  if (signal?.aborted) {
    return unsupportedSummary(testCases.length, 'Execution cancelled.');
  }

  const container = document.body || document.documentElement;
  if (!container) {
    return unsupportedSummary(testCases.length, 'Document root is unavailable for DSA sandbox.');
  }

  return new Promise<DsaExecutionSummary>((resolve) => {
    const runId = generateRandomToken();
    const bootstrapToken = generateRandomToken();
    const channel = new MessageChannel();
    const iframe = document.createElement('iframe');
    iframe.setAttribute('sandbox', 'allow-scripts');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.tabIndex = -1;
    iframe.style.display = 'none';
    iframe.srcdoc = buildSandboxSrcdoc(bootstrapToken);

    let settled = false;
    let dispatched = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const cleanup = () => {
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
      window.removeEventListener('message', onWindowMessage);
      iframe.removeEventListener('load', onIframeLoad);
      signal?.removeEventListener('abort', onAbort);
      channel.port1.onmessage = null;
      try {
        channel.port1.close();
      } catch {
        // Ignore already-closed port
      }
      try {
        channel.port2.close();
      } catch {
        // Ignore already-closed port
      }
      try {
        iframe.remove();
      } catch {
        // Ignore detached element
      }
    };

    const finish = (summary: DsaExecutionSummary) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(summary);
    };

    const dispatchExecution = () => {
      if (settled || dispatched) return;
      const targetWindow = iframe.contentWindow;
      if (!targetWindow) {
        finish(unsupportedSummary(testCases.length, 'Sandbox iframe window unavailable.'));
        return;
      }
      dispatched = true;
      targetWindow.postMessage(
        {
          type: 'dsa:execute',
          runId,
          payload: {
            sanitizedCode,
            entryFunctionName,
            parameterNames,
            testCases,
          },
        },
        '*',
        [channel.port2]
      );
    };

    const onWindowMessage = (event: MessageEvent) => {
      if (settled || dispatched) return;
      if (event.source !== iframe.contentWindow) return;
      const data = event.data as Record<string, unknown> | null;
      if (
        data &&
        data.type === 'dsa:ready' &&
        data.bootstrapToken === bootstrapToken
      ) {
        dispatchExecution();
      }
    };

    const onIframeLoad = () => {
      if (!settled && !dispatched) {
        dispatchExecution();
      }
    };

    const onAbort = () => {
      try {
        channel.port1.postMessage({ type: 'dsa:abort', runId });
      } catch {
        // Ignore if channel already closed
      }
      finish(unsupportedSummary(testCases.length, 'Execution cancelled.'));
    };

    channel.port1.onmessage = (event: MessageEvent) => {
      if (settled) return;
      const data = event.data as Record<string, unknown> | null;
      if (!data || data.type !== 'dsa:result' || data.runId !== runId) {
        return;
      }
      const normalized = normalizeSummary(data.summary, testCases.length);
      if (!normalized) {
        finish(unsupportedSummary(testCases.length, 'Received invalid execution summary from sandbox.'));
        return;
      }
      finish(normalized);
    };

    timer = setTimeout(() => {
      try {
        channel.port1.postMessage({ type: 'dsa:abort', runId });
      } catch {
        // Ignore if channel already closed
      }
      finish({
        status: 'Time Limit Exceeded',
        passedCount: 0,
        totalCount: testCases.length,
        totalTimeMs: timeoutMs,
        results: [],
        errorMessage: `Execution timed out after ${timeoutMs}ms (possible infinite loop).`,
      });
    }, timeoutMs);

    window.addEventListener('message', onWindowMessage);
    iframe.addEventListener('load', onIframeLoad);
    signal?.addEventListener('abort', onAbort, { once: true });
    container.appendChild(iframe);
  });
}

/**
 * Main entrypoint for DSA workspace code execution.
 * Runs JavaScript/TypeScript inside an opaque-origin sandboxed iframe + Worker,
 * returning explicit unsupported summaries for Python or non-browser environments.
 */
export async function executeDsaCode(request: {
  problem: DsaProblem;
  language: DsaLanguage;
  code: string;
  timeoutMs?: number;
  signal?: AbortSignal;
}): Promise<DsaExecutionSummary> {
  const { problem, language, code, timeoutMs = 2500, signal } = request;

  if (language === 'python') {
    return unsupportedSummary(
      problem.testCases.length,
      'Python runner requires Python runtime or Pyodide environment.'
    );
  }

  const sanitizedCode = language === 'typescript' ? sanitizeTypeScriptCode(code) : code;

  return runInSandboxedIframe(
    sanitizedCode,
    problem.entryFunctionName,
    problem.parameterNames,
    problem.testCases,
    timeoutMs,
    signal
  );
}
