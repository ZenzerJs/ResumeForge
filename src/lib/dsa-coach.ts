import type { DsaProblem, DsaLanguage } from './dsa-problems';
import type { DsaExecutionSummary } from './dsa-runner';
import { getActiveConfig, resolveClientProviderConfig } from './byok-vault';
import { callByokModel } from './ai-provider';

export type DsaInterviewStage =
  | 'CLARIFICATION'
  | 'APPROACH'
  | 'CODING'
  | 'OPTIMIZATION'
  | 'SCORECARD';

export interface DsaChatMessage {
  role: 'user' | 'assistant';
  content: string;
  stage: DsaInterviewStage;
  timestamp: string;
}

export interface DsaComplexityAudit {
  detectedTimeComplexity: string;
  detectedSpaceComplexity: string;
  optimalTimeComplexity: string;
  optimalSpaceComplexity: string;
  isTimeOptimal: boolean;
  isSpaceOptimal: boolean;
  missedEdgeCases: string[];
  readabilityScore: number;
  actionableFeedback: string;
}

export interface DsaScorecard {
  overallScore: number;
  grade: 'S' | 'A' | 'B' | 'C' | 'D';
  passedTestsRatio: string;
  hintsUsed: number;
  hintPenalty: number;
  complexityAudit: DsaComplexityAudit;
  strengths: string[];
  growthAreas: string[];
  mode: 'byok' | 'heuristic';
}

const REDACTED_CODE_MESSAGE =
  '[Code redacted by Socratic Guardrail — focus on the invariant and approach!]';

/**
 * Strips fenced multi-line code blocks from coach responses in active interview stages.
 * Code blocks are only preserved in the final SCORECARD stage.
 */
export function sanitizeSocraticResponse(text: string, stage: DsaInterviewStage): string {
  if (stage === 'SCORECARD') {
    return text;
  }
  return text.replace(/```[\s\S]*?```/g, REDACTED_CODE_MESSAGE);
}

function stripCommentsAndStrings(code: string): string {
  let cleaned = code.replace(/\/\*[\s\S]*?\*\//g, '');
  cleaned = cleaned.replace(/(^|[^:])\/\/.*$/gm, '$1');
  cleaned = cleaned.replace(/#.*$/gm, '');
  cleaned = cleaned.replace(/(["'`])(?:\\.|[^\\])*?\1/g, '""');
  return cleaned;
}

function computeLoopNestingDepth(code: string): number {
  const clean = stripCommentsAndStrings(code);
  let maxDepth = 0;

  // Check if Python code
  const isPython = /def\s+[a-zA-Z0-9_]+\s*\(/.test(clean) && !clean.includes('{');

  if (isPython) {
    const lines = clean.split('\n');
    const loopIndents: number[] = [];
    for (const line of lines) {
      if (!line.trim()) continue;
      const indent = line.search(/\S/);
      while (loopIndents.length > 0 && indent <= loopIndents[loopIndents.length - 1]) {
        loopIndents.pop();
      }
      if (/^\s*(?:for\s+[a-zA-Z0-9_,\s]+\s+in\b|while\b)/.test(line)) {
        loopIndents.push(indent);
        if (loopIndents.length > maxDepth) {
          maxDepth = loopIndents.length;
        }
      }
    }
    return maxDepth;
  }

  // JS/TS brace & loop tracking
  let braceDepth = 0;
  const activeLoops: number[] = [];
  const tokens = clean.match(/\bfor\s*\(|\bwhile\s*\(|\.(?:forEach|map|filter|reduce)\s*\(|\{|\}/g) || [];
  let pendingLoop = false;

  for (const token of tokens) {
    if (token === '{') {
      braceDepth++;
      if (pendingLoop) {
        activeLoops.push(braceDepth);
        if (activeLoops.length > maxDepth) {
          maxDepth = activeLoops.length;
        }
        pendingLoop = false;
      }
    } else if (token === '}') {
      while (activeLoops.length > 0 && activeLoops[activeLoops.length - 1] >= braceDepth) {
        activeLoops.pop();
      }
      braceDepth = Math.max(0, braceDepth - 1);
    } else {
      pendingLoop = true;
      if (activeLoops.length + 1 > maxDepth) {
        maxDepth = activeLoops.length + 1;
      }
    }
  }

  // Direct regex pattern fallback for nested loops
  if (maxDepth < 2) {
    if (
      /for\s*\([^)]*\)[\s\S]*?for\s*\([^)]*\)/.test(clean) ||
      /while\s*\([^)]*\)[\s\S]*?while\s*\([^)]*\)/.test(clean) ||
      /for\s*\([^)]*\)[\s\S]*?while\s*\([^)]*\)/.test(clean)
    ) {
      maxDepth = 2;
    }
  }

  return maxDepth;
}

function computeReadabilityScore(code: string): number {
  if (!code || code.trim().length === 0) return 5;
  const clean = stripCommentsAndStrings(code);
  let score = 20;

  // Penalize uninformative single-letter variable declarations outside idiomatic loop variables
  const singleLetters = clean.match(/\b(?:let|const|var)\s+([a-zA-Z])\b/g) || [];
  const allowed = new Set([
    'let i', 'let j', 'let k', 'let n', 'let m', 'let s',
    'const i', 'const j', 'const k', 'const n', 'const m', 'const s',
  ]);
  const badSingles = singleLetters.filter((v) => !allowed.has(v));
  if (badSingles.length > 1) {
    score -= Math.min(6, badSingles.length * 2);
  }

  // Long lines (> 110 chars)
  const lines = code.split('\n');
  const longLines = lines.filter((l) => l.length > 110).length;
  if (longLines > 0) {
    score -= Math.min(4, longLines);
  }

  // Extremely short or empty implementation
  if (lines.filter((l) => l.trim().length > 0).length < 3) {
    score -= 4;
  }

  return Math.max(5, Math.min(20, score));
}

function detectSpaceComplexity(cleanCode: string, problem: DsaProblem): string {
  const hasMapOrSet = /\bnew\s+(?:Map|Set)\b|\bdict\(|\bset\(|\bdefaultdict\(|\bCounter\(/.test(cleanCode);
  const hasObjectHash =
    /(?:const|let|var)\s+[a-zA-Z0-9_$]+\s*[:\w\s]*=\s*\{(?:\s*\})?|\b[a-zA-Z0-9_$]+\s*=\s*\{\}/.test(cleanCode);
  const hasArrayAlloc = /\bnew\s+Array\b|Array\.from\b|\.slice\(\)|\.concat\(/i.test(cleanCode);
  const hasStackOrQueue =
    /(?:const|let|var)\s+(?:stack|queue|seen|visited|memo|dp)\s*[:\w\s]*=\s*\[|\b(?:stack|queue|seen|visited|memo|dp)\s*=\s*\[/i.test(
      cleanCode
    );
  const hasPushOrAppend = /\.(?:push|append|unshift)\(/.test(cleanCode);

  if (hasMapOrSet || hasObjectHash || hasStackOrQueue || (hasArrayAlloc && hasPushOrAppend)) {
    if (problem.optimalSpaceComplexity === 'O(min(n, m))') return 'O(min(n, m))';
    if (problem.optimalSpaceComplexity === 'O(amount)') return 'O(amount)';
    if (problem.optimalSpaceComplexity === 'O(m * n)') return 'O(m * n)';
    return 'O(n)';
  }

  return 'O(1)';
}

function detectMissedEdgeCases(
  problem: DsaProblem,
  code: string,
  execution?: DsaExecutionSummary
): string[] {
  const missed: string[] = [];
  const clean = stripCommentsAndStrings(code);

  if (execution && execution.results && execution.results.length > 0) {
    const failedResults = execution.results.filter((r) => !r.passed);
    for (const failed of failedResults) {
      const tc = problem.testCases.find((t) => t.id === failed.testCaseId);
      if (!tc) continue;

      for (const [, val] of Object.entries(tc.input)) {
        if (Array.isArray(val) && val.length === 0) {
          if (!missed.includes('Empty array input ([])')) {
            missed.push('Empty array input ([])');
          }
        } else if (typeof val === 'string' && val.length === 0) {
          if (!missed.includes('Empty string input ("")')) {
            missed.push('Empty string input ("")');
          }
        } else if (Array.isArray(val) && val.length === 1) {
          if (!missed.includes('Single-element array input')) {
            missed.push('Single-element array input');
          }
        } else if (typeof val === 'number' && val <= 0) {
          if (!missed.includes('Zero or negative numerical boundary')) {
            missed.push('Zero or negative numerical boundary');
          }
        } else if (Array.isArray(val) && val.some((x) => typeof x === 'number' && x < 0)) {
          if (!missed.includes('Negative values in array')) {
            missed.push('Negative values in array');
          }
        }
      }

      if (failed.error && failed.error.toLowerCase().includes('timed out')) {
        if (!missed.includes('Performance on large scale inputs (Time Limit Exceeded)')) {
          missed.push('Performance on large scale inputs (Time Limit Exceeded)');
        }
      }
    }
  }

  // Heuristic boundary check if tests passed but common boundary guards are absent
  if (missed.length === 0 && (!execution || execution.status === 'Accepted')) {
    const allowsEmpty = problem.constraints.some((c) => c.includes('0 <=') || c.toLowerCase().includes('empty'));
    const hasEmptyGuard = /length\s*===?\s*0|!s\b|!\w+\.length|\bif\s*\(![a-zA-Z0-9_$]+\)/.test(clean);
    if (allowsEmpty && !hasEmptyGuard && problem.difficulty !== 'Easy') {
      missed.push('Explicit guard for zero-length / empty boundary inputs');
    }
  }

  return missed;
}

const TIME_COMPLEXITY_RANK: Record<string, number> = {
  'o(1)': 1,
  'o(log n)': 2,
  'o(n)': 3,
  'o(min(n, m))': 3,
  'o(n log k)': 4,
  'o(n log n)': 5,
  'o(m * n)': 5,
  'o(amount * len(coins))': 5,
  'o(n^2)': 6,
  'o(2^n)': 7,
};

const SPACE_COMPLEXITY_RANK: Record<string, number> = {
  'o(1)': 1,
  'o(log n)': 2,
  'o(min(n, m))': 3,
  'o(n)': 3,
  'o(amount)': 3,
  'o(m * n)': 4,
  'o(n^2)': 5,
};

/**
 * Deterministically analyzes code for loop nesting, sorting, data structure allocation,
 * and edge-case coverage against target problem bounds.
 */
export function analyzeComplexityHeuristically(
  problem: DsaProblem,
  code: string,
  execution?: DsaExecutionSummary
): DsaComplexityAudit {
  const clean = stripCommentsAndStrings(code);
  const loopNesting = computeLoopNestingDepth(code);
  const hasSort = /\.sort\(|sorted\(|\.sort_values\(/i.test(clean);

  // Time complexity detection
  let detectedTime = 'O(n)';
  if (loopNesting >= 2) {
    if (problem.optimalTimeComplexity.includes('m * n') || problem.optimalTimeComplexity.includes('len(coins)')) {
      detectedTime = problem.optimalTimeComplexity;
    } else {
      detectedTime = 'O(n^2)';
    }
  } else if (hasSort) {
    detectedTime = 'O(n log n)';
  } else if (loopNesting === 1) {
    detectedTime = 'O(n)';
  } else if (loopNesting === 0) {
    detectedTime = problem.optimalTimeComplexity === 'O(1)' ? 'O(1)' : 'O(n)';
  }

  // Space complexity detection
  const detectedSpace = detectSpaceComplexity(clean, problem);

  // Optimality evaluations
  const targetTimeNorm = problem.optimalTimeComplexity.trim().toLowerCase();
  const targetSpaceNorm = problem.optimalSpaceComplexity.trim().toLowerCase();
  const detectedTimeNorm = detectedTime.trim().toLowerCase();
  const detectedSpaceNorm = detectedSpace.trim().toLowerCase();

  const detectedTimeRank = TIME_COMPLEXITY_RANK[detectedTimeNorm] ?? 5;
  const targetTimeRank = TIME_COMPLEXITY_RANK[targetTimeNorm] ?? 5;
  const isTimeOptimal = detectedTimeRank <= targetTimeRank;

  const detectedSpaceRank = SPACE_COMPLEXITY_RANK[detectedSpaceNorm] ?? 3;
  const targetSpaceRank = SPACE_COMPLEXITY_RANK[targetSpaceNorm] ?? 3;
  const isSpaceOptimal = detectedSpaceRank <= targetSpaceRank;

  const missedEdgeCases = detectMissedEdgeCases(problem, code, execution);
  const readabilityScore = computeReadabilityScore(code);

  let actionableFeedback = '';
  if (isTimeOptimal && isSpaceOptimal && (!execution || execution.status === 'Accepted')) {
    actionableFeedback = `Optimal runtime (${detectedTime}) and auxiliary space (${detectedSpace}) achieved. Solution aligns with target algorithmic bounds.`;
  } else if (!isTimeOptimal) {
    actionableFeedback = `Detected time complexity is ${detectedTime}, which is sub-optimal compared to target ${problem.optimalTimeComplexity}. Aim to eliminate redundant passes.`;
  } else if (!isSpaceOptimal) {
    actionableFeedback = `Detected auxiliary space is ${detectedSpace}, exceeding the target bound of ${problem.optimalSpaceComplexity}. Consider in-place mutations or pointer reuse.`;
  } else {
    actionableFeedback = `Address failing edge cases: ${missedEdgeCases.join(', ') || 'review logic invariants'}.`;
  }

  return {
    detectedTimeComplexity: detectedTime,
    detectedSpaceComplexity: detectedSpace,
    optimalTimeComplexity: problem.optimalTimeComplexity,
    optimalSpaceComplexity: problem.optimalSpaceComplexity,
    isTimeOptimal,
    isSpaceOptimal,
    missedEdgeCases,
    readabilityScore,
    actionableFeedback,
  };
}

/**
 * Audits a candidate's DSA submission using BYOK if available, falling back to
 * the deterministic complexity auditor. Computes test pass ratio, complexity optimality,
 * hint penalty deductions, and letter grade.
 */
export async function auditDsaSubmission(params: {
  problem: DsaProblem;
  language: DsaLanguage;
  code: string;
  execution: DsaExecutionSummary;
  hintsUsed: number;
}): Promise<DsaScorecard> {
  const { problem, language, code, execution, hintsUsed } = params;
  const heuristicAudit = analyzeComplexityHeuristically(problem, code, execution);

  let complexityAudit: DsaComplexityAudit = heuristicAudit;
  let strengths: string[] = [];
  let growthAreas: string[] = [];
  let mode: 'byok' | 'heuristic' = 'heuristic';

  try {
    const clientConfig = await resolveClientProviderConfig();
    const config = await getActiveConfig();
    if (clientConfig || config.hasKey) {
      const systemPrompt = `You are a Staff-Engineer Socratic DSA Interviewer and Complexity Auditor.
Evaluate the candidate's code for "${problem.title}".
Return a JSON object with:
{
  "detectedTimeComplexity": string,
  "detectedSpaceComplexity": string,
  "isTimeOptimal": boolean,
  "isSpaceOptimal": boolean,
  "missedEdgeCases": string[],
  "readabilityScore": number (5-20),
  "actionableFeedback": string,
  "strengths": string[],
  "growthAreas": string[]
}`;

      const prompt = `Problem: ${problem.title} (${problem.difficulty})
Target Time: ${problem.optimalTimeComplexity}
Target Space: ${problem.optimalSpaceComplexity}
Language: ${language}
Tests: ${execution.passedCount}/${execution.totalCount} passed (${execution.status})
Hints Used: ${hintsUsed}

Candidate Code:
\`\`\`${language}
${code}
\`\`\``;

      const response = await callByokModel<{
        detectedTimeComplexity?: string;
        detectedSpaceComplexity?: string;
        isTimeOptimal?: boolean;
        isSpaceOptimal?: boolean;
        missedEdgeCases?: string[];
        readabilityScore?: number;
        actionableFeedback?: string;
        strengths?: string[];
        growthAreas?: string[];
      }>({
        systemPrompt,
        prompt,
        json: true,
        temperature: 0.1,
      });

      if (response.data && typeof response.data === 'object') {
        const d = response.data;
        if (d.detectedTimeComplexity && d.detectedSpaceComplexity) {
          complexityAudit = {
            detectedTimeComplexity: String(d.detectedTimeComplexity),
            detectedSpaceComplexity: String(d.detectedSpaceComplexity),
            optimalTimeComplexity: problem.optimalTimeComplexity,
            optimalSpaceComplexity: problem.optimalSpaceComplexity,
            isTimeOptimal: Boolean(d.isTimeOptimal),
            isSpaceOptimal: Boolean(d.isSpaceOptimal),
            missedEdgeCases: Array.isArray(d.missedEdgeCases)
              ? d.missedEdgeCases.map(String)
              : heuristicAudit.missedEdgeCases,
            readabilityScore:
              typeof d.readabilityScore === 'number'
                ? Math.max(5, Math.min(20, d.readabilityScore))
                : heuristicAudit.readabilityScore,
            actionableFeedback: d.actionableFeedback
              ? String(d.actionableFeedback)
              : heuristicAudit.actionableFeedback,
          };
          strengths = Array.isArray(d.strengths) ? d.strengths.map(String) : [];
          growthAreas = Array.isArray(d.growthAreas) ? d.growthAreas.map(String) : [];
          mode = 'byok';
        }
      }
    }
  } catch {
    // Graceful fallback to deterministic heuristic audit
  }

  // Score calculation:
  // Tests: up to 50 pts
  // Time/Space optimality: up to 30 pts (15 each)
  // Readability: up to 20 pts
  // Hint penalty: hintsUsed * 5
  const totalTests = Math.max(1, execution.totalCount);
  const testPassScore = Math.round(50 * (execution.passedCount / totalTests));
  const timeScore = complexityAudit.isTimeOptimal ? 15 : 0;
  const spaceScore = complexityAudit.isSpaceOptimal ? 15 : 0;
  const readabilityScore = complexityAudit.readabilityScore;
  const hintPenalty = hintsUsed * 5;

  const rawScore = testPassScore + timeScore + spaceScore + readabilityScore - hintPenalty;
  const overallScore = Math.max(0, Math.min(100, rawScore));

  let grade: DsaScorecard['grade'] = 'D';
  if (overallScore >= 95) grade = 'S';
  else if (overallScore >= 85) grade = 'A';
  else if (overallScore >= 70) grade = 'B';
  else if (overallScore >= 50) grade = 'C';
  else grade = 'D';

  if (strengths.length === 0) {
    if (complexityAudit.isTimeOptimal) strengths.push('Optimal time complexity achieved');
    if (complexityAudit.isSpaceOptimal) strengths.push('Space complexity within target bounds');
    if (execution.passedCount === execution.totalCount) strengths.push('All test cases passed cleanly');
    if (readabilityScore >= 16) strengths.push('Clean and readable code layout');
    if (strengths.length === 0) strengths.push('Viable algorithmic approach');
  }

  if (growthAreas.length === 0) {
    if (!complexityAudit.isTimeOptimal) {
      growthAreas.push(`Improve time complexity toward ${problem.optimalTimeComplexity}`);
    }
    if (!complexityAudit.isSpaceOptimal) {
      growthAreas.push(`Reduce auxiliary space toward ${problem.optimalSpaceComplexity}`);
    }
    for (const missed of complexityAudit.missedEdgeCases) {
      growthAreas.push(`Address edge case: ${missed}`);
    }
    if (hintsUsed > 0) {
      growthAreas.push('Strive to solve without hints to avoid penalty points');
    }
    if (growthAreas.length === 0) {
      growthAreas.push('Practice explaining invariants aloud under interview conditions');
    }
  }

  return {
    overallScore,
    grade,
    passedTestsRatio: `${execution.passedCount}/${execution.totalCount}`,
    hintsUsed,
    hintPenalty,
    complexityAudit,
    strengths,
    growthAreas,
    mode,
  };
}

function computeNextStage(
  currentStage: DsaInterviewStage,
  userMessage: string,
  execution?: DsaExecutionSummary,
  isOptimal?: boolean
): DsaInterviewStage {
  const norm = userMessage.toLowerCase();

  switch (currentStage) {
    case 'CLARIFICATION': {
      const isAdvancing =
        norm.includes('understand') ||
        norm.includes('makes sense') ||
        norm.includes('constraints') ||
        norm.includes('edge case') ||
        norm.includes('approach') ||
        norm.includes('ready') ||
        norm.includes('assume');
      return isAdvancing ? 'APPROACH' : 'CLARIFICATION';
    }
    case 'APPROACH': {
      const discussesApproach =
        norm.includes('hash') ||
        norm.includes('map') ||
        norm.includes('set') ||
        norm.includes('pointer') ||
        norm.includes('sort') ||
        norm.includes('stack') ||
        norm.includes('queue') ||
        norm.includes('dp') ||
        norm.includes('window') ||
        norm.includes('o(n') ||
        norm.includes('o(1') ||
        norm.includes('code') ||
        norm.includes('implement');
      return discussesApproach ? 'CODING' : 'APPROACH';
    }
    case 'CODING': {
      if (execution && execution.status === 'Accepted') {
        return isOptimal ? 'SCORECARD' : 'OPTIMIZATION';
      }
      return 'CODING';
    }
    case 'OPTIMIZATION': {
      if (execution && execution.status === 'Accepted' && isOptimal) {
        return 'SCORECARD';
      }
      if (norm.includes('scorecard') || norm.includes('finish') || norm.includes('done') || norm.includes('submit')) {
        return 'SCORECARD';
      }
      return 'OPTIMIZATION';
    }
    case 'SCORECARD':
      return 'SCORECARD';
  }
}

function generateHeuristicSocraticReply(
  problem: DsaProblem,
  stage: DsaInterviewStage,
  execution?: DsaExecutionSummary
): string {
  switch (stage) {
    case 'CLARIFICATION':
      return `Welcome! Let's clarify the problem constraints: ${problem.constraints.join('; ')}. Before designing an algorithm, what edge cases or boundary conditions (such as empty inputs, single elements, or duplicates) should we consider?`;
    case 'APPROACH':
      return `What would be the brute-force approach and its Big-O complexity? Consider: ${problem.hints[0]} How could a ${problem.pattern} approach help reduce repeated work?`;
    case 'CODING':
      if (execution) {
        if (execution.status === 'Accepted') {
          return `All ${execution.passedCount} test cases passed cleanly! What is the exact time and space complexity of your implementation? Are we at the optimal ${problem.optimalTimeComplexity} bound?`;
        }
        if (execution.status === 'Wrong Answer') {
          const failed = execution.results.find((r) => !r.passed);
          return `Your solution passed ${execution.passedCount}/${execution.totalCount} tests. Examine the failing case where expected is ${JSON.stringify(failed?.expected)}. What loop invariant or condition produced this mismatch?`;
        }
        if (execution.status === 'Time Limit Exceeded') {
          return `Execution timed out on large inputs. Notice the loop nesting. How can we trade space for time using: ${problem.hints[1]}?`;
        }
        return `A runtime error was encountered: ${execution.errorMessage || 'check array bounds and null checks'}. What boundary condition could trigger this exception?`;
      }
      return `Focus on establishing the core loop invariant. Remember: ${problem.hints[0]}. How will you initialize your pointers or tracking structure?`;
    case 'OPTIMIZATION':
      return `Your solution passes the functional tests. Can we optimize time toward ${problem.optimalTimeComplexity} or auxiliary space toward ${problem.optimalSpaceComplexity}? Hint: ${problem.hints[2]}`;
    case 'SCORECARD':
      return `Interview session complete. Review the scorecard below for your test pass ratio, complexity audit, and growth areas.`;
  }
}

/**
 * Conducts a Socratic coaching interaction, routing to BYOK when available
 * or generating context-aware guidance via heuristics.
 * Guaranteed to pass responses through `sanitizeSocraticResponse`.
 */
export async function askSocraticCoach(params: {
  problem: DsaProblem;
  stage: DsaInterviewStage;
  language: DsaLanguage;
  code: string;
  execution?: DsaExecutionSummary;
  messages: DsaChatMessage[];
  userMessage: string;
}): Promise<{
  reply: string;
  suggestedNextStage: DsaInterviewStage;
  mode: 'byok' | 'heuristic';
}> {
  const { problem, stage, language, code, execution, messages, userMessage } = params;
  const audit = analyzeComplexityHeuristically(problem, code, execution);
  const suggestedNextStage = computeNextStage(stage, userMessage, execution, audit.isTimeOptimal && audit.isSpaceOptimal);

  let rawReply = '';
  let mode: 'byok' | 'heuristic' = 'heuristic';

  try {
    const clientConfig = await resolveClientProviderConfig();
    const config = await getActiveConfig();
    if (clientConfig || config.hasKey) {
      const systemPrompt = `You are a Staff Software Engineer Socratic DSA Interviewer.
Problem: ${problem.title} (${problem.difficulty})
Pattern: ${problem.pattern}
Constraints: ${problem.constraints.join('; ')}
Target Time: ${problem.optimalTimeComplexity}
Target Space: ${problem.optimalSpaceComplexity}
Current Stage: ${stage}

NON-NEGOTIABLE ANTI-SPOILER RULE:
NEVER output runnable code solutions, functions, or multi-line fenced code blocks (\`\`\`).
Ask leading questions, probe loop invariants, nudge toward optimal data structures, and highlight edge cases.`;

      const promptHistory = messages.slice(-4).map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n');
      const executionInfo = execution
        ? `\nLatest Tests: ${execution.passedCount}/${execution.totalCount} passed (${execution.status})`
        : '';
      const prompt = `${promptHistory ? promptHistory + '\n' : ''}USER CODE BUFFER:
\`\`\`${language}
${code}
\`\`\`${executionInfo}

CANDIDATE: ${userMessage}
SOCRATIC INTERVIEWER:`;

      const response = await callByokModel({
        systemPrompt,
        prompt,
        temperature: 0.3,
      });

      if (response.text && response.text.trim().length > 0) {
        rawReply = response.text.trim();
        mode = 'byok';
      }
    }
  } catch {
    // Fall back to heuristic response
  }

  if (!rawReply) {
    rawReply = generateHeuristicSocraticReply(problem, stage, execution);
    mode = 'heuristic';
  }

  const sanitizedReply = sanitizeSocraticResponse(rawReply, stage);

  return {
    reply: sanitizedReply,
    suggestedNextStage,
    mode,
  };
}
