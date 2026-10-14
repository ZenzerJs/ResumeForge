/**
 * Browser-native Web Crypto API (AES-GCM) encrypted vault for BYOK API keys.
 * Keys are stored encrypted in localStorage and never written to database or server logs.
 */

export type ByokProvider = "gemini" | "openai" | "anthropic" | "groq" | "ollama";

const VAULT_MASTER_KEY_STORAGE = "rf_vault_master_key";
const VAULT_KEY_PREFIX = "rf_byok_key_";
const SETTINGS_STORAGE_KEY = "resumeforge_ai_settings";

const DEFAULT_MODELS: Record<string, string> = {
  gemini: "gemini-3.8-flash",
  openai: "gpt-4o",
  anthropic: "claude-3-5-sonnet-20241022",
  groq: "llama-3.3-70b-versatile",
  ollama: "llama3",
};

let cachedCryptoKey: CryptoKey | null = null;

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Gets or creates the AES-GCM master CryptoKey from localStorage.
 */
async function getMasterCryptoKey(): Promise<CryptoKey> {
  if (cachedCryptoKey) {
    return cachedCryptoKey;
  }

  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error("Web Crypto API (crypto.subtle) is not supported in this environment");
  }

  if (!isBrowser()) {
    // Ephemeral key for non-browser/SSR environments
    const ephemeralKey = await subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );
    cachedCryptoKey = ephemeralKey;
    return ephemeralKey;
  }

  const storedJwk = localStorage.getItem(VAULT_MASTER_KEY_STORAGE);
  if (storedJwk) {
    try {
      const jwk = JSON.parse(storedJwk);
      cachedCryptoKey = await subtle.importKey(
        "jwk",
        jwk,
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
      );
      return cachedCryptoKey;
    } catch {
      // If corrupted, re-generate below
    }
  }

  // Generate new 256-bit AES-GCM key and persist JWK
  const newKey = await subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
  const exported = await subtle.exportKey("jwk", newKey);
  localStorage.setItem(VAULT_MASTER_KEY_STORAGE, JSON.stringify(exported));
  cachedCryptoKey = newKey;
  return newKey;
}

/**
 * Encrypts a string using AES-GCM and a random 12-byte IV.
 */
async function encrypt(plaintext: string): Promise<string> {
  const key = await getMasterCryptoKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded
  );

  const ivB64 = uint8ArrayToBase64(iv);
  const cipherB64 = uint8ArrayToBase64(new Uint8Array(ciphertextBuffer));
  return `${ivB64}:${cipherB64}`;
}

/**
 * Decrypts an AES-GCM encrypted payload (ivB64:cipherB64).
 */
async function decrypt(payload: string): Promise<string | null> {
  try {
    const parts = payload.split(":");
    if (parts.length !== 2) return null;

    const iv = base64ToUint8Array(parts[0]);
    const ciphertext = base64ToUint8Array(parts[1]);
    const key = await getMasterCryptoKey();

    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv as BufferSource },
      key,
      ciphertext as BufferSource
    );

    return new TextDecoder().decode(decryptedBuffer);
  } catch {
    return null;
  }
}

/**
 * Encrypts and saves an API key to localStorage under a provider-specific vault key.
 */
export async function saveKey(
  provider: "gemini" | "openai" | "anthropic" | "groq" | "ollama",
  rawKey: string
): Promise<void> {
  if (!isBrowser()) return;

  const trimmed = rawKey.trim();
  if (!trimmed) {
    await removeKey(provider);
    return;
  }

  const encrypted = await encrypt(trimmed);
  localStorage.setItem(`${VAULT_KEY_PREFIX}${provider}`, encrypted);
}

/**
 * Retrieves and decrypts the API key for a given provider.
 * Automatically checks legacy unencrypted settings for seamless migration.
 */
export async function getKey(provider: string): Promise<string | null> {
  if (!isBrowser()) return null;

  const stored = localStorage.getItem(`${VAULT_KEY_PREFIX}${provider}`);
  if (stored) {
    const decrypted = await decrypt(stored);
    if (decrypted) return decrypted;
  }

  // Fallback: check legacy unencrypted storage for seamless migration
  try {
    const legacy = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (legacy) {
      const parsed = JSON.parse(legacy);
      if (parsed.provider === provider && typeof parsed.apiKey === "string" && parsed.apiKey.trim()) {
        const key = parsed.apiKey.trim();
        // Migrate into encrypted vault
        await saveKey(provider as ByokProvider, key);
        return key;
      }
    }
  } catch {
    // Ignore legacy parse errors
  }

  return null;
}

/**
 * Removes the stored key for a given provider from localStorage.
 */
export async function removeKey(provider: string): Promise<void> {
  if (!isBrowser()) return;
  localStorage.removeItem(`${VAULT_KEY_PREFIX}${provider}`);
}

/**
 * Returns the currently active provider configuration and key status.
 */
export async function getActiveConfig(): Promise<{ provider: string; model: string; hasKey: boolean }> {
  let provider = "gemini";
  let model = DEFAULT_MODELS.gemini;

  if (isBrowser()) {
    try {
      const settingsRaw = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (settingsRaw) {
        const parsed = JSON.parse(settingsRaw);
        if (parsed.provider) provider = parsed.provider;
        if (parsed.model?.trim()) model = parsed.model.trim();
      }
    } catch {
      // Use defaults
    }
  }

  if (!model || model === DEFAULT_MODELS.gemini) {
    model = DEFAULT_MODELS[provider] || DEFAULT_MODELS.gemini;
  }

  const key = await getKey(provider);
  // Ollama runs locally without requiring an API key
  const hasKey = provider === "ollama" ? true : Boolean(key && key.trim().length > 0);

  return { provider, model, hasKey };
}
