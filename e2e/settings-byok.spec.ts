import { test, expect } from "@playwright/test";

test.describe("Phase 4 BYOK AI Gateway Settings UI", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/settings");
  });

  test("renders settings page with generic custom provider label", async ({ page }) => {
    await expect(page.locator("h1")).toContainText("Connect an AI provider key (stored in this browser)");

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

  test("saves and encrypts Gemini key in IndexedDB without plaintext leakage", async ({ page }) => {
    const rawGeminiKey = "AIzaSyTestKey1234567890abcdef";

    // Select Gemini
    await page.selectOption("#provider-select", "gemini");
    await expect(page.locator("#model-input")).toHaveValue("gemini-3.8-flash");

    // Enter key
    await page.fill("#api-key-input", rawGeminiKey);

    // Wait for vault status indicator
    const vaultStatus = page.locator('[data-testid="vault-status"]');
    await expect(vaultStatus).toBeVisible();
    await expect(vaultStatus).toContainText("Key encrypted in browser IndexedDB");

    // Assert neither raw key nor JWK master key is stored in localStorage
    const legacyStored = await page.evaluate(() => ({
      key: localStorage.getItem("rf_byok_key_gemini"),
      master: localStorage.getItem("rf_vault_master_key"),
    }));
    expect(legacyStored.key).toBeNull();
    expect(legacyStored.master).toBeNull();

    // Assert key is stored encrypted in IndexedDB with a non-extractable CryptoKey
    const idbRecord = await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open("resumeforge-byok-vault", 1);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      const tx = db.transaction(["keys", "secrets"], "readonly");
      const master = await new Promise<CryptoKey | undefined>((resolve, reject) => {
        const req = tx.objectStore("keys").get("master");
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      const secret = await new Promise<{ payload?: string } | undefined>((resolve, reject) => {
        const req = tx.objectStore("secrets").get("gemini");
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      db.close();
      return {
        extractable: master ? master.extractable : null,
        payload: secret?.payload ?? null,
      };
    });
    expect(idbRecord.extractable).toBe(false);
    expect(idbRecord.payload).toBeTruthy();
    expect(idbRecord.payload).not.toContain(rawGeminiKey);
    expect(idbRecord.payload).toContain(":");

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

  test("deleting key purges the vault entry from IndexedDB", async ({ page }) => {
    await page.selectOption("#provider-select", "gemini");
    await page.fill("#api-key-input", "AIzaSyDeleteMeKey123");
    await expect(page.locator('[data-testid="vault-status"]')).toContainText(
      "Key encrypted in browser IndexedDB"
    );

    // Verify key exists in IndexedDB vault
    const beforeVal = await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open("resumeforge-byok-vault", 1);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      const rec = await new Promise<unknown>((resolve, reject) => {
        const tx = db.transaction(["secrets"], "readonly");
        const req = tx.objectStore("secrets").get("gemini");
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      db.close();
      return rec ?? null;
    });
    expect(beforeVal).toBeTruthy();

    // Click Clear Key button
    const clearBtn = page.locator('[data-testid="clear-key-btn"]');
    await expect(clearBtn).toBeVisible();
    await clearBtn.click();

    // Key input should be cleared
    await expect(page.locator("#api-key-input")).toHaveValue("");

    // Vault status should reflect no key
    await expect(page.locator('[data-testid="vault-status"]')).toContainText("No encrypted key in vault");

    // Verify IndexedDB and localStorage entries are removed
    await expect
      .poll(async () => {
        return page.evaluate(async () => {
          const db = await new Promise<IDBDatabase>((resolve, reject) => {
            const req = indexedDB.open("resumeforge-byok-vault", 1);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
          });
          const rec = await new Promise<unknown>((resolve, reject) => {
            const tx = db.transaction(["secrets"], "readonly");
            const req = tx.objectStore("secrets").get("gemini");
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
          });
          db.close();
          return {
            idb: rec ?? null,
            legacy: localStorage.getItem("rf_byok_key_gemini"),
          };
        });
      })
      .toEqual({ idb: null, legacy: null });
  });

  test("persists encrypted key in IndexedDB across page reload", async ({ page }) => {
    const persistedKey = "AIzaSyReloadPersistKey987654";
    await page.selectOption("#provider-select", "gemini");
    await page.fill("#api-key-input", persistedKey);
    await expect(page.locator('[data-testid="vault-status"]')).toContainText(
      "Key encrypted in browser IndexedDB"
    );

    await page.reload();
    await expect(page.locator("#api-key-input")).toHaveValue(persistedKey);
    await expect(page.locator('[data-testid="vault-status"]')).toContainText(
      "Key encrypted in browser IndexedDB"
    );
  });

  test("migrates legacy localStorage vault entries including custom into IndexedDB on reload", async ({ page }) => {
    await page.evaluate(async () => {
      await new Promise<void>((resolve, reject) => {
        const req = indexedDB.deleteDatabase("resumeforge-byok-vault");
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
        req.onblocked = () => resolve();
      });

      const master = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
        "encrypt",
        "decrypt",
      ]);
      const jwk = await crypto.subtle.exportKey("jwk", master);
      localStorage.setItem("rf_vault_master_key", JSON.stringify(jwk));

      const encryptLegacy = async (val: string) => {
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const buf = await crypto.subtle.encrypt(
          { name: "AES-GCM", iv },
          master,
          new TextEncoder().encode(val)
        );
        const toB64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
        return `${toB64(iv)}:${toB64(new Uint8Array(buf))}`;
      };

      localStorage.setItem("rf_byok_key_custom", await encryptLegacy("sk-custom-migrated-key"));
      localStorage.setItem(
        "resumeforge_ai_settings",
        JSON.stringify({ provider: "custom", model: "llama3", apiKey: "sk-legacy-settings-key" })
      );
    });

    await page.reload();
    await expect(page.locator("#provider-select")).toHaveValue("custom");
    await expect(page.locator("#api-key-input")).toHaveValue("sk-custom-migrated-key");

    const postMigration = await page.evaluate(() => ({
      customLegacy: localStorage.getItem("rf_byok_key_custom"),
      masterJwk: localStorage.getItem("rf_vault_master_key"),
      settings: JSON.parse(localStorage.getItem("resumeforge_ai_settings") || "{}"),
    }));
    expect(postMigration.customLegacy).toBeNull();
    expect(postMigration.masterJwk).toBeNull();
    expect(postMigration.settings.provider).toBe("custom");
    expect(postMigration.settings.model).toBe("llama3");
    expect(postMigration.settings.apiKey).toBeUndefined();
  });

  test("shows selected-provider help before key input and clears prior provider help on switch", async ({ page }) => {
    const expectedProviders = [
      {
        id: "gemini",
        url: "https://aistudio.google.com/app/apikey",
        label: "Google Gemini setup",
        prerequisiteSnippet: "Google Cloud billing",
      },
      {
        id: "openai",
        url: "https://platform.openai.com/api-keys",
        label: "OpenAI setup",
        prerequisiteSnippet: "prepaid API billing credits",
      },
      {
        id: "anthropic",
        url: "https://platform.claude.com/settings/keys",
        label: "Anthropic setup",
        prerequisiteSnippet: "Claude Console organization",
      },
      {
        id: "groq",
        url: "https://console.groq.com/keys",
        label: "Groq setup",
        prerequisiteSnippet: "GroqCloud",
      },
    ] as const;

    for (let i = 0; i < expectedProviders.length; i++) {
      const current = expectedProviders[i];
      await page.selectOption("#provider-select", current.id);

      const helpBox = page.locator('[data-testid="provider-help"]');
      await expect(helpBox).toBeVisible();
      await expect(helpBox).toHaveAttribute("data-provider", current.id);
      await expect(helpBox).toContainText(current.label);
      await expect(helpBox).toContainText(current.prerequisiteSnippet);

      const getKeyLink = page.locator('[data-testid="provider-get-key-link"]');
      await expect(getKeyLink).toBeVisible();
      await expect(getKeyLink).toHaveText(/Get an API key/);
      await expect(getKeyLink).toHaveAttribute("href", current.url);
      await expect(getKeyLink).toHaveAttribute("target", "_blank");
      await expect(getKeyLink).toHaveAttribute("rel", "noopener noreferrer");

      if (i > 0) {
        const previous = expectedProviders[i - 1];
        await expect(helpBox).not.toContainText(previous.label);
      }

      // Help appears directly before the API key input in document order
      const isHelpBeforeKey = await page.evaluate(() => {
        const help = document.querySelector('[data-testid="provider-help"]');
        const input = document.querySelector("#api-key-input");
        if (!help || !input) return false;
        return Boolean(help.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_FOLLOWING);
      });
      expect(isHelpBeforeKey).toBe(true);
    }
  });

  test("collapses optional model and OpenAI endpoint override in Advanced, preserves values, and auto-expands on non-default load", async ({ page }) => {
    const advanced = page.locator('[data-testid="advanced-settings-disclosure"]');
    const summary = advanced.locator("summary");

    await page.selectOption("#provider-select", "openai");
    await expect(advanced).not.toHaveAttribute("open", "");
    await expect(page.locator("#model-input")).toBeHidden();
    await expect(page.locator("#base-url-input")).toBeHidden();

    // Expand Advanced, customize model and endpoint override, collapse, and re-expand without resetting
    await summary.click();
    await expect(advanced).toHaveAttribute("open", "");
    await expect(page.locator("#model-input")).toBeVisible();
    await expect(page.locator("#base-url-input")).toBeVisible();

    await page.fill("#model-input", "gpt-4o-mini");
    await page.fill("#base-url-input", "https://proxy.example.test/v1");

    await summary.click();
    await expect(advanced).not.toHaveAttribute("open", "");
    await expect(page.locator("#model-input")).toHaveValue("gpt-4o-mini");
    await expect(page.locator("#base-url-input")).toHaveValue("https://proxy.example.test/v1");

    await summary.click();
    await expect(advanced).toHaveAttribute("open", "");
    await expect(page.locator("#model-input")).toHaveValue("gpt-4o-mini");
    await expect(page.locator("#base-url-input")).toHaveValue("https://proxy.example.test/v1");

    // Reload with non-default values -> Advanced auto-expands
    await page.reload();
    await expect(page.locator("#provider-select")).toHaveValue("openai");
    await expect(advanced).toHaveAttribute("open", "");
    await expect(page.locator("#model-input")).toBeVisible();
    await expect(page.locator("#model-input")).toHaveValue("gpt-4o-mini");
    await expect(page.locator("#base-url-input")).toBeVisible();
    await expect(page.locator("#base-url-input")).toHaveValue("https://proxy.example.test/v1");

    // Reset to defaults and reload -> Advanced starts collapsed
    await page.fill("#model-input", "gpt-4o");
    await page.fill("#base-url-input", "");
    await page.reload();
    await expect(advanced).not.toHaveAttribute("open", "");
    await expect(page.locator("#model-input")).toBeHidden();
  });

  test("keeps required Ollama and Custom endpoints visible outside Advanced", async ({ page }) => {
    const advanced = page.locator('[data-testid="advanced-settings-disclosure"]');

    // Ollama: endpoint visible when Advanced collapsed; no API key input
    await page.selectOption("#provider-select", "ollama");
    await expect(advanced).not.toHaveAttribute("open", "");
    await expect(page.locator('[data-testid="provider-help"]')).toHaveCount(0);
    await expect(page.locator("#base-url-input")).toBeVisible();
    await expect(page.locator("#base-url-input")).toHaveValue("http://localhost:11434");
    await expect(page.locator('[data-testid="vault-status"]')).toContainText("no API key required");
    await expect(page.locator("#api-key-input")).toHaveCount(0);

    // Custom: required endpoint and optional key both visible when Advanced collapsed
    await page.selectOption("#provider-select", "custom");
    await expect(advanced).not.toHaveAttribute("open", "");
    await expect(page.locator('[data-testid="provider-help"]')).toHaveCount(0);
    await expect(page.locator("#base-url-input")).toBeVisible();
    await expect(page.locator("#api-key-input")).toBeVisible();
    await expect(page.locator('label[for="api-key-input"]')).toContainText("Optional");
  });
});
