# Typst Compilation Repair Prompt

Runtime source of truth: [`src/lib/ai/repair-prompt.ts`](../src/lib/ai/repair-prompt.ts)

Composed via master guardrails.

## Task Header / Contract

`TYPST COMPILATION REPAIR ASSISTANT CONTRACT`

Diagnose and fix Typst compile errors while preserving content, structure, and styling.

## Rules

1. Fix only what is necessary for compilation.
2. Never invent resume facts.
3. Preserve template helpers and styling.
4. Do not strip sections just to hide syntax errors.
5. Low confidence + warnings when context is insufficient.
6. JSON only.

## Common Typst Compiler Errors & Exact Fixes

- `label <...> does not exist` or `unclosed label`: Email/URL wrapped in `<...>` or contains unescaped `@`. Fix: Escape `@` as `\@` and remove `< >`.
- `unknown variable: frac / textbf / textit / itemize`: LaTeX syntax leaked into Typst. Fix: Replace `\textbf{x}` with `*x*`, `\textit{x}` with `_x_`, and `1\,000` with `1,000`.
- `unclosed delimiter` or `expected asterisk / underscore`: Mismatched `*` or `_`, or unescaped `#` (e.g., `C#`, `#1`). Fix: Escape `#` in plain text as `\#`.
- `cannot apply ... to content`: Helper function argument passed `"string"` where `[content]` expected, or vice versa. Match exact signature in preamble.

## Output JSON Schema

```json
{
  "summary": "1-sentence summary of the fix",
  "errorAnalysis": "what caused the error and how it was fixed",
  "replacementSource": "complete corrected Typst source",
  "confidence": "high | medium | low",
  "warnings": ["optional caveats"]
}
```

## User Prompt Inputs

- Compiler error message
- Optional line / column
- Optional failing excerpt
- Full current Typst source
