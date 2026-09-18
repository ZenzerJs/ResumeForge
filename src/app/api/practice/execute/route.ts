import { NextRequest, NextResponse } from "next/server";
import { getProblemById, getProblemBySlug } from "@/lib/practice/practice-curriculum";
import { runCodeAgainstTestCases } from "@/lib/practice/code-runner";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { problemId, problemSlug, code, language } = body;

    if (!code || typeof code !== "string") {
      return NextResponse.json(
        { success: false, error: "Code content is required" },
        { status: 400 }
      );
    }

    const problem =
      (problemId && getProblemById(problemId)) ||
      (problemSlug && getProblemBySlug(problemSlug));

    if (!problem) {
      return NextResponse.json(
        { success: false, error: "Practice problem not found" },
        { status: 404 }
      );
    }

    // Currently in-browser and API execution supports JavaScript and TypeScript
    const lang = (language || "typescript").toLowerCase();
    if (lang !== "typescript" && lang !== "javascript") {
      return NextResponse.json({
        success: true,
        data: {
          status: "ERROR",
          totalTests: problem.testCases.length,
          passedTests: 0,
          executionTimeMs: 0,
          testResults: [],
          error: `Automated test runner currently supports JavaScript and TypeScript. Switch language to TypeScript to test your logic.`,
        },
      });
    }

    // Security check: Block server-side execution of dangerous Node.js runtime globals
    const BANNED_PATTERNS = [
      /\bprocess\b/,
      /\brequire\s*\(/,
      /\bimport\s*\(/,
      /\bchild_process\b/,
      /\bfs\b/,
      /\bvm\b/,
      /\beval\s*\(/,
    ];

    for (const pattern of BANNED_PATTERNS) {
      if (pattern.test(code)) {
        return NextResponse.json(
          {
            success: true,
            data: {
              status: "ERROR",
              totalTests: problem.testCases.length,
              passedTests: 0,
              executionTimeMs: 0,
              testResults: [],
              error: "Security violation: Access to system environment or dynamic evaluation is prohibited.",
            },
          },
          { status: 400 }
        );
      }
    }

    const result = runCodeAgainstTestCases(code, problem.testCases, problem.functionName);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    console.error("[API practice/execute] Error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Execution failed" },
      { status: 500 }
    );
  }
}
