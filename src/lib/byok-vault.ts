/**
 * Browser-native Web Crypto API (AES-GCM) encrypted vault for BYOK API keys.
 * Uses a non-extractable AES-GCM CryptoKey and encrypted key records stored in IndexedDB,
 * falling back to memory-only storage when IndexedDB is unavailable.
 */

export type ByokProvider = "gemini" | "openai" | "anthropic" | "groq" | "ollama" | "custom";

const VAULT_DB_NAME = "resumeforge-byok-vault";
const VAULT_DB_VERSION = 1;
const STORE_KEYS = "keys";
const STORE_SECRETS = "secrets";
const MASTER_KEY_ID = "master";

const LEGACY_VAULT_MASTER_KEY_STORAGE = "rf_vault_master_key";
const LEGACY_VAULT_KEY_PREFIX = "rf_byok_key_";
const SETTINGS_STORAGE_KEY = "resumeforge_ai_settings";

const KNOWN_PROVIDERS: readonly ByokProvider[] = [
  "gemini",
  "openai",
  "anthropic",
  "groq",
  "ollama",
  "custom",
];

const DEFAULT_MODELS: Record<string, string> = {
  gemini: "gemini-2.5-flash",
  openai: "gpt-4o",
  anthropic: "claude-3-5-sonnet-20241022",
  groq: "llama-3.3-70b-versatile",
  ollama: "llama3",
  custom: "llama3",
};

interface VaultSecretRecord {
  provider: string;
  payload: string;
  updatedAt: number;
}

let vaultQueue: Promise<unknown> = Promise.resolve();
let initialized = false;
let storageMode: "idb" | "memory" = "idb";
let cachedDb: IDBDatabase | null = null;
let cachedMasterKey: CryptoKey | null = null;
let cachedWindowRef: unknown = undefined;
let cachedIdbRef: unknown = undefined;
const memorySecrets = new Map<string, string>();

export function __resetByokVaultForTests(): void {
  if (cachedDb) {
    try {
      cachedDb.close();
    } catch {
      // Ignore close errors
    }
  }
  initialized = false;
  storageMode = "idb";
  cachedDb = null;
  cachedMasterKey = null;
  cachedWindowRef = undefined;
  cachedIdbRef = undefined;
  memorySecrets.clear();
}

function enqueueVaultOp<T>(fn: () => Promise<T>): Promise<T> {
  const next = vaultQueue.then(fn, fn);
  vaultQueue = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function getLocalStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage ?? (typeof localStorage !== "undefined" ? localStorage : null);
  } catch {
    return null;
  }
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

async function generateNonExtractableMasterKey(): Promise<CryptoKey> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error("Web Crypto API (crypto.subtle) is not supported in this environment");
  }
  return subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encryptWithKey(key: CryptoKey, plaintext: string): Promise<string> {
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

async function decryptWithKey(key: CryptoKey, payload: string): Promise<string | null> {
  try {
    const parts = payload.split(":");
    if (parts.length !== 2) return null;

    const iv = base64ToUint8Array(parts[0]);
    const ciphertext = base64ToUint8Array(parts[1]);
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

function idbRequestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

function idbTxComplete(tx: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
  });
}

function openVaultDatabase(): Promise<IDBDatabase> {
  const idb = globalThis.indexedDB;
  if (!idb) {
    return Promise.reject(new Error("IndexedDB is unavailable"));
  }
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = idb.open(VAULT_DB_NAME, VAULT_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_KEYS)) {
        db.createObjectStore(STORE_KEYS);
      }
      if (!db.objectStoreNames.contains(STORE_SECRETS)) {
        db.createObjectStore(STORE_SECRETS, { keyPath: "provider" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Failed to open IndexedDB vault"));
    request.onblocked = () => reject(new Error("IndexedDB vault open blocked"));
  });
}

interface LegacyPlaintexts {
  providerKeys: Map<string, string>;
  discoveredLegacyVaultProviders: string[];
  hadLegacySettingsApiKey: boolean;
  legacySettingsProvider: string | null;
  hasLegacyMasterJwk: boolean;
}

async function readLegacyLocalStorage(): Promise<LegacyPlaintexts> {
  const result: LegacyPlaintexts = {
    providerKeys: new Map(),
    discoveredLegacyVaultProviders: [],
    hadLegacySettingsApiKey: false,
    legacySettingsProvider: null,
    hasLegacyMasterJwk: false,
  };

  const storage = getLocalStorage();
  if (!storage) return result;

  const candidateProviders = new Set<string>(KNOWN_PROVIDERS);
  if (typeof storage.length === "number" && typeof storage.key === "function") {
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k && k.startsWith(LEGACY_VAULT_KEY_PREFIX)) {
        candidateProviders.add(k.slice(LEGACY_VAULT_KEY_PREFIX.length));
      }
    }
  }

  let legacyKey: CryptoKey | null = null;
  const storedJwk = storage.getItem(LEGACY_VAULT_MASTER_KEY_STORAGE);
  if (storedJwk) {
    result.hasLegacyMasterJwk = true;
    try {
      const jwk = JSON.parse(storedJwk);
      legacyKey = await crypto.subtle.importKey(
        "jwk",
        jwk,
        { name: "AES-GCM", length: 256 },
        false,
        ["decrypt"]
      );
    } catch {
      legacyKey = null;
    }
  }

  for (const provider of candidateProviders) {
    const encrypted = storage.getItem(`${LEGACY_VAULT_KEY_PREFIX}${provider}`);
    if (!encrypted) continue;
    result.discoveredLegacyVaultProviders.push(provider);
    if (legacyKey) {
      const decrypted = await decryptWithKey(legacyKey, encrypted);
      if (decrypted && decrypted.trim()) {
        result.providerKeys.set(provider, decrypted.trim());
      }
    }
  }

  try {
    const legacyRaw = storage.getItem(SETTINGS_STORAGE_KEY);
    if (legacyRaw) {
      const parsed = JSON.parse(legacyRaw);
      if (typeof parsed?.apiKey === "string" && parsed.apiKey.trim()) {
        const provider =
          typeof parsed.provider === "string" && parsed.provider.trim()
            ? parsed.provider.trim()
            : "gemini";
        result.hadLegacySettingsApiKey = true;
        result.legacySettingsProvider = provider;
        if (!result.providerKeys.has(provider)) {
          result.providerKeys.set(provider, parsed.apiKey.trim());
        }
      }
    }
  } catch {
    // Ignore invalid legacy JSON
  }

  return result;
}

function cleanupLegacyLocalStorage(
  migratedProviders: Set<string>,
  legacy: LegacyPlaintexts
): void {
  const storage = getLocalStorage();
  if (!storage) return;

  for (const provider of legacy.discoveredLegacyVaultProviders) {
    if (migratedProviders.has(provider)) {
      storage.removeItem(`${LEGACY_VAULT_KEY_PREFIX}${provider}`);
    }
  }

  // Only remove the shared exported JWK if every discovered legacy provider ciphertext was migrated
  const allLegacyProvidersCleared = legacy.discoveredLegacyVaultProviders.every((p) =>
    migratedProviders.has(p)
  );
  if (legacy.hasLegacyMasterJwk && allLegacyProvidersCleared) {
    storage.removeItem(LEGACY_VAULT_MASTER_KEY_STORAGE);
  }

  if (
    legacy.hadLegacySettingsApiKey &&
    legacy.legacySettingsProvider &&
    migratedProviders.has(legacy.legacySettingsProvider)
  ) {
    try {
      const raw = storage.getItem(SETTINGS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && "apiKey" in parsed) {
          delete parsed.apiKey;
          storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(parsed));
        }
      }
    } catch {
      // Preserve existing string if unreadable
    }
  }
}

async function ensureVaultReady(): Promise<{
  mode: "idb" | "memory";
  db: IDBDatabase | null;
  masterKey: CryptoKey;
}> {
  const currentIdbRef = typeof globalThis.indexedDB !== "undefined" ? globalThis.indexedDB : undefined;
  const currentWindowRef = typeof globalThis.window !== "undefined" ? globalThis.window : undefined;

  if (initialized && (cachedIdbRef !== currentIdbRef || cachedWindowRef !== currentWindowRef)) {
    __resetByokVaultForTests();
  }

  if (initialized && cachedMasterKey) {
    return { mode: storageMode, db: cachedDb, masterKey: cachedMasterKey };
  }

  cachedIdbRef = currentIdbRef;
  cachedWindowRef = currentWindowRef;

  if (!isBrowser()) {
    const ephemeralKey = await generateNonExtractableMasterKey();
    cachedMasterKey = ephemeralKey;
    storageMode = "memory";
    initialized = true;
    return { mode: "memory", db: null, masterKey: ephemeralKey };
  }

  const legacy = await readLegacyLocalStorage();

  if (typeof globalThis.indexedDB !== "undefined") {
    try {
      const db = await openVaultDatabase();
      db.onversionchange = () => {
        try {
          db.close();
        } catch {
          // Ignore close errors
        }
        if (cachedDb === db) {
          cachedDb = null;
          cachedMasterKey = null;
          initialized = false;
        }
      };

      // Step 1: Read existing master key and existing secret keys
      const readTx = db.transaction([STORE_KEYS, STORE_SECRETS], "readonly");
      const existingMasterRaw = await idbRequestToPromise(
        readTx.objectStore(STORE_KEYS).get(MASTER_KEY_ID)
      );
      const existingSecretKeys = await idbRequestToPromise(
        readTx.objectStore(STORE_SECRETS).getAllKeys()
      );
      await idbTxComplete(readTx);

      const existingMasterKey = existingMasterRaw instanceof CryptoKey
        ? existingMasterRaw
        : (existingMasterRaw && typeof existingMasterRaw === "object" && "type" in (existingMasterRaw as object)
          ? (existingMasterRaw as CryptoKey)
          : null);
      const masterKey = existingMasterKey ?? (await generateNonExtractableMasterKey());
      const existingProviders = new Set(existingSecretKeys.map(String));

      // Step 2: Encrypt any unmigrated legacy provider entries before opening the write transaction
      const recordsToWrite: VaultSecretRecord[] = [];
      const expectedMigrated = new Map<string, string>();
      for (const [provider, plaintext] of legacy.providerKeys.entries()) {
        if (!existingProviders.has(provider)) {
          const payload = await encryptWithKey(masterKey, plaintext);
          recordsToWrite.push({
            provider,
            payload,
            updatedAt: Date.now(),
          });
        }
        expectedMigrated.set(provider, plaintext);
      }

      // Step 3: Commit master key and migrated encrypted records in a single transaction
      if (!existingMasterKey || recordsToWrite.length > 0) {
        const writeTx = db.transaction([STORE_KEYS, STORE_SECRETS], "readwrite");
        if (!existingMasterKey) {
          writeTx.objectStore(STORE_KEYS).put(masterKey, MASTER_KEY_ID);
        }
        const secretsStore = writeTx.objectStore(STORE_SECRETS);
        for (const rec of recordsToWrite) {
          secretsStore.put(rec);
        }
        await idbTxComplete(writeTx);
      }

      // Step 4: Verify durable readback from IndexedDB before deleting any legacy storage
      const verifiedProviders = new Set<string>();
      if (expectedMigrated.size > 0 || !existingMasterKey) {
        const verifyTx = db.transaction([STORE_KEYS, STORE_SECRETS], "readonly");
        const persistedKey = await idbRequestToPromise(
          verifyTx.objectStore(STORE_KEYS).get(MASTER_KEY_ID)
        ) as CryptoKey | undefined;
        const verifiedReads = new Map<string, VaultSecretRecord | undefined>();
        for (const provider of expectedMigrated.keys()) {
          const rec = (await idbRequestToPromise(
            verifyTx.objectStore(STORE_SECRETS).get(provider)
          )) as VaultSecretRecord | undefined;
          verifiedReads.set(provider, rec);
        }
        await idbTxComplete(verifyTx);

        const activeVerifyKey = persistedKey ?? masterKey;
        for (const [provider] of expectedMigrated.entries()) {
          const rec = verifiedReads.get(provider);
          if (rec && typeof rec.payload === "string") {
            const plain = await decryptWithKey(activeVerifyKey, rec.payload);
            if (plain && plain.trim()) {
              verifiedProviders.add(provider);
            }
          }
        }
      }

      cleanupLegacyLocalStorage(verifiedProviders, legacy);

      cachedDb = db;
      cachedMasterKey = masterKey;
      storageMode = "idb";
      initialized = true;
      return { mode: "idb", db, masterKey };
    } catch {
      // Fall back to memory-only vault when IndexedDB is unavailable or fails
    }
  }

  const memoryKey = await generateNonExtractableMasterKey();
  for (const [provider, plaintext] of legacy.providerKeys.entries()) {
    const payload = await encryptWithKey(memoryKey, plaintext);
    memorySecrets.set(provider, payload);
  }
  cachedDb = null;
  cachedMasterKey = memoryKey;
  storageMode = "memory";
  initialized = true;
  return { mode: "memory", db: null, masterKey: memoryKey };
}

/**
 * Encrypts and saves an API key into the IndexedDB vault (or memory fallback).
 */
export async function saveKey(
  provider: ByokProvider | string,
  rawKey: string
): Promise<void> {
  if (!isBrowser()) return;

  const trimmed = rawKey.trim();
  if (!trimmed) {
    await removeKey(provider);
    return;
  }

  return enqueueVaultOp(async () => {
    const { mode, db, masterKey } = await ensureVaultReady();
    const payload = await encryptWithKey(masterKey, trimmed);

    if (mode === "idb" && db) {
      const tx = db.transaction([STORE_SECRETS], "readwrite");
      tx.objectStore(STORE_SECRETS).put({
        provider,
        payload,
        updatedAt: Date.now(),
      } satisfies VaultSecretRecord);
      await idbTxComplete(tx);
    } else {
      memorySecrets.set(provider, payload);
    }
  });
}

/**
 * Retrieves and decrypts the API key for a given provider.
 */
export async function getKey(provider: string): Promise<string | null> {
  if (!isBrowser()) return null;

  return enqueueVaultOp(async () => {
    const { mode, db, masterKey } = await ensureVaultReady();

    if (mode === "idb" && db) {
      const tx = db.transaction([STORE_SECRETS], "readonly");
      const record = (await idbRequestToPromise(
        tx.objectStore(STORE_SECRETS).get(provider)
      )) as VaultSecretRecord | undefined;
      await idbTxComplete(tx);
      if (record && typeof record.payload === "string") {
        const decrypted = await decryptWithKey(masterKey, record.payload);
        if (decrypted) return decrypted;
      }
      return null;
    }

    const memPayload = memorySecrets.get(provider);
    if (memPayload) {
      const decrypted = await decryptWithKey(masterKey, memPayload);
      if (decrypted) return decrypted;
    }
    return null;
  });
}

/**
 * Removes the stored key for a given provider from IndexedDB (or memory fallback).
 */
export async function removeKey(provider: string): Promise<void> {
  if (!isBrowser()) return;

  return enqueueVaultOp(async () => {
    const { mode, db } = await ensureVaultReady();

    if (mode === "idb" && db) {
      const tx = db.transaction([STORE_SECRETS], "readwrite");
      tx.objectStore(STORE_SECRETS).delete(provider);
      await idbTxComplete(tx);
    } else {
      memorySecrets.delete(provider);
    }

    const storage = getLocalStorage();
    if (storage) {
      storage.removeItem(`${LEGACY_VAULT_KEY_PREFIX}${provider}`);
      try {
        const raw = storage.getItem(SETTINGS_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === "object" && "apiKey" in parsed) {
            const settingsProvider =
              typeof parsed.provider === "string" && parsed.provider.trim()
                ? parsed.provider.trim()
                : "gemini";
            if (settingsProvider === provider) {
              delete parsed.apiKey;
              storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(parsed));
            }
          }
        }
      } catch {
        // Ignore invalid settings JSON
      }
    }
  });
}

/**
 * Returns the currently active provider configuration and key status.
 */
export async function getActiveConfig(): Promise<{ provider: string; model: string; hasKey: boolean }> {
  let provider = "gemini";
  let model = DEFAULT_MODELS.gemini;

  const storage = getLocalStorage();
  if (storage) {
    try {
      const settingsRaw = storage.getItem(SETTINGS_STORAGE_KEY);
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
  const hasKey = provider === "ollama" ? true : Boolean(key && key.trim().length > 0);

  return { provider, model, hasKey };
}

export interface ClientProviderConfig {
  provider: ByokProvider;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

/**
 * Resolves the active client-side BYOK provider configuration, decrypting the API key
 * from the IndexedDB AES-GCM vault (with memory-only fallback when IndexedDB is unavailable).
 * Returns null if no key is configured for a provider that requires one.
 */
export async function resolveClientProviderConfig(): Promise<ClientProviderConfig | null> {
  if (!isBrowser()) return null;

  let provider: ByokProvider = "gemini";
  let model = "";
  let baseUrl = "";

  const storage = getLocalStorage();
  if (storage) {
    try {
      const raw = storage.getItem(SETTINGS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.provider) provider = parsed.provider;
        if (typeof parsed.model === "string") model = parsed.model.trim();
        if (typeof parsed.baseUrl === "string") baseUrl = parsed.baseUrl.trim();
      }
    } catch {
      // Ignore parse errors
    }
  }

  const vaultKey = await getKey(provider);
  const apiKey = vaultKey || "";

  if (provider !== "ollama" && provider !== "custom" && !apiKey) {
    return null;
  }

  let resolvedModel = model || DEFAULT_MODELS[provider] || "";
  if (provider === "gemini" && resolvedModel === "gemini-3.8-flash") {
    resolvedModel = "gemini-2.5-flash";
  }

  if (provider === "ollama" && !baseUrl) {
    baseUrl = "http://localhost:11434";
  }

  return {
    provider,
    apiKey: apiKey || undefined,
    baseUrl: baseUrl || undefined,
    model: resolvedModel || undefined,
  };
}
