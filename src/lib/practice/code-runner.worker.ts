import { runCodeAgainstTestCases } from "./code-runner";
import type { TestCase } from "./types";

self.onmessage = (event: MessageEvent<{ userCode: string; testCases: TestCase[]; functionName?: string }>) => {
  const { userCode, testCases, functionName } = event.data;
  const result = runCodeAgainstTestCases(userCode, testCases, functionName);
  self.postMessage(result);
};
