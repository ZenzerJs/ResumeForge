# Playwright Testing & Unbiased Execution Reporting Rules

## 1. Subagent Delegation for E2E Testing
- Whenever executing Playwright test suites (`npx playwright test`), ALWAYS launch/delegate to a subagent specifically dedicated to test execution, log monitoring, and reporting.

## 2. Accurate Execution Status (No Premature Pass Claims)
- NEVER report that background commands, test suites, or build tasks ran "without error" or "passed cleanly" while they are still executing.
- State clearly that the process has been launched in the background, and wait for the system completion notification before declaring pass or fail status.

## 3. Total Transparency on Failures & Diagnostics
- As an unbiased marker, always report what went right AND what went wrong.
- If any test or command fails during development (such as an interim timeout, selector error, or assertion failure), ALWAYS report:
  1. The exact failure details and output log.
  2. The root cause diagnosis.
  3. The exact code/configuration fix applied.
  4. The subsequent re-run verification results.
- NEVER hide or omit intermediate test failures from summaries.
