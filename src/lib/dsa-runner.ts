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

/**
 * Deep equality checker for test case outputs.
 * Supports primitives, arrays (including permuted primitive arrays), and nested objects.
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a === 'number' && typeof b === 'number' && isNaN(a) && isNaN(b)) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null || a === undefined || b === undefined) return a === b;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    const exactMatch = a.every((val, idx) => deepEqual(val, b[idx]));
    if (exactMatch) return true;
    if (
      a.every((x) => typeof x === 'number' || typeof x === 'string') &&
      b.every((x) => typeof x === 'number' || typeof x === 'string')
    ) {
      const sortedA = [...a].sort();
      const sortedB = [...b].sort();
      return sortedA.every((val, idx) => val === sortedB[idx]);
    }
    return false;
  }

  if (typeof a === 'object' && typeof b === 'object') {
    const keysA = Object.keys(a as Record<string, unknown>);
    const keysB = Object.keys(b as Record<string, unknown>);
    if (keysA.length !== keysB.length) return false;
    for (const key of keysA) {
      if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
      if (!deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])) {
        return false;
      }
    }
    return true;
  }

  return false;
}

/**
 * Strips basic TypeScript type annotations so code can run directly in JS engines.
 */
export function sanitizeTypeScriptCode(code: string): string {
  let cleaned = code;
  cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');
  cleaned = cleaned.replace(/(^|[^:])\/\/.*$/gm, '$1');
  cleaned = cleaned.replace(/^\s*(import|export)\s+.*$/gm, '');
  cleaned = cleaned.replace(/^\s*(?:type|interface)\s+[A-Za-z0-9_$]+[\s\S]*?(?:;|\})\s*$/gm, '');
  cleaned = cleaned.replace(/\s+as\s+[A-Za-z0-9_<>\[\]| ]+/g, '');
  cleaned = cleaned.replace(/([a-zA-Z0-9_\]\)])!(?=[,\s\.;\)=])/g, '$1');
  cleaned = cleaned.replace(/\)\s*:\s*[A-Za-z0-9_<>\[\]|,\s]+(\s*\{|\s*=>)/g, ')$1');
  cleaned = cleaned.replace(/<[A-Za-z0-9_\[\],\s|]+>/g, '');
  cleaned = cleaned.replace(/((?:let|const|var)\s+[a-zA-Z0-9_$]+)\s*:\s*[A-Za-z0-9_\[\]| ]+\s*=/g, '$1 =');
  cleaned = cleaned.replace(/:\s*([A-Za-z0-9_\[\]| ]+)(?=[,)=])/g, '');
  return cleaned;
}

function getNodeModule<T = unknown>(name: string): T | null {
  if (typeof window !== 'undefined') return null;
  try {
    const customReq = (globalThis as unknown as { __non_webpack_require__?: (mod: string) => unknown }).__non_webpack_require__;
    const req = typeof customReq === 'function' ? customReq : eval('require');
    return req(name) as T;
  } catch {
    return null;
  }
}

/**
 * Executes JS/TS code inside an isolated inline Web Worker (browser) with hard timeout termination.
 */
function runInBrowserWorker(
  sanitizedCode: string,
  entryFunctionName: string,
  parameterNames: string[],
  testCases: DsaTestCase[],
  timeoutMs: number
): Promise<DsaExecutionSummary> {
  return new Promise((resolve) => {
    const workerScript = `
      self.onmessage = function(e) {
        const { code, entryFunctionName, parameterNames, testCases } = e.data;
        const results = [];
        let passedCount = 0;
        let hasRuntimeError = false;
        let runtimeErrorMessage = null;

        let logs = [];
        const customConsole = {
          log: (...args) => logs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')),
          info: (...args) => logs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')),
          warn: (...args) => logs.push('[warn] ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')),
          error: (...args) => logs.push('[error] ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '))
        };

        function deepEqual(a, b) {
          if (a === b) return true;
          if (typeof a === 'number' && typeof b === 'number' && isNaN(a) && isNaN(b)) return true;
          if (typeof a !== typeof b) return false;
          if (a === null || b === null || a === undefined || b === undefined) return a === b;
          if (Array.isArray(a) && Array.isArray(b)) {
            if (a.length !== b.length) return false;
            const exact = a.every((v, i) => deepEqual(v, b[i]));
            if (exact) return true;
            if (a.every(x => typeof x === 'number' || typeof x === 'string') &&
                b.every(x => typeof x === 'number' || typeof x === 'string')) {
              const sa = [...a].sort();
              const sb = [...b].sort();
              return sa.every((v, i) => v === sb[i]);
            }
            return false;
          }
          if (typeof a === 'object' && typeof b === 'object') {
            const ka = Object.keys(a);
            const kb = Object.keys(b);
            if (ka.length !== kb.length) return false;
            for (const k of ka) {
              if (!Object.prototype.hasOwnProperty.call(b, k)) return false;
              if (!deepEqual(a[k], b[k])) return false;
            }
            return true;
          }
          return false;
        }

        try {
          const fnFactory = new Function('console', '"use strict"; ' + code + '; return (typeof ' + entryFunctionName + ' === "function" ? ' + entryFunctionName + ' : null);');
          const targetFn = fnFactory(customConsole);
          if (!targetFn) {
            self.postMessage({
              status: 'Runtime Error',
              passedCount: 0,
              totalCount: testCases.length,
              totalTimeMs: 0,
              results: [],
              errorMessage: "Function '" + entryFunctionName + "' is not defined."
            });
            return;
          }

          const startTotal = Date.now();
          for (const tc of testCases) {
            logs = [];
            const caseStart = Date.now();
            const args = parameterNames.map(p => {
              const val = tc.input[p];
              return val !== undefined ? JSON.parse(JSON.stringify(val)) : undefined;
            });

            try {
              const actual = targetFn(...args);
              const duration = Date.now() - caseStart;
              const passed = deepEqual(actual, tc.expected);
              if (passed) passedCount++;

              results.push({
                testCaseId: tc.id,
                passed,
                actual,
                expected: tc.expected,
                executionTimeMs: duration,
                stdout: logs.join('\\n')
              });
            } catch (err) {
              hasRuntimeError = true;
              runtimeErrorMessage = err && err.message ? err.message : String(err);
              results.push({
                testCaseId: tc.id,
                passed: false,
                actual: 'Runtime Error',
                expected: tc.expected,
                executionTimeMs: Date.now() - caseStart,
                stdout: logs.join('\\n'),
                error: runtimeErrorMessage
              });
            }
          }

          const totalTimeMs = Date.now() - startTotal;
          let status = 'Accepted';
          if (hasRuntimeError) {
            status = 'Runtime Error';
          } else if (passedCount !== testCases.length) {
            status = 'Wrong Answer';
          }

          self.postMessage({
            status,
            passedCount,
            totalCount: testCases.length,
            totalTimeMs,
            results,
            errorMessage: runtimeErrorMessage || undefined
          });
        } catch (err) {
          const isSyntax = err instanceof SyntaxError || (err && err.name === 'SyntaxError');
          self.postMessage({
            status: isSyntax ? 'Syntax Error' : 'Runtime Error',
            passedCount: 0,
            totalCount: testCases.length,
            totalTimeMs: 0,
            results: [],
            errorMessage: err && err.message ? err.message : String(err)
          });
        }
      };
    `;

    let settled = false;
    const blob = new Blob([workerScript], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    const worker = new Worker(url);

    const cleanup = () => {
      URL.revokeObjectURL(url);
      worker.terminate();
    };

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve({
        status: 'Time Limit Exceeded',
        passedCount: 0,
        totalCount: testCases.length,
        totalTimeMs: timeoutMs,
        results: testCases.map((tc) => ({
          testCaseId: tc.id,
          passed: false,
          actual: 'Time Limit Exceeded',
          expected: tc.expected,
          executionTimeMs: timeoutMs,
          stdout: '',
          error: `Execution timed out after ${timeoutMs}ms.`,
        })),
        errorMessage: `Execution timed out after ${timeoutMs}ms.`,
      });
    }, timeoutMs);

    worker.onmessage = (e: MessageEvent<DsaExecutionSummary>) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      cleanup();
      resolve(e.data);
    };

    worker.onerror = (e: ErrorEvent) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      cleanup();
      resolve({
        status: 'Runtime Error',
        passedCount: 0,
        totalCount: testCases.length,
        totalTimeMs: 0,
        results: [],
        errorMessage: e.message || 'Worker execution error',
      });
    };

    worker.postMessage({
      code: sanitizedCode,
      entryFunctionName,
      parameterNames,
      testCases,
    });
  });
}

/**
 * Executes JS/TS code inside Node.js VM context with timeout guard.
 */
function runInNodeVm(
  sanitizedCode: string,
  entryFunctionName: string,
  parameterNames: string[],
  testCases: DsaTestCase[],
  timeoutMs: number
): DsaExecutionSummary {
  const startTime = Date.now();
  const vm: any = getNodeModule('node:vm');
  if (!vm) {
    throw new Error('Node vm module unavailable');
  }

  // Pre-compile script to catch syntax errors
  let script: any;
  try {
    script = new vm.Script(sanitizedCode, { filename: 'user_code.js' });
  } catch (err: any) {
    return {
      status: 'Syntax Error',
      passedCount: 0,
      totalCount: testCases.length,
      totalTimeMs: 0,
      results: [],
      errorMessage: err?.message || String(err),
    };
  }

  let currentLogs: string[] = [];
  const customConsole = {
    log: (...args: unknown[]) => {
      currentLogs.push(args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '));
    },
    info: (...args: unknown[]) => {
      currentLogs.push(args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '));
    },
    warn: (...args: unknown[]) => {
      currentLogs.push('[warn] ' + args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '));
    },
    error: (...args: unknown[]) => {
      currentLogs.push('[error] ' + args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '));
    },
  };

  const sandbox: Record<string, any> = {
    console: customConsole,
    Math,
    Date,
    Array,
    Object,
    String,
    Number,
    Boolean,
    Set,
    Map,
    RegExp,
    JSON,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
  };

  const context = vm.createContext(sandbox);

  try {
    script.runInContext(context, { timeout: timeoutMs });
  } catch (err: any) {
    const isTimeout =
      err?.code === 'ERR_SCRIPT_EXECUTION_TIMEOUT' ||
      (err?.message && err.message.toLowerCase().includes('timed out'));
    return {
      status: isTimeout ? 'Time Limit Exceeded' : 'Runtime Error',
      passedCount: 0,
      totalCount: testCases.length,
      totalTimeMs: Date.now() - startTime,
      results: [],
      errorMessage: err?.message || String(err),
    };
  }

  const targetFn = sandbox[entryFunctionName];
  if (typeof targetFn !== 'function') {
    return {
      status: 'Runtime Error',
      passedCount: 0,
      totalCount: testCases.length,
      totalTimeMs: Date.now() - startTime,
      results: [],
      errorMessage: `Function '${entryFunctionName}' is not defined.`,
    };
  }

  const results: DsaTestResult[] = [];
  let passedCount = 0;
  let hasTimeout = false;
  let runtimeErrorMessage: string | undefined;

  for (const tc of testCases) {
    currentLogs = [];
    const caseStart = Date.now();
    const args = parameterNames.map((param) => {
      const val = tc.input[param];
      return val !== undefined ? JSON.parse(JSON.stringify(val)) : undefined;
    });

    try {
      const caseCode = `__targetFn__(...__args__)`;
      const caseContext = vm.createContext({
        __targetFn__: targetFn,
        __args__: args,
        console: customConsole,
        Math,
        Date,
        Array,
        Object,
        String,
        Number,
        Boolean,
        Set,
        Map,
        RegExp,
        JSON,
        parseInt,
        parseFloat,
        isNaN,
        isFinite,
      });

      const caseScript = new vm.Script(caseCode);
      const actual = caseScript.runInContext(caseContext, { timeout: timeoutMs });
      const duration = Date.now() - caseStart;
      const passed = deepEqual(actual, tc.expected);
      if (passed) passedCount++;

      results.push({
        testCaseId: tc.id,
        passed,
        actual,
        expected: tc.expected,
        executionTimeMs: duration,
        stdout: currentLogs.join('\n'),
      });
    } catch (err: any) {
      const duration = Date.now() - caseStart;
      const isTimeout =
        err?.code === 'ERR_SCRIPT_EXECUTION_TIMEOUT' ||
        (err?.message && err.message.toLowerCase().includes('timed out'));

      if (isTimeout) {
        hasTimeout = true;
        results.push({
          testCaseId: tc.id,
          passed: false,
          actual: 'Time Limit Exceeded',
          expected: tc.expected,
          executionTimeMs: duration,
          stdout: currentLogs.join('\n'),
          error: 'Time limit exceeded',
        });
        break;
      } else {
        runtimeErrorMessage = err?.message || String(err);
        results.push({
          testCaseId: tc.id,
          passed: false,
          actual: 'Runtime Error',
          expected: tc.expected,
          executionTimeMs: duration,
          stdout: currentLogs.join('\n'),
          error: runtimeErrorMessage,
        });
      }
    }
  }

  const totalTimeMs = Date.now() - startTime;
  let status: DsaExecutionSummary['status'] = 'Accepted';
  if (hasTimeout) {
    status = 'Time Limit Exceeded';
  } else if (results.some((r) => r.error)) {
    status = 'Runtime Error';
  } else if (passedCount !== testCases.length) {
    status = 'Wrong Answer';
  }

  return {
    status,
    passedCount,
    totalCount: testCases.length,
    totalTimeMs,
    results,
    errorMessage: hasTimeout ? `Execution timed out after ${timeoutMs}ms.` : runtimeErrorMessage,
  };
}

/**
 * Executes Python code via system Python in Node/Vitest environments.
 */
async function runPythonCode(
  code: string,
  entryFunctionName: string,
  parameterNames: string[],
  testCases: DsaTestCase[],
  timeoutMs: number
): Promise<DsaExecutionSummary> {
  const cp: any = getNodeModule('node:child_process');
  if (!cp) {
    // If running in browser without Pyodide worker, return clean unsupported summary
    return {
      status: 'Runtime Error',
      passedCount: 0,
      totalCount: testCases.length,
      totalTimeMs: 0,
      results: [],
      errorMessage: 'Python runner requires Python runtime or Pyodide environment.',
    };
  }

  const harnessScript = `
import sys, json, time, io

${code}

test_cases = json.loads(${JSON.stringify(JSON.stringify(testCases))})
param_names = json.loads(${JSON.stringify(JSON.stringify(parameterNames))})
entry_name = ${JSON.stringify(entryFunctionName)}

fn = globals().get(entry_name)
if not callable(fn):
    print("ENTRY_NOT_FOUND:" + entry_name)
    sys.exit(0)

results = []
passed_count = 0
total_start = time.perf_counter()

for tc in test_cases:
    t_id = tc["id"]
    t_input = tc["input"]
    expected = tc["expected"]
    args = [t_input.get(p) for p in param_names]
    
    old_stdout = sys.stdout
    buf = io.StringIO()
    sys.stdout = buf
    start_t = time.perf_counter()
    passed = False
    actual = None
    err_str = None
    
    try:
        actual = fn(*args)
        duration_ms = (time.perf_counter() - start_t) * 1000
        passed = (actual == expected)
        if not passed and isinstance(actual, (list, tuple)) and isinstance(expected, (list, tuple)):
            try:
                passed = sorted(actual) == sorted(expected)
            except Exception:
                pass
    except Exception as e:
        duration_ms = (time.perf_counter() - start_t) * 1000
        err_str = str(e)
    finally:
        sys.stdout = old_stdout
        
    if passed:
        passed_count += 1
        
    results.append({
        "testCaseId": t_id,
        "passed": passed,
        "actual": actual if err_str is None else "Runtime Error",
        "expected": expected,
        "executionTimeMs": round(duration_ms, 2),
        "stdout": buf.getvalue(),
        "error": err_str
    })

print("---DSA_RESULT_START---")
print(json.dumps({
    "passedCount": passed_count,
    "totalTimeMs": round((time.perf_counter() - total_start) * 1000, 2),
    "results": results
}))
`;

  // Try python, python3, or py
  const commands = ['python', 'python3', 'py'];
  let proc: any = null;

  for (const cmd of commands) {
    try {
      proc = cp.spawnSync(cmd, ['-'], {
        input: harnessScript,
        encoding: 'utf8',
        timeout: timeoutMs,
      });
      if (proc && !proc.error) break;
      if (proc?.error?.code === 'ETIMEDOUT') break;
    } catch {
      // try next
    }
  }

  if (!proc) {
    return {
      status: 'Runtime Error',
      passedCount: 0,
      totalCount: testCases.length,
      totalTimeMs: 0,
      results: [],
      errorMessage: 'Could not find a Python runtime executable (python, python3, py).',
    };
  }

  if (proc.error?.code === 'ETIMEDOUT' || proc.signal === 'SIGTERM') {
    return {
      status: 'Time Limit Exceeded',
      passedCount: 0,
      totalCount: testCases.length,
      totalTimeMs: timeoutMs,
      results: testCases.map((tc) => ({
        testCaseId: tc.id,
        passed: false,
        actual: 'Time Limit Exceeded',
        expected: tc.expected,
        executionTimeMs: timeoutMs,
        stdout: '',
        error: `Execution timed out after ${timeoutMs}ms.`,
      })),
      errorMessage: `Execution timed out after ${timeoutMs}ms.`,
    };
  }

  if (proc.status !== 0 && proc.stderr) {
    const isSyntax = proc.stderr.includes('SyntaxError');
    return {
      status: isSyntax ? 'Syntax Error' : 'Runtime Error',
      passedCount: 0,
      totalCount: testCases.length,
      totalTimeMs: 0,
      results: [],
      errorMessage: proc.stderr.trim(),
    };
  }

  const stdout = proc.stdout || '';
  if (stdout.includes('ENTRY_NOT_FOUND:')) {
    return {
      status: 'Runtime Error',
      passedCount: 0,
      totalCount: testCases.length,
      totalTimeMs: 0,
      results: [],
      errorMessage: `Function '${entryFunctionName}' is not defined.`,
    };
  }

  const marker = '---DSA_RESULT_START---';
  const markerIdx = stdout.indexOf(marker);
  if (markerIdx === -1) {
    return {
      status: 'Runtime Error',
      passedCount: 0,
      totalCount: testCases.length,
      totalTimeMs: 0,
      results: [],
      errorMessage: proc.stderr || stdout || 'Unknown Python execution error',
    };
  }

  try {
    const payload = JSON.parse(stdout.slice(markerIdx + marker.length).trim());
    const results: DsaTestResult[] = payload.results || [];
    const passedCount = payload.passedCount ?? 0;
    const totalTimeMs = payload.totalTimeMs ?? 0;

    let status: DsaExecutionSummary['status'] = 'Accepted';
    if (results.some((r) => r.error)) {
      status = 'Runtime Error';
    } else if (passedCount !== testCases.length) {
      status = 'Wrong Answer';
    }

    return {
      status,
      passedCount,
      totalCount: testCases.length,
      totalTimeMs,
      results,
    };
  } catch (err: any) {
    return {
      status: 'Runtime Error',
      passedCount: 0,
      totalCount: testCases.length,
      totalTimeMs: 0,
      results: [],
      errorMessage: `Failed to parse Python test output: ${err.message}`,
    };
  }
}

/**
 * Universal DSA code execution engine.
 * Supports JavaScript, TypeScript, and Python with sandboxing, timeout guards, and captured stdout.
 */
export async function executeDsaCode(request: {
  problem: DsaProblem;
  language: DsaLanguage;
  code: string;
  timeoutMs?: number;
}): Promise<DsaExecutionSummary> {
  const timeoutMs = request.timeoutMs ?? 2000;
  const { problem, language, code } = request;

  if (language === 'python') {
    return runPythonCode(code, problem.entryFunctionName, problem.parameterNames, problem.testCases, timeoutMs);
  }

  const sanitized = sanitizeTypeScriptCode(code);

  const canUseBrowserWorker = typeof window !== 'undefined' && typeof Worker !== 'undefined';
  if (canUseBrowserWorker) {
    return runInBrowserWorker(sanitized, problem.entryFunctionName, problem.parameterNames, problem.testCases, timeoutMs);
  }

  return Promise.resolve(runInNodeVm(sanitized, problem.entryFunctionName, problem.parameterNames, problem.testCases, timeoutMs));
}
