import {
  DSA_PROBLEMS,
  type DsaPattern,
  type DsaProblem,
} from "@/lib/dsa-problems";
import { getAllProblems } from "@/lib/practice/practice-curriculum";
import type { PracticeProblem } from "@/lib/practice/types";

const TOPIC_PATTERN: Record<string, DsaPattern> = {
  "arrays-hashing": "Hash Map & Sets",
  "two-pointers": "Two Pointers",
  "sliding-window": "Sliding Window",
  stack: "Stack & Monotonic Stack",
  "binary-search": "Intervals & Greedy",
  "trees-graphs": "Trees & Graphs",
  "dynamic-programming": "Dynamic Programming",
};

function inferEntry(starter: string): { name: string; params: string[] } {
  const fn = starter.match(/function\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)/);
  if (fn) {
    const params = fn[2]
      .split(",")
      .map((part) => part.trim().split(/[:\s=]/)[0])
      .filter(Boolean);
    return { name: fn[1], params };
  }
  return { name: "solution", params: [] };
}

function practiceToDsa(problem: PracticeProblem): DsaProblem {
  const { name, params } = inferEntry(problem.starterTemplates.javascript);
  const hints: [string, string, string] = [
    problem.hints[0]?.content || "Start from the constraints and a brute-force pass.",
    problem.hints[1]?.content || "Name the data structure that removes the inner scan.",
    problem.hints[2]?.content || "Check empty input and the single-answer edge.",
  ];

  return {
    id: problem.id,
    slug: problem.slug,
    title: problem.title,
    difficulty: problem.difficulty,
    pattern: TOPIC_PATTERN[problem.topicId] ?? "Hash Map & Sets",
    categoryTags: [problem.topicId, problem.category],
    jdKeywords: [problem.topicId, ...problem.companies],
    description: problem.descriptionMarkdown,
    constraints: problem.constraints,
    examples: problem.examples,
    starterCode: {
      javascript: problem.starterTemplates.javascript,
      typescript: problem.starterTemplates.typescript,
      python: problem.starterTemplates.python,
    },
    entryFunctionName: name,
    parameterNames: params,
    testCases: problem.testCases.map((testCase) => ({
      id: testCase.id,
      input: Object.fromEntries(params.map((param, index) => [param, testCase.args[index]])),
      expected: testCase.expected,
      explanation: testCase.explanation,
      isHidden: testCase.isHidden,
    })),
    optimalTimeComplexity: problem.solution.timeComplexity,
    optimalSpaceComplexity: problem.solution.spaceComplexity,
    hints,
  };
}

/** DSA catalog plus practice problems that are not already in it. */
export function listSandboxProblems(): DsaProblem[] {
  const slugs = new Set(DSA_PROBLEMS.map((problem) => problem.slug));
  const extras = getAllProblems()
    .filter((problem) => !slugs.has(problem.slug))
    .map(practiceToDsa);
  return [...DSA_PROBLEMS, ...extras];
}
