import { test, expect } from "@playwright/test";

test.describe("Phase 4 BYOK AI Gateway Settings UI", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/settings");
  });

  test("renders settings page with generic custom provider label", async ({ page }) => {
    await expect(page.locator("h1")).toContainText("Bring-Your-Own-Key (BYOK) AI Configuration");

    const providerSelect = page.locator("#provider-select");
    await expect(providerSelect).toBeVisible();

    // Verify generic option label
    const customOptionText = await providerSelect.locator("option[value='custom']").textContent();
    expect(customOptionText).toContain("Custom OpenAI-compatible endpoint");
  });

  test("handles key entry and test connection interaction safely", async ({ page }) => {
    const fakeKey = "sk-proj-testkey1234567890abcdef";

    // Select OpenAI to test password input
    await page.selectOption("#provider-select", "openai");

    // Fill in API key
    await page.fill("#api-key-input", fakeKey);

    // Verify key input type is password
    await expect(page.locator("#api-key-input")).toHaveAttribute("type", "password");

    // Click test connection button
    await page.click("#test-connection-btn");

    // Wait for response banner to appear
    const banner = page.locator("#test-result-banner");
    await expect(banner).toBeVisible({ timeout: 15000 });

    // Assert raw key is NEVER present in page text/DOM output
    const pageText = await page.innerText("body");
    expect(pageText).not.toContain(fakeKey);
  });

  test("saves and encrypts Gemini key in localStorage without plaintext leakage", async ({ page }) => {
    const rawGeminiKey = "AIzaSyTestKey1234567890abcdef";

    // Select Gemini
    await page.selectOption("#provider-select", "gemini");
    await expect(page.locator("#model-input")).toHaveValue("gemini-3.8-flash");

    // Enter key
    await page.fill("#api-key-input", rawGeminiKey);

    // Wait for vault status indicator
    const vaultStatus = page.locator('[data-testid="vault-status"]');
    await expect(vaultStatus).toBeVisible();
    await expect(vaultStatus).toContainText("Key encrypted in local storage");

    // Assert key is encrypted in localStorage under rf_byok_key_gemini
    const storedVaultVal = await page.evaluate(() => localStorage.getItem("rf_byok_key_gemini"));
    expect(storedVaultVal).toBeTruthy();
    expect(storedVaultVal).not.toContain(rawGeminiKey);
    expect(storedVaultVal).toContain(":"); // iv:ciphertext format

    // Assert raw key is NOT stored in resumeforge_ai_settings
    const settingsRaw = await page.evaluate(() => localStorage.getItem("resumeforge_ai_settings"));
    if (settingsRaw) {
      expect(settingsRaw).not.toContain(rawGeminiKey);
    }
  });

  test("switching providers updates active model and vault retrieval", async ({ page }) => {
    // 1. Configure Gemini
    await page.selectOption("#provider-select", "gemini");
    await page.fill("#api-key-input", "AIzaSyGeminiKey999");
    await expect(page.locator("#model-input")).toHaveValue("gemini-3.8-flash");

    // 2. Switch to Groq
    await page.selectOption("#provider-select", "groq");
    await expect(page.locator("#model-input")).toHaveValue("llama-3.3-70b-versatile");
    // Initially empty
    await expect(page.locator("#api-key-input")).toHaveValue("");

    // Save Groq key
    await page.fill("#api-key-input", "gsk-groqkey888");

    // 3. Switch to Ollama
    await page.selectOption("#provider-select", "ollama");
    await expect(page.locator("#model-input")).toHaveValue("llama3");
    await expect(page.locator('[data-testid="ollama-endpoint"]')).toHaveValue("http://localhost:11434");
    await expect(page.locator('[data-testid="vault-status"]')).toContainText("Local daemon endpoint");

    // 4. Switch back to Gemini and assert retrieved decrypted key
    await page.selectOption("#provider-select", "gemini");
    await expect(page.locator("#model-input")).toHaveValue("gemini-3.8-flash");
    await expect(page.locator("#api-key-input")).toHaveValue("AIzaSyGeminiKey999");

    // 5. Switch back to Groq and assert retrieved decrypted key
    await page.selectOption("#provider-select", "groq");
    await expect(page.locator("#model-input")).toHaveValue("llama-3.3-70b-versatile");
    await expect(page.locator("#api-key-input")).toHaveValue("gsk-groqkey888");
  });

  test("deleting key purges the vault entry from localStorage", async ({ page }) => {
    await page.selectOption("#provider-select", "gemini");
    await page.fill("#api-key-input", "AIzaSyDeleteMeKey123");

    // Verify key exists in vault
    const beforeVal = await page.evaluate(() => localStorage.getItem("rf_byok_key_gemini"));
    expect(beforeVal).toBeTruthy();

    // Click Clear Key button
    const clearBtn = page.locator('[data-testid="clear-key-btn"]');
    await expect(clearBtn).toBeVisible();
    await clearBtn.click();

    // Key input should be cleared
    await expect(page.locator("#api-key-input")).toHaveValue("");

    // Vault status should reflect no key
    await expect(page.locator('[data-testid="vault-status"]')).toContainText("No encrypted key in vault");

    // Verify localStorage entry is removed
    const afterVal = await page.evaluate(() => localStorage.getItem("rf_byok_key_gemini"));
    expect(afterVal).toBeNull();
  });
});
