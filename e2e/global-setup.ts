import { mkdir } from "node:fs/promises";
import { chromium, type FullConfig } from "@playwright/test";

const EMAIL = "playwright@resumeforge.test";
const PASSWORD = "playwright-test-secret";

export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use?.baseURL || "http://localhost:3005";
  await mkdir("e2e/.auth", { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage();

  const signup = await page.request.post(`${baseURL}/api/auth/signup`, {
    data: { email: EMAIL, password: PASSWORD },
  });
  if (!signup.ok()) {
    const login = await page.request.post(`${baseURL}/api/auth/login`, {
      data: { email: EMAIL, password: PASSWORD },
    });
    if (!login.ok()) {
      await page.goto(`${baseURL}/login`);
      await page.getByLabel("Email").fill(EMAIL);
      await page.getByLabel("Password").fill(PASSWORD);
      await page.getByRole("button", { name: "Sign In" }).click();
      await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15000 });
    }
  }

  await page.context().storageState({ path: "e2e/.auth/user.json" });
  await browser.close();
}
