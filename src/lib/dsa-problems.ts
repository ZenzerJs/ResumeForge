export type DsaPattern =
  | 'Two Pointers'
  | 'Sliding Window'
  | 'Hash Map & Sets'
  | 'Trees & Graphs'
  | 'Heap / Priority Queue'
  | 'Dynamic Programming'
  | 'Intervals & Greedy'
  | 'Stack & Monotonic Stack';

export type DsaDifficulty = 'Easy' | 'Medium' | 'Hard';

export type DsaLanguage = 'javascript' | 'typescript' | 'python';

export interface DsaTestCase {
  id: string;
  input: Record<string, unknown>;
  expected: unknown;
  isHidden?: boolean;
  explanation?: string;
}

export interface DsaProblem {
  id: string;
  slug: string;
  title: string;
  difficulty: DsaDifficulty;
  pattern: DsaPattern;
  categoryTags: string[];
  jdKeywords: string[];
  description: string;
  constraints: string[];
  examples: Array<{
    input: string;
    output: string;
    explanation?: string;
  }>;
  starterCode: Record<DsaLanguage, string>;
  entryFunctionName: string;
  parameterNames: string[];
  testCases: DsaTestCase[];
  optimalTimeComplexity: string;
  optimalSpaceComplexity: string;
  hints: [string, string, string];
}

export interface DsaRecommendation {
  problem: DsaProblem;
  matchReason: string;
  relevanceScore: number;
}

export const DSA_PROBLEMS: DsaProblem[] = [
  {
    id: 'dsa-1',
    slug: 'two-sum',
    title: 'Two Sum',
    difficulty: 'Easy',
    pattern: 'Hash Map & Sets',
    categoryTags: ['Array', 'Hash Table', 'Search'],
    jdKeywords: ['hash table', 'hash map', 'dictionary', 'key-value', 'caching', 'lookup', 'deduplication', 'index'],
    description:
      'Given an array of integers `nums` and an integer `target`, return indices of the two numbers such that they add up to `target`.\n\nYou may assume that each input would have exactly one solution, and you may not use the same element twice. You can return the answer in any order.',
    constraints: [
      '2 <= nums.length <= 10^4',
      '-10^9 <= nums[i] <= 10^9',
      '-10^9 <= target <= 10^9',
      'Only one valid answer exists.',
    ],
    examples: [
      {
        input: 'nums = [2, 7, 11, 15], target = 9',
        output: '[0, 1]',
        explanation: 'Because nums[0] + nums[1] == 9, we return [0, 1].',
      },
      {
        input: 'nums = [3, 2, 4], target = 6',
        output: '[1, 2]',
      },
      {
        input: 'nums = [3, 3], target = 6',
        output: '[0, 1]',
      },
    ],
    starterCode: {
      javascript: `function twoSum(nums, target) {\n  // Write your code here\n}`,
      typescript: `function twoSum(nums: number[], target: number): number[] {\n  // Write your code here\n  return [];\n}`,
      python: `def twoSum(nums, target):\n    # Write your code here\n    pass`,
    },
    entryFunctionName: 'twoSum',
    parameterNames: ['nums', 'target'],
    testCases: [
      {
        id: 'tc-1',
        input: { nums: [2, 7, 11, 15], target: 9 },
        expected: [0, 1],
      },
      {
        id: 'tc-2',
        input: { nums: [3, 2, 4], target: 6 },
        expected: [1, 2],
      },
      {
        id: 'tc-3',
        input: { nums: [3, 3], target: 6 },
        expected: [0, 1],
      },
      {
        id: 'tc-4',
        input: { nums: [-1, -2, -3, -4, -5], target: -8 },
        expected: [2, 4],
        isHidden: true,
      },
    ],
    optimalTimeComplexity: 'O(n)',
    optimalSpaceComplexity: 'O(n)',
    hints: [
      'Can you check if the complement (target - current) exists as you iterate through the list?',
      'A hash map allows O(1) average lookup time to verify if the complement was already recorded.',
      'Store each number as a key and its index as the value during a single pass through the array.',
    ],
  },
  {
    id: 'dsa-2',
    slug: 'longest-substring-without-repeating-characters',
    title: 'Longest Substring Without Repeating Characters',
    difficulty: 'Medium',
    pattern: 'Sliding Window',
    categoryTags: ['String', 'Sliding Window', 'Hash Set'],
    jdKeywords: ['sliding window', 'streaming', 'buffer', 'substring', 'real-time', 'windowing', 'stream processing'],
    description:
      'Given a string `s`, find the length of the longest substring without repeating characters.',
    constraints: [
      '0 <= s.length <= 5 * 10^4',
      's consists of English letters, digits, symbols and spaces.',
    ],
    examples: [
      {
        input: 's = "abcabcbb"',
        output: '3',
        explanation: 'The answer is "abc", with the length of 3.',
      },
      {
        input: 's = "bbbbb"',
        output: '1',
        explanation: 'The answer is "b", with the length of 1.',
      },
      {
        input: 's = "pwwkew"',
        output: '3',
        explanation: 'The answer is "wke", with the length of 3.',
      },
    ],
    starterCode: {
      javascript: `function lengthOfLongestSubstring(s) {\n  // Write your code here\n}`,
      typescript: `function lengthOfLongestSubstring(s: string): number {\n  // Write your code here\n  return 0;\n}`,
      python: `def lengthOfLongestSubstring(s):\n    # Write your code here\n    pass`,
    },
    entryFunctionName: 'lengthOfLongestSubstring',
    parameterNames: ['s'],
    testCases: [
      {
        id: 'tc-1',
        input: { s: 'abcabcbb' },
        expected: 3,
      },
      {
        id: 'tc-2',
        input: { s: 'bbbbb' },
        expected: 1,
      },
      {
        id: 'tc-3',
        input: { s: 'pwwkew' },
        expected: 3,
      },
      {
        id: 'tc-4',
        input: { s: '' },
        expected: 0,
        isHidden: true,
      },
      {
        id: 'tc-5',
        input: { s: 'dvdf' },
        expected: 3,
        isHidden: true,
      },
    ],
    optimalTimeComplexity: 'O(n)',
    optimalSpaceComplexity: 'O(min(n, m))',
    hints: [
      'Maintain a dynamic window [left, right] of characters that contain zero duplicates.',
      'When expanding right encounters a character already in the window, shift left past its previous index.',
      'A hash map storing the most recent index of each character allows left pointer jumps in O(1).',
    ],
  },
  {
    id: 'dsa-3',
    slug: 'merge-intervals',
    title: 'Merge Intervals',
    difficulty: 'Medium',
    pattern: 'Intervals & Greedy',
    categoryTags: ['Array', 'Sorting', 'Intervals'],
    jdKeywords: ['intervals', 'scheduling', 'calendar', 'overlap', 'range', 'time slots', 'resource allocation', 'reservation'],
    description:
      'Given an array of `intervals` where `intervals[i] = [start_i, end_i]`, merge all overlapping intervals, and return an array of the non-overlapping intervals that cover all the intervals in the input.',
    constraints: [
      '1 <= intervals.length <= 10^4',
      'intervals[i].length == 2',
      '0 <= start_i <= end_i <= 10^4',
    ],
    examples: [
      {
        input: 'intervals = [[1, 3], [2, 6], [8, 10], [15, 18]]',
        output: '[[1, 6], [8, 10], [15, 18]]',
        explanation: 'Since intervals [1, 3] and [2, 6] overlap, merge them into [1, 6].',
      },
      {
        input: 'intervals = [[1, 4], [4, 5]]',
        output: '[[1, 5]]',
        explanation: 'Intervals [1, 4] and [4, 5] are considered overlapping.',
      },
    ],
    starterCode: {
      javascript: `function merge(intervals) {\n  // Write your code here\n}`,
      typescript: `function merge(intervals: number[][]): number[][] {\n  // Write your code here\n  return [];\n}`,
      python: `def merge(intervals):\n    # Write your code here\n    pass`,
    },
    entryFunctionName: 'merge',
    parameterNames: ['intervals'],
    testCases: [
      {
        id: 'tc-1',
        input: { intervals: [[1, 3], [2, 6], [8, 10], [15, 18]] },
        expected: [[1, 6], [8, 10], [15, 18]],
      },
      {
        id: 'tc-2',
        input: { intervals: [[1, 4], [4, 5]] },
        expected: [[1, 5]],
      },
      {
        id: 'tc-3',
        input: { intervals: [[1, 4], [2, 3]] },
        expected: [[1, 4]],
      },
      {
        id: 'tc-4',
        input: { intervals: [] },
        expected: [],
        isHidden: true,
      },
    ],
    optimalTimeComplexity: 'O(n log n)',
    optimalSpaceComplexity: 'O(n)',
    hints: [
      'What simple transformation simplifies detecting interval overlap? Consider sorting by start time.',
      'Once sorted, two intervals overlap if the start of interval B is less than or equal to the end of interval A.',
      'Append the first interval, then compare each subsequent interval to the tail of your merged result.',
    ],
  },
  {
    id: 'dsa-4',
    slug: 'number-of-islands',
    title: 'Number of Islands',
    difficulty: 'Medium',
    pattern: 'Trees & Graphs',
    categoryTags: ['Array', 'Breadth-First Search', 'Depth-First Search', 'Matrix'],
    jdKeywords: ['graph', 'bfs', 'dfs', 'traversal', 'grid', 'connected components', 'mesh', 'topology', 'distributed'],
    description:
      'Given an `m x n` 2D binary grid `grid` which represents a map of `\'1\'`s (land) and `\'0\'`s (water), return the number of islands.\n\nAn island is surrounded by water and is formed by connecting adjacent lands horizontally or vertically. You may assume all four edges of the grid are all surrounded by water.',
    constraints: [
      'm == grid.length',
      'n == grid[i].length',
      '1 <= m, n <= 300',
      'grid[i][j] is \'0\' or \'1\'.',
    ],
    examples: [
      {
        input: 'grid = [["1","1","1","1","0"],["1","1","0","1","0"],["1","1","0","0","0"],["0","0","0","0","0"]]',
        output: '1',
      },
      {
        input: 'grid = [["1","1","0","0","0"],["1","1","0","0","0"],["0","0","1","0","0"],["0","0","0","1","1"]]',
        output: '3',
      },
    ],
    starterCode: {
      javascript: `function numIslands(grid) {\n  // Write your code here\n}`,
      typescript: `function numIslands(grid: string[][]): number {\n  // Write your code here\n  return 0;\n}`,
      python: `def numIslands(grid):\n    # Write your code here\n    pass`,
    },
    entryFunctionName: 'numIslands',
    parameterNames: ['grid'],
    testCases: [
      {
        id: 'tc-1',
        input: {
          grid: [
            ['1', '1', '1', '1', '0'],
            ['1', '1', '0', '1', '0'],
            ['1', '1', '0', '0', '0'],
            ['0', '0', '0', '0', '0'],
          ],
        },
        expected: 1,
      },
      {
        id: 'tc-2',
        input: {
          grid: [
            ['1', '1', '0', '0', '0'],
            ['1', '1', '0', '0', '0'],
            ['0', '0', '1', '0', '0'],
            ['0', '0', '0', '1', '1'],
          ],
        },
        expected: 3,
      },
      {
        id: 'tc-3',
        input: { grid: [['1']] },
        expected: 1,
        isHidden: true,
      },
      {
        id: 'tc-4',
        input: { grid: [] },
        expected: 0,
        isHidden: true,
      },
    ],
    optimalTimeComplexity: 'O(m * n)',
    optimalSpaceComplexity: 'O(m * n)',
    hints: [
      'Iterate through every cell in the 2D matrix. Encountering a \'1\' indicates the start of an island.',
      'Trigger a traversal (BFS or DFS) to visit and mark all 4-directionally adjacent land cells.',
      'Mutate visited land to \'0\' in place to avoid allocating separate visited sets.',
    ],
  },
  {
    id: 'dsa-5',
    slug: 'valid-parentheses',
    title: 'Valid Parentheses',
    difficulty: 'Easy',
    pattern: 'Stack & Monotonic Stack',
    categoryTags: ['String', 'Stack', 'Parsing'],
    jdKeywords: ['stack', 'parsing', 'ast', 'compiler', 'linter', 'syntax', 'matching', 'brackets', 'validator'],
    description:
      'Given a string `s` containing just the characters `\'(\'`, `\')\'`, `\'{\'`, `\'}\'`, `\'[\'` and `\']\'`, determine if the input string is valid.\n\nAn input string is valid if:\n1. Open brackets must be closed by the same type of brackets.\n2. Open brackets must be closed in the correct order.\n3. Every close bracket has a corresponding open bracket of the same type.',
    constraints: [
      '1 <= s.length <= 10^4',
      's consists of parentheses only \'()[]{}\'.',
    ],
    examples: [
      {
        input: 's = "()"',
        output: 'true',
      },
      {
        input: 's = "()[]{}"',
        output: 'true',
      },
      {
        input: 's = "(]"',
        output: 'false',
      },
      {
        input: 's = "([])"',
        output: 'true',
      },
    ],
    starterCode: {
      javascript: `function isValid(s) {\n  // Write your code here\n}`,
      typescript: `function isValid(s: string): boolean {\n  // Write your code here\n  return false;\n}`,
      python: `def isValid(s):\n    # Write your code here\n    pass`,
    },
    entryFunctionName: 'isValid',
    parameterNames: ['s'],
    testCases: [
      {
        id: 'tc-1',
        input: { s: '()' },
        expected: true,
      },
      {
        id: 'tc-2',
        input: { s: '()[]{}' },
        expected: true,
      },
      {
        id: 'tc-3',
        input: { s: '(]' },
        expected: false,
      },
      {
        id: 'tc-4',
        input: { s: '([)]' },
        expected: false,
      },
      {
        id: 'tc-5',
        input: { s: '{[]}' },
        expected: true,
      },
    ],
    optimalTimeComplexity: 'O(n)',
    optimalSpaceComplexity: 'O(n)',
    hints: [
      'Use a Last-In First-Out (LIFO) stack to match the most recently opened bracket.',
      'When seeing an opening bracket, push its expected closing tag onto the stack.',
      'When seeing a closing bracket, pop from the stack and verify identity. Confirm stack is empty at completion.',
    ],
  },
  {
    id: 'dsa-6',
    slug: 'top-k-frequent-elements',
    title: 'Top K Frequent Elements',
    difficulty: 'Medium',
    pattern: 'Heap / Priority Queue',
    categoryTags: ['Array', 'Hash Table', 'Heap', 'Bucket Sort'],
    jdKeywords: ['heap', 'priority queue', 'ranking', 'top-k', 'analytics', 'frequency', 'metrics', 'telemetry'],
    description:
      'Given an integer array `nums` and an integer `k`, return the `k` most frequent elements. You may return the answer in any order.',
    constraints: [
      '1 <= nums.length <= 10^5',
      '-10^4 <= nums[i] <= 10^4',
      'k is in the range [1, the number of unique elements in the array].',
      'It is guaranteed that the answer is unique.',
    ],
    examples: [
      {
        input: 'nums = [1, 1, 1, 2, 2, 3], k = 2',
        output: '[1, 2]',
      },
      {
        input: 'nums = [1], k = 1',
        output: '[1]',
      },
    ],
    starterCode: {
      javascript: `function topKFrequent(nums, k) {\n  // Write your code here\n}`,
      typescript: `function topKFrequent(nums: number[], k: number): number[] {\n  // Write your code here\n  return [];\n}`,
      python: `def topKFrequent(nums, k):\n    # Write your code here\n    pass`,
    },
    entryFunctionName: 'topKFrequent',
    parameterNames: ['nums', 'k'],
    testCases: [
      {
        id: 'tc-1',
        input: { nums: [1, 1, 1, 2, 2, 3], k: 2 },
        expected: [1, 2],
      },
      {
        id: 'tc-2',
        input: { nums: [1], k: 1 },
        expected: [1],
      },
      {
        id: 'tc-3',
        input: { nums: [4, 1, -1, 2, -1, 2, 3], k: 2 },
        expected: [-1, 2],
        isHidden: true,
      },
    ],
    optimalTimeComplexity: 'O(n log k)',
    optimalSpaceComplexity: 'O(n)',
    hints: [
      'Begin by building an element frequency map in O(n) time.',
      'A min-heap of maximum size k maintains the top elements by discarding smaller frequencies.',
      'Alternatively, bucket sort by frequencies achieves O(n) linear time with bounded array buckets.',
    ],
  },
  {
    id: 'dsa-7',
    slug: 'coin-change',
    title: 'Coin Change',
    difficulty: 'Medium',
    pattern: 'Dynamic Programming',
    categoryTags: ['Array', 'Dynamic Programming', 'Breadth-First Search'],
    jdKeywords: ['dynamic programming', 'optimization', 'cost minimization', 'billing', 'budget', 'pricing', 'knapsack'],
    description:
      'You are given an integer array `coins` representing coins of different denominations and an integer `amount` representing a total amount of money.\n\nReturn the fewest number of coins that you need to make up that amount. If that amount of money cannot be made up by any combination of the coins, return `-1`.\n\nYou may assume that you have an infinite number of each kind of coin.',
    constraints: [
      '1 <= coins.length <= 12',
      '1 <= coins[i] <= 2^31 - 1',
      '0 <= amount <= 10^4',
    ],
    examples: [
      {
        input: 'coins = [1, 2, 5], amount = 11',
        output: '3',
        explanation: '11 = 5 + 5 + 1',
      },
      {
        input: 'coins = [2], amount = 3',
        output: '-1',
      },
      {
        input: 'coins = [1], amount = 0',
        output: '0',
      },
    ],
    starterCode: {
      javascript: `function coinChange(coins, amount) {\n  // Write your code here\n}`,
      typescript: `function coinChange(coins: number[], amount: number): number {\n  // Write your code here\n  return -1;\n}`,
      python: `def coinChange(coins, amount):\n    # Write your code here\n    pass`,
    },
    entryFunctionName: 'coinChange',
    parameterNames: ['coins', 'amount'],
    testCases: [
      {
        id: 'tc-1',
        input: { coins: [1, 2, 5], amount: 11 },
        expected: 3,
      },
      {
        id: 'tc-2',
        input: { coins: [2], amount: 3 },
        expected: -1,
      },
      {
        id: 'tc-3',
        input: { coins: [1], amount: 0 },
        expected: 0,
      },
      {
        id: 'tc-4',
        input: { coins: [186, 419, 83, 408], amount: 6249 },
        expected: 20,
        isHidden: true,
      },
    ],
    optimalTimeComplexity: 'O(amount * len(coins))',
    optimalSpaceComplexity: 'O(amount)',
    hints: [
      'Formulate a 1D DP table where dp[i] represents the minimum coins needed for sub-amount i.',
      'Initialize dp array of length amount + 1 with Infinity, and base condition dp[0] = 0.',
      'For each sub-amount from 1 to target, dp[i] = min(dp[i], dp[i - coin] + 1) for valid coins.',
    ],
  },
  {
    id: 'dsa-8',
    slug: 'container-with-most-water',
    title: 'Container With Most Water',
    difficulty: 'Medium',
    pattern: 'Two Pointers',
    categoryTags: ['Array', 'Two Pointers', 'Greedy'],
    jdKeywords: ['two pointers', 'optimization', 'geometry', 'capacity', 'limits', 'throughput', 'resource bounds'],
    description:
      'You are given an integer array `height` of length `n`. There are `n` vertical lines drawn such that the two endpoints of the `i-th` line are `(i, 0)` and `(i, height[i])`.\n\nFind two lines that together with the x-axis form a container, such that the container contains the most water.\n\nReturn the maximum amount of water a container can store.\n\nNotice that you may not slant the container.',
    constraints: [
      'n == height.length',
      '2 <= n <= 10^5',
      '0 <= height[i] <= 10^4',
    ],
    examples: [
      {
        input: 'height = [1, 8, 6, 2, 5, 4, 8, 3, 7]',
        output: '49',
        explanation: 'The above vertical lines represent [1,8,6,2,5,4,8,3,7]. In this case, the max area is between index 1 and 8: min(8, 7) * (8 - 1) = 49.',
      },
      {
        input: 'height = [1, 1]',
        output: '1',
      },
    ],
    starterCode: {
      javascript: `function maxArea(height) {\n  // Write your code here\n}`,
      typescript: `function maxArea(height: number[]): number {\n  // Write your code here\n  return 0;\n}`,
      python: `def maxArea(height):\n    # Write your code here\n    pass`,
    },
    entryFunctionName: 'maxArea',
    parameterNames: ['height'],
    testCases: [
      {
        id: 'tc-1',
        input: { height: [1, 8, 6, 2, 5, 4, 8, 3, 7] },
        expected: 49,
      },
      {
        id: 'tc-2',
        input: { height: [1, 1] },
        expected: 1,
      },
      {
        id: 'tc-3',
        input: { height: [4, 3, 2, 1, 4] },
        expected: 16,
      },
      {
        id: 'tc-4',
        input: { height: [1, 2, 1] },
        expected: 2,
        isHidden: true,
      },
    ],
    optimalTimeComplexity: 'O(n)',
    optimalSpaceComplexity: 'O(1)',
    hints: [
      'Initialize two pointers at opposite ends of the array to maximize the container width.',
      'The volume is bounded by the shorter line: (right - left) * min(height[left], height[right]).',
      'Always advance the pointer pointing to the shorter vertical bar to search for a taller wall.',
    ],
  },
];

const DIFFICULTY_WEIGHT: Record<DsaDifficulty, number> = {
  Easy: 1,
  Medium: 2,
  Hard: 3,
};

export function recommendProblemsForJob(jdText: string, limit = 5): DsaRecommendation[] {
  if (!jdText || typeof jdText !== 'string' || jdText.trim().length === 0) {
    return DSA_PROBLEMS.slice(0, limit).map((problem, idx) => ({
      problem,
      matchReason: 'Core interview foundation problem covering common pattern archetypes.',
      relevanceScore: 75 - idx * 5,
    }));
  }

  const normalizedJd = jdText.toLowerCase();

  // Role archetype detection
  const isBackend = /\b(backend|distributed|systems|database|api|services|microservices|golang|java|c\+\+|node|sql|caching|infra)\b/i.test(normalizedJd);
  const isFrontend = /\b(frontend|react|ui|ux|web|browser|client|css|dom|javascript|typescript|next\.js|vue|angular)\b/i.test(normalizedJd);
  const isDataOrAnalytics = /\b(data|pipeline|analytics|etl|metrics|telemetry|ranking|streaming|kafka|spark)\b/i.test(normalizedJd);

  const scored = DSA_PROBLEMS.map((problem) => {
    let score = 20; // baseline relevance
    const matchedKeywords: string[] = [];

    // Check JD keywords
    for (const kw of problem.jdKeywords) {
      const regex = new RegExp(`\\b${kw.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
      if (regex.test(normalizedJd)) {
        score += 15;
        matchedKeywords.push(kw);
      }
    }

    // Check category tags
    for (const tag of problem.categoryTags) {
      const regex = new RegExp(`\\b${tag.toLowerCase().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
      if (regex.test(normalizedJd)) {
        score += 10;
        if (!matchedKeywords.includes(tag.toLowerCase())) {
          matchedKeywords.push(tag.toLowerCase());
        }
      }
    }

    // Check pattern title overlap
    const patternWords = problem.pattern.toLowerCase().split(/\s+/).filter((w) => w.length > 3 && w !== '&');
    for (const pw of patternWords) {
      if (new RegExp(`\\b${pw}\\b`, 'i').test(normalizedJd)) {
        score += 8;
      }
    }

    // Role archetype boosts
    if (isBackend) {
      if (problem.pattern === 'Trees & Graphs') score += 25;
      if (problem.pattern === 'Intervals & Greedy') score += 20;
      if (problem.pattern === 'Hash Map & Sets') score += 15;
      if (problem.pattern === 'Heap / Priority Queue') score += 15;
    }
    if (isFrontend) {
      if (problem.pattern === 'Stack & Monotonic Stack') score += 25;
      if (problem.pattern === 'Sliding Window') score += 20;
      if (problem.pattern === 'Two Pointers') score += 15;
      if (problem.pattern === 'Hash Map & Sets') score += 10;
    }
    if (isDataOrAnalytics) {
      if (problem.pattern === 'Heap / Priority Queue') score += 25;
      if (problem.pattern === 'Dynamic Programming') score += 18;
      if (problem.pattern === 'Sliding Window') score += 12;
    }

    const finalScore = Math.min(99, Math.max(10, score));

    let matchReason: string;
    if (matchedKeywords.length > 0) {
      const preview = matchedKeywords.slice(0, 3).map((k) => `'${k}'`).join(', ');
      matchReason = `Direct match with role keywords: ${preview}. Target pattern: ${problem.pattern}.`;
    } else if (isBackend && ['Trees & Graphs', 'Intervals & Greedy', 'Hash Map & Sets'].includes(problem.pattern)) {
      matchReason = `High-yield ${problem.pattern} problem aligned with backend systems and resource management.`;
    } else if (isFrontend && ['Stack & Monotonic Stack', 'Sliding Window', 'Two Pointers'].includes(problem.pattern)) {
      matchReason = `High-yield ${problem.pattern} problem aligned with frontend state, parsing, and UI windowing.`;
    } else {
      matchReason = `Fundamental ${problem.pattern} problem frequently evaluated in technical interviews.`;
    }

    return {
      problem,
      matchReason,
      relevanceScore: finalScore,
    };
  });

  scored.sort((a, b) => {
    if (b.relevanceScore !== a.relevanceScore) {
      return b.relevanceScore - a.relevanceScore;
    }
    const diffComp = DIFFICULTY_WEIGHT[a.problem.difficulty] - DIFFICULTY_WEIGHT[b.problem.difficulty];
    if (diffComp !== 0) return diffComp;
    return a.problem.title.localeCompare(b.problem.title);
  });

  return scored.slice(0, limit);
}
