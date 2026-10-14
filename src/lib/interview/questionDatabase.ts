import { InterviewQuestion, CompanyLogo } from "../schema/interviewPrep";

export const NEETCODE_150: InterviewQuestion[] = [
  {
    "id": "nc1",
    "title": "Two Sum",
    "track": "algorithms",
    "category": "Arrays & Hashing",
    "difficulty": "Easy",
    "companyTags": [
      "amazon",
      "google",
      "meta"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Use single-pass hash map tracking complement value (target - num) and index.",
    "constraints": [
      "Input constraints standard for Easy LeetCode problems."
    ],
    "timeComplexity": "O(n)",
    "spaceComplexity": "O(n)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Arrays & Hashing pattern under tight complexity bounds.",
      "task": "Achieve target O(n) runtime complexity with O(n) memory overhead.",
      "action": "Use single-pass hash map tracking complement value (target - num) and index.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc2",
    "title": "Valid Anagram",
    "track": "algorithms",
    "category": "Arrays & Hashing",
    "difficulty": "Easy",
    "companyTags": [
      "uber",
      "google"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Use 26-element integer frequency array or character count hash map.",
    "constraints": [
      "Input constraints standard for Easy LeetCode problems."
    ],
    "timeComplexity": "O(n)",
    "spaceComplexity": "O(1)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Arrays & Hashing pattern under tight complexity bounds.",
      "task": "Achieve target O(n) runtime complexity with O(1) memory overhead.",
      "action": "Use 26-element integer frequency array or character count hash map.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc3",
    "title": "Contains Duplicate",
    "track": "algorithms",
    "category": "Arrays & Hashing",
    "difficulty": "Easy",
    "companyTags": [
      "microsoft",
      "apple"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Use hash set to check seen status during array iteration.",
    "constraints": [
      "Input constraints standard for Easy LeetCode problems."
    ],
    "timeComplexity": "O(n)",
    "spaceComplexity": "O(n)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Arrays & Hashing pattern under tight complexity bounds.",
      "task": "Achieve target O(n) runtime complexity with O(n) memory overhead.",
      "action": "Use hash set to check seen status during array iteration.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc4",
    "title": "Group Anagrams",
    "track": "algorithms",
    "category": "Arrays & Hashing",
    "difficulty": "Medium",
    "companyTags": [
      "amazon",
      "meta"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Hash character frequency tuple or sorted string key in a map.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(n * k)",
    "spaceComplexity": "O(n * k)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Arrays & Hashing pattern under tight complexity bounds.",
      "task": "Achieve target O(n * k) runtime complexity with O(n * k) memory overhead.",
      "action": "Hash character frequency tuple or sorted string key in a map.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc5",
    "title": "Top K Frequent Elements",
    "track": "algorithms",
    "category": "Arrays & Hashing",
    "difficulty": "Medium",
    "companyTags": [
      "amazon",
      "meta"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Count frequencies then apply bucket sort indexed by frequency count.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(n)",
    "spaceComplexity": "O(n)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Arrays & Hashing pattern under tight complexity bounds.",
      "task": "Achieve target O(n) runtime complexity with O(n) memory overhead.",
      "action": "Count frequencies then apply bucket sort indexed by frequency count.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc6",
    "title": "Product of Array Except Self",
    "track": "algorithms",
    "category": "Arrays & Hashing",
    "difficulty": "Medium",
    "companyTags": [
      "apple",
      "google"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Prefix and suffix product passes storing running product directly in result array.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(n)",
    "spaceComplexity": "O(1)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Arrays & Hashing pattern under tight complexity bounds.",
      "task": "Achieve target O(n) runtime complexity with O(1) memory overhead.",
      "action": "Prefix and suffix product passes storing running product directly in result array.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc7",
    "title": "Valid Sudoku",
    "track": "algorithms",
    "category": "Arrays & Hashing",
    "difficulty": "Medium",
    "companyTags": [
      "amazon",
      "uber"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Validate 9 rows, 9 columns, and 9 3x3 sub-boxes using bitmasks or hash sets.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(1)",
    "spaceComplexity": "O(1)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Arrays & Hashing pattern under tight complexity bounds.",
      "task": "Achieve target O(1) runtime complexity with O(1) memory overhead.",
      "action": "Validate 9 rows, 9 columns, and 9 3x3 sub-boxes using bitmasks or hash sets.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc8",
    "title": "Encode and Decode Strings",
    "track": "algorithms",
    "category": "Arrays & Hashing",
    "difficulty": "Medium",
    "companyTags": [
      "google",
      "meta"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Length-prefixed encoding format: `[len]#[string]` for unambiguous decoding.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(n)",
    "spaceComplexity": "O(n)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Arrays & Hashing pattern under tight complexity bounds.",
      "task": "Achieve target O(n) runtime complexity with O(n) memory overhead.",
      "action": "Length-prefixed encoding format: `[len]#[string]` for unambiguous decoding.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc9",
    "title": "Longest Consecutive Sequence",
    "track": "algorithms",
    "category": "Arrays & Hashing",
    "difficulty": "Medium",
    "companyTags": [
      "google",
      "stripe"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Store numbers in set; start sequence count only when `num - 1` is absent.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(n)",
    "spaceComplexity": "O(n)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Arrays & Hashing pattern under tight complexity bounds.",
      "task": "Achieve target O(n) runtime complexity with O(n) memory overhead.",
      "action": "Store numbers in set; start sequence count only when `num - 1` is absent.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc10",
    "title": "Valid Palindrome",
    "track": "algorithms",
    "category": "Two Pointers",
    "difficulty": "Easy",
    "companyTags": [
      "meta",
      "microsoft"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Two pointers from left and right skipping non-alphanumerics with case insensitivity.",
    "constraints": [
      "Input constraints standard for Easy LeetCode problems."
    ],
    "timeComplexity": "O(n)",
    "spaceComplexity": "O(1)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Two Pointers pattern under tight complexity bounds.",
      "task": "Achieve target O(n) runtime complexity with O(1) memory overhead.",
      "action": "Two pointers from left and right skipping non-alphanumerics with case insensitivity.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc11",
    "title": "Two Sum II Input Array Is Sorted",
    "track": "algorithms",
    "category": "Two Pointers",
    "difficulty": "Medium",
    "companyTags": [
      "amazon"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Two pointers moving inwards based on sum comparison to target.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(n)",
    "spaceComplexity": "O(1)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Two Pointers pattern under tight complexity bounds.",
      "task": "Achieve target O(n) runtime complexity with O(1) memory overhead.",
      "action": "Two pointers moving inwards based on sum comparison to target.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc12",
    "title": "3Sum",
    "track": "algorithms",
    "category": "Two Pointers",
    "difficulty": "Medium",
    "companyTags": [
      "meta",
      "amazon"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Sort array, fix first element, and run two pointers for remaining two with duplicate skipping.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(n^2)",
    "spaceComplexity": "O(1)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Two Pointers pattern under tight complexity bounds.",
      "task": "Achieve target O(n^2) runtime complexity with O(1) memory overhead.",
      "action": "Sort array, fix first element, and run two pointers for remaining two with duplicate skipping.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc13",
    "title": "Container With Most Water",
    "track": "algorithms",
    "category": "Two Pointers",
    "difficulty": "Medium",
    "companyTags": [
      "google",
      "amazon"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Two pointers at edges, advance pointer with smaller height to maximize area.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(n)",
    "spaceComplexity": "O(1)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Two Pointers pattern under tight complexity bounds.",
      "task": "Achieve target O(n) runtime complexity with O(1) memory overhead.",
      "action": "Two pointers at edges, advance pointer with smaller height to maximize area.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc14",
    "title": "Trapping Rain Water",
    "track": "algorithms",
    "category": "Two Pointers",
    "difficulty": "Hard",
    "companyTags": [
      "amazon",
      "google"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Two pointers maintaining leftMax and rightMax tracking trapped units.",
    "constraints": [
      "Input constraints standard for Hard LeetCode problems."
    ],
    "timeComplexity": "O(n)",
    "spaceComplexity": "O(1)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Two Pointers pattern under tight complexity bounds.",
      "task": "Achieve target O(n) runtime complexity with O(1) memory overhead.",
      "action": "Two pointers maintaining leftMax and rightMax tracking trapped units.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc15",
    "title": "Best Time to Buy and Sell Stock",
    "track": "algorithms",
    "category": "Sliding Window",
    "difficulty": "Easy",
    "companyTags": [
      "amazon",
      "meta"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Track minimum price seen so far and update maximum profit.",
    "constraints": [
      "Input constraints standard for Easy LeetCode problems."
    ],
    "timeComplexity": "O(n)",
    "spaceComplexity": "O(1)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Sliding Window pattern under tight complexity bounds.",
      "task": "Achieve target O(n) runtime complexity with O(1) memory overhead.",
      "action": "Track minimum price seen so far and update maximum profit.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc16",
    "title": "Longest Substring Without Repeating Characters",
    "track": "algorithms",
    "category": "Sliding Window",
    "difficulty": "Medium",
    "companyTags": [
      "meta",
      "amazon"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Sliding window with character index map to contract left boundary on duplicates.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(n)",
    "spaceComplexity": "O(min(m,n))",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Sliding Window pattern under tight complexity bounds.",
      "task": "Achieve target O(n) runtime complexity with O(min(m,n)) memory overhead.",
      "action": "Sliding window with character index map to contract left boundary on duplicates.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc17",
    "title": "Longest Repeating Character Replacement",
    "track": "algorithms",
    "category": "Sliding Window",
    "difficulty": "Medium",
    "companyTags": [
      "google",
      "uber"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Window length minus max frequency must be <= k; slide window accordingly.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(n)",
    "spaceComplexity": "O(1)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Sliding Window pattern under tight complexity bounds.",
      "task": "Achieve target O(n) runtime complexity with O(1) memory overhead.",
      "action": "Window length minus max frequency must be <= k; slide window accordingly.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc18",
    "title": "Permutation in String",
    "track": "algorithms",
    "category": "Sliding Window",
    "difficulty": "Medium",
    "companyTags": [
      "microsoft"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Fixed-size sliding window comparing character count array matching s1 length.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(n)",
    "spaceComplexity": "O(1)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Sliding Window pattern under tight complexity bounds.",
      "task": "Achieve target O(n) runtime complexity with O(1) memory overhead.",
      "action": "Fixed-size sliding window comparing character count array matching s1 length.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc19",
    "title": "Minimum Window Substring",
    "track": "algorithms",
    "category": "Sliding Window",
    "difficulty": "Hard",
    "companyTags": [
      "meta",
      "google"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Sliding window tracking matched unique character counts against target frequency.",
    "constraints": [
      "Input constraints standard for Hard LeetCode problems."
    ],
    "timeComplexity": "O(n)",
    "spaceComplexity": "O(m)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Sliding Window pattern under tight complexity bounds.",
      "task": "Achieve target O(n) runtime complexity with O(m) memory overhead.",
      "action": "Sliding window tracking matched unique character counts against target frequency.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc20",
    "title": "Sliding Window Maximum",
    "track": "algorithms",
    "category": "Sliding Window",
    "difficulty": "Hard",
    "companyTags": [
      "google",
      "amazon"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Monotonic decreasing deque holding indices within current window.",
    "constraints": [
      "Input constraints standard for Hard LeetCode problems."
    ],
    "timeComplexity": "O(n)",
    "spaceComplexity": "O(k)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Sliding Window pattern under tight complexity bounds.",
      "task": "Achieve target O(n) runtime complexity with O(k) memory overhead.",
      "action": "Monotonic decreasing deque holding indices within current window.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc21",
    "title": "Valid Parentheses",
    "track": "algorithms",
    "category": "Stack",
    "difficulty": "Easy",
    "companyTags": [
      "meta",
      "google"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Stack matching open brackets against closing bracket map.",
    "constraints": [
      "Input constraints standard for Easy LeetCode problems."
    ],
    "timeComplexity": "O(n)",
    "spaceComplexity": "O(n)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Stack pattern under tight complexity bounds.",
      "task": "Achieve target O(n) runtime complexity with O(n) memory overhead.",
      "action": "Stack matching open brackets against closing bracket map.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc22",
    "title": "Min Stack",
    "track": "algorithms",
    "category": "Stack",
    "difficulty": "Medium",
    "companyTags": [
      "amazon",
      "apple"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Primary stack paired with auxiliary minimum tracking stack.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(1)",
    "spaceComplexity": "O(n)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Stack pattern under tight complexity bounds.",
      "task": "Achieve target O(1) runtime complexity with O(n) memory overhead.",
      "action": "Primary stack paired with auxiliary minimum tracking stack.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc23",
    "title": "Evaluate Reverse Polish Notation",
    "track": "algorithms",
    "category": "Stack",
    "difficulty": "Medium",
    "companyTags": [
      "meta",
      "google"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Stack pushing operands and evaluating binary operators on pop.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(n)",
    "spaceComplexity": "O(n)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Stack pattern under tight complexity bounds.",
      "task": "Achieve target O(n) runtime complexity with O(n) memory overhead.",
      "action": "Stack pushing operands and evaluating binary operators on pop.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc24",
    "title": "Generate Parentheses",
    "track": "algorithms",
    "category": "Stack",
    "difficulty": "Medium",
    "companyTags": [
      "microsoft",
      "amazon"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Backtracking adding '(' when open < n and ')' when close < open.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(4^n / sqrt(n))",
    "spaceComplexity": "O(n)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Stack pattern under tight complexity bounds.",
      "task": "Achieve target O(4^n / sqrt(n)) runtime complexity with O(n) memory overhead.",
      "action": "Backtracking adding '(' when open < n and ')' when close < open.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc25",
    "title": "Daily Temperatures",
    "track": "algorithms",
    "category": "Stack",
    "difficulty": "Medium",
    "companyTags": [
      "amazon",
      "meta"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Monotonic decreasing stack storing indices waiting for warmer day.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(n)",
    "spaceComplexity": "O(n)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Stack pattern under tight complexity bounds.",
      "task": "Achieve target O(n) runtime complexity with O(n) memory overhead.",
      "action": "Monotonic decreasing stack storing indices waiting for warmer day.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc26",
    "title": "Car Fleet",
    "track": "algorithms",
    "category": "Stack",
    "difficulty": "Medium",
    "companyTags": [
      "google"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Sort cars by position descending, compute time to target, stack merge fleets.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(n log n)",
    "spaceComplexity": "O(n)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Stack pattern under tight complexity bounds.",
      "task": "Achieve target O(n log n) runtime complexity with O(n) memory overhead.",
      "action": "Sort cars by position descending, compute time to target, stack merge fleets.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc27",
    "title": "Largest Rectangle in Histogram",
    "track": "algorithms",
    "category": "Stack",
    "difficulty": "Hard",
    "companyTags": [
      "amazon",
      "google"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Monotonic increasing stack calculating width when popping taller bars.",
    "constraints": [
      "Input constraints standard for Hard LeetCode problems."
    ],
    "timeComplexity": "O(n)",
    "spaceComplexity": "O(n)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Stack pattern under tight complexity bounds.",
      "task": "Achieve target O(n) runtime complexity with O(n) memory overhead.",
      "action": "Monotonic increasing stack calculating width when popping taller bars.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc28",
    "title": "Binary Search",
    "track": "algorithms",
    "category": "Binary Search",
    "difficulty": "Easy",
    "companyTags": [
      "apple",
      "google"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Standard low/high pointers with midpoint `low + (high - low) / 2`.",
    "constraints": [
      "Input constraints standard for Easy LeetCode problems."
    ],
    "timeComplexity": "O(log n)",
    "spaceComplexity": "O(1)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Binary Search pattern under tight complexity bounds.",
      "task": "Achieve target O(log n) runtime complexity with O(1) memory overhead.",
      "action": "Standard low/high pointers with midpoint `low + (high - low) / 2`.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc29",
    "title": "Search a 2D Matrix",
    "track": "algorithms",
    "category": "Binary Search",
    "difficulty": "Medium",
    "companyTags": [
      "amazon",
      "microsoft"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Treat m x n matrix as 1D array of length m*n using row = idx / n and col = idx % n.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(log(m*n))",
    "spaceComplexity": "O(1)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Binary Search pattern under tight complexity bounds.",
      "task": "Achieve target O(log(m*n)) runtime complexity with O(1) memory overhead.",
      "action": "Treat m x n matrix as 1D array of length m*n using row = idx / n and col = idx % n.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc30",
    "title": "Koko Eating Bananas",
    "track": "algorithms",
    "category": "Binary Search",
    "difficulty": "Medium",
    "companyTags": [
      "google",
      "uber"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Binary search on eating speed k between 1 and max(piles).",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(n log m)",
    "spaceComplexity": "O(1)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Binary Search pattern under tight complexity bounds.",
      "task": "Achieve target O(n log m) runtime complexity with O(1) memory overhead.",
      "action": "Binary search on eating speed k between 1 and max(piles).",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc31",
    "title": "Find Minimum in Rotated Sorted Array",
    "track": "algorithms",
    "category": "Binary Search",
    "difficulty": "Medium",
    "companyTags": [
      "amazon",
      "meta"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Compare mid with high pointer to eliminate sorted half.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(log n)",
    "spaceComplexity": "O(1)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Binary Search pattern under tight complexity bounds.",
      "task": "Achieve target O(log n) runtime complexity with O(1) memory overhead.",
      "action": "Compare mid with high pointer to eliminate sorted half.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc32",
    "title": "Search in Rotated Sorted Array",
    "track": "algorithms",
    "category": "Binary Search",
    "difficulty": "Medium",
    "companyTags": [
      "meta",
      "google"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Identify which half is strictly sorted and test if target falls in range.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(log n)",
    "spaceComplexity": "O(1)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Binary Search pattern under tight complexity bounds.",
      "task": "Achieve target O(log n) runtime complexity with O(1) memory overhead.",
      "action": "Identify which half is strictly sorted and test if target falls in range.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc33",
    "title": "Time Based Key-Value Store",
    "track": "algorithms",
    "category": "Binary Search",
    "difficulty": "Medium",
    "companyTags": [
      "stripe",
      "netflix"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Hash map of keys to arrays of timestamped values; binary search on timestamps.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(log n)",
    "spaceComplexity": "O(n)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Binary Search pattern under tight complexity bounds.",
      "task": "Achieve target O(log n) runtime complexity with O(n) memory overhead.",
      "action": "Hash map of keys to arrays of timestamped values; binary search on timestamps.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc34",
    "title": "Median of Two Sorted Arrays",
    "track": "algorithms",
    "category": "Binary Search",
    "difficulty": "Hard",
    "companyTags": [
      "google",
      "amazon"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Binary search partition on smaller array ensuring maxLeft <= minRight across both.",
    "constraints": [
      "Input constraints standard for Hard LeetCode problems."
    ],
    "timeComplexity": "O(log(min(m,n)))",
    "spaceComplexity": "O(1)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Binary Search pattern under tight complexity bounds.",
      "task": "Achieve target O(log(min(m,n))) runtime complexity with O(1) memory overhead.",
      "action": "Binary search partition on smaller array ensuring maxLeft <= minRight across both.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc35",
    "title": "Reverse Linked List",
    "track": "algorithms",
    "category": "Linked List",
    "difficulty": "Easy",
    "companyTags": [
      "amazon",
      "google",
      "meta"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Three pointers (prev, curr, next) iterating node by node.",
    "constraints": [
      "Input constraints standard for Easy LeetCode problems."
    ],
    "timeComplexity": "O(n)",
    "spaceComplexity": "O(1)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Linked List pattern under tight complexity bounds.",
      "task": "Achieve target O(n) runtime complexity with O(1) memory overhead.",
      "action": "Three pointers (prev, curr, next) iterating node by node.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc36",
    "title": "Merge Two Sorted Lists",
    "track": "algorithms",
    "category": "Linked List",
    "difficulty": "Easy",
    "companyTags": [
      "amazon",
      "apple"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Dummy head pointer splicing nodes in non-decreasing order.",
    "constraints": [
      "Input constraints standard for Easy LeetCode problems."
    ],
    "timeComplexity": "O(n + m)",
    "spaceComplexity": "O(1)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Linked List pattern under tight complexity bounds.",
      "task": "Achieve target O(n + m) runtime complexity with O(1) memory overhead.",
      "action": "Dummy head pointer splicing nodes in non-decreasing order.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc37",
    "title": "Reorder List",
    "track": "algorithms",
    "category": "Linked List",
    "difficulty": "Medium",
    "companyTags": [
      "meta"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Find midpoint with fast/slow pointers, reverse second half, weave two halves together.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(n)",
    "spaceComplexity": "O(1)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Linked List pattern under tight complexity bounds.",
      "task": "Achieve target O(n) runtime complexity with O(1) memory overhead.",
      "action": "Find midpoint with fast/slow pointers, reverse second half, weave two halves together.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc38",
    "title": "Remove Nth Node From End of List",
    "track": "algorithms",
    "category": "Linked List",
    "difficulty": "Medium",
    "companyTags": [
      "google"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Two pointers separated by n nodes advancing to end with dummy head.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(n)",
    "spaceComplexity": "O(1)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Linked List pattern under tight complexity bounds.",
      "task": "Achieve target O(n) runtime complexity with O(1) memory overhead.",
      "action": "Two pointers separated by n nodes advancing to end with dummy head.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc39",
    "title": "Copy List with Random Pointer",
    "track": "algorithms",
    "category": "Linked List",
    "difficulty": "Medium",
    "companyTags": [
      "amazon",
      "microsoft"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Interleave copied nodes next to originals, assign randoms, then unweave.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(n)",
    "spaceComplexity": "O(1)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Linked List pattern under tight complexity bounds.",
      "task": "Achieve target O(n) runtime complexity with O(1) memory overhead.",
      "action": "Interleave copied nodes next to originals, assign randoms, then unweave.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc40",
    "title": "Add Two Numbers",
    "track": "algorithms",
    "category": "Linked List",
    "difficulty": "Medium",
    "companyTags": [
      "amazon",
      "meta"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Elementary addition with carry variable creating new result nodes.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(max(n,m))",
    "spaceComplexity": "O(1)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Linked List pattern under tight complexity bounds.",
      "task": "Achieve target O(max(n,m)) runtime complexity with O(1) memory overhead.",
      "action": "Elementary addition with carry variable creating new result nodes.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc41",
    "title": "Linked List Cycle",
    "track": "algorithms",
    "category": "Linked List",
    "difficulty": "Easy",
    "companyTags": [
      "microsoft"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Floyd's Tortoise and Hare fast/slow pointer cycle detection.",
    "constraints": [
      "Input constraints standard for Easy LeetCode problems."
    ],
    "timeComplexity": "O(n)",
    "spaceComplexity": "O(1)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Linked List pattern under tight complexity bounds.",
      "task": "Achieve target O(n) runtime complexity with O(1) memory overhead.",
      "action": "Floyd's Tortoise and Hare fast/slow pointer cycle detection.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc42",
    "title": "Find the Duplicate Number",
    "track": "algorithms",
    "category": "Linked List",
    "difficulty": "Medium",
    "companyTags": [
      "amazon"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Cycle detection treating array values as next pointers in a linked list.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(n)",
    "spaceComplexity": "O(1)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Linked List pattern under tight complexity bounds.",
      "task": "Achieve target O(n) runtime complexity with O(1) memory overhead.",
      "action": "Cycle detection treating array values as next pointers in a linked list.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc43",
    "title": "LRU Cache",
    "track": "algorithms",
    "category": "Linked List",
    "difficulty": "Medium",
    "companyTags": [
      "amazon",
      "google",
      "meta"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Doubly linked list paired with hash map for O(1) get and put eviction.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(1)",
    "spaceComplexity": "O(c)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Linked List pattern under tight complexity bounds.",
      "task": "Achieve target O(1) runtime complexity with O(c) memory overhead.",
      "action": "Doubly linked list paired with hash map for O(1) get and put eviction.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc44",
    "title": "Merge k Sorted Lists",
    "track": "algorithms",
    "category": "Linked List",
    "difficulty": "Hard",
    "companyTags": [
      "meta",
      "amazon"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Min-heap storing k node heads, popping min and pushing next.",
    "constraints": [
      "Input constraints standard for Hard LeetCode problems."
    ],
    "timeComplexity": "O(n log k)",
    "spaceComplexity": "O(k)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Linked List pattern under tight complexity bounds.",
      "task": "Achieve target O(n log k) runtime complexity with O(k) memory overhead.",
      "action": "Min-heap storing k node heads, popping min and pushing next.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc45",
    "title": "Reverse Nodes in k-Group",
    "track": "algorithms",
    "category": "Linked List",
    "difficulty": "Hard",
    "companyTags": [
      "google",
      "microsoft"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Count k nodes ahead, reverse group in-place, and connect boundaries.",
    "constraints": [
      "Input constraints standard for Hard LeetCode problems."
    ],
    "timeComplexity": "O(n)",
    "spaceComplexity": "O(1)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Linked List pattern under tight complexity bounds.",
      "task": "Achieve target O(n) runtime complexity with O(1) memory overhead.",
      "action": "Count k nodes ahead, reverse group in-place, and connect boundaries.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc46",
    "title": "Invert Binary Tree",
    "track": "algorithms",
    "category": "Trees",
    "difficulty": "Easy",
    "companyTags": [
      "google"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Recursively swap left and right child pointers down to leaves.",
    "constraints": [
      "Input constraints standard for Easy LeetCode problems."
    ],
    "timeComplexity": "O(n)",
    "spaceComplexity": "O(h)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Trees pattern under tight complexity bounds.",
      "task": "Achieve target O(n) runtime complexity with O(h) memory overhead.",
      "action": "Recursively swap left and right child pointers down to leaves.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc47",
    "title": "Maximum Depth of Binary Tree",
    "track": "algorithms",
    "category": "Trees",
    "difficulty": "Easy",
    "companyTags": [
      "amazon"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "DFS returning 1 + max(depth(left), depth(right)).",
    "constraints": [
      "Input constraints standard for Easy LeetCode problems."
    ],
    "timeComplexity": "O(n)",
    "spaceComplexity": "O(h)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Trees pattern under tight complexity bounds.",
      "task": "Achieve target O(n) runtime complexity with O(h) memory overhead.",
      "action": "DFS returning 1 + max(depth(left), depth(right)).",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc48",
    "title": "Diameter of Binary Tree",
    "track": "algorithms",
    "category": "Trees",
    "difficulty": "Easy",
    "companyTags": [
      "meta"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Postorder traversal calculating left_height + right_height at each node.",
    "constraints": [
      "Input constraints standard for Easy LeetCode problems."
    ],
    "timeComplexity": "O(n)",
    "spaceComplexity": "O(h)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Trees pattern under tight complexity bounds.",
      "task": "Achieve target O(n) runtime complexity with O(h) memory overhead.",
      "action": "Postorder traversal calculating left_height + right_height at each node.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc49",
    "title": "Balanced Binary Tree",
    "track": "algorithms",
    "category": "Trees",
    "difficulty": "Easy",
    "companyTags": [
      "google"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Bottom-up DFS returning -1 if height difference between subtrees > 1.",
    "constraints": [
      "Input constraints standard for Easy LeetCode problems."
    ],
    "timeComplexity": "O(n)",
    "spaceComplexity": "O(h)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Trees pattern under tight complexity bounds.",
      "task": "Achieve target O(n) runtime complexity with O(h) memory overhead.",
      "action": "Bottom-up DFS returning -1 if height difference between subtrees > 1.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc50",
    "title": "Same Tree",
    "track": "algorithms",
    "category": "Trees",
    "difficulty": "Easy",
    "companyTags": [
      "amazon"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Simultaneous DFS asserting value equality and structural parity.",
    "constraints": [
      "Input constraints standard for Easy LeetCode problems."
    ],
    "timeComplexity": "O(n)",
    "spaceComplexity": "O(h)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Trees pattern under tight complexity bounds.",
      "task": "Achieve target O(n) runtime complexity with O(h) memory overhead.",
      "action": "Simultaneous DFS asserting value equality and structural parity.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc51",
    "title": "Subtree of Another Tree",
    "track": "algorithms",
    "category": "Trees",
    "difficulty": "Easy",
    "companyTags": [
      "amazon"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "DFS on main tree calling isSameTree helper on every matching root.",
    "constraints": [
      "Input constraints standard for Easy LeetCode problems."
    ],
    "timeComplexity": "O(n * m)",
    "spaceComplexity": "O(h)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Trees pattern under tight complexity bounds.",
      "task": "Achieve target O(n * m) runtime complexity with O(h) memory overhead.",
      "action": "DFS on main tree calling isSameTree helper on every matching root.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc52",
    "title": "Lowest Common Ancestor of a Binary Search Tree",
    "track": "algorithms",
    "category": "Trees",
    "difficulty": "Medium",
    "companyTags": [
      "amazon",
      "meta"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Traverse left if both values < root, right if both > root; return split node.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(h)",
    "spaceComplexity": "O(1)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Trees pattern under tight complexity bounds.",
      "task": "Achieve target O(h) runtime complexity with O(1) memory overhead.",
      "action": "Traverse left if both values < root, right if both > root; return split node.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc53",
    "title": "Binary Tree Level Order Traversal",
    "track": "algorithms",
    "category": "Trees",
    "difficulty": "Medium",
    "companyTags": [
      "amazon",
      "meta"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "BFS with queue processing current level length in batches.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(n)",
    "spaceComplexity": "O(n)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Trees pattern under tight complexity bounds.",
      "task": "Achieve target O(n) runtime complexity with O(n) memory overhead.",
      "action": "BFS with queue processing current level length in batches.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc54",
    "title": "Binary Tree Right Side View",
    "track": "algorithms",
    "category": "Trees",
    "difficulty": "Medium",
    "companyTags": [
      "meta"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Level-order traversal capturing the last node of each level queue.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(n)",
    "spaceComplexity": "O(h)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Trees pattern under tight complexity bounds.",
      "task": "Achieve target O(n) runtime complexity with O(h) memory overhead.",
      "action": "Level-order traversal capturing the last node of each level queue.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc55",
    "title": "Count Good Nodes in Binary Tree",
    "track": "algorithms",
    "category": "Trees",
    "difficulty": "Medium",
    "companyTags": [
      "microsoft"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "DFS passing running maximum down tree, incrementing count when node.val >= max.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(n)",
    "spaceComplexity": "O(h)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Trees pattern under tight complexity bounds.",
      "task": "Achieve target O(n) runtime complexity with O(h) memory overhead.",
      "action": "DFS passing running maximum down tree, incrementing count when node.val >= max.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc56",
    "title": "Validate Binary Search Tree",
    "track": "algorithms",
    "category": "Trees",
    "difficulty": "Medium",
    "companyTags": [
      "amazon",
      "meta"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "DFS validating values stay strictly within (minLimit, maxLimit) boundaries.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(n)",
    "spaceComplexity": "O(h)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Trees pattern under tight complexity bounds.",
      "task": "Achieve target O(n) runtime complexity with O(h) memory overhead.",
      "action": "DFS validating values stay strictly within (minLimit, maxLimit) boundaries.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc57",
    "title": "Kth Smallest Element in a BST",
    "track": "algorithms",
    "category": "Trees",
    "difficulty": "Medium",
    "companyTags": [
      "uber"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Inorder traversal yielding sorted elements; stop when kth visited.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(h + k)",
    "spaceComplexity": "O(h)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Trees pattern under tight complexity bounds.",
      "task": "Achieve target O(h + k) runtime complexity with O(h) memory overhead.",
      "action": "Inorder traversal yielding sorted elements; stop when kth visited.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc58",
    "title": "Construct Binary Tree from Preorder and Inorder Traversal",
    "track": "algorithms",
    "category": "Trees",
    "difficulty": "Medium",
    "companyTags": [
      "amazon"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Root is first in preorder; lookup root in inorder map to partition left and right subtrees.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(n)",
    "spaceComplexity": "O(n)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Trees pattern under tight complexity bounds.",
      "task": "Achieve target O(n) runtime complexity with O(n) memory overhead.",
      "action": "Root is first in preorder; lookup root in inorder map to partition left and right subtrees.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc59",
    "title": "Binary Tree Maximum Path Sum",
    "track": "algorithms",
    "category": "Trees",
    "difficulty": "Hard",
    "companyTags": [
      "meta",
      "google"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Postorder DFS returning max single-branch gain while updating global max path sum.",
    "constraints": [
      "Input constraints standard for Hard LeetCode problems."
    ],
    "timeComplexity": "O(n)",
    "spaceComplexity": "O(h)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Trees pattern under tight complexity bounds.",
      "task": "Achieve target O(n) runtime complexity with O(h) memory overhead.",
      "action": "Postorder DFS returning max single-branch gain while updating global max path sum.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc60",
    "title": "Serialize and Deserialize Binary Tree",
    "track": "algorithms",
    "category": "Trees",
    "difficulty": "Hard",
    "companyTags": [
      "meta",
      "amazon"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Preorder traversal with '#' null markers for deterministic string decoding.",
    "constraints": [
      "Input constraints standard for Hard LeetCode problems."
    ],
    "timeComplexity": "O(n)",
    "spaceComplexity": "O(n)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Trees pattern under tight complexity bounds.",
      "task": "Achieve target O(n) runtime complexity with O(n) memory overhead.",
      "action": "Preorder traversal with '#' null markers for deterministic string decoding.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc61",
    "title": "Implement Trie Prefix Tree",
    "track": "algorithms",
    "category": "Tries",
    "difficulty": "Medium",
    "companyTags": [
      "google",
      "amazon"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Node with 26-element child array/map and isEndOfWord boolean flag.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(m)",
    "spaceComplexity": "O(m * 26)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Tries pattern under tight complexity bounds.",
      "task": "Achieve target O(m) runtime complexity with O(m * 26) memory overhead.",
      "action": "Node with 26-element child array/map and isEndOfWord boolean flag.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc62",
    "title": "Design Add and Search Words Data Structure",
    "track": "algorithms",
    "category": "Tries",
    "difficulty": "Medium",
    "companyTags": [
      "meta"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Trie with DFS branch traversal when encountering '.' wildcard character.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(m)",
    "spaceComplexity": "O(m * 26)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Tries pattern under tight complexity bounds.",
      "task": "Achieve target O(m) runtime complexity with O(m * 26) memory overhead.",
      "action": "Trie with DFS branch traversal when encountering '.' wildcard character.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc63",
    "title": "Word Search II",
    "track": "algorithms",
    "category": "Tries",
    "difficulty": "Hard",
    "companyTags": [
      "amazon",
      "google"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Trie built from word list + backtracking DFS on 2D grid with in-place character masking.",
    "constraints": [
      "Input constraints standard for Hard LeetCode problems."
    ],
    "timeComplexity": "O(m * n * 4^l)",
    "spaceComplexity": "O(words)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Tries pattern under tight complexity bounds.",
      "task": "Achieve target O(m * n * 4^l) runtime complexity with O(words) memory overhead.",
      "action": "Trie built from word list + backtracking DFS on 2D grid with in-place character masking.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc64",
    "title": "Kth Largest Element in a Stream",
    "track": "algorithms",
    "category": "Heap / Priority Queue",
    "difficulty": "Easy",
    "companyTags": [
      "amazon"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Maintain min-heap of size k; top element is always kth largest.",
    "constraints": [
      "Input constraints standard for Easy LeetCode problems."
    ],
    "timeComplexity": "O(log k)",
    "spaceComplexity": "O(k)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Heap / Priority Queue pattern under tight complexity bounds.",
      "task": "Achieve target O(log k) runtime complexity with O(k) memory overhead.",
      "action": "Maintain min-heap of size k; top element is always kth largest.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc65",
    "title": "Last Stone Weight",
    "track": "algorithms",
    "category": "Heap / Priority Queue",
    "difficulty": "Easy",
    "companyTags": [
      "amazon"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Max-heap popping two largest stones, pushing difference until <= 1 remain.",
    "constraints": [
      "Input constraints standard for Easy LeetCode problems."
    ],
    "timeComplexity": "O(n log n)",
    "spaceComplexity": "O(n)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Heap / Priority Queue pattern under tight complexity bounds.",
      "task": "Achieve target O(n log n) runtime complexity with O(n) memory overhead.",
      "action": "Max-heap popping two largest stones, pushing difference until <= 1 remain.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc66",
    "title": "K Closest Points to Origin",
    "track": "algorithms",
    "category": "Heap / Priority Queue",
    "difficulty": "Medium",
    "companyTags": [
      "amazon",
      "meta"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Max-heap of size k tracking Euclidean distance or QuickSelect partition.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(n log k)",
    "spaceComplexity": "O(k)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Heap / Priority Queue pattern under tight complexity bounds.",
      "task": "Achieve target O(n log k) runtime complexity with O(k) memory overhead.",
      "action": "Max-heap of size k tracking Euclidean distance or QuickSelect partition.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc67",
    "title": "Kth Largest Element in an Array",
    "track": "algorithms",
    "category": "Heap / Priority Queue",
    "difficulty": "Medium",
    "companyTags": [
      "meta",
      "amazon"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "QuickSelect partition algorithm with random pivot or Min-Heap of size k.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(n)",
    "spaceComplexity": "O(1)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Heap / Priority Queue pattern under tight complexity bounds.",
      "task": "Achieve target O(n) runtime complexity with O(1) memory overhead.",
      "action": "QuickSelect partition algorithm with random pivot or Min-Heap of size k.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc68",
    "title": "Task Scheduler",
    "track": "algorithms",
    "category": "Heap / Priority Queue",
    "difficulty": "Medium",
    "companyTags": [
      "meta"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Greedy max-frequency math: (maxFreq - 1) * (n + 1) + maxCount.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(n)",
    "spaceComplexity": "O(1)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Heap / Priority Queue pattern under tight complexity bounds.",
      "task": "Achieve target O(n) runtime complexity with O(1) memory overhead.",
      "action": "Greedy max-frequency math: (maxFreq - 1) * (n + 1) + maxCount.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc69",
    "title": "Design Twitter",
    "track": "algorithms",
    "category": "Heap / Priority Queue",
    "difficulty": "Medium",
    "companyTags": [
      "twitter",
      "uber"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Min/Max-heap k-way merge of recent tweets from followed users.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(k log f)",
    "spaceComplexity": "O(u + t)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Heap / Priority Queue pattern under tight complexity bounds.",
      "task": "Achieve target O(k log f) runtime complexity with O(u + t) memory overhead.",
      "action": "Min/Max-heap k-way merge of recent tweets from followed users.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc70",
    "title": "Find Median from Data Stream",
    "track": "algorithms",
    "category": "Heap / Priority Queue",
    "difficulty": "Hard",
    "companyTags": [
      "google",
      "amazon"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Two heaps: max-heap for lower half, min-heap for upper half, balanced within size 1.",
    "constraints": [
      "Input constraints standard for Hard LeetCode problems."
    ],
    "timeComplexity": "O(log n)",
    "spaceComplexity": "O(n)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Heap / Priority Queue pattern under tight complexity bounds.",
      "task": "Achieve target O(log n) runtime complexity with O(n) memory overhead.",
      "action": "Two heaps: max-heap for lower half, min-heap for upper half, balanced within size 1.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc71",
    "title": "Subsets",
    "track": "algorithms",
    "category": "Backtracking",
    "difficulty": "Medium",
    "companyTags": [
      "meta",
      "amazon"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Backtracking deciding to include or exclude current element at each index.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(2^n)",
    "spaceComplexity": "O(n)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Backtracking pattern under tight complexity bounds.",
      "task": "Achieve target O(2^n) runtime complexity with O(n) memory overhead.",
      "action": "Backtracking deciding to include or exclude current element at each index.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc72",
    "title": "Combination Sum",
    "track": "algorithms",
    "category": "Backtracking",
    "difficulty": "Medium",
    "companyTags": [
      "airbnb",
      "amazon"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Include current number repeatedly until target exceeded, or skip to next index.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(2^t)",
    "spaceComplexity": "O(t)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Backtracking pattern under tight complexity bounds.",
      "task": "Achieve target O(2^t) runtime complexity with O(t) memory overhead.",
      "action": "Include current number repeatedly until target exceeded, or skip to next index.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc73",
    "title": "Permutations",
    "track": "algorithms",
    "category": "Backtracking",
    "difficulty": "Medium",
    "companyTags": [
      "microsoft",
      "google"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Backtracking with boolean visited array or in-place element swapping.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(n!)",
    "spaceComplexity": "O(n)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Backtracking pattern under tight complexity bounds.",
      "task": "Achieve target O(n!) runtime complexity with O(n) memory overhead.",
      "action": "Backtracking with boolean visited array or in-place element swapping.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc74",
    "title": "Subsets II",
    "track": "algorithms",
    "category": "Backtracking",
    "difficulty": "Medium",
    "companyTags": [
      "amazon"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Sort input array; skip duplicate elements when branching on exclusion.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(2^n)",
    "spaceComplexity": "O(n)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Backtracking pattern under tight complexity bounds.",
      "task": "Achieve target O(2^n) runtime complexity with O(n) memory overhead.",
      "action": "Sort input array; skip duplicate elements when branching on exclusion.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc75",
    "title": "Combination Sum II",
    "track": "algorithms",
    "category": "Backtracking",
    "difficulty": "Medium",
    "companyTags": [
      "amazon"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Sort input array; skip `candidates[i] === candidates[i-1]` in recursive loop.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(2^n)",
    "spaceComplexity": "O(n)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Backtracking pattern under tight complexity bounds.",
      "task": "Achieve target O(2^n) runtime complexity with O(n) memory overhead.",
      "action": "Sort input array; skip `candidates[i] === candidates[i-1]` in recursive loop.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc76",
    "title": "Word Search",
    "track": "algorithms",
    "category": "Backtracking",
    "difficulty": "Medium",
    "companyTags": [
      "amazon",
      "microsoft"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Grid DFS matching characters, marking visited cells temporarily with '#'.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(n * m * 4^l)",
    "spaceComplexity": "O(l)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Backtracking pattern under tight complexity bounds.",
      "task": "Achieve target O(n * m * 4^l) runtime complexity with O(l) memory overhead.",
      "action": "Grid DFS matching characters, marking visited cells temporarily with '#'.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc77",
    "title": "Palindrome Partitioning",
    "track": "algorithms",
    "category": "Backtracking",
    "difficulty": "Medium",
    "companyTags": [
      "google"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Partition string if prefix is palindrome; recurse on remaining suffix.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(n * 2^n)",
    "spaceComplexity": "O(n)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Backtracking pattern under tight complexity bounds.",
      "task": "Achieve target O(n * 2^n) runtime complexity with O(n) memory overhead.",
      "action": "Partition string if prefix is palindrome; recurse on remaining suffix.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc78",
    "title": "Letter Combinations of a Phone Number",
    "track": "algorithms",
    "category": "Backtracking",
    "difficulty": "Medium",
    "companyTags": [
      "uber"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "DFS mapping digits to character strings via keypad lookup table.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(4^n)",
    "spaceComplexity": "O(n)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Backtracking pattern under tight complexity bounds.",
      "task": "Achieve target O(4^n) runtime complexity with O(n) memory overhead.",
      "action": "DFS mapping digits to character strings via keypad lookup table.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc79",
    "title": "N-Queens",
    "track": "algorithms",
    "category": "Backtracking",
    "difficulty": "Hard",
    "companyTags": [
      "meta",
      "google"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Column and diagonal tracking sets (r + c, r - c) placing queens row by row.",
    "constraints": [
      "Input constraints standard for Hard LeetCode problems."
    ],
    "timeComplexity": "O(n!)",
    "spaceComplexity": "O(n)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Backtracking pattern under tight complexity bounds.",
      "task": "Achieve target O(n!) runtime complexity with O(n) memory overhead.",
      "action": "Column and diagonal tracking sets (r + c, r - c) placing queens row by row.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc80",
    "title": "Number of Islands",
    "track": "algorithms",
    "category": "Graphs",
    "difficulty": "Medium",
    "companyTags": [
      "amazon",
      "google",
      "meta"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "DFS or BFS flood-fill sinking visited land ('1' -> '0').",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(m * n)",
    "spaceComplexity": "O(m * n)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Graphs pattern under tight complexity bounds.",
      "task": "Achieve target O(m * n) runtime complexity with O(m * n) memory overhead.",
      "action": "DFS or BFS flood-fill sinking visited land ('1' -> '0').",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc81",
    "title": "Max Area of Island",
    "track": "algorithms",
    "category": "Graphs",
    "difficulty": "Medium",
    "companyTags": [
      "meta"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "DFS returning 1 + sum of connected 4-directional land cells.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(m * n)",
    "spaceComplexity": "O(m * n)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Graphs pattern under tight complexity bounds.",
      "task": "Achieve target O(m * n) runtime complexity with O(m * n) memory overhead.",
      "action": "DFS returning 1 + sum of connected 4-directional land cells.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc82",
    "title": "Clone Graph",
    "track": "algorithms",
    "category": "Graphs",
    "difficulty": "Medium",
    "companyTags": [
      "meta",
      "google"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "DFS or BFS using map of original node pointers to cloned node pointers.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(v + e)",
    "spaceComplexity": "O(v)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Graphs pattern under tight complexity bounds.",
      "task": "Achieve target O(v + e) runtime complexity with O(v) memory overhead.",
      "action": "DFS or BFS using map of original node pointers to cloned node pointers.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc83",
    "title": "Walls and Gates",
    "track": "algorithms",
    "category": "Graphs",
    "difficulty": "Medium",
    "companyTags": [
      "meta"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Multi-source BFS starting from all gates (0) simultaneously.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(m * n)",
    "spaceComplexity": "O(m * n)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Graphs pattern under tight complexity bounds.",
      "task": "Achieve target O(m * n) runtime complexity with O(m * n) memory overhead.",
      "action": "Multi-source BFS starting from all gates (0) simultaneously.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc84",
    "title": "Rotting Oranges",
    "track": "algorithms",
    "category": "Graphs",
    "difficulty": "Medium",
    "companyTags": [
      "amazon"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Multi-source BFS from rotten oranges, tracking minutes until all fresh infected.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(m * n)",
    "spaceComplexity": "O(m * n)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Graphs pattern under tight complexity bounds.",
      "task": "Achieve target O(m * n) runtime complexity with O(m * n) memory overhead.",
      "action": "Multi-source BFS from rotten oranges, tracking minutes until all fresh infected.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc85",
    "title": "Pacific Atlantic Water Flow",
    "track": "algorithms",
    "category": "Graphs",
    "difficulty": "Medium",
    "companyTags": [
      "google"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Two BFS/DFS runs starting backwards from Pacific and Atlantic borders.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(m * n)",
    "spaceComplexity": "O(m * n)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Graphs pattern under tight complexity bounds.",
      "task": "Achieve target O(m * n) runtime complexity with O(m * n) memory overhead.",
      "action": "Two BFS/DFS runs starting backwards from Pacific and Atlantic borders.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc86",
    "title": "Surrounded Regions",
    "track": "algorithms",
    "category": "Graphs",
    "difficulty": "Medium",
    "companyTags": [
      "google"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "DFS from un-capturable border 'O's marking them safe; flip remaining.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(m * n)",
    "spaceComplexity": "O(m * n)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Graphs pattern under tight complexity bounds.",
      "task": "Achieve target O(m * n) runtime complexity with O(m * n) memory overhead.",
      "action": "DFS from un-capturable border 'O's marking them safe; flip remaining.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc87",
    "title": "Course Schedule",
    "track": "algorithms",
    "category": "Graphs",
    "difficulty": "Medium",
    "companyTags": [
      "amazon",
      "meta"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Topological sort via Kahn's in-degree algorithm or DFS cycle detection.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(v + e)",
    "spaceComplexity": "O(v + e)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Graphs pattern under tight complexity bounds.",
      "task": "Achieve target O(v + e) runtime complexity with O(v + e) memory overhead.",
      "action": "Topological sort via Kahn's in-degree algorithm or DFS cycle detection.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc88",
    "title": "Course Schedule II",
    "track": "algorithms",
    "category": "Graphs",
    "difficulty": "Medium",
    "companyTags": [
      "amazon"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Kahn's BFS appending 0-in-degree nodes to topological order list.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(v + e)",
    "spaceComplexity": "O(v + e)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Graphs pattern under tight complexity bounds.",
      "task": "Achieve target O(v + e) runtime complexity with O(v + e) memory overhead.",
      "action": "Kahn's BFS appending 0-in-degree nodes to topological order list.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc89",
    "title": "Graph Valid Tree",
    "track": "algorithms",
    "category": "Graphs",
    "difficulty": "Medium",
    "companyTags": [
      "google"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Tree condition: exactly v - 1 edges and 0 cycles (Union-Find or DFS).",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(v + e)",
    "spaceComplexity": "O(v)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Graphs pattern under tight complexity bounds.",
      "task": "Achieve target O(v + e) runtime complexity with O(v) memory overhead.",
      "action": "Tree condition: exactly v - 1 edges and 0 cycles (Union-Find or DFS).",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc90",
    "title": "Number of Connected Components in an Undirected Graph",
    "track": "algorithms",
    "category": "Graphs",
    "difficulty": "Medium",
    "companyTags": [
      "meta"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Union-Find with path compression counting remaining disjoint sets.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(v + e)",
    "spaceComplexity": "O(v)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Graphs pattern under tight complexity bounds.",
      "task": "Achieve target O(v + e) runtime complexity with O(v) memory overhead.",
      "action": "Union-Find with path compression counting remaining disjoint sets.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc91",
    "title": "Redundant Connection",
    "track": "algorithms",
    "category": "Graphs",
    "difficulty": "Medium",
    "companyTags": [
      "google"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Union-Find identifying the first edge whose nodes share the same root.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(n)",
    "spaceComplexity": "O(n)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Graphs pattern under tight complexity bounds.",
      "task": "Achieve target O(n) runtime complexity with O(n) memory overhead.",
      "action": "Union-Find identifying the first edge whose nodes share the same root.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc92",
    "title": "Word Ladder",
    "track": "algorithms",
    "category": "Graphs",
    "difficulty": "Hard",
    "companyTags": [
      "amazon",
      "google"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "BFS shortest path with intermediate wildcard patterns `h*t`.",
    "constraints": [
      "Input constraints standard for Hard LeetCode problems."
    ],
    "timeComplexity": "O(m^2 * n)",
    "spaceComplexity": "O(m^2 * n)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Graphs pattern under tight complexity bounds.",
      "task": "Achieve target O(m^2 * n) runtime complexity with O(m^2 * n) memory overhead.",
      "action": "BFS shortest path with intermediate wildcard patterns `h*t`.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc93",
    "title": "Reconstruct Itinerary",
    "track": "algorithms",
    "category": "Advanced Graphs",
    "difficulty": "Hard",
    "companyTags": [
      "google"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Hierholzer's Eulerian path algorithm using min-heaps for lexical airport order.",
    "constraints": [
      "Input constraints standard for Hard LeetCode problems."
    ],
    "timeComplexity": "O(e log e)",
    "spaceComplexity": "O(v + e)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Advanced Graphs pattern under tight complexity bounds.",
      "task": "Achieve target O(e log e) runtime complexity with O(v + e) memory overhead.",
      "action": "Hierholzer's Eulerian path algorithm using min-heaps for lexical airport order.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc94",
    "title": "Min Cost to Connect All Points",
    "track": "algorithms",
    "category": "Advanced Graphs",
    "difficulty": "Medium",
    "companyTags": [
      "amazon"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Prim's Minimum Spanning Tree algorithm using min-heap for Manhattan distances.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(n^2 log n)",
    "spaceComplexity": "O(n^2)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Advanced Graphs pattern under tight complexity bounds.",
      "task": "Achieve target O(n^2 log n) runtime complexity with O(n^2) memory overhead.",
      "action": "Prim's Minimum Spanning Tree algorithm using min-heap for Manhattan distances.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc95",
    "title": "Network Delay Time",
    "track": "algorithms",
    "category": "Advanced Graphs",
    "difficulty": "Medium",
    "companyTags": [
      "google"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Dijkstra's shortest path algorithm using priority queue.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(e log v)",
    "spaceComplexity": "O(v + e)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Advanced Graphs pattern under tight complexity bounds.",
      "task": "Achieve target O(e log v) runtime complexity with O(v + e) memory overhead.",
      "action": "Dijkstra's shortest path algorithm using priority queue.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc96",
    "title": "Swim in Rising Water",
    "track": "algorithms",
    "category": "Advanced Graphs",
    "difficulty": "Hard",
    "companyTags": [
      "google"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Modified Dijkstra on grid prioritizing lowest elevation water levels.",
    "constraints": [
      "Input constraints standard for Hard LeetCode problems."
    ],
    "timeComplexity": "O(n^2 log n)",
    "spaceComplexity": "O(n^2)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Advanced Graphs pattern under tight complexity bounds.",
      "task": "Achieve target O(n^2 log n) runtime complexity with O(n^2) memory overhead.",
      "action": "Modified Dijkstra on grid prioritizing lowest elevation water levels.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc97",
    "title": "Alien Dictionary",
    "track": "algorithms",
    "category": "Advanced Graphs",
    "difficulty": "Hard",
    "companyTags": [
      "meta",
      "airbnb"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Build directed graph from adjacent words; topological sort for valid alphabet order.",
    "constraints": [
      "Input constraints standard for Hard LeetCode problems."
    ],
    "timeComplexity": "O(c)",
    "spaceComplexity": "O(1)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Advanced Graphs pattern under tight complexity bounds.",
      "task": "Achieve target O(c) runtime complexity with O(1) memory overhead.",
      "action": "Build directed graph from adjacent words; topological sort for valid alphabet order.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc98",
    "title": "Cheapest Flights Within K Stops",
    "track": "algorithms",
    "category": "Advanced Graphs",
    "difficulty": "Medium",
    "companyTags": [
      "uber"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Bellman-Ford algorithm executed for k + 1 rounds.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(k * e)",
    "spaceComplexity": "O(v)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Advanced Graphs pattern under tight complexity bounds.",
      "task": "Achieve target O(k * e) runtime complexity with O(v) memory overhead.",
      "action": "Bellman-Ford algorithm executed for k + 1 rounds.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc99",
    "title": "Climbing Stairs",
    "track": "algorithms",
    "category": "1-D DP",
    "difficulty": "Easy",
    "companyTags": [
      "google",
      "apple"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Fibonacci state transition: dp[i] = dp[i-1] + dp[i-2].",
    "constraints": [
      "Input constraints standard for Easy LeetCode problems."
    ],
    "timeComplexity": "O(n)",
    "spaceComplexity": "O(1)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal 1-D DP pattern under tight complexity bounds.",
      "task": "Achieve target O(n) runtime complexity with O(1) memory overhead.",
      "action": "Fibonacci state transition: dp[i] = dp[i-1] + dp[i-2].",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc100",
    "title": "Min Cost Climbing Stairs",
    "track": "algorithms",
    "category": "1-D DP",
    "difficulty": "Easy",
    "companyTags": [
      "amazon"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "dp[i] = cost[i] + min(dp[i-1], dp[i-2]) with constant space.",
    "constraints": [
      "Input constraints standard for Easy LeetCode problems."
    ],
    "timeComplexity": "O(n)",
    "spaceComplexity": "O(1)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal 1-D DP pattern under tight complexity bounds.",
      "task": "Achieve target O(n) runtime complexity with O(1) memory overhead.",
      "action": "dp[i] = cost[i] + min(dp[i-1], dp[i-2]) with constant space.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc101",
    "title": "House Robber",
    "track": "algorithms",
    "category": "1-D DP",
    "difficulty": "Medium",
    "companyTags": [
      "meta",
      "airbnb"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "dp[i] = max(dp[i-1], nums[i] + dp[i-2]) tracking two prior values.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(n)",
    "spaceComplexity": "O(1)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal 1-D DP pattern under tight complexity bounds.",
      "task": "Achieve target O(n) runtime complexity with O(1) memory overhead.",
      "action": "dp[i] = max(dp[i-1], nums[i] + dp[i-2]) tracking two prior values.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc102",
    "title": "House Robber II",
    "track": "algorithms",
    "category": "1-D DP",
    "difficulty": "Medium",
    "companyTags": [
      "microsoft"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Circular array: run House Robber on nums[0..n-2] and nums[1..n-1].",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(n)",
    "spaceComplexity": "O(1)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal 1-D DP pattern under tight complexity bounds.",
      "task": "Achieve target O(n) runtime complexity with O(1) memory overhead.",
      "action": "Circular array: run House Robber on nums[0..n-2] and nums[1..n-1].",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc103",
    "title": "Longest Palindromic Substring",
    "track": "algorithms",
    "category": "1-D DP",
    "difficulty": "Medium",
    "companyTags": [
      "amazon",
      "meta"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Expand around centers for both odd and even palindrome lengths.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(n^2)",
    "spaceComplexity": "O(1)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal 1-D DP pattern under tight complexity bounds.",
      "task": "Achieve target O(n^2) runtime complexity with O(1) memory overhead.",
      "action": "Expand around centers for both odd and even palindrome lengths.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc104",
    "title": "Palindromic Substrings",
    "track": "algorithms",
    "category": "1-D DP",
    "difficulty": "Medium",
    "companyTags": [
      "meta"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Expand around all 2n-1 centers counting valid palindrome matches.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(n^2)",
    "spaceComplexity": "O(1)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal 1-D DP pattern under tight complexity bounds.",
      "task": "Achieve target O(n^2) runtime complexity with O(1) memory overhead.",
      "action": "Expand around all 2n-1 centers counting valid palindrome matches.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc105",
    "title": "Decode Ways",
    "track": "algorithms",
    "category": "1-D DP",
    "difficulty": "Medium",
    "companyTags": [
      "meta",
      "uber"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "dp[i] sums single digit if 1-9 and two-digit combinations if 10-26.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(n)",
    "spaceComplexity": "O(1)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal 1-D DP pattern under tight complexity bounds.",
      "task": "Achieve target O(n) runtime complexity with O(1) memory overhead.",
      "action": "dp[i] sums single digit if 1-9 and two-digit combinations if 10-26.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc106",
    "title": "Coin Change",
    "track": "algorithms",
    "category": "1-D DP",
    "difficulty": "Medium",
    "companyTags": [
      "amazon",
      "google"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Unbounded knapsack: dp[a] = min(dp[a], 1 + dp[a - c]).",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(amount * n)",
    "spaceComplexity": "O(amount)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal 1-D DP pattern under tight complexity bounds.",
      "task": "Achieve target O(amount * n) runtime complexity with O(amount) memory overhead.",
      "action": "Unbounded knapsack: dp[a] = min(dp[a], 1 + dp[a - c]).",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc107",
    "title": "Maximum Product Subarray",
    "track": "algorithms",
    "category": "1-D DP",
    "difficulty": "Medium",
    "companyTags": [
      "amazon",
      "google"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Maintain running minProduct and maxProduct multiplying each num.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(n)",
    "spaceComplexity": "O(1)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal 1-D DP pattern under tight complexity bounds.",
      "task": "Achieve target O(n) runtime complexity with O(1) memory overhead.",
      "action": "Maintain running minProduct and maxProduct multiplying each num.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc108",
    "title": "Word Break",
    "track": "algorithms",
    "category": "1-D DP",
    "difficulty": "Medium",
    "companyTags": [
      "meta",
      "amazon"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "dp[i] true if dp[j] true and s[j..i] exists in dictionary.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(n^2 * k)",
    "spaceComplexity": "O(n)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal 1-D DP pattern under tight complexity bounds.",
      "task": "Achieve target O(n^2 * k) runtime complexity with O(n) memory overhead.",
      "action": "dp[i] true if dp[j] true and s[j..i] exists in dictionary.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc109",
    "title": "Longest Increasing Subsequence",
    "track": "algorithms",
    "category": "1-D DP",
    "difficulty": "Medium",
    "companyTags": [
      "google",
      "microsoft"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Patience sorting / binary search replacement in tails array.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(n log n)",
    "spaceComplexity": "O(n)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal 1-D DP pattern under tight complexity bounds.",
      "task": "Achieve target O(n log n) runtime complexity with O(n) memory overhead.",
      "action": "Patience sorting / binary search replacement in tails array.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc110",
    "title": "Partition Equal Subset Sum",
    "track": "algorithms",
    "category": "1-D DP",
    "difficulty": "Medium",
    "companyTags": [
      "amazon"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "0/1 Knapsack testing if subset sums to totalSum / 2.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(n * target)",
    "spaceComplexity": "O(target)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal 1-D DP pattern under tight complexity bounds.",
      "task": "Achieve target O(n * target) runtime complexity with O(target) memory overhead.",
      "action": "0/1 Knapsack testing if subset sums to totalSum / 2.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc111",
    "title": "Unique Paths",
    "track": "algorithms",
    "category": "2-D DP",
    "difficulty": "Medium",
    "companyTags": [
      "google",
      "amazon"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Grid DP: dp[r][c] = dp[r-1][c] + dp[r][c-1] with 1D array optimization.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(m * n)",
    "spaceComplexity": "O(n)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal 2-D DP pattern under tight complexity bounds.",
      "task": "Achieve target O(m * n) runtime complexity with O(n) memory overhead.",
      "action": "Grid DP: dp[r][c] = dp[r-1][c] + dp[r][c-1] with 1D array optimization.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc112",
    "title": "Longest Common Subsequence",
    "track": "algorithms",
    "category": "2-D DP",
    "difficulty": "Medium",
    "companyTags": [
      "amazon"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Match: 1 + dp[i-1][j-1]; mismatch: max(dp[i-1][j], dp[i][j-1]).",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(m * n)",
    "spaceComplexity": "O(min(m,n))",
    "starRubric": {
      "situation": "Encountered problem requiring optimal 2-D DP pattern under tight complexity bounds.",
      "task": "Achieve target O(m * n) runtime complexity with O(min(m,n)) memory overhead.",
      "action": "Match: 1 + dp[i-1][j-1]; mismatch: max(dp[i-1][j], dp[i][j-1]).",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc113",
    "title": "Best Time to Buy and Sell Stock with Cooldown",
    "track": "algorithms",
    "category": "2-D DP",
    "difficulty": "Medium",
    "companyTags": [
      "meta"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Three states: Buying, Selling, and Cooldown.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(n)",
    "spaceComplexity": "O(1)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal 2-D DP pattern under tight complexity bounds.",
      "task": "Achieve target O(n) runtime complexity with O(1) memory overhead.",
      "action": "Three states: Buying, Selling, and Cooldown.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc114",
    "title": "Coin Change II",
    "track": "algorithms",
    "category": "2-D DP",
    "difficulty": "Medium",
    "companyTags": [
      "amazon"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Outer loop over coins, inner loop over amounts to compute unique combinations.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(n * amount)",
    "spaceComplexity": "O(amount)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal 2-D DP pattern under tight complexity bounds.",
      "task": "Achieve target O(n * amount) runtime complexity with O(amount) memory overhead.",
      "action": "Outer loop over coins, inner loop over amounts to compute unique combinations.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc115",
    "title": "Target Sum",
    "track": "algorithms",
    "category": "2-D DP",
    "difficulty": "Medium",
    "companyTags": [
      "meta"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Convert to subset sum problem: target + totalSum must be even.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(n * sum)",
    "spaceComplexity": "O(sum)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal 2-D DP pattern under tight complexity bounds.",
      "task": "Achieve target O(n * sum) runtime complexity with O(sum) memory overhead.",
      "action": "Convert to subset sum problem: target + totalSum must be even.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc116",
    "title": "Interleaving String",
    "track": "algorithms",
    "category": "2-D DP",
    "difficulty": "Medium",
    "companyTags": [
      "google"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "dp[i][j] true if prefix matched from s1[i-1] or s2[j-1].",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(m * n)",
    "spaceComplexity": "O(n)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal 2-D DP pattern under tight complexity bounds.",
      "task": "Achieve target O(m * n) runtime complexity with O(n) memory overhead.",
      "action": "dp[i][j] true if prefix matched from s1[i-1] or s2[j-1].",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc117",
    "title": "Longest Increasing Path in a Matrix",
    "track": "algorithms",
    "category": "2-D DP",
    "difficulty": "Hard",
    "companyTags": [
      "google"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "DFS with memoization table on DAG formed by increasing neighbor values.",
    "constraints": [
      "Input constraints standard for Hard LeetCode problems."
    ],
    "timeComplexity": "O(m * n)",
    "spaceComplexity": "O(m * n)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal 2-D DP pattern under tight complexity bounds.",
      "task": "Achieve target O(m * n) runtime complexity with O(m * n) memory overhead.",
      "action": "DFS with memoization table on DAG formed by increasing neighbor values.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc118",
    "title": "Distinct Subsequences",
    "track": "algorithms",
    "category": "2-D DP",
    "difficulty": "Hard",
    "companyTags": [
      "google"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Match: dp[i-1][j-1] + dp[i-1][j]; mismatch: dp[i-1][j].",
    "constraints": [
      "Input constraints standard for Hard LeetCode problems."
    ],
    "timeComplexity": "O(m * n)",
    "spaceComplexity": "O(n)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal 2-D DP pattern under tight complexity bounds.",
      "task": "Achieve target O(m * n) runtime complexity with O(n) memory overhead.",
      "action": "Match: dp[i-1][j-1] + dp[i-1][j]; mismatch: dp[i-1][j].",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc119",
    "title": "Edit Distance",
    "track": "algorithms",
    "category": "2-D DP",
    "difficulty": "Medium",
    "companyTags": [
      "google",
      "microsoft"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "1 + min(insert, delete, replace) when characters differ.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(m * n)",
    "spaceComplexity": "O(min(m,n))",
    "starRubric": {
      "situation": "Encountered problem requiring optimal 2-D DP pattern under tight complexity bounds.",
      "task": "Achieve target O(m * n) runtime complexity with O(min(m,n)) memory overhead.",
      "action": "1 + min(insert, delete, replace) when characters differ.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc120",
    "title": "Burst Balloons",
    "track": "algorithms",
    "category": "2-D DP",
    "difficulty": "Hard",
    "companyTags": [
      "amazon"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Interval DP: pick the last balloon to burst in range (left, right).",
    "constraints": [
      "Input constraints standard for Hard LeetCode problems."
    ],
    "timeComplexity": "O(n^3)",
    "spaceComplexity": "O(n^2)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal 2-D DP pattern under tight complexity bounds.",
      "task": "Achieve target O(n^3) runtime complexity with O(n^2) memory overhead.",
      "action": "Interval DP: pick the last balloon to burst in range (left, right).",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc121",
    "title": "Regular Expression Matching",
    "track": "algorithms",
    "category": "2-D DP",
    "difficulty": "Hard",
    "companyTags": [
      "meta",
      "google"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Handle '*' as zero occurrences or one-or-more occurrences via subproblem lookback.",
    "constraints": [
      "Input constraints standard for Hard LeetCode problems."
    ],
    "timeComplexity": "O(m * n)",
    "spaceComplexity": "O(m * n)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal 2-D DP pattern under tight complexity bounds.",
      "task": "Achieve target O(m * n) runtime complexity with O(m * n) memory overhead.",
      "action": "Handle '*' as zero occurrences or one-or-more occurrences via subproblem lookback.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc122",
    "title": "Maximum Subarray",
    "track": "algorithms",
    "category": "Greedy",
    "difficulty": "Medium",
    "companyTags": [
      "amazon",
      "meta"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Kadane's algorithm resetting running sum when negative.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(n)",
    "spaceComplexity": "O(1)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Greedy pattern under tight complexity bounds.",
      "task": "Achieve target O(n) runtime complexity with O(1) memory overhead.",
      "action": "Kadane's algorithm resetting running sum when negative.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc123",
    "title": "Jump Game",
    "track": "algorithms",
    "category": "Greedy",
    "difficulty": "Medium",
    "companyTags": [
      "amazon",
      "apple"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Track furthest reachable index or shift target goalpost backwards.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(n)",
    "spaceComplexity": "O(1)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Greedy pattern under tight complexity bounds.",
      "task": "Achieve target O(n) runtime complexity with O(1) memory overhead.",
      "action": "Track furthest reachable index or shift target goalpost backwards.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc124",
    "title": "Jump Game II",
    "track": "algorithms",
    "category": "Greedy",
    "difficulty": "Medium",
    "companyTags": [
      "google"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "BFS style greedy window tracking current jump reach and next max reach.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(n)",
    "spaceComplexity": "O(1)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Greedy pattern under tight complexity bounds.",
      "task": "Achieve target O(n) runtime complexity with O(1) memory overhead.",
      "action": "BFS style greedy window tracking current jump reach and next max reach.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc125",
    "title": "Gas Station",
    "track": "algorithms",
    "category": "Greedy",
    "difficulty": "Medium",
    "companyTags": [
      "amazon"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Total gas >= total cost guarantees solution; reset start whenever running tank drops below 0.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(n)",
    "spaceComplexity": "O(1)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Greedy pattern under tight complexity bounds.",
      "task": "Achieve target O(n) runtime complexity with O(1) memory overhead.",
      "action": "Total gas >= total cost guarantees solution; reset start whenever running tank drops below 0.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc126",
    "title": "Hand of Straights",
    "track": "algorithms",
    "category": "Greedy",
    "difficulty": "Medium",
    "companyTags": [
      "google"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Count frequencies in TreeMap/sorted map; form consecutive groups from smallest key.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(n log n)",
    "spaceComplexity": "O(n)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Greedy pattern under tight complexity bounds.",
      "task": "Achieve target O(n log n) runtime complexity with O(n) memory overhead.",
      "action": "Count frequencies in TreeMap/sorted map; form consecutive groups from smallest key.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc127",
    "title": "Merge Triplets to Form Target Triplet",
    "track": "algorithms",
    "category": "Greedy",
    "difficulty": "Medium",
    "companyTags": [
      "amazon"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Filter out triplets where any element > target; verify remaining elements cover target values.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(n)",
    "spaceComplexity": "O(1)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Greedy pattern under tight complexity bounds.",
      "task": "Achieve target O(n) runtime complexity with O(1) memory overhead.",
      "action": "Filter out triplets where any element > target; verify remaining elements cover target values.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc128",
    "title": "Partition Labels",
    "track": "algorithms",
    "category": "Greedy",
    "difficulty": "Medium",
    "companyTags": [
      "amazon"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Map last occurrence of each char; expand current partition to max of last occurrences.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(n)",
    "spaceComplexity": "O(1)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Greedy pattern under tight complexity bounds.",
      "task": "Achieve target O(n) runtime complexity with O(1) memory overhead.",
      "action": "Map last occurrence of each char; expand current partition to max of last occurrences.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc129",
    "title": "Valid Parenthesis String",
    "track": "algorithms",
    "category": "Greedy",
    "difficulty": "Medium",
    "companyTags": [
      "meta"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Track range of open parenthesis counts [cMin, cMax] handling '*' flexibly.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(n)",
    "spaceComplexity": "O(1)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Greedy pattern under tight complexity bounds.",
      "task": "Achieve target O(n) runtime complexity with O(1) memory overhead.",
      "action": "Track range of open parenthesis counts [cMin, cMax] handling '*' flexibly.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc130",
    "title": "Insert Interval",
    "track": "algorithms",
    "category": "Intervals",
    "difficulty": "Medium",
    "companyTags": [
      "google",
      "meta"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Append intervals before, merge overlapping intervals, then append intervals after.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(n)",
    "spaceComplexity": "O(n)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Intervals pattern under tight complexity bounds.",
      "task": "Achieve target O(n) runtime complexity with O(n) memory overhead.",
      "action": "Append intervals before, merge overlapping intervals, then append intervals after.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc131",
    "title": "Merge Intervals",
    "track": "algorithms",
    "category": "Intervals",
    "difficulty": "Medium",
    "companyTags": [
      "amazon",
      "meta"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Sort by start time; merge into previous interval if start <= prev.end.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(n log n)",
    "spaceComplexity": "O(n)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Intervals pattern under tight complexity bounds.",
      "task": "Achieve target O(n log n) runtime complexity with O(n) memory overhead.",
      "action": "Sort by start time; merge into previous interval if start <= prev.end.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc132",
    "title": "Non-overlapping Intervals",
    "track": "algorithms",
    "category": "Intervals",
    "difficulty": "Medium",
    "companyTags": [
      "meta"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Sort by end time; greedily keep interval that ends earliest to minimize removals.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(n log n)",
    "spaceComplexity": "O(1)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Intervals pattern under tight complexity bounds.",
      "task": "Achieve target O(n log n) runtime complexity with O(1) memory overhead.",
      "action": "Sort by end time; greedily keep interval that ends earliest to minimize removals.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc133",
    "title": "Meeting Rooms",
    "track": "algorithms",
    "category": "Intervals",
    "difficulty": "Easy",
    "companyTags": [
      "meta"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Sort by start time; return false if any adjacent intervals overlap.",
    "constraints": [
      "Input constraints standard for Easy LeetCode problems."
    ],
    "timeComplexity": "O(n log n)",
    "spaceComplexity": "O(1)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Intervals pattern under tight complexity bounds.",
      "task": "Achieve target O(n log n) runtime complexity with O(1) memory overhead.",
      "action": "Sort by start time; return false if any adjacent intervals overlap.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc134",
    "title": "Meeting Rooms II",
    "track": "algorithms",
    "category": "Intervals",
    "difficulty": "Medium",
    "companyTags": [
      "amazon",
      "google"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Chronological two-pointer approach comparing sorted start and end arrays.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(n log n)",
    "spaceComplexity": "O(n)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Intervals pattern under tight complexity bounds.",
      "task": "Achieve target O(n log n) runtime complexity with O(n) memory overhead.",
      "action": "Chronological two-pointer approach comparing sorted start and end arrays.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc135",
    "title": "Minimum Interval to Include Each Query",
    "track": "algorithms",
    "category": "Intervals",
    "difficulty": "Hard",
    "companyTags": [
      "google"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Sort queries and intervals; use min-heap indexed by interval size.",
    "constraints": [
      "Input constraints standard for Hard LeetCode problems."
    ],
    "timeComplexity": "O(n log n + q log q)",
    "spaceComplexity": "O(n + q)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Intervals pattern under tight complexity bounds.",
      "task": "Achieve target O(n log n + q log q) runtime complexity with O(n + q) memory overhead.",
      "action": "Sort queries and intervals; use min-heap indexed by interval size.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc136",
    "title": "Rotate Image",
    "track": "algorithms",
    "category": "Math & Geometry",
    "difficulty": "Medium",
    "companyTags": [
      "amazon",
      "microsoft"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Transpose matrix across diagonal then reverse each row.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(n^2)",
    "spaceComplexity": "O(1)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Math & Geometry pattern under tight complexity bounds.",
      "task": "Achieve target O(n^2) runtime complexity with O(1) memory overhead.",
      "action": "Transpose matrix across diagonal then reverse each row.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc137",
    "title": "Spiral Matrix",
    "track": "algorithms",
    "category": "Math & Geometry",
    "difficulty": "Medium",
    "companyTags": [
      "microsoft",
      "apple"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Four boundary pointers (top, bottom, left, right) traversing perimeter inwards.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(m * n)",
    "spaceComplexity": "O(1)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Math & Geometry pattern under tight complexity bounds.",
      "task": "Achieve target O(m * n) runtime complexity with O(1) memory overhead.",
      "action": "Four boundary pointers (top, bottom, left, right) traversing perimeter inwards.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc138",
    "title": "Set Matrix Zeroes",
    "track": "algorithms",
    "category": "Math & Geometry",
    "difficulty": "Medium",
    "companyTags": [
      "meta",
      "microsoft"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Use first row and column as flag markers; track col0 status in separate boolean.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(m * n)",
    "spaceComplexity": "O(1)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Math & Geometry pattern under tight complexity bounds.",
      "task": "Achieve target O(m * n) runtime complexity with O(1) memory overhead.",
      "action": "Use first row and column as flag markers; track col0 status in separate boolean.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc139",
    "title": "Happy Number",
    "track": "algorithms",
    "category": "Math & Geometry",
    "difficulty": "Easy",
    "companyTags": [
      "google"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Floyd's cycle detection comparing sum of squared digits of slow and fast.",
    "constraints": [
      "Input constraints standard for Easy LeetCode problems."
    ],
    "timeComplexity": "O(log n)",
    "spaceComplexity": "O(1)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Math & Geometry pattern under tight complexity bounds.",
      "task": "Achieve target O(log n) runtime complexity with O(1) memory overhead.",
      "action": "Floyd's cycle detection comparing sum of squared digits of slow and fast.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc140",
    "title": "Plus One",
    "track": "algorithms",
    "category": "Math & Geometry",
    "difficulty": "Easy",
    "companyTags": [
      "google"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Add carry from right; early return when digit < 9.",
    "constraints": [
      "Input constraints standard for Easy LeetCode problems."
    ],
    "timeComplexity": "O(n)",
    "spaceComplexity": "O(1)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Math & Geometry pattern under tight complexity bounds.",
      "task": "Achieve target O(n) runtime complexity with O(1) memory overhead.",
      "action": "Add carry from right; early return when digit < 9.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc141",
    "title": "Pow(x, n)",
    "track": "algorithms",
    "category": "Math & Geometry",
    "difficulty": "Medium",
    "companyTags": [
      "meta"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Binary exponentiation squaring base and halving exponent.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(log n)",
    "spaceComplexity": "O(1)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Math & Geometry pattern under tight complexity bounds.",
      "task": "Achieve target O(log n) runtime complexity with O(1) memory overhead.",
      "action": "Binary exponentiation squaring base and halving exponent.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc142",
    "title": "Multiply Strings",
    "track": "algorithms",
    "category": "Math & Geometry",
    "difficulty": "Medium",
    "companyTags": [
      "meta"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Elementary multiplication placing product of num1[i] and num2[j] at indices i+j and i+j+1.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(n * m)",
    "spaceComplexity": "O(n + m)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Math & Geometry pattern under tight complexity bounds.",
      "task": "Achieve target O(n * m) runtime complexity with O(n + m) memory overhead.",
      "action": "Elementary multiplication placing product of num1[i] and num2[j] at indices i+j and i+j+1.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc143",
    "title": "Detect Squares",
    "track": "algorithms",
    "category": "Math & Geometry",
    "difficulty": "Medium",
    "companyTags": [
      "google"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Store points in frequency map; query diagonals and assert matching adjacent points.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(n)",
    "spaceComplexity": "O(n)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Math & Geometry pattern under tight complexity bounds.",
      "task": "Achieve target O(n) runtime complexity with O(n) memory overhead.",
      "action": "Store points in frequency map; query diagonals and assert matching adjacent points.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc144",
    "title": "Single Number",
    "track": "algorithms",
    "category": "Bit Manipulation",
    "difficulty": "Easy",
    "companyTags": [
      "amazon"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "XOR all elements together: a ^ a = 0 and a ^ 0 = a.",
    "constraints": [
      "Input constraints standard for Easy LeetCode problems."
    ],
    "timeComplexity": "O(n)",
    "spaceComplexity": "O(1)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Bit Manipulation pattern under tight complexity bounds.",
      "task": "Achieve target O(n) runtime complexity with O(1) memory overhead.",
      "action": "XOR all elements together: a ^ a = 0 and a ^ 0 = a.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc145",
    "title": "Number of 1 Bits",
    "track": "algorithms",
    "category": "Bit Manipulation",
    "difficulty": "Easy",
    "companyTags": [
      "microsoft"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Brian Kernighan's algorithm: `n &= (n - 1)` clears lowest set bit.",
    "constraints": [
      "Input constraints standard for Easy LeetCode problems."
    ],
    "timeComplexity": "O(1)",
    "spaceComplexity": "O(1)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Bit Manipulation pattern under tight complexity bounds.",
      "task": "Achieve target O(1) runtime complexity with O(1) memory overhead.",
      "action": "Brian Kernighan's algorithm: `n &= (n - 1)` clears lowest set bit.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc146",
    "title": "Counting Bits",
    "track": "algorithms",
    "category": "Bit Manipulation",
    "difficulty": "Easy",
    "companyTags": [
      "amazon"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "dp[i] = dp[i >> 1] + (i & 1).",
    "constraints": [
      "Input constraints standard for Easy LeetCode problems."
    ],
    "timeComplexity": "O(n)",
    "spaceComplexity": "O(n)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Bit Manipulation pattern under tight complexity bounds.",
      "task": "Achieve target O(n) runtime complexity with O(n) memory overhead.",
      "action": "dp[i] = dp[i >> 1] + (i & 1).",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc147",
    "title": "Reverse Bits",
    "track": "algorithms",
    "category": "Bit Manipulation",
    "difficulty": "Easy",
    "companyTags": [
      "apple"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Iterate 32 bits, shift result left, bitwise OR with `n & 1`, shift n right.",
    "constraints": [
      "Input constraints standard for Easy LeetCode problems."
    ],
    "timeComplexity": "O(1)",
    "spaceComplexity": "O(1)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Bit Manipulation pattern under tight complexity bounds.",
      "task": "Achieve target O(1) runtime complexity with O(1) memory overhead.",
      "action": "Iterate 32 bits, shift result left, bitwise OR with `n & 1`, shift n right.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc148",
    "title": "Missing Number",
    "track": "algorithms",
    "category": "Bit Manipulation",
    "difficulty": "Easy",
    "companyTags": [
      "amazon"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Gauss sum `n * (n + 1) / 2` minus array sum, or XOR range 0..n with array.",
    "constraints": [
      "Input constraints standard for Easy LeetCode problems."
    ],
    "timeComplexity": "O(n)",
    "spaceComplexity": "O(1)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Bit Manipulation pattern under tight complexity bounds.",
      "task": "Achieve target O(n) runtime complexity with O(1) memory overhead.",
      "action": "Gauss sum `n * (n + 1) / 2` minus array sum, or XOR range 0..n with array.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc149",
    "title": "Sum of Two Integers",
    "track": "algorithms",
    "category": "Bit Manipulation",
    "difficulty": "Medium",
    "companyTags": [
      "meta"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Bitwise XOR for addition without carry; AND shifted left by 1 for carry.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(1)",
    "spaceComplexity": "O(1)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Bit Manipulation pattern under tight complexity bounds.",
      "task": "Achieve target O(1) runtime complexity with O(1) memory overhead.",
      "action": "Bitwise XOR for addition without carry; AND shifted left by 1 for carry.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  },
  {
    "id": "nc150",
    "title": "Reverse Integer",
    "track": "algorithms",
    "category": "Bit Manipulation",
    "difficulty": "Medium",
    "companyTags": [
      "apple"
    ],
    "sourceSet": "NeetCode 150",
    "rubricGuide": "Pop last digit and push to result checking for 32-bit signed overflow.",
    "constraints": [
      "Input constraints standard for Medium LeetCode problems."
    ],
    "timeComplexity": "O(log x)",
    "spaceComplexity": "O(1)",
    "starRubric": {
      "situation": "Encountered problem requiring optimal Bit Manipulation pattern under tight complexity bounds.",
      "task": "Achieve target O(log x) runtime complexity with O(1) memory overhead.",
      "action": "Pop last digit and push to result checking for 32-bit signed overflow.",
      "result": "Cleanly passed all test cases with optimal time and space complexity constraints."
    }
  }
];

export const SYSTEM_DESIGN_QUESTIONS: InterviewQuestion[] = [
  {
    "id": "sd1",
    "title": "Design a URL Shortener",
    "track": "system_design",
    "category": "System Design",
    "difficulty": "Medium",
    "companyTags": [
      "amazon",
      "meta",
      "microsoft"
    ],
    "sourceSet": "System Design",
    "rubricGuide": "Key Components: Base62 encoding service, distributed counter/KGS (Key Generation Service), distributed cache (Redis) for hot URLs, NoSQL or RDBMS with hash index. Constraints: 100M URLs/day (1,200 writes/sec, 12,000 reads/sec), read-heavy (10:1), 500TB storage over 5 years. Trade-offs: In-memory counter vs pre-generated keys; single-region Redis vs active-active multi-region replication.",
    "constraints": [
      "Latency < 15ms redirect",
      "High availability (99.99%)",
      "Eventual consistency for analytics"
    ],
    "timeComplexity": "O(1) lookup",
    "spaceComplexity": "Distributed memory cache + persistent store",
    "starRubric": {
      "situation": "High-volume link generation requiring predictable sub-20ms global redirect latency.",
      "task": "Architect fault-tolerant URL shortening service handling 10:1 read/write asymmetry.",
      "action": "Deployed pre-generated Base62 key pool with cluster Redis caching and CDN edge routing.",
      "result": "Achieved 99.99% availability and 8ms p99 redirect latency across global edge pops."
    }
  },
  {
    "id": "sd2",
    "title": "Design Twitter / X News Feed",
    "track": "system_design",
    "category": "System Design",
    "difficulty": "Hard",
    "companyTags": [
      "meta",
      "uber",
      "google"
    ],
    "sourceSet": "System Design",
    "rubricGuide": "Key Components: Feed generation service, social graph service, timeline cache (Redis sorted sets), user posting service. Constraints: 300M DAU, 500M tweets/day, average 200 followers per user, celebrity users with 50M+ followers. Trade-offs: Fan-out on write (push model for regular users) vs fan-out on read (pull model for celebrities/high-follower accounts) to prevent write amplification.",
    "constraints": [
      "Timeline generation latency < 200ms",
      "Feed delivery within 5 seconds of posting"
    ],
    "timeComplexity": "O(log k) timeline fetch",
    "spaceComplexity": "In-memory sorted sets (top 800 tweets per active user)",
    "starRubric": {
      "situation": "Real-time timeline delivery suffering from fan-out write storms on high-follower accounts.",
      "task": "Eliminate write amplification while maintaining sub-200ms timeline assembly.",
      "action": "Implemented hybrid push/pull fan-out architecture isolating accounts with >25k followers.",
      "result": "Reduced message queue lag by 94% and sustained stable 140ms p95 timeline renders."
    }
  },
  {
    "id": "sd3",
    "title": "Design a Distributed Rate Limiter",
    "track": "system_design",
    "category": "System Design",
    "difficulty": "Medium",
    "companyTags": [
      "stripe",
      "amazon",
      "uber"
    ],
    "sourceSet": "System Design",
    "rubricGuide": "Key Components: API Gateway filter, Redis cluster with Lua scripts, token bucket/sliding window log algorithm, fallback local memory limiter. Constraints: 1M requests/second, microsecond decision latency, zero false-negative drops. Trade-offs: Token bucket vs sliding window log; local in-memory synchronization vs centralized Redis atomic operations.",
    "constraints": [
      "Decision latency < 2ms",
      "Fault tolerance: fail-open vs fail-closed policy"
    ],
    "timeComplexity": "O(1) Redis eval",
    "spaceComplexity": "O(users * rate_rules)",
    "starRubric": {
      "situation": "Public API vulnerable to credential stuffing and DDoS traffic spikes.",
      "task": "Deploy a low-latency rate limiter enforcing per-client and per-IP tiered quotas.",
      "action": "Implemented Redis cluster sliding window log with Lua atomicity and local process fallback.",
      "result": "Protected downstream microservices while adding less than 1.2ms to roundtrip API latency."
    }
  },
  {
    "id": "sd4",
    "title": "Design a Distributed Key-Value Store",
    "track": "system_design",
    "category": "System Design",
    "difficulty": "Hard",
    "companyTags": [
      "amazon",
      "microsoft"
    ],
    "sourceSet": "System Design",
    "rubricGuide": "Key Components: Consistent hashing ring with virtual nodes, SSTables and LSM-Trees, write-ahead logging (WAL), gossip protocol for failure detection, vector clocks for conflict resolution. Constraints: Highly scalable write throughput, tunable consistency (CAP theorem: AP preference). Trade-offs: Read repair vs anti-entropy with Merkle trees; quorum parameters (R + W > N).",
    "constraints": [
      "Sub-5ms read/write latency",
      "Zero single point of failure",
      "Tunable consistency"
    ],
    "timeComplexity": "O(1) memory lookup + O(log n) SSTable search",
    "spaceComplexity": "Distributed storage across partitions",
    "starRubric": {
      "situation": "Mission-critical state store requiring write availability during network partitions.",
      "task": "Architect Dynamo-style peer-to-peer storage engine with tunable quorum parameters.",
      "action": "Configured consistent hashing with 256 virtual nodes and vector clock conflict detection.",
      "result": "Survived node failures with zero downtime and verified R=2, W=2 quorum consistency."
    }
  },
  {
    "id": "sd5",
    "title": "Design a Scalable Chat Service",
    "track": "system_design",
    "category": "System Design",
    "difficulty": "Hard",
    "companyTags": [
      "meta",
      "microsoft",
      "slack"
    ],
    "sourceSet": "System Design",
    "rubricGuide": "Key Components: WebSocket gateway servers, presence service, Apache Kafka / RabbitMQ message bus, Cassandra/ScyllaDB message archive, push notification service. Constraints: 50M concurrent connections, 100k messages/second. Trade-offs: Long polling vs WebSockets; global message ordering vs per-chat room ordering.",
    "constraints": [
      "End-to-end delivery < 100ms",
      "Guaranteed delivery semantics",
      "Offline message sync"
    ],
    "timeComplexity": "O(1) socket dispatch",
    "spaceComplexity": "Distributed connection session table",
    "starRubric": {
      "situation": "Chat delivery bottlenecks causing disconnect storms and out-of-order message receipts.",
      "task": "Build scalable WebSocket routing layer with distributed presence tracking.",
      "action": "Deployed Redis Pub/Sub connection registry backed by Cassandra append-only message logs.",
      "result": "Scaled to 10M concurrent connections with 45ms average message delivery latency."
    }
  },
  {
    "id": "sd6",
    "title": "Design YouTube / Video Streaming Platform",
    "track": "system_design",
    "category": "System Design",
    "difficulty": "Hard",
    "companyTags": [
      "google",
      "netflix"
    ],
    "sourceSet": "System Design",
    "rubricGuide": "Key Components: Chunked video upload service, distributed transcode workers (FFmpeg), CDN edge distribution, HLS/DASH manifest generation, metadata RDBMS. Constraints: 500 hours uploaded per minute, petabytes of daily egress. Trade-offs: Upfront multi-resolution transcoding vs on-demand transcoding; edge caching vs origin storage costs.",
    "constraints": [
      "Smooth playback with < 2s startup buffering",
      "Global CDN coverage"
    ],
    "timeComplexity": "O(1) CDN hit",
    "spaceComplexity": "Multi-bitrate chunked object storage (S3/GCS)",
    "starRubric": {
      "situation": "Video buffering spikes during peak hours due to origin server bandwidth saturation.",
      "task": "Implement adaptive bitrate streaming with localized CDN distribution tier.",
      "action": "Split uploads into 4-second HLS chunks with geo-distributed edge caching rules.",
      "result": "Reduced video rebuffering rate by 82% and offloaded 96% of video traffic to edge CDNs."
    }
  },
  {
    "id": "sd7",
    "title": "Design a Notification System",
    "track": "system_design",
    "category": "System Design",
    "difficulty": "Medium",
    "companyTags": [
      "uber",
      "amazon",
      "apple"
    ],
    "sourceSet": "System Design",
    "rubricGuide": "Key Components: Notification ingestion API, priority queues (critical vs promotional), user preference service, third-party adapters (APNs, FCM, Twilio, SendGrid), deduplication cache. Constraints: 10M notifications/hour. Trade-offs: Rate limiting per user to avoid alert fatigue; synchronous push vs asynchronous queued workers.",
    "constraints": [
      "Transactional alerts delivered < 5s",
      "At-least-once delivery with deduplication"
    ],
    "timeComplexity": "O(1) queue push",
    "spaceComplexity": "Deduplication hash window (Redis)",
    "starRubric": {
      "situation": "Marketing campaigns overwhelming transactional OTP and security notification delivery.",
      "task": "Isolate delivery pipelines and enforce user notification frequency caps.",
      "action": "Architected dual-priority Kafka queues with Redis idempotency keys and APNs/FCM workers.",
      "result": "Guaranteed 100% of OTPs delivered within 3 seconds regardless of marketing batch load."
    }
  },
  {
    "id": "sd8",
    "title": "Design Uber / Ride Sharing Dispatch Engine",
    "track": "system_design",
    "category": "System Design",
    "difficulty": "Hard",
    "companyTags": [
      "uber"
    ],
    "sourceSet": "System Design",
    "rubricGuide": "Key Components: Location tracking service, spatial indexing (H3 / S2 / QuadTree), dispatch matching engine, dynamic pricing / surge service, trip state machine. Constraints: 1M active drivers sending GPS every 4 seconds (250k writes/sec). Trade-offs: In-memory spatial index vs PostGIS database; nearest driver match vs batch optimization matching.",
    "constraints": [
      "Driver location update p99 < 50ms",
      "Match dispatch within 3 seconds"
    ],
    "timeComplexity": "O(k) spatial range query",
    "spaceComplexity": "In-memory driver coordinate cell table",
    "starRubric": {
      "situation": "Driver location updates overwhelming database write capacity during peak rush hours.",
      "task": "Build real-time spatial ingestion engine supporting 300k GPS pings per second.",
      "action": "Partitioned geospatial state into Uber H3 hexagonal cells stored in Redis memory clusters.",
      "result": "Reduced dispatch calculation time to 400ms and eliminated GPS write backpressure."
    }
  },
  {
    "id": "sd9",
    "title": "Design Google Search Autocomplete",
    "track": "system_design",
    "category": "System Design",
    "difficulty": "Medium",
    "companyTags": [
      "google",
      "microsoft"
    ],
    "sourceSet": "System Design",
    "rubricGuide": "Key Components: Trie data structure with top-k cached suggestions, query collection service, MapReduce frequency aggregator, CDN / browser query cache. Constraints: 5B queries/day, latency budget < 30ms. Trade-offs: Dynamic real-time Trie updates vs periodic batch Trie rebuilds; server-side prefix matching vs client-side caching.",
    "constraints": [
      "Sub-30ms response time globally",
      "Trending query adaptation within 1 hour"
    ],
    "timeComplexity": "O(prefix_length + k) lookup",
    "spaceComplexity": "Compressed Trie (Radix Tree) memory footprint",
    "starRubric": {
      "situation": "Keystroke suggestion latency exceeding 100ms, degrading interactive typing feel.",
      "task": "Design distributed autocomplete cache providing instant top-5 search predictions.",
      "action": "Built serialized Trie node cache with precomputed top-k results deployed to edge PoPs.",
      "result": "Cut p99 autocomplete latency to 18ms and absorbed 70% of query keystrokes at edge."
    }
  },
  {
    "id": "sd10",
    "title": "Design a Distributed Web Crawler",
    "track": "system_design",
    "category": "System Design",
    "difficulty": "Hard",
    "companyTags": [
      "google"
    ],
    "sourceSet": "System Design",
    "rubricGuide": "Key Components: Frontier queue, DNS cache resolver, HTML fetcher, duplicate content detector (SimHash), link extractor, robots.txt politeness engine. Constraints: 1B web pages/month, polite rate limiting per domain. Trade-offs: Breadth-first vs depth-first crawl; distributed URL frontier prioritization vs politeness queues.",
    "constraints": [
      "Strict domain politeness (1 req/sec/host)",
      "De-duplication of 1B+ URLs"
    ],
    "timeComplexity": "O(1) hash check",
    "spaceComplexity": "Bloom filter of visited URLs + document repository",
    "starRubric": {
      "situation": "Crawler encountering crawler traps, duplicate mirrors, and rate-limit IP bans.",
      "task": "Architect distributed web crawler enforcing politeness and duplicate document elimination.",
      "action": "Implemented two-tier frontier queue (priority + politeness) with 64-bit SimHash deduplication.",
      "result": "Scaled crawler throughput to 40k pages/sec while maintaining zero IP block incidents."
    }
  },
  {
    "id": "sd11",
    "title": "Design a Distributed Cache",
    "track": "system_design",
    "category": "System Design",
    "difficulty": "Medium",
    "companyTags": [
      "amazon",
      "meta",
      "google"
    ],
    "sourceSet": "System Design",
    "rubricGuide": "Key Components: Client hashing router, cache nodes, LRU eviction with doubly linked list + hash map, consistent hashing with replication, master-replica sync. Constraints: 10M QPS, sub-millisecond latency. Trade-offs: Cache-aside vs write-through vs write-behind; Memcached multi-threaded model vs Redis single-threaded event loop.",
    "constraints": [
      "p99 read latency < 1ms",
      "High availability with automatic failover"
    ],
    "timeComplexity": "O(1) read/write",
    "spaceComplexity": "In-memory RAM allocation",
    "starRubric": {
      "situation": "Primary database under severe connection pressure from repetitive reads.",
      "task": "Deploy distributed in-memory cache cluster with automatic partition rebalancing.",
      "action": "Configured consistent hashing ring with virtual nodes and LRU eviction policy.",
      "result": "Absorbed 92% of read queries with 0.8ms average latency."
    }
  },
  {
    "id": "sd12",
    "title": "Design a Payment Processing System",
    "track": "system_design",
    "category": "System Design",
    "difficulty": "Hard",
    "companyTags": [
      "stripe",
      "amazon"
    ],
    "sourceSet": "System Design",
    "rubricGuide": "Key Components: Payment gateway, idempotency manager, ledger service (double-entry bookkeeping), payment processor integration, reconciliation engine. Constraints: Zero double-charges, exactly-once processing semantics, ACID transaction guarantees. Trade-offs: Two-phase commit (2PC) vs Saga pattern with compensating transactions; synchronous gateway response vs asynchronous settlement.",
    "constraints": [
      "100% financial correctness",
      "Idempotency key enforcement on all charges"
    ],
    "timeComplexity": "O(1) lookup with atomic transactional lock",
    "spaceComplexity": "Append-only immutable ledger table",
    "starRubric": {
      "situation": "Network timeouts between payment gateway and third-party acquirers risking duplicate charges.",
      "task": "Architect zero-loss payment pipeline guaranteeing exactly-once transaction processing.",
      "action": "Built distributed idempotency layer with double-entry ledger and reconciliation cron.",
      "result": "Processed $50M+ in volume with zero duplicate charges and 100% audit trail compliance."
    }
  },
  {
    "id": "sd13",
    "title": "Design an API Gateway",
    "track": "system_design",
    "category": "System Design",
    "difficulty": "Medium",
    "companyTags": [
      "netflix",
      "amazon"
    ],
    "sourceSet": "System Design",
    "rubricGuide": "Key Components: Reverse proxy router, JWT / OAuth2 token validator, distributed rate limiter, circuit breaker, telemetry / request tracing collector. Constraints: 500k RPS, latency overhead < 5ms. Trade-offs: Non-blocking I/O (Netty/Envoy) vs thread-per-request; centralized gateway vs service-mesh sidecar architecture.",
    "constraints": [
      "Overhead latency < 3ms",
      "Zero disruption during upstream microservice deployments"
    ],
    "timeComplexity": "O(1) route match",
    "spaceComplexity": "Token blacklist and rate limit counter cache",
    "starRubric": {
      "situation": "Direct client-to-microservice calls creating security fragmentation and cross-cutting duplication.",
      "task": "Consolidate routing, authentication, and throttling into an enterprise API gateway.",
      "action": "Implemented Envoy-based gateway with distributed JWT verification and circuit breakers.",
      "result": "Unified security posture across 40+ services while keeping routing overhead under 2.4ms."
    }
  },
  {
    "id": "sd14",
    "title": "Design a Real-Time Gaming Leaderboard",
    "track": "system_design",
    "category": "System Design",
    "difficulty": "Medium",
    "companyTags": [
      "amazon",
      "meta"
    ],
    "sourceSet": "System Design",
    "rubricGuide": "Key Components: Score ingestion API, Redis Sorted Sets (ZADD, ZREVRANGE), sharded leaderboards for millions of players, background snapshot service. Constraints: 50M users, 100k score updates/sec, instant top-100 and around-me rank retrieval. Trade-offs: Redis Sorted Set memory overhead vs relational database index; single shard vs range-partitioned shards.",
    "constraints": [
      "Rank update latency < 50ms",
      "Rank query latency < 10ms"
    ],
    "timeComplexity": "O(log n) update and rank query",
    "spaceComplexity": "In-memory skip list and hash table per shard",
    "starRubric": {
      "situation": "Leaderboard queries locking SQL database during tournament events.",
      "task": "Build real-time ranking engine supporting instantaneous rank updates and pagination.",
      "action": "Deployed Redis Sorted Sets with range-partitioned buckets and tier caches.",
      "result": "Handled 120k score submissions/second with sub-5ms rank lookup times."
    }
  },
  {
    "id": "sd15",
    "title": "Design a Hotel Booking System",
    "track": "system_design",
    "category": "System Design",
    "difficulty": "Hard",
    "companyTags": [
      "airbnb",
      "google"
    ],
    "sourceSet": "System Design",
    "rubricGuide": "Key Components: Search and filter service, inventory management, reservation state machine, locking service (pessimistic vs optimistic), payment coordinator. Constraints: High concurrency on high-demand dates, zero double-bookings. Trade-offs: Pessimistic row-level locking vs distributed Redis lock with TTL vs optimistic locking with version checks.",
    "constraints": [
      "Zero inventory overbooking",
      "Cart reservation hold expires in 10 minutes"
    ],
    "timeComplexity": "O(1) inventory check and lock",
    "spaceComplexity": "Date-range inventory availability table",
    "starRubric": {
      "situation": "Flash sale events causing race conditions and double-bookings on hotel rooms.",
      "task": "Architect inventory reservation system preventing overbooking under high concurrent load.",
      "action": "Implemented optimistic concurrency control with 10-minute Redis reservation locks.",
      "result": "Completely eliminated overbooking incidents across 200k concurrent checkout attempts."
    }
  }
];

export const OA_PROBLEMS: InterviewQuestion[] = [
  {
    "id": "oa1",
    "title": "Robot Path Decoding",
    "track": "oa_screening",
    "category": "String Manipulation",
    "difficulty": "Medium",
    "companyTags": [
      "amazon",
      "microsoft"
    ],
    "sourceSet": "OA Screening",
    "rubricGuide": "Assessment Scope: 70-minute timed screen. Parse compressed movement strings containing nested repeat brackets (e.g., `3[L2[R]]`). Use a stack tracking multiplier and string fragments. Test edge cases with single-character brackets and multipliers up to 100.",
    "constraints": [
      "1 <= s.length <= 10^5",
      "All brackets are valid and properly matched"
    ],
    "timeComplexity": "O(output_length)",
    "spaceComplexity": "O(nesting_depth)",
    "starRubric": {
      "situation": "Standard 70-minute OA question testing bracket evaluation and simulation.",
      "task": "Decode nested commands without stack overflow or intermediate string allocations.",
      "action": "Implemented stack-based iterative parsing accumulating segment string builders.",
      "result": "Passed all 25 visible and hidden platform test cases in 18 minutes."
    }
  },
  {
    "id": "oa2",
    "title": "Max Servers Running Concurrently",
    "track": "oa_screening",
    "category": "Arrays & Intervals",
    "difficulty": "Medium",
    "companyTags": [
      "amazon",
      "google"
    ],
    "sourceSet": "OA Screening",
    "rubricGuide": "Assessment Scope: 70-minute timed screen. Given server boot times and shut-down intervals, find maximum simultaneous operational servers. Coordinate sorting on timestamps with start events (+1) ordered before end events (-1).",
    "constraints": [
      "1 <= intervals.length <= 2 * 10^5",
      "Timestamps fit in 32-bit signed integers"
    ],
    "timeComplexity": "O(n log n)",
    "spaceComplexity": "O(n)",
    "starRubric": {
      "situation": "Cloud infrastructure capacity assessment problem in technical screen.",
      "task": "Compute peak server concurrency across overlapping active time ranges.",
      "action": "Applied sweep-line algorithm sorting event points with tie-break handling.",
      "result": "Optimized runtime from O(n^2) brute force to O(n log n), passing all scale test cases."
    }
  },
  {
    "id": "oa3",
    "title": "Optimal Delivery Route Dispatch",
    "track": "oa_screening",
    "category": "Graphs & Shortest Path",
    "difficulty": "Medium",
    "companyTags": [
      "amazon",
      "uber"
    ],
    "sourceSet": "OA Screening",
    "rubricGuide": "Assessment Scope: 90-minute timed assessment. Grid traversal with road obstacles and toll weights. Apply Dijkstra's algorithm with priority queue to find least-cost path from warehouse to target fulfillment hub.",
    "constraints": [
      "Grid size up to 1000 x 1000",
      "Weights between 1 and 100"
    ],
    "timeComplexity": "O(V log V + E)",
    "spaceComplexity": "O(V)",
    "starRubric": {
      "situation": "Logistics routing scenario under timed assessment constraints.",
      "task": "Find minimum toll cost path across 2D grid with variable congestion costs.",
      "action": "Implemented min-heap Dijkstra tracking visited coordinates and running costs.",
      "result": "Produced optimal path within 220ms, well beneath the 2-second timeout ceiling."
    }
  },
  {
    "id": "oa4",
    "title": "Unique Substring Diversity Calculator",
    "track": "oa_screening",
    "category": "Sliding Window & Hashing",
    "difficulty": "Hard",
    "companyTags": [
      "amazon",
      "meta"
    ],
    "sourceSet": "OA Screening",
    "rubricGuide": "Assessment Scope: 90-minute timed assessment. Calculate sum of count of unique characters across all substrings of a given string. Instead of evaluating all O(n^2) substrings, compute contribution of each character `s[i]` based on its previous and next occurrence.",
    "constraints": [
      "1 <= s.length <= 10^5",
      "String contains only lowercase English letters"
    ],
    "timeComplexity": "O(n)",
    "spaceComplexity": "O(n)",
    "starRubric": {
      "situation": "Complex combinatorial substring question requiring mathematical transformation.",
      "task": "Eliminate O(n^2) sliding window in favor of linear character contribution math.",
      "action": "Tracked prev[i] and next[i] positions for each character, adding (i - prev) * (next - i).",
      "result": "Delivered O(n) solution passing 100,000-character test inputs in 14ms."
    }
  },
  {
    "id": "oa5",
    "title": "Suspicious Transaction Log Identifier",
    "track": "oa_screening",
    "category": "Sorting & Hashing",
    "difficulty": "Easy",
    "companyTags": [
      "amazon",
      "stripe"
    ],
    "sourceSet": "OA Screening",
    "rubricGuide": "Assessment Scope: 70-minute timed assessment. Parse financial transaction records `[sender, recipient, amount]`. Count transactions per user (self-transactions count once). Return users whose transaction count >= threshold, sorted numerically.",
    "constraints": [
      "1 <= logs.length <= 10^5",
      "Threshold >= 1"
    ],
    "timeComplexity": "O(n log n)",
    "spaceComplexity": "O(n)",
    "starRubric": {
      "situation": "Fraud screening assessment problem focusing on parsing and frequency thresholds.",
      "task": "Aggregate activity counts with proper self-transaction deduplication.",
      "action": "Parsed tokens into hash map, filtered by threshold, and applied custom numeric sort.",
      "result": "Clean implementation completed in under 12 minutes with 100% test accuracy."
    }
  },
  {
    "id": "oa6",
    "title": "Password Strength Factor Evaluator",
    "track": "oa_screening",
    "category": "Dynamic Programming",
    "difficulty": "Medium",
    "companyTags": [
      "amazon",
      "microsoft"
    ],
    "sourceSet": "OA Screening",
    "rubricGuide": "Assessment Scope: 70-minute timed assessment. Evaluate the strength of all substrings where strength equals distinct vowel count. Sum up strengths over all possible contiguous segments using prefix sum aggregation.",
    "constraints": [
      "1 <= password.length <= 10^5"
    ],
    "timeComplexity": "O(n)",
    "spaceComplexity": "O(1)",
    "starRubric": {
      "situation": "Security credential metric calculation under OA assessment time pressure.",
      "task": "Compute vowel presence weight across all substrings in linear time.",
      "action": "Maintained running total of vowel contribution multipliers across scan.",
      "result": "Achieved optimal O(n) performance avoiding time-limit-exceeded failures."
    }
  },
  {
    "id": "oa7",
    "title": "Song Pair Duration Divisibility",
    "track": "oa_screening",
    "category": "Math & Hashing",
    "difficulty": "Medium",
    "companyTags": [
      "amazon",
      "apple"
    ],
    "sourceSet": "OA Screening",
    "rubricGuide": "Assessment Scope: 70-minute timed assessment. Find number of pairs whose total playback duration in seconds is divisible by 60. Store remainder modulo 60 in frequency map: pairs formed with `(60 - rem) % 60`.",
    "constraints": [
      "1 <= time.length <= 6 * 10^4",
      "1 <= time[i] <= 500"
    ],
    "timeComplexity": "O(n)",
    "spaceComplexity": "O(1)",
    "starRubric": {
      "situation": "Media playlist optimization question in technical coding assessment.",
      "task": "Count divisible duration combinations without nested loop quadratic time.",
      "action": "Used 60-element integer array storing remainder counts for constant-space matching.",
      "result": "Executed in 8ms with zero auxiliary memory overhead."
    }
  },
  {
    "id": "oa8",
    "title": "Grid Power Component Connectivity",
    "track": "oa_screening",
    "category": "Union-Find & Graphs",
    "difficulty": "Easy",
    "companyTags": [
      "amazon",
      "databricks"
    ],
    "sourceSet": "OA Screening",
    "rubricGuide": "Assessment Scope: 70-minute timed assessment. Determine minimum connections required to unify isolated power substation clusters. Union-Find with rank tracking component counts; answer is `numComponents - 1` if sufficient edges exist.",
    "constraints": [
      "1 <= n <= 10^4",
      "0 <= connections.length <= 10^5"
    ],
    "timeComplexity": "O(V + E * alpha(V))",
    "spaceComplexity": "O(V)",
    "starRubric": {
      "situation": "Infrastructure connectivity prompt testing disjoint set data structures.",
      "task": "Validate whether sufficient redundant cables exist to link all power nodes.",
      "action": "Built Disjoint Set Union (DSU) class with path compression and rank heuristics.",
      "result": "Correctly resolved edge cases including disconnected cycles in under 15 minutes."
    }
  },
  {
    "id": "oa9",
    "title": "Process Scheduling Priority Queue",
    "track": "oa_screening",
    "category": "Greedy & Heaps",
    "difficulty": "Medium",
    "companyTags": [
      "amazon",
      "google"
    ],
    "sourceSet": "OA Screening",
    "rubricGuide": "Assessment Scope: 90-minute timed assessment. Allocate CPU processes with release times and execution durations to minimize total completion wait time. Min-heap prioritizes available processes by shortest remaining processing time.",
    "constraints": [
      "1 <= processes.length <= 10^5"
    ],
    "timeComplexity": "O(n log n)",
    "spaceComplexity": "O(n)",
    "starRubric": {
      "situation": "OS CPU task scheduling simulation in technical assessment.",
      "task": "Simulate shortest-remaining-time-first scheduler under arrival time constraints.",
      "action": "Sorted by arrival time and maintained priority queue of runnable candidate jobs.",
      "result": "Passed all memory and time constraint checks on test evaluation platform."
    }
  },
  {
    "id": "oa10",
    "title": "Frequently Co-Purchased Item Associations",
    "track": "oa_screening",
    "category": "Graphs & Connected Components",
    "difficulty": "Medium",
    "companyTags": [
      "amazon"
    ],
    "sourceSet": "OA Screening",
    "rubricGuide": "Assessment Scope: 90-minute timed assessment. Group items into connected clusters based on purchase pairing pairs. Find the largest component; if tie, return the component that is lexicographically smallest.",
    "constraints": [
      "1 <= associations.length <= 10^4",
      "Item strings are lowercase alphanumeric"
    ],
    "timeComplexity": "O(V log V + E)",
    "spaceComplexity": "O(V + E)",
    "starRubric": {
      "situation": "E-commerce recommendation system association group problem.",
      "task": "Identify maximum connected item cluster with tie-breaking lexicographical ordering.",
      "action": "Constructed adjacency list, ran BFS traversal, and sorted cluster elements.",
      "result": "Met all strict lexical tie-breaker criteria and passed 100% of test suites."
    }
  }
];

export const ALL_QUESTIONS: InterviewQuestion[] = [
  ...NEETCODE_150,
  ...SYSTEM_DESIGN_QUESTIONS,
  ...OA_PROBLEMS
];

export const COMPANY_LOGOS: CompanyLogo[] = [
  {
    "slug": "google",
    "name": "Google",
    "logoPath": "/logos/google.svg"
  },
  {
    "slug": "meta",
    "name": "Meta",
    "logoPath": "/logos/meta.svg"
  },
  {
    "slug": "amazon",
    "name": "Amazon",
    "logoPath": "/logos/amazon.svg"
  },
  {
    "slug": "apple",
    "name": "Apple",
    "logoPath": "/logos/apple.svg"
  },
  {
    "slug": "netflix",
    "name": "Netflix",
    "logoPath": "/logos/netflix.svg"
  },
  {
    "slug": "openai",
    "name": "OpenAI",
    "logoPath": "/logos/openai.svg"
  },
  {
    "slug": "microsoft",
    "name": "Microsoft",
    "logoPath": "/logos/microsoft.svg"
  },
  {
    "slug": "uber",
    "name": "Uber",
    "logoPath": "/logos/uber.svg"
  },
  {
    "slug": "stripe",
    "name": "Stripe",
    "logoPath": "/logos/stripe.svg"
  },
  {
    "slug": "databricks",
    "name": "Databricks",
    "logoPath": "/logos/databricks.svg"
  }
];
