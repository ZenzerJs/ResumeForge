import { test, expect } from "@playwright/test";

test.describe("hosted auth and a11y gates", () => {
  test("guest GET /api/jobs returns the shared catalog", async ({ browser, baseURL }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    const res = await page.request.get(`${baseURL}/api/jobs`);
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
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
    await expect(page.getByLabel("Email or username")).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Password" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Continue as guest" })).toBeVisible();
    const skip = page.getByRole("link", { name: "Skip to content" });
    await skip.focus();
    await expect(skip).toBeVisible();
    await context.close();
  });

  test("login form UI authenticates user and redirects away from login page", async ({ browser, baseURL }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    const unique = Date.now();
    const email = `ui-login-${unique}@resumeforge.test`;
    const username = `uilogin_${unique}`;
    const password = "Password123!";

    // Create user via signup
    const signup = await page.request.post(`${baseURL}/api/auth/signup`, {
      data: { email, username, password },
    });
    expect(signup.ok()).toBeTruthy();

    // Clear cookies to test logging in from scratch via the UI
    await context.clearCookies();

    // Navigate to /login and submit credentials using email
    await page.goto("/login");
    await page.getByTestId("login-email-input").fill(email);
    await page.getByTestId("login-password-input").fill(password);
    await page.getByTestId("login-submit-btn").click();

    // Verify redirected away from /login
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15000 });

    // Verify session is active by requesting an authenticated API endpoint
    const meRes = await page.request.get(`${baseURL}/api/auth/me`);
    expect(meRes.status()).toBe(200);
    const meJson = await meRes.json();
    expect(meJson.guest).toBe(false);
    expect(meJson.data?.username).toBe(username);

    await context.close();
  });

  test("login form UI authenticates user using username instead of email", async ({ browser, baseURL }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    const unique = Date.now() + 1;
    const email = `ui-user-${unique}@resumeforge.test`;
    const username = `uiuser_${unique}`;
    const password = "Password123!";

    // Create user via signup
    const signup = await page.request.post(`${baseURL}/api/auth/signup`, {
      data: { email, username, password },
    });
    expect(signup.ok()).toBeTruthy();

    // Clear cookies to test logging in using username
    await context.clearCookies();

    await page.goto("/login");
    await page.getByTestId("login-email-input").fill(username);
    await page.getByTestId("login-password-input").fill(password);
    await page.getByTestId("login-submit-btn").click();

    // Verify redirected away from /login
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15000 });

    // Verify session is active
    const meRes = await page.request.get(`${baseURL}/api/auth/me`);
    expect(meRes.status()).toBe(200);
    const meJson = await meRes.json();
    expect(meJson.guest).toBe(false);
    expect(meJson.data?.username).toBe(username);

    await context.close();
  });

  test("login form UI respects redirect query parameter after authentication", async ({ browser, baseURL }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    const unique = Date.now() + 2;
    const email = `ui-redirect-${unique}@resumeforge.test`;
    const username = `uiredirect_${unique}`;
    const password = "Password123!";

    const signup = await page.request.post(`${baseURL}/api/auth/signup`, {
      data: { email, username, password },
    });
    expect(signup.ok()).toBeTruthy();
    await context.clearCookies();

    // Navigate to /login with redirect to /tracker
    await page.goto("/login?redirect=/tracker");
    await page.getByTestId("login-email-input").fill(email);
    await page.getByTestId("login-password-input").fill(password);
    await page.getByTestId("login-submit-btn").click();

    // Verify redirected directly to /tracker
    await page.waitForURL((url) => url.pathname === "/tracker", { timeout: 15000 });

    await context.close();
  });

  test("login form UI handles simulated password manager autofill via DOM property assignment", async ({ browser, baseURL }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    const unique = Date.now() + 3;
    const email = `ui-autofill-${unique}@resumeforge.test`;
    const username = `uiautofill_${unique}`;
    const password = "Password123!";

    const signup = await page.request.post(`${baseURL}/api/auth/signup`, {
      data: { email, username, password },
    });
    expect(signup.ok()).toBeTruthy();
    await context.clearCookies();

    await page.goto("/login");
    await expect(page.getByTestId("login-email-input")).toBeVisible();

    // Simulate autofill extension injecting value directly onto DOM elements
    await page.evaluate(
      ({ userEmail, userPass }) => {
        const emailInput = document.querySelector('[data-testid="login-email-input"]') as HTMLInputElement;
        const passInput = document.querySelector('[data-testid="login-password-input"]') as HTMLInputElement;
        if (emailInput) {
          emailInput.value = userEmail;
          emailInput.dispatchEvent(new Event("input", { bubbles: true }));
        }
        if (passInput) {
          passInput.value = userPass;
          passInput.dispatchEvent(new Event("input", { bubbles: true }));
        }
      },
      { userEmail: email, userPass: password }
    );

    // Submit form directly
    await page.getByTestId("login-submit-btn").click();

    // Verify successful signin despite absence of synthetic keystroke events
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15000 });

    const meRes = await page.request.get(`${baseURL}/api/auth/me`);
    expect(meRes.status()).toBe(200);
    const meJson = await meRes.json();
    expect(meJson.guest).toBe(false);
    expect(meJson.data?.username).toBe(username);

    await context.close();
  });

  test("login form UI displays error when invalid credentials are provided", async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();

    await page.goto("/login");
    await page.getByTestId("login-email-input").fill("nonexistent-user@example.com");
    await page.getByTestId("login-password-input").fill("WrongPassword999!");
    await page.getByTestId("login-submit-btn").click();

    // Verify error message is rendered
    const errorMsg = page.getByTestId("login-error-msg");
    await expect(errorMsg).toBeVisible({ timeout: 10000 });
    await expect(errorMsg).toContainText("Invalid email, username, or password");

    await context.close();
  });

  test("signup form UI creates account and redirects away from login page", async ({ browser, baseURL }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    const unique = Date.now() + 4;
    const email = `ui-signup-${unique}@resumeforge.test`;
    const username = `uisignup_${unique}`;
    const password = "Password123!";

    await page.goto("/login");
    // Switch to signup mode
    await page.getByTestId("login-mode-toggle-btn").click();
    await expect(page.getByTestId("login-username-input")).toBeVisible();

    await page.getByTestId("login-username-input").fill(username);
    await page.getByTestId("login-email-input").fill(email);
    await page.getByTestId("login-password-input").fill(password);
    await page.getByTestId("login-submit-btn").click();

    // Verify redirected away from /login
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15000 });

    // Verify session is active
    const meRes = await page.request.get(`${baseURL}/api/auth/me`);
    expect(meRes.status()).toBe(200);
    const meJson = await meRes.json();
    expect(meJson.guest).toBe(false);
    expect(meJson.data?.username).toBe(username);

    await context.close();
  });

  test("signup and login persist a session", async ({ browser, baseURL }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    const email = `e2e-${Date.now()}@resumeforge.test`;
    const username = `e2e_${Date.now()}`;
    const signup = await page.request.post(`${baseURL}/api/auth/signup`, {
      data: { email, username, password: "playwright-test-secret" },
    });
    expect(signup.ok()).toBeTruthy();
    const jobs = await page.request.get(`${baseURL}/api/jobs`);
    expect(jobs.status()).toBe(200);
    const json = await jobs.json();
    expect(json.guest).not.toBe(true);
    await context.close();
  });

  test("mobile navigation is available at 375px", async ({ browser }) => {
    const context = await browser.newContext({ storageState: "e2e/.auth/user.json", viewport: { width: 375, height: 812 } });
    const page = await context.newPage();
    await page.goto("/");
    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(page.getByRole("navigation", { name: "Mobile navigation" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Mobile navigation" }).getByRole("link", { name: "Editor" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign Out" })).toBeVisible();
    await context.close();
  });

  test("sign out clears the session and returns home", async ({ browser }) => {
    const context = await browser.newContext({ storageState: "e2e/.auth/user.json" });
    const page = await context.newPage();
    await page.goto("/");
    await page.getByRole("button", { name: "Sign Out" }).click();
    await expect(page.getByRole("link", { name: "Sign In" }).first()).toBeVisible({ timeout: 10000 });
    const res = await page.request.get("/api/jobs");
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.guest).toBe(true);
    await context.close();
  });

  test("settings page can sign out the current session", async ({ browser }) => {
    const context = await browser.newContext({ storageState: "e2e/.auth/user.json" });
    const page = await context.newPage();
    await page.goto("/settings");
    await expect(page.getByTestId("account-settings")).toBeVisible();
    await expect(page.locator("#settings-username")).toBeVisible();
    await page.getByTestId("account-settings").getByRole("button", { name: "Sign Out" }).click();
    await expect(page.getByRole("link", { name: "Sign In" }).first()).toBeVisible({ timeout: 10000 });
    await context.close();
  });

  test("nav shows username instead of email", async ({ browser }) => {
    const context = await browser.newContext({ storageState: "e2e/.auth/user.json" });
    const page = await context.newPage();
    await page.goto("/");
    const me = await page.request.get("/api/auth/me");
    const json = await me.json();
    expect(json.data?.username).toBeTruthy();
    await expect(page.getByRole("link", { name: new RegExp(`@${json.data.username}`) })).toBeVisible();
    await expect(page.getByText("playwright@resumeforge.test")).toHaveCount(0);
    await context.close();
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
