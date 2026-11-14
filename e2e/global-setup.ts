import { mkdir } from "node:fs/promises";
import { chromium, type FullConfig } from "@playwright/test";

const EMAIL = "playwright@resumeforge.test";
const PASSWORD = "playwright-test-secret";

export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use?.baseURL || "http://127.0.0.1:3005";
  await mkdir("e2e/.auth", { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage();

  const signup = await page.request.post(`${baseURL}/api/auth/signup`, {
    data: { email: EMAIL, username: "playwright", password: PASSWORD },
  });
  if (!signup.ok()) {
    const login = await page.request.post(`${baseURL}/api/auth/login`, {
      data: { email: EMAIL, password: PASSWORD },
    });
    if (!login.ok()) {
      await page.goto(`${baseURL}/login`);
      await page.getByLabel("Email or username").fill(EMAIL);
      await page.locator("input#password").fill(PASSWORD);
      await page.getByRole("button", { name: "Sign In" }).click();
      await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15000 });
    }
  }

  await page.request.patch(`${baseURL}/api/auth/me`, {
    data: { username: "playwright" },
  });

  // Restore canonical form-safe starter Master Resume so persistent DB state from prior runs cannot poison editor/smoke tests
  const starterRes = await page.request.get(`${baseURL}/templates/starter-resume.typ`);
  if (starterRes.ok()) {
    const starterSource = await starterRes.text();
    if (starterSource.trim().length > 0) {
      await page.request.post(`${baseURL}/api/resumes/save-master`, {
        data: {
          title: "Master Resume",
          typstSource: starterSource,
          confirmOverwrite: true,
        },
      });
    }
  }

  await page.context().storageState({ path: "e2e/.auth/user.json" });
  await browser.close();
}
