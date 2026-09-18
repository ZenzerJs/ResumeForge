import {
  PracticeProblem,
  TopicCurriculum,
} from "./types";

export const TOPIC_CURRICULUM: TopicCurriculum[] = [
  {
    id: "arrays-hashing",
    title: "Arrays & Hashing",
    shortName: "Arrays",
    icon: "Hash",
    overview:
      "Arrays store contiguous sequences in memory with O(1) indexed lookups. Hashing trades memory for speed by mapping arbitrary keys to table indices in O(1) average time.",
    patternIntuition:
      "Whenever you need to check for existence, count frequencies, or find pairs that satisfy an arithmetic relation (like sum, difference, or duplicate), reach for a Hash Map or Hash Set to reduce O(n²) nested loops to O(n) single passes.",
    commonUseCases: [
      "Finding complements (e.g. target - current)",
      "Frequency counting (e.g. anagrams, majority elements)",
      "Tracking visited elements in one pass",
      "Grouping items by a computed canonical key",
    ],
    timeComplexity: "O(n) average lookup/insert with good hash distribution",
    spaceComplexity: "O(n) auxiliary space to store elements",
    blueprintPseudocode: `function hashPattern(items, target):
    seen = new Map() // or Set
    for each item in items:
        complement = computeComplement(item, target)
        if complement in seen:
            return result(seen[complement], item)
        seen[item] = currentIndex
    return default`,
    workedExample: {
      title: "Find Pair with Target Sum",
      problemStatement:
        "Given an array of integers and a target sum, determine if any two numbers sum to target.",
      walkthrough:
        "Instead of checking every pair with two nested loops (O(n²)), iterate once through the array. For each number x, calculate complement = target - x. Check if complement already exists in our seen set. If yes, we found our pair. If not, insert x into the set and continue.",
      code: `function hasPairWithSum(nums: number[], target: number): boolean {
  const seen = new Set<number>();
  for (const num of nums) {
    const complement = target - num;
    if (seen.has(complement)) {
      return true;
    }
    seen.add(num);
  }
  return false;
}`,
      keyTakeaways: [
        "Trade O(n) memory to eliminate the inner scan loop.",
        "Check existence BEFORE adding the current element to avoid using the same index twice.",
        "Hash collisions degrade to O(n) in worst cases, but average time is O(1).",
      ],
    },
    problemIds: ["two-sum", "contains-duplicate", "group-anagrams"],
  },
  {
    id: "two-pointers",
    title: "Two Pointers",
    shortName: "Two Pointers",
    icon: "ArrowLeftRight",
    overview:
      "The Two Pointers pattern utilizes two index markers that traverse a data structure concurrently—either converging inward from both ends or traveling in the same direction at varying rates.",
    patternIntuition:
      "When an array or string is sorted (or monotonic), moving pointers based on relative comparisons allows you to eliminate entire search spaces deterministically without exhaustive brute force.",
    commonUseCases: [
      "Reversing arrays or checking palindromes in-place",
      "Finding pairs or triplets in sorted arrays",
      "Partitioning arrays around a pivot (Dutch National Flag)",
      "Merging two sorted lists",
    ],
    timeComplexity: "O(n) single sweep across the sequence",
    spaceComplexity: "O(1) in-place pointers without extra allocation",
    blueprintPseudocode: `function twoPointers(sortedArray):
    left = 0
    right = sortedArray.length - 1
    while left < right:
        currentSum = sortedArray[left] + sortedArray[right]
        if currentSum == target:
            return [left, right]
        else if currentSum < target:
            left++ // Need larger value
        else:
            right-- // Need smaller value
    return null`,
    workedExample: {
      title: "Valid Palindrome",
      problemStatement:
        "Verify if a string reads identically forwards and backwards after converting to lowercase and stripping non-alphanumeric characters.",
      walkthrough:
        "Place one pointer at index 0 and one at the last index. Advance left and decrement right while skipping non-alphanumerics. Compare characters. If any mismatch occurs, it's not a palindrome. If pointers cross without mismatch, it is valid.",
      code: `function isPalindrome(s: string): boolean {
  let left = 0;
  let right = s.length - 1;
  const isAlphaNum = (c: string) => /[a-z0-9]/i.test(c);

  while (left < right) {
    while (left < right && !isAlphaNum(s[left])) left++;
    while (left < right && !isAlphaNum(s[right])) right--;
    if (s[left].toLowerCase() !== s[right].toLowerCase()) {
      return false;
    }
    left++;
    right--;
  }
  return true;
}`,
      keyTakeaways: [
        "In-place space complexity is strictly O(1).",
        "Always bound the inner pointer advancement with left < right.",
        "Pre-sorting an unsorted array takes O(n log n) but unlocks the two-pointer technique.",
      ],
    },
    problemIds: ["valid-palindrome", "two-sum-ii", "container-with-most-water"],
  },
  {
    id: "sliding-window",
    title: "Sliding Window",
    shortName: "Sliding Window",
    icon: "Maximize2",
    overview:
      "Sliding Window maintains a contiguous subsegment of an array or string between indices [L, R], expanding the right boundary to ingest elements and contracting the left boundary when constraints are violated.",
    patternIntuition:
      "Whenever a problem asks for the longest, shortest, or optimal contiguous subarray/substring satisfying a monotonic condition, sliding window avoids recalculating overlapping regions from scratch.",
    commonUseCases: [
      "Maximum or minimum sum of fixed-size subsegment K",
      "Longest substring without repeating characters",
      "Smallest subarray with sum greater than or equal to S",
      "Permutation or anagram search in a text stream",
    ],
    timeComplexity: "O(n) because each index is visited at most twice (once by R, once by L)",
    spaceComplexity: "O(k) where k is the size of the window alphabet/hash map",
    blueprintPseudocode: `function slidingWindow(sequence):
    left = 0
    windowState = new State()
    bestResult = 0
    for right from 0 to sequence.length - 1:
        windowState.add(sequence[right])
        while windowState.isInvalid():
            windowState.remove(sequence[left])
            left++
        bestResult = max(bestResult, right - left + 1)
    return bestResult`,
    workedExample: {
      title: "Best Time to Buy and Sell Stock",
      problemStatement:
        "Find the maximum single-transaction profit from an array of daily stock prices.",
      walkthrough:
        "Keep track of the minimum price observed so far as the left anchor. For every price on the right, calculate profit = price - minPrice. Update maximum profit if higher. If current price is lower than minPrice, update minPrice.",
      code: `function maxProfit(prices: number[]): number {
  let minPrice = Infinity;
  let maxProfit = 0;
  for (const price of prices) {
    if (price < minPrice) {
      minPrice = price;
    } else {
      maxProfit = Math.max(maxProfit, price - minPrice);
    }
  }
  return maxProfit;
}`,
      keyTakeaways: [
        "Each element enters the window once and leaves at most once -> O(n) total.",
        "Distinguish between fixed-size windows and variable-size dynamic windows.",
        "Store frequency counts or last-seen indices to compress contraction steps.",
      ],
    },
    problemIds: ["best-time-to-buy-stock", "longest-substring-without-repeating"],
  },
  {
    id: "stack",
    title: "Stack & Monotonic Stack",
    shortName: "Stack",
    icon: "Layers",
    overview:
      "A Stack is a Last-In, First-Out (LIFO) structure. A Monotonic Stack preserves elements in strictly ascending or descending order, efficiently finding the next greater or smaller element.",
    patternIntuition:
      "Use a stack when parsing nested structures (parentheses, HTML tags) or when you need to remember previous elements until a future element resolves or matches them.",
    commonUseCases: [
      "Matching brackets, tags, or expression parsing",
      "Next Greater Element / Daily Temperatures",
      "Evaluating Reverse Polish Notation (RPN)",
      "Largest rectangle in a histogram",
    ],
    timeComplexity: "O(n) total time with amortized O(1) push and pop",
    spaceComplexity: "O(n) worst case auxiliary stack memory",
    blueprintPseudocode: `function validBrackets(s):
    stack = []
    pairs = {')': '(', '}': '{', ']': '['}
    for char in s:
        if char is opening:
            stack.push(char)
        else if stack.pop() != pairs[char]:
            return false
    return stack.isEmpty()`,
    workedExample: {
      title: "Valid Parentheses",
      problemStatement:
        "Determine if a string containing '(', ')', '{', '}', '[' and ']' is validly paired and nested.",
      walkthrough:
        "Iterate over each character. If it is an opening bracket, push it to the stack. If it is a closing bracket, check if the top of the stack matches its opening pair. If not or stack is empty, return false. At the end, stack must be empty.",
      code: `function isValid(s: string): boolean {
  const stack: string[] = [];
  const map: Record<string, string> = {
    ")": "(",
    "}": "{",
    "]": "[",
  };

  for (const ch of s) {
    if (ch === "(" || ch === "{" || ch === "[") {
      stack.push(ch);
    } else {
      const top = stack.pop();
      if (top !== map[ch]) return false;
    }
  }
  return stack.length === 0;
}`,
      keyTakeaways: [
        "Closing bracket without preceding opening bracket is an immediate false.",
        "Non-empty stack at completion indicates unclosed opening brackets.",
        "Monotonic stacks prune elements that can never serve as answers for future indices.",
      ],
    },
    problemIds: ["valid-parentheses", "daily-temperatures"],
  },
  {
    id: "binary-search",
    title: "Binary Search",
    shortName: "Binary Search",
    icon: "Search",
    overview:
      "Binary Search halves the candidate search space on every iteration by probing the midpoint of a sorted or monotonic domain.",
    patternIntuition:
      "If you can formulate a boolean predicate condition(mid) that evaluates to false false ... true true (monotonicity), binary search will locate the exact boundary in O(log n) steps.",
    commonUseCases: [
      "Target lookup in sorted arrays or matrices",
      "Search in rotated sorted arrays",
      "Binary search on the answer (min capacity, max speed)",
      "Finding square roots or integer bounds without floating point",
    ],
    timeComplexity: "O(log n) logarithmic time",
    spaceComplexity: "O(1) iterative space",
    blueprintPseudocode: `function binarySearch(nums, target):
    left = 0, right = nums.length - 1
    while left <= right:
        mid = left + Math.floor((right - left) / 2)
        if nums[mid] == target:
            return mid
        else if nums[mid] < target:
            left = mid + 1
        else:
            right = mid - 1
    return -1`,
    workedExample: {
      title: "Binary Search Implementation",
      problemStatement:
        "Search for a target value in an ascending sorted array and return its index or -1 if not found.",
      walkthrough:
        "Compute mid = left + Math.floor((right - left) / 2) to prevent 32-bit integer overflow. Compare nums[mid] to target. If equal, return mid. If less, discard left half (left = mid + 1). If greater, discard right half (right = mid - 1).",
      code: `function search(nums: number[], target: number): number {
  let left = 0;
  let right = nums.length - 1;

  while (left <= right) {
    const mid = left + Math.floor((right - left) / 2);
    if (nums[mid] === target) {
      return mid;
    } else if (nums[mid] < target) {
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }
  return -1;
}`,
      keyTakeaways: [
        "Always calculate mid as left + floor((right - left) / 2) to protect against overflow in other languages.",
        "Maintain invariant: target is guaranteed inside [left, right] range if it exists.",
        "Identify monotonic properties even in problems that don't look like sorted arrays.",
      ],
    },
    problemIds: ["binary-search", "search-rotated-sorted-array"],
  },
  {
    id: "trees-graphs",
    title: "Trees & Graphs (BFS / DFS)",
    shortName: "Trees & Graphs",
    icon: "Network",
    overview:
      "Trees are hierarchical connected acyclic graphs. Graphs represent arbitrary entity networks. Depth-First Search (DFS) explores branch paths to depth, while Breadth-First Search (BFS) explores radially by level.",
    patternIntuition:
      "BFS guarantees shortest path on unweighted graphs using a FIFO Queue. DFS excels at path finding, backtracking, topological sorting, and tree traversals with call stack recursion.",
    commonUseCases: [
      "Level-order traversal and shortest path (BFS)",
      "Connected components and cycle detection (DFS/BFS)",
      "Binary search tree validations and LCA lookups",
      "Matrix island counting and flood fills",
    ],
    timeComplexity: "O(V + E) linear in vertices plus edges",
    spaceComplexity: "O(V) queue or recursion call stack depth",
    blueprintPseudocode: `function dfs(node, visited):
    if node is null or node in visited:
        return
    visited.add(node)
    for neighbor in node.neighbors:
        dfs(neighbor, visited)`,
    workedExample: {
      title: "Maximum Depth of Binary Tree",
      problemStatement: "Find the maximum depth (root-to-leaf path length) of a binary tree.",
      walkthrough:
        "If root is null, depth is 0. Recursively compute the maximum depth of the left subtree and the right subtree. The depth of the current tree is 1 + max(leftDepth, rightDepth).",
      code: `class TreeNode {
  val: number;
  left: TreeNode | null;
  right: TreeNode | null;
  constructor(val?: number, left?: TreeNode | null, right?: TreeNode | null) {
    this.val = val === undefined ? 0 : val;
    this.left = left === undefined ? null : left;
    this.right = right === undefined ? null : right;
  }
}

function maxDepth(root: TreeNode | null): number {
  if (!root) return 0;
  return 1 + Math.max(maxDepth(root.left), maxDepth(root.right));
}`,
      keyTakeaways: [
        "Recursive base cases handle leaf and null boundaries.",
        "BFS utilizes a queue to process level-by-level.",
        "Track a visited set when traversing generic cyclic graphs.",
      ],
    },
    problemIds: ["invert-binary-tree", "number-of-islands"],
  },
  {
    id: "dynamic-programming",
    title: "Dynamic Programming",
    shortName: "DP",
    icon: "Cpu",
    overview:
      "Dynamic Programming breaks complex problems into overlapping subproblems, memoizing or tabulating intermediate subproblem results to guarantee each state is evaluated exactly once.",
    patternIntuition:
      "When a problem exhibits optimal substructure (optimal solution to the whole derives from optimal solutions to subparts) and repeated overlapping subproblems, define state transitions and cache results.",
    commonUseCases: [
      "Fibonacci, climbing stairs, and grid paths",
      "0/1 Knapsack, subset sum, coin change",
      "Longest Common Subsequence (LCS) & Edit Distance",
      "Longest Increasing Subsequence (LIS)",
    ],
    timeComplexity: "O(number of unique states * transition time per state)",
    spaceComplexity: "O(states) or O(1) with rolling window space optimization",
    blueprintPseudocode: `function dpPattern(n):
    dp = new Array(n + 1).fill(0)
    dp[0] = baseCase0
    dp[1] = baseCase1
    for i from 2 to n:
        dp[i] = transition(dp[i-1], dp[i-2])
    return dp[n]`,
    workedExample: {
      title: "Climbing Stairs",
      problemStatement:
        "You are climbing a staircase with n steps. Each time you can climb 1 or 2 steps. In how many distinct ways can you reach the top?",
      walkthrough:
        "To reach step i, you must have stepped from i-1 (1 step) or i-2 (2 steps). Therefore, ways[i] = ways[i-1] + ways[i-2]. This is identical to Fibonacci. We only need the last two values, optimizing space to O(1).",
      code: `function climbStairs(n: number): number {
  if (n <= 2) return n;
  let prev2 = 1;
  let prev1 = 2;
  for (let i = 3; i <= n; i++) {
    const current = prev1 + prev2;
    prev2 = prev1;
    prev1 = current;
  }
  return prev1;
}`,
      keyTakeaways: [
        "State definition must completely determine the subproblem without ambiguity.",
        "Identify base cases cleanly before writing loops.",
        "Check if you can roll state variables to achieve O(1) space.",
      ],
    },
    problemIds: ["climbing-stairs", "coin-change"],
  },
];

export const PRACTICE_PROBLEMS: PracticeProblem[] = [
  {
    id: "two-sum",
    slug: "two-sum",
    title: "Two Sum",
    topicId: "arrays-hashing",
    difficulty: "Easy",
    category: "OA",
    companies: ["Amazon", "Google", "Meta", "Spotify", "Stripe"],
    summary:
      "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.",
    descriptionMarkdown: `Given an array of integers \`nums\` and an integer \`target\`, return *indices of the two numbers such that they add up to \`target\`*.

You may assume that each input would have **exactly one solution**, and you may not use the *same* element twice.

You can return the answer in any order.`,
    examples: [
      {
        input: "nums = [2,7,11,15], target = 9",
        output: "[0,1]",
        explanation: "Because nums[0] + nums[1] == 9, we return [0, 1].",
      },
      {
        input: "nums = [3,2,4], target = 6",
        output: "[1,2]",
        explanation: "nums[1] + nums[2] == 6, we return [1, 2].",
      },
      {
        input: "nums = [3,3], target = 6",
        output: "[0,1]",
      },
    ],
    constraints: [
      "2 <= nums.length <= 10^4",
      "-10^9 <= nums[i] <= 10^9",
      "-10^9 <= target <= 10^9",
      "Only one valid answer exists.",
    ],
    starterTemplates: {
      typescript: `function twoSum(nums: number[], target: number): number[] {
  // Write your solution here
  return [];
}`,
      javascript: `function twoSum(nums, target) {
  // Write your solution here
  return [];
}`,
      python: `class Solution:
    def twoSum(self, nums: list[int], target: int) -> list[int]:
        # Write your solution here
        return []`,
      java: `class Solution {
    public int[] twoSum(int[] nums, int target) {
        // Write your solution here
        return new int[]{};
    }
}`,
      cpp: `class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        // Write your solution here
        return {};
    }
};`,
    },
    testCases: [
      {
        id: "ts-tc-1",
        inputDisplay: "[2, 7, 11, 15], target = 9",
        args: [[2, 7, 11, 15], 9],
        expected: [0, 1],
        expectedDisplay: "[0, 1]",
      },
      {
        id: "ts-tc-2",
        inputDisplay: "[3, 2, 4], target = 6",
        args: [[3, 2, 4], 6],
        expected: [1, 2],
        expectedDisplay: "[1, 2]",
      },
      {
        id: "ts-tc-3",
        inputDisplay: "[3, 3], target = 6",
        args: [[3, 3], 6],
        expected: [0, 1],
        expectedDisplay: "[0, 1]",
      },
    ],
    hints: [
      {
        step: 1,
        title: "Brute Force vs Optimal",
        content:
          "A brute force approach checks every pair with two nested loops in O(n²) time. Can you do better using extra memory?",
      },
      {
        step: 2,
        title: "The Complement Trick",
        content:
          "For any number x, we know the exact value needed to reach target: complement = target - x. Can you look up if complement was seen previously in O(1) time?",
      },
      {
        step: 3,
        title: "Single-Pass Hash Map",
        content:
          "Maintain a Hash Map from value to its index. In one pass, check if target - nums[i] is in the map. If yes, return [map.get(complement), i]. If not, insert nums[i] -> i.",
      },
    ],
    solution: {
      approach: "One-Pass Hash Map",
      timeComplexity: "O(n) — Traverse the list containing n elements exactly once. Each hash table lookup is O(1).",
      spaceComplexity: "O(n) — The extra space required depends on the number of items stored in the hash map, which stores at most n elements.",
      explanation:
        "While iterating through the array, we check if the complement (target - nums[i]) already exists in our hash map. If it does, we have found the solution and return the stored index and current index. Otherwise, we insert the current number and its index into the map.",
      code: {
        typescript: `function twoSum(nums: number[], target: number): number[] {
  const map = new Map<number, number>();
  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i];
    if (map.has(complement)) {
      return [map.get(complement)!, i];
    }
    map.set(nums[i], i);
  }
  return [];
}`,
        python: `class Solution:
    def twoSum(self, nums: list[int], target: int) -> list[int]:
        seen = {}
        for i, num in enumerate(nums):
            complement = target - num
            if complement in seen:
                return [seen[complement], i]
            seen[num] = i
        return []`,
      },
    },
  },
  {
    id: "valid-palindrome",
    slug: "valid-palindrome",
    title: "Valid Palindrome",
    topicId: "two-pointers",
    difficulty: "Easy",
    category: "Phone Screen",
    companies: ["Meta", "Amazon", "Cohere", "Spotify"],
    summary:
      "A phrase is a palindrome if, after converting all uppercase letters into lowercase letters and removing all non-alphanumeric characters, it reads the same forward and backward.",
    descriptionMarkdown: `A phrase is a **palindrome** if, after converting all uppercase letters into lowercase letters and removing all non-alphanumeric characters, it reads the same forward and backward. Alphanumeric characters include letters and numbers.

Given a string \`s\`, return \`true\` *if it is a palindrome, or* \`false\` *otherwise*.`,
    examples: [
      {
        input: 's = "A man, a plan, a canal: Panama"',
        output: "true",
        explanation: '"amanaplanacanalpanama" is a palindrome.',
      },
      {
        input: 's = "race a car"',
        output: "false",
        explanation: '"raceacar" is not a palindrome.',
      },
      {
        input: 's = " "',
        output: "true",
        explanation: 's is an empty string "" after removing non-alphanumeric characters. Since an empty string reads the same forward and backward, it is a palindrome.',
      },
    ],
    constraints: [
      "1 <= s.length <= 2 * 10^5",
      "s consists only of printable ASCII characters.",
    ],
    starterTemplates: {
      typescript: `function isPalindrome(s: string): boolean {
  // Write your solution here
  return false;
}`,
      javascript: `function isPalindrome(s) {
  // Write your solution here
  return false;
}`,
      python: `class Solution:
    def isPalindrome(self, s: str) -> bool:
        # Write your solution here
        return False`,
      java: `class Solution {
    public boolean isPalindrome(String s) {
        // Write your solution here
        return false;
    }
}`,
      cpp: `class Solution {
public:
    boolean isPalindrome(string s) {
        // Write your solution here
        return false;
    }
};`,
    },
    testCases: [
      {
        id: "vp-tc-1",
        inputDisplay: '"A man, a plan, a canal: Panama"',
        args: ["A man, a plan, a canal: Panama"],
        expected: true,
        expectedDisplay: "true",
      },
      {
        id: "vp-tc-2",
        inputDisplay: '"race a car"',
        args: ["race a car"],
        expected: false,
        expectedDisplay: "false",
      },
      {
        id: "vp-tc-3",
        inputDisplay: '" "',
        args: [" "],
        expected: true,
        expectedDisplay: "true",
      },
    ],
    hints: [
      {
        step: 1,
        title: "Filtering vs In-Place",
        content:
          "You could create a cleaned string and check s === s.reverse(), but that takes O(n) auxiliary memory. Can you do it in O(1) space?",
      },
      {
        step: 2,
        title: "Two Pointers from Both Ends",
        content:
          "Start one pointer at 0 and another at length - 1. Increment left and decrement right while character is not alphanumeric.",
      },
      {
        step: 3,
        title: "Case Insensitive Comparison",
        content:
          "Compare lowercase versions of characters at left and right. If they differ, return false immediately.",
      },
    ],
    solution: {
      approach: "Two Pointers In-Place",
      timeComplexity: "O(n) — We traverse each character in the string at most once.",
      spaceComplexity: "O(1) — Only two integer pointers are used in memory.",
      explanation:
        "Using two pointers moving toward the center, we skip non-alphanumeric characters and compare the remaining characters case-insensitively. If all matching pairs are equal until the pointers meet, the string is a valid palindrome.",
      code: {
        typescript: `function isPalindrome(s: string): boolean {
  let left = 0;
  let right = s.length - 1;
  const isAlphaNum = (c: string) => /[a-z0-9]/i.test(c);

  while (left < right) {
    while (left < right && !isAlphaNum(s[left])) left++;
    while (left < right && !isAlphaNum(s[right])) right--;
    if (s[left].toLowerCase() !== s[right].toLowerCase()) {
      return false;
    }
    left++;
    right--;
  }
  return true;
}`,
      },
    },
  },
  {
    id: "best-time-to-buy-stock",
    slug: "best-time-to-buy-stock",
    title: "Best Time to Buy and Sell Stock",
    topicId: "sliding-window",
    difficulty: "Easy",
    category: "OA",
    companies: ["Amazon", "Google", "Databricks", "Figma", "Stripe"],
    summary:
      "You want to maximize your profit by choosing a single day to buy one stock and choosing a different day in the future to sell that stock.",
    descriptionMarkdown: `You are given an array \`prices\` where \`prices[i]\` is the price of a given stock on the \`i\`th day.

You want to maximize your profit by choosing a **single day** to buy one stock and choosing a **different day in the future** to sell that stock.

Return *the maximum profit you can achieve from this transaction*. If you cannot achieve any profit, return \`0\`.`,
    examples: [
      {
        input: "prices = [7,1,5,3,6,4]",
        output: "5",
        explanation: "Buy on day 2 (price = 1) and sell on day 5 (price = 6), profit = 6-1 = 5. Note that buying on day 2 and selling on day 1 is not allowed.",
      },
      {
        input: "prices = [7,6,4,3,1]",
        output: "0",
        explanation: "In this case, no transactions are done and the max profit = 0.",
      },
    ],
    constraints: [
      "1 <= prices.length <= 10^5",
      "0 <= prices[i] <= 10^4",
    ],
    starterTemplates: {
      typescript: `function maxProfit(prices: number[]): number {
  // Write your solution here
  return 0;
}`,
      javascript: `function maxProfit(prices) {
  // Write your solution here
  return 0;
}`,
      python: `class Solution:
    def maxProfit(self, prices: list[int]) -> int:
        # Write your solution here
        return 0`,
      java: `class Solution {
    public int maxProfit(int[] prices) {
        // Write your solution here
        return 0;
    }
}`,
      cpp: `class Solution {
public:
    int maxProfit(vector<int>& prices) {
        // Write your solution here
        return 0;
    }
};`,
    },
    testCases: [
      {
        id: "stock-tc-1",
        inputDisplay: "[7, 1, 5, 3, 6, 4]",
        args: [[7, 1, 5, 3, 6, 4]],
        expected: 5,
        expectedDisplay: "5",
      },
      {
        id: "stock-tc-2",
        inputDisplay: "[7, 6, 4, 3, 1]",
        args: [[7, 6, 4, 3, 1]],
        expected: 0,
        expectedDisplay: "0",
      },
    ],
    hints: [
      {
        step: 1,
        title: "Track the Minimum",
        content: "To maximize profit, you always want to buy at the lowest historical price seen so far.",
      },
      {
        step: 2,
        title: "Single Pass",
        content: "Iterate from day 0 to N-1. Maintain minPrice and maxProfit.",
      },
      {
        step: 3,
        title: "Calculate Spread",
        content: "On each day: maxProfit = max(maxProfit, price - minPrice), then minPrice = min(minPrice, price).",
      },
    ],
    solution: {
      approach: "One-Pass Dynamic Minimum",
      timeComplexity: "O(n) — Single pass over the prices array.",
      spaceComplexity: "O(1) — Only two scalar numbers tracked.",
      explanation:
        "By continually tracking the lowest price seen so far, each day's optimal potential profit is simply currentPrice - minPriceSoFar. We track the maximum spread encountered.",
      code: {
        typescript: `function maxProfit(prices: number[]): number {
  let minPrice = Infinity;
  let maxProfit = 0;
  for (const price of prices) {
    if (price < minPrice) {
      minPrice = price;
    } else {
      maxProfit = Math.max(maxProfit, price - minPrice);
    }
  }
  return maxProfit;
}`,
      },
    },
  },
  {
    id: "valid-parentheses",
    slug: "valid-parentheses",
    title: "Valid Parentheses",
    topicId: "stack",
    difficulty: "Easy",
    category: "OA",
    companies: ["Amazon", "Google", "Meta", "Cloudflare"],
    summary:
      "Given a string s containing just the characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid.",
    descriptionMarkdown: `Given a string \`s\` containing just the characters \`'('\`, \`')'\`, \`'{'\`, \`'}'\`, \`'['\` and \`']'\`, determine if the input string is valid.

An input string is valid if:
1. Open brackets must be closed by the same type of brackets.
2. Open brackets must be closed in the correct order.
3. Every close bracket has a corresponding open bracket of the same type.`,
    examples: [
      {
        input: 's = "()"',
        output: "true",
      },
      {
        input: 's = "()[]{}"',
        output: "true",
      },
      {
        input: 's = "(]"',
        output: "false",
      },
      {
        input: 's = "([])"',
        output: "true",
      },
    ],
    constraints: [
      "1 <= s.length <= 10^4",
      "s consists of parentheses only '()[]{}'.",
    ],
    starterTemplates: {
      typescript: `function isValid(s: string): boolean {
  // Write your solution here
  return false;
}`,
      javascript: `function isValid(s) {
  // Write your solution here
  return false;
}`,
      python: `class Solution:
    def isValid(self, s: str) -> bool:
        # Write your solution here
        return False`,
      java: `class Solution {
    public boolean isValid(String s) {
        // Write your solution here
        return false;
    }
}`,
      cpp: `class Solution {
public:
    bool isValid(string s) {
        // Write your solution here
        return false;
    }
};`,
    },
    testCases: [
      {
        id: "vp-tc-1",
        inputDisplay: '"()"',
        args: ["()"],
        expected: true,
        expectedDisplay: "true",
      },
      {
        id: "vp-tc-2",
        inputDisplay: '"()[]{}"',
        args: ["()[]{}"],
        expected: true,
        expectedDisplay: "true",
      },
      {
        id: "vp-tc-3",
        inputDisplay: '"(]"',
        args: ["(]"],
        expected: false,
        expectedDisplay: "false",
      },
      {
        id: "vp-tc-4",
        inputDisplay: '"([])"',
        args: ["([])"],
        expected: true,
        expectedDisplay: "true",
      },
    ],
    hints: [
      {
        step: 1,
        title: "LIFO Property",
        content:
          "The last opening bracket encountered must be the first one closed. This matches the Stack data structure perfectly.",
      },
      {
        step: 2,
        title: "Matching Closing Brackets",
        content:
          "When you see an opening bracket, push it. When you see a closing bracket, pop from the stack and check if it matches.",
      },
      {
        step: 3,
        title: "Clean Termination",
        content:
          "Don't forget to check if the stack is completely empty at the end. An unclosed bracket like '(' should return false.",
      },
    ],
    solution: {
      approach: "Stack Simulation",
      timeComplexity: "O(n) — Iterate through string of length n once. Each push/pop is O(1).",
      spaceComplexity: "O(n) — Worst case all opening brackets in stack.",
      explanation:
        "Using a stack, push opening brackets and pop upon finding closing brackets. If the popped bracket does not match the corresponding opening bracket, the string is invalid.",
      code: {
        typescript: `function isValid(s: string): boolean {
  const stack: string[] = [];
  const map: Record<string, string> = {
    ")": "(",
    "}": "{",
    "]": "[",
  };

  for (const ch of s) {
    if (ch === "(" || ch === "{" || ch === "[") {
      stack.push(ch);
    } else {
      const top = stack.pop();
      if (top !== map[ch]) return false;
    }
  }
  return stack.length === 0;
}`,
      },
    },
  },
  {
    id: "climbing-stairs",
    slug: "climbing-stairs",
    title: "Climbing Stairs",
    topicId: "dynamic-programming",
    difficulty: "Easy",
    category: "OA",
    companies: ["Google", "Amazon", "Cohere", "Spotify"],
    summary:
      "You are climbing a staircase. It takes n steps to reach the top. Each time you can either climb 1 or 2 steps. In how many distinct ways can you climb to the top?",
    descriptionMarkdown: `You are climbing a staircase. It takes \`n\` steps to reach the top.

Each time you can either climb \`1\` or \`2\` steps. In how many distinct ways can you climb to the top?`,
    examples: [
      {
        input: "n = 2",
        output: "2",
        explanation: "There are two ways to climb to the top: 1. 1 step + 1 step, 2. 2 steps.",
      },
      {
        input: "n = 3",
        output: "3",
        explanation: "There are three ways: 1. 1+1+1, 2. 1+2, 3. 2+1.",
      },
    ],
    constraints: ["1 <= n <= 45"],
    starterTemplates: {
      typescript: `function climbStairs(n: number): number {
  // Write your solution here
  return 0;
}`,
      javascript: `function climbStairs(n) {
  // Write your solution here
  return 0;
}`,
      python: `class Solution:
    def climbStairs(self, n: int) -> int:
        # Write your solution here
        return 0`,
      java: `class Solution {
    public int climbStairs(int n) {
        // Write your solution here
        return 0;
    }
}`,
      cpp: `class Solution {
public:
    int climbStairs(int n) {
        // Write your solution here
        return 0;
    }
};`,
    },
    testCases: [
      {
        id: "cs-tc-1",
        inputDisplay: "n = 2",
        args: [2],
        expected: 2,
        expectedDisplay: "2",
      },
      {
        id: "cs-tc-2",
        inputDisplay: "n = 3",
        args: [3],
        expected: 3,
        expectedDisplay: "3",
      },
      {
        id: "cs-tc-3",
        inputDisplay: "n = 5",
        args: [5],
        expected: 8,
        expectedDisplay: "8",
      },
    ],
    hints: [
      {
        step: 1,
        title: "Subproblem Formulation",
        content: "To reach step n, where could you have jumped from? Step n-1 or step n-2.",
      },
      {
        step: 2,
        title: "Recurrence Relation",
        content: "ways(n) = ways(n-1) + ways(n-2). Base cases: ways(1) = 1, ways(2) = 2.",
      },
      {
        step: 3,
        title: "Space Optimization",
        content: "You only need the previous two numbers, so you can optimize memory to O(1) space.",
      },
    ],
    solution: {
      approach: "Bottom-Up DP with Rolling Variables",
      timeComplexity: "O(n) — Single loop from 3 up to n.",
      spaceComplexity: "O(1) — Only two integer variables maintained.",
      explanation:
        "The problem forms a Fibonacci sequence because reaching step n requires jumping from either step n-1 or n-2. We compute iteratively from base cases.",
      code: {
        typescript: `function climbStairs(n: number): number {
  if (n <= 2) return n;
  let prev2 = 1;
  let prev1 = 2;
  for (let i = 3; i <= n; i++) {
    const current = prev1 + prev2;
    prev2 = prev1;
    prev1 = current;
  }
  return prev1;
}`,
      },
    },
  },
  {
    id: "binary-search",
    slug: "binary-search",
    title: "Binary Search",
    topicId: "binary-search",
    difficulty: "Easy",
    category: "Phone Screen",
    companies: ["Amazon", "Google", "Meta", "Stripe", "Figma"],
    summary:
      "Given an array of integers nums which is sorted in ascending order, and an integer target, write a function to search target in nums.",
    descriptionMarkdown: `Given an array of integers \`nums\` which is sorted in ascending order, and an integer \`target\`, write a function to search \`target\` in \`nums\`. If \`target\` exists, then return its index. Otherwise, return \`-1\`.

You must write an algorithm with \`O(log n)\` runtime complexity.`,
    examples: [
      {
        input: "nums = [-1,0,3,5,9,12], target = 9",
        output: "4",
        explanation: "9 exists in nums and its index is 4.",
      },
      {
        input: "nums = [-1,0,3,5,9,12], target = 2",
        output: "-1",
        explanation: "2 does not exist in nums so return -1.",
      },
    ],
    constraints: [
      "1 <= nums.length <= 10^4",
      "-10^4 < nums[i], target < 10^4",
      "All the integers in nums are unique.",
      "nums is sorted in ascending order.",
    ],
    starterTemplates: {
      typescript: `function search(nums: number[], target: number): number {
  // Write your solution here
  return -1;
}`,
      javascript: `function search(nums, target) {
  // Write your solution here
  return -1;
}`,
      python: `class Solution:
    def search(self, nums: list[int], target: int) -> int:
        # Write your solution here
        return -1`,
      java: `class Solution {
    public int search(int[] nums, int target) {
        // Write your solution here
        return -1;
    }
}`,
      cpp: `class Solution {
public:
    int search(vector<int>& nums, int target) {
        // Write your solution here
        return -1;
    }
};`,
    },
    testCases: [
      {
        id: "bs-tc-1",
        inputDisplay: "nums = [-1,0,3,5,9,12], target = 9",
        args: [[-1, 0, 3, 5, 9, 12], 9],
        expected: 4,
        expectedDisplay: "4",
      },
      {
        id: "bs-tc-2",
        inputDisplay: "nums = [-1,0,3,5,9,12], target = 2",
        args: [[-1, 0, 3, 5, 9, 12], 2],
        expected: -1,
        expectedDisplay: "-1",
      },
    ],
    hints: [
      {
        step: 1,
        title: "Halving Search Space",
        content: "Because nums is sorted, checking the middle element tells you whether target is in the left half or right half.",
      },
      {
        step: 2,
        title: "Midpoint Calculation",
        content: "Calculate mid = left + Math.floor((right - left) / 2) to prevent overflow.",
      },
      {
        step: 3,
        title: "Loop Termination",
        content: "Loop while left <= right. When target > nums[mid], move left = mid + 1.",
      },
    ],
    solution: {
      approach: "Iterative Binary Search",
      timeComplexity: "O(log n) — The search space is divided in half on each step.",
      spaceComplexity: "O(1) — No additional memory allocation.",
      explanation:
        "Using pointers left and right, we repeatedly evaluate the midpoint and narrow our search boundary until the element is found or the pointers cross.",
      code: {
        typescript: `function search(nums: number[], target: number): number {
  let left = 0;
  let right = nums.length - 1;

  while (left <= right) {
    const mid = left + Math.floor((right - left) / 2);
    if (nums[mid] === target) {
      return mid;
    } else if (nums[mid] < target) {
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }
  return -1;
}`,
      },
    },
  },
];

export function getAllTopics(): TopicCurriculum[] {
  return TOPIC_CURRICULUM;
}

export function getTopicById(id: string): TopicCurriculum | undefined {
  return TOPIC_CURRICULUM.find((t) => t.id === id);
}

export function getAllProblems(): PracticeProblem[] {
  return PRACTICE_PROBLEMS;
}

export function getProblemBySlug(slug: string): PracticeProblem | undefined {
  return PRACTICE_PROBLEMS.find((p) => p.slug === slug);
}

export function getProblemById(id: string): PracticeProblem | undefined {
  return PRACTICE_PROBLEMS.find((p) => p.id === id);
}

export function getProblemsByTopic(topicId: string): PracticeProblem[] {
  return PRACTICE_PROBLEMS.filter((p) => p.topicId === topicId);
}

export function getProblemsByCompany(company: string): PracticeProblem[] {
  const norm = company.toLowerCase().trim();
  return PRACTICE_PROBLEMS.filter((p) =>
    p.companies.some((c) => c.toLowerCase().includes(norm))
  );
}

export function getAllCompanies(): string[] {
  const set = new Set<string>();
  for (const p of PRACTICE_PROBLEMS) {
    for (const c of p.companies) {
      set.add(c);
    }
  }
  return Array.from(set).sort();
}
