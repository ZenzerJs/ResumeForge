import { test, expect } from "@playwright/test";

test.describe("hosted auth and a11y gates", () => {
  test("guest GET /api/jobs returns empty data", async ({ browser, baseURL }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    const res = await page.request.get(`${baseURL}/api/jobs`);
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data).toEqual([]);
    expect(json.guest).toBe(true);
    await context.close();
  });

  test("guest POST save-master is rejected", async ({ browser, baseURL }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    const res = await page.request.post(`${baseURL}/api/resumes/save-master`, {
      data: {
        title: "Guest Master",
        typstSource: "= Guest\n",
        confirmOverwrite: true,
      },
    });
    expect(res.status()).toBe(401);
    const json = await res.json();
    expect(json.code).toBe("GUEST_READ_ONLY");
    await context.close();
  });

  test("guests can open the home page without signing in", async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    await page.goto("/");
    await expect(page.getByRole("link", { name: "ResumeForge home" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign In" }).first()).toBeVisible();
    await context.close();
  });

  test("login page supports email, password, and guest continue", async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    await page.goto("/login");
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Password" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Continue as guest" })).toBeVisible();
    const skip = page.getByRole("link", { name: "Skip to content" });
    await skip.focus();
    await expect(skip).toBeVisible();
    await context.close();
  });

  test("signup and login persist a session", async ({ browser, baseURL }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    const email = `e2e-${Date.now()}@resumeforge.test`;
    const signup = await page.request.post(`${baseURL}/api/auth/signup`, {
      data: { email, password: "playwright-test-secret" },
    });
    expect(signup.ok()).toBeTruthy();
    const jobs = await page.request.get(`${baseURL}/api/jobs`);
    expect(jobs.status()).toBe(200);
    const json = await jobs.json();
    expect(json.guest).not.toBe(true);
    await context.close();
  });

  test("mobile navigation is available at 375px", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(page.getByRole("navigation", { name: "Mobile navigation" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Editor" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign Out" })).toBeVisible();
  });

  test("sign out clears the session and returns home", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Sign Out" }).click();
    await expect(page.getByRole("link", { name: "Sign In" }).first()).toBeVisible({ timeout: 10000 });
    const res = await page.request.get("/api/jobs");
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.guest).toBe(true);
  });

  test("protected master cannot be overwritten via PUT", async ({ request }) => {
    const save = await request.post("/api/resumes/save-master", {
      data: {
        title: "E2E Protected Master",
        typstSource: "= Protected Master\n",
        confirmOverwrite: true,
      },
    });
    expect(save.ok()).toBeTruthy();
    const saved = await save.json();
    const put = await request.put(`/api/resumes/${saved.data.id}`, {
      data: { typstSource: "= Hijack\n" },
    });
    expect(put.status()).toBe(403);
  });
});
