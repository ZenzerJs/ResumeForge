export type CodeLanguage = "typescript" | "javascript" | "python" | "java" | "cpp";

export type ProblemDifficulty = "Easy" | "Medium" | "Hard";

export interface TestCase {
  id: string;
  inputDisplay: string;
  args: unknown[];
  expected: unknown;
  expectedDisplay: string;
  explanation?: string;
  isHidden?: boolean;
}

export interface ProgressiveHint {
  step: number;
  title: string;
  content: string;
}

export interface ProblemSolution {
  approach: string;
  timeComplexity: string;
  spaceComplexity: string;
  explanation: string;
  code: Partial<Record<CodeLanguage, string>>;
}

export interface PracticeProblem {
  id: string;
  slug: string;
  title: string;
  topicId: string;
  difficulty: ProblemDifficulty;
  category: string;
  companies: string[];
  summary: string;
  descriptionMarkdown: string;
  examples: Array<{
    input: string;
    output: string;
    explanation?: string;
  }>;
  constraints: string[];
  starterTemplates: Record<CodeLanguage, string>;
  testCases: TestCase[];
  hints: ProgressiveHint[];
  solution: ProblemSolution;
}

export interface WorkedExample {
  title: string;
  problemStatement: string;
  walkthrough: string;
  code: string;
  keyTakeaways: string[];
}

export interface TopicCurriculum {
  id: string;
  title: string;
  shortName: string;
  icon: string;
  overview: string;
  patternIntuition: string;
  commonUseCases: string[];
  timeComplexity: string;
  spaceComplexity: string;
  blueprintPseudocode: string;
  workedExample: WorkedExample;
  problemIds: string[];
}

export interface TestRunItemResult {
  testCaseId: string;
  passed: boolean;
  input: string;
  expected: string;
  actual: string;
  error?: string;
  executionTimeMs?: number;
}

export interface ExecutionResult {
  status: "PASS" | "FAIL" | "ERROR" | "TIMEOUT";
  totalTests: number;
  passedTests: number;
  executionTimeMs: number;
  testResults: TestRunItemResult[];
  error?: string;
  stdout?: string;
}
