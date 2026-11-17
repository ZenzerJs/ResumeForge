/**
 * Shared application-continuity helpers for Tailor, Editor, Library, Settings,
 * Tracker, and global navigation.
 *
 * Centralizes:
 * - validated query parameters (`jobId`, `tab`, `variantId`, `resumeId`, `mode`, `from`)
 * - safe internal route/return-path construction (no open redirects or unknown tabs)
 * - tab-scoped `sessionStorage` active-job persistence isolated by account/guest scope
 * - precedence rules (explicit new job / sample / job / document over stored active job)
 * - save-before-navigation failure/retry and pending-review-choice preservation
 */

export type TailorWorkspaceTab =
  | "overview"
  | "3-pane"
  | "job-info"
  | "cover-letter"
  | "diagnostic";

export const VALID_TAILOR_TABS: readonly TailorWorkspaceTab[] = [
  "job-info",
  "3-pane",
  "overview",
  "cover-letter",
  "diagnostic",
] as const;

export type EditorModeParam = "visual" | "code";

export type ApplicationReturnOrigin = "tailor";

export type SampleJobKind = "default" | "backend" | "frontend" | "demo";

export const KNOWN_APP_ROUTES = [
  "/",
  "/editor",
  "/library",
  "/tracker",
  "/tracker/feed",
  "/tracker/saved",
  "/tracker/applied",
  "/tracker/outcomes",
  "/tailor",
  "/practice",
  "/settings",
] as const;

export type KnownAppRoute = (typeof KNOWN_APP_ROUTES)[number];

const KNOWN_APP_ROUTE_SET: ReadonlySet<string> = new Set<string>(KNOWN_APP_ROUTES);

export const ACTIVE_APPLICATION_STORAGE_KEY = "resumeforge_active_application_context";
export const LEGACY_ACTIVE_JOB_STORAGE_KEY = "resumeforge_active_job_id";
export const PENDING_REVIEW_CHOICES_STORAGE_KEY = "resumeforge_pending_review_choices";

const SAFE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface ReadonlyURLSearchParamsLike {
  get(name: string): string | null;
}

export type SearchParamsInput =
  | URLSearchParams
  | ReadonlyURLSearchParamsLike
  | Record<string, string | string[] | null | undefined>
  | string
  | null
  | undefined;

export interface ApplicationAccountScope {
  /** Signed-in user ID, or `null` when explicitly signed out / guest. */
  userId?: string | null;
  /** True when `DEMO_MODE` is enabled. */
  demoMode?: boolean;
  /** Optional guest session token/id when distinguishing guest sessions. */
  guestSessionId?: string | null;
  /** Set to `false` while session/demo status is still loading to avoid premature storage reads. */
  scopeResolved?: boolean;
}

export interface StoredApplicationContext {
  jobId: string;
  tab?: TailorWorkspaceTab;
  roleTitle?: string;
  company?: string;
  variantId?: string;
  resumeId?: string;
  mode?: EditorModeParam;
  updatedAt: number;
}

export interface PendingReviewChoicesState {
  jobId: string;
  batchId?: string | null;
  decisions: Record<string, "accepted" | "rejected" | "pending">;
  acknowledgedSkills: string[];
  updatedAt: number;
}

export type TailorEntrySource =
  | "explicit-new"
  | "explicit-sample"
  | "explicit-job"
  | "explicit-document"
  | "stored-active"
  | "default";

export interface TailorEntryResolution {
  source: TailorEntrySource;
  jobId: string | null;
  tab: TailorWorkspaceTab;
  variantId: string | null;
  resumeId: string | null;
  mode: EditorModeParam | null;
  from: ApplicationReturnOrigin | null;
  sampleKind: SampleJobKind | null;
  storedContext: StoredApplicationContext | null;
}

export interface TailorReturnContext {
  from: ApplicationReturnOrigin;
  href: string;
  jobId: string | null;
  tab: TailorWorkspaceTab;
  roleTitle: string | null;
  company: string | null;
  variantId: string | null;
  resumeId: string | null;
  mode: EditorModeParam | null;
  label: string;
}

export interface ApplicationHrefParams {
  jobId?: string | null;
  tab?: string | null;
  variantId?: string | null;
  resumeId?: string | null;
  mode?: string | null;
  from?: ApplicationReturnOrigin | null;
  sample?: boolean | SampleJobKind | null;
  newJob?: boolean;
  skill?: string | null;
}

export interface SaveBeforeNavigationSaveResult<TContext = unknown> {
  ok: boolean;
  context?: TContext;
  error?: string;
  canRetry?: boolean;
}

export interface SaveBeforeNavigationOptions<TContext = unknown> {
  /** True when there are unsaved changes or an in-flight save that must complete before navigating. */
  hasPendingSave: boolean;
  /** True when unapplied review choices exist (e.g. accept/reject decisions). */
  hasPendingReviewChoices?: boolean;
  /** True when pending review choices can be preserved across navigation. */
  canPreserveReviewChoices?: boolean;
  /** Persists pending review choices before navigation; returning false falls back to confirmation. */
  preserveReviewChoices?: () => Promise<boolean> | boolean;
  /** Prompts the user before discarding unapplied review choices; returning false keeps the user on page. */
  confirmDiscardReviewChoices?: () => Promise<boolean> | boolean;
  /** Saves/flushes pending edits; must leave typed text intact on failure. */
  save: () => Promise<SaveBeforeNavigationSaveResult<TContext>>;
  /** Called only when navigation is safe to proceed. */
  onNavigate: (context?: TContext) => void | Promise<void>;
  /** Called on save failure so the UI can focus the retryable error banner or retry button. */
  onErrorFocus?: () => void;
  fallbackErrorMessage?: string;
}

export type SaveBeforeNavigationOutcome<TContext = unknown> =
  | { status: "navigated"; context?: TContext }
  | { status: "cancelled"; reason: "review-choices-retained" }
  | { status: "in-flight" }
  | { status: "failed"; error: string; canRetry: true };

export interface SaveBeforeNavigationController {
  readonly isPending: boolean;
  execute: <TContext = unknown>(
    options: SaveBeforeNavigationOptions<TContext>
  ) => Promise<SaveBeforeNavigationOutcome<TContext>>;
}

function getDefaultSessionStorage(): StorageLike | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/** Type guard for recognized Tailor `?tab=` values. */
export function isRecognizedTailorTab(
  param: string | null | undefined
): param is TailorWorkspaceTab {
  return (
    param === "overview" ||
    param === "3-pane" ||
    param === "job-info" ||
    param === "cover-letter" ||
    param === "diagnostic"
  );
}

/** Normalizes a Tailor `?tab=` query value, falling back to `"job-info"`. */
export function normalizeTailorTabParam(
  param: string | null | undefined
): TailorWorkspaceTab {
  return isRecognizedTailorTab(param) ? param : "job-info";
}

/** Normalizes an Editor `?mode=` query value to `"visual"`, `"code"`, or `null`. */
export function normalizeEditorModeParam(
  param: string | null | undefined
): EditorModeParam | null {
  if (param === "visual" || param === "code") return param;
  return null;
}

/** Returns true only for known internal ResumeForge app routes. */
export function isKnownAppRoute(
  route: string | null | undefined
): route is KnownAppRoute {
  if (typeof route !== "string") return false;
  return KNOWN_APP_ROUTE_SET.has(route);
}

/** Validates an entity identifier (`jobId`, `variantId`, `resumeId`) for URL and storage safety. */
export function isValidContextId(
  id: string | null | undefined
): id is string {
  if (typeof id !== "string") return false;
  if (!SAFE_ID_PATTERN.test(id)) return false;
  return !id.includes("..");
}

function normalizeTextMeta(value: string | null | undefined): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 200) : undefined;
}

function isTruthyQueryFlag(value: string | null | undefined): boolean {
  return value === "1" || value === "true" || value === "yes";
}

function parseSampleQueryFlag(value: string | null | undefined): SampleJobKind | null {
  if (!value) return null;
  if (value === "1" || value === "true") return "default";
  if (value === "backend" || value === "frontend" || value === "demo") return value;
  return null;
}

function toURLSearchParams(input: SearchParamsInput): URLSearchParams {
  if (!input) return new URLSearchParams();
  if (typeof input === "string") {
    const query = input.startsWith("?") ? input.slice(1) : input;
    return new URLSearchParams(query);
  }
  if (input instanceof URLSearchParams) {
    return new URLSearchParams(input.toString());
  }
  if (typeof (input as ReadonlyURLSearchParamsLike).get === "function") {
    const reader = input as ReadonlyURLSearchParamsLike;
    const params = new URLSearchParams();
    const keys = [
      "jobId",
      "tab",
      "variantId",
      "resumeId",
      "mode",
      "from",
      "sample",
      "new",
      "action",
      "skill",
    ];
    for (const key of keys) {
      const value = reader.get(key);
      if (value !== null) params.set(key, value);
    }
    return params;
  }
  const params = new URLSearchParams();
  for (const [key, raw] of Object.entries(input as Record<string, string | string[] | null | undefined>)) {
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (typeof value === "string") params.set(key, value);
  }
  return params;
}

/**
 * Resolves a deterministic scope key for the active account or guest/demo session.
 * Returns `null` when `scopeResolved === false` so unresolved auth never reads stale storage.
 */
export function resolveApplicationScopeKey(
  scope: ApplicationAccountScope
): string | null {
  if (scope.scopeResolved === false) return null;
  if (typeof scope.userId === "string" && scope.userId.trim().length > 0) {
    return `user:${scope.userId.trim()}`;
  }
  const guestSuffix =
    typeof scope.guestSessionId === "string" && scope.guestSessionId.trim().length > 0
      ? scope.guestSessionId.trim()
      : "default";
  if (scope.demoMode) {
    return `demo:${guestSuffix}`;
  }
  return `guest:${guestSuffix}`;
}

function sanitizeStoredContext(raw: unknown): StoredApplicationContext | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  if (!isValidContextId(record.jobId as string | undefined)) return null;

  const updatedAt =
    typeof record.updatedAt === "number" && Number.isFinite(record.updatedAt)
      ? record.updatedAt
      : Date.now();

  const sanitized: StoredApplicationContext = {
    jobId: record.jobId as string,
    updatedAt,
  };
  if (isRecognizedTailorTab(record.tab as string | undefined)) {
    sanitized.tab = record.tab as TailorWorkspaceTab;
  }
  const roleTitle = normalizeTextMeta(record.roleTitle as string | undefined);
  if (roleTitle) sanitized.roleTitle = roleTitle;
  const company = normalizeTextMeta(record.company as string | undefined);
  if (company) sanitized.company = company;
  if (isValidContextId(record.variantId as string | undefined)) {
    sanitized.variantId = record.variantId as string;
  }
  if (isValidContextId(record.resumeId as string | undefined)) {
    sanitized.resumeId = record.resumeId as string;
  }
  const mode = normalizeEditorModeParam(record.mode as string | undefined);
  if (mode) sanitized.mode = mode;
  return sanitized;
}

/**
 * Reads tab-scoped active-job context only if it matches the active account/guest scope.
 * Automatically clears mismatched-scope records (e.g. after logout or account switch).
 */
export function readActiveApplicationContext(
  scope: ApplicationAccountScope,
  storage: StorageLike | null = getDefaultSessionStorage()
): StoredApplicationContext | null {
  const scopeKey = resolveApplicationScopeKey(scope);
  if (!scopeKey || !storage) return null;

  try {
    const raw = storage.getItem(ACTIVE_APPLICATION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { scopeKey?: unknown; context?: unknown } | null;
    if (!parsed || typeof parsed !== "object" || parsed.scopeKey !== scopeKey) {
      storage.removeItem(ACTIVE_APPLICATION_STORAGE_KEY);
      storage.removeItem(LEGACY_ACTIVE_JOB_STORAGE_KEY);
      storage.removeItem(PENDING_REVIEW_CHOICES_STORAGE_KEY);
      return null;
    }
    return sanitizeStoredContext(parsed.context);
  } catch {
    return null;
  }
}

/**
 * Persists tab-scoped active-job context under the resolved account/guest scope.
 * Never writes if the scope is unresolved or `jobId` is invalid.
 */
export function writeActiveApplicationContext(
  context: Omit<StoredApplicationContext, "updatedAt"> & { updatedAt?: number },
  scope: ApplicationAccountScope,
  storage: StorageLike | null = getDefaultSessionStorage()
): StoredApplicationContext | null {
  const scopeKey = resolveApplicationScopeKey(scope);
  if (!scopeKey || !storage) return null;
  const sanitized = sanitizeStoredContext({
    ...context,
    updatedAt: context.updatedAt ?? Date.now(),
  });
  if (!sanitized) return null;

  try {
    storage.setItem(
      ACTIVE_APPLICATION_STORAGE_KEY,
      JSON.stringify({ scopeKey, context: sanitized })
    );
    storage.setItem(LEGACY_ACTIVE_JOB_STORAGE_KEY, sanitized.jobId);
    return sanitized;
  } catch {
    return null;
  }
}

/**
 * Updates fields on an existing scoped active-job record (or creates one if `jobId` is provided).
 */
export function updateActiveApplicationContext(
  patch: Partial<Omit<StoredApplicationContext, "updatedAt">>,
  scope: ApplicationAccountScope,
  storage: StorageLike | null = getDefaultSessionStorage()
): StoredApplicationContext | null {
  const existing = readActiveApplicationContext(scope, storage);
  const targetJobId = patch.jobId ?? existing?.jobId;
  if (!isValidContextId(targetJobId)) return null;

  return writeActiveApplicationContext(
    {
      ...existing,
      ...patch,
      jobId: targetJobId,
      updatedAt: Date.now(),
    },
    scope,
    storage
  );
}

/** Clears all tab-scoped active-job and pending-review-choice storage (call on sign-out). */
export function clearActiveApplicationContext(
  storage: StorageLike | null = getDefaultSessionStorage()
): void {
  if (!storage) return;
  try {
    storage.removeItem(ACTIVE_APPLICATION_STORAGE_KEY);
    storage.removeItem(LEGACY_ACTIVE_JOB_STORAGE_KEY);
    storage.removeItem(PENDING_REVIEW_CHOICES_STORAGE_KEY);
  } catch {
    // Ignore storage removal errors in restricted environments.
  }
}

/**
 * Persists pending patch-review decisions in tab-scoped storage keyed by `scopeKey` and `jobId`.
 */
export function writePendingReviewChoices(
  choices: Omit<PendingReviewChoicesState, "updatedAt"> & { updatedAt?: number },
  scope: ApplicationAccountScope,
  storage: StorageLike | null = getDefaultSessionStorage()
): PendingReviewChoicesState | null {
  const scopeKey = resolveApplicationScopeKey(scope);
  if (!scopeKey || !storage || !isValidContextId(choices.jobId)) return null;

  const decisions: Record<string, "accepted" | "rejected" | "pending"> = {};
  for (const [id, status] of Object.entries(choices.decisions)) {
    if (status === "accepted" || status === "rejected" || status === "pending") {
      decisions[id] = status;
    }
  }
  const acknowledgedSkills = Array.from(
    new Set(
      choices.acknowledgedSkills
        .map((skill) => skill.trim())
        .filter((skill) => skill.length > 0)
    )
  );
  const payload: PendingReviewChoicesState = {
    jobId: choices.jobId,
    batchId: choices.batchId ?? null,
    decisions,
    acknowledgedSkills,
    updatedAt: choices.updatedAt ?? Date.now(),
  };

  try {
    storage.setItem(
      PENDING_REVIEW_CHOICES_STORAGE_KEY,
      JSON.stringify({ scopeKey, choices: payload })
    );
    return payload;
  } catch {
    return null;
  }
}

/** Reads pending patch-review decisions only when both `scopeKey` and `jobId` match. */
export function readPendingReviewChoices(
  jobId: string | null | undefined,
  scope: ApplicationAccountScope,
  storage: StorageLike | null = getDefaultSessionStorage()
): PendingReviewChoicesState | null {
  const scopeKey = resolveApplicationScopeKey(scope);
  if (!scopeKey || !storage || !isValidContextId(jobId)) return null;

  try {
    const raw = storage.getItem(PENDING_REVIEW_CHOICES_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      scopeKey?: unknown;
      choices?: Partial<PendingReviewChoicesState>;
    } | null;
    if (!parsed || parsed.scopeKey !== scopeKey) {
      storage.removeItem(PENDING_REVIEW_CHOICES_STORAGE_KEY);
      return null;
    }
    const choices = parsed.choices;
    if (!choices || choices.jobId !== jobId) return null;

    const decisions: Record<string, "accepted" | "rejected" | "pending"> = {};
    if (choices.decisions && typeof choices.decisions === "object") {
      for (const [id, status] of Object.entries(choices.decisions)) {
        if (status === "accepted" || status === "rejected" || status === "pending") {
          decisions[id] = status;
        }
      }
    }
    const acknowledgedSkills = Array.isArray(choices.acknowledgedSkills)
      ? choices.acknowledgedSkills.filter((item): item is string => typeof item === "string")
      : [];

    return {
      jobId,
      batchId: typeof choices.batchId === "string" ? choices.batchId : null,
      decisions,
      acknowledgedSkills,
      updatedAt:
        typeof choices.updatedAt === "number" && Number.isFinite(choices.updatedAt)
          ? choices.updatedAt
          : Date.now(),
    };
  } catch {
    return null;
  }
}

/** Clears stored pending review choices. */
export function clearPendingReviewChoices(
  storage: StorageLike | null = getDefaultSessionStorage()
): void {
  if (!storage) return;
  try {
    storage.removeItem(PENDING_REVIEW_CHOICES_STORAGE_KEY);
  } catch {
    // Ignore storage removal errors.
  }
}

/**
 * Resolves Tailor entry state with strict precedence:
 * 1. Explicit new job (`new=1` / `action=new`)
 * 2. Explicit sample (`sample=1|backend|frontend|demo`)
 * 3. Explicit `jobId` query parameter
 * 4. Explicit document link (`variantId` or `resumeId`)
 * 5. Tab-scoped stored active job for the current account/guest scope
 * 6. Default workspace state
 */
export function resolveTailorEntryContext(
  searchParams: SearchParamsInput,
  scope: ApplicationAccountScope,
  options?: {
    storage?: StorageLike | null;
    explicitNewJob?: boolean;
    explicitSample?: SampleJobKind | boolean;
  }
): TailorEntryResolution {
  const params = toURLSearchParams(searchParams);
  const storage = options?.storage === undefined ? getDefaultSessionStorage() : options.storage;

  const rawTab = params.get("tab");
  const hasExplicitTab = isRecognizedTailorTab(rawTab);
  const rawJobId = params.get("jobId");
  const validJobId = isValidContextId(rawJobId) ? rawJobId : null;
  const rawVariantId = params.get("variantId");
  const validVariantId = isValidContextId(rawVariantId) ? rawVariantId : null;
  const rawResumeId = params.get("resumeId");
  const validResumeId = isValidContextId(rawResumeId) ? rawResumeId : null;
  const mode = normalizeEditorModeParam(params.get("mode"));
  const from = params.get("from") === "tailor" ? "tailor" : null;

  const explicitNew =
    Boolean(options?.explicitNewJob) ||
    isTruthyQueryFlag(params.get("new")) ||
    params.get("action") === "new";

  const paramSampleKind = parseSampleQueryFlag(params.get("sample"));
  const optionSampleKind: SampleJobKind | null =
    options?.explicitSample === true
      ? "default"
      : typeof options?.explicitSample === "string"
        ? options.explicitSample
        : null;
  const sampleKind = optionSampleKind ?? paramSampleKind;

  if (explicitNew) {
    return {
      source: "explicit-new",
      jobId: null,
      tab: normalizeTailorTabParam(rawTab),
      variantId: validVariantId,
      resumeId: validResumeId,
      mode,
      from,
      sampleKind: null,
      storedContext: null,
    };
  }

  if (sampleKind) {
    return {
      source: "explicit-sample",
      jobId: null,
      tab: normalizeTailorTabParam(rawTab),
      variantId: validVariantId,
      resumeId: validResumeId,
      mode,
      from,
      sampleKind,
      storedContext: null,
    };
  }

  const stored = readActiveApplicationContext(scope, storage);

  if (validJobId) {
    const matchingStored = stored && stored.jobId === validJobId ? stored : null;
    return {
      source: "explicit-job",
      jobId: validJobId,
      tab: hasExplicitTab
        ? rawTab
        : matchingStored?.tab ?? normalizeTailorTabParam(rawTab),
      variantId: validVariantId ?? matchingStored?.variantId ?? null,
      resumeId: validResumeId ?? matchingStored?.resumeId ?? null,
      mode: mode ?? matchingStored?.mode ?? null,
      from,
      sampleKind: null,
      storedContext: matchingStored,
    };
  }

  if (validVariantId || validResumeId) {
    return {
      source: "explicit-document",
      jobId: null,
      tab: normalizeTailorTabParam(rawTab),
      variantId: validVariantId,
      resumeId: validResumeId,
      mode,
      from,
      sampleKind: null,
      storedContext: null,
    };
  }

  if (stored) {
    return {
      source: "stored-active",
      jobId: stored.jobId,
      tab: hasExplicitTab ? rawTab : stored.tab ?? "job-info",
      variantId: stored.variantId ?? null,
      resumeId: stored.resumeId ?? null,
      mode: stored.mode ?? null,
      from,
      sampleKind: null,
      storedContext: stored,
    };
  }

  return {
    source: "default",
    jobId: null,
    tab: normalizeTailorTabParam(rawTab),
    variantId: null,
    resumeId: null,
    mode,
    from,
    sampleKind: null,
    storedContext: null,
  };
}

/**
 * Builds an internal path strictly from a known route and validated parameters.
 * Returns `null` if `route` is not a known ResumeForge route.
 */
export function buildSafeInternalRouteHref(
  route: string,
  params: ApplicationHrefParams = {}
): string | null {
  if (!isKnownAppRoute(route)) return null;

  const query = new URLSearchParams();

  if (params.newJob) {
    query.set("new", "1");
  } else if (params.sample) {
    query.set("sample", typeof params.sample === "string" ? params.sample : "1");
  } else if (isValidContextId(params.jobId)) {
    query.set("jobId", params.jobId);
  }

  if (params.from === "tailor" && route !== "/tailor") {
    query.set("from", "tailor");
  }

  if (params.tab !== undefined && params.tab !== null) {
    query.set("tab", normalizeTailorTabParam(params.tab));
  }

  if (isValidContextId(params.variantId)) {
    query.set("variantId", params.variantId);
  }
  if (isValidContextId(params.resumeId)) {
    query.set("resumeId", params.resumeId);
  }

  const mode = normalizeEditorModeParam(params.mode);
  if (mode) {
    query.set("mode", mode);
  }

  if (typeof params.skill === "string" && params.skill.trim().length > 0) {
    query.set("skill", params.skill.trim().slice(0, 120));
  }

  const qs = query.toString();
  return qs ? `${route}?${qs}` : route;
}

/** Builds a validated `/tailor` href preserving job, tab, and optional editor document/mode context. */
export function buildTailorHref(params: Omit<ApplicationHrefParams, "from" | "skill"> = {}): string {
  return buildSafeInternalRouteHref("/tailor", params) ?? "/tailor";
}

/** Builds a `/tailor` href that opens an empty job entry (takes precedence over stored active job). */
export function buildTailorNewJobHref(params?: { tab?: TailorWorkspaceTab }): string {
  return buildSafeInternalRouteHref("/tailor", {
    newJob: true,
    tab: params?.tab,
  }) ?? "/tailor?new=1";
}

/** Builds a `/tailor` href that opens the sample experience (takes precedence over stored active job). */
export function buildTailorSampleHref(params?: {
  sample?: SampleJobKind;
  tab?: TailorWorkspaceTab;
}): string {
  return buildSafeInternalRouteHref("/tailor", {
    sample: params?.sample ?? true,
    tab: params?.tab,
  }) ?? "/tailor?sample=1";
}

/** Builds a validated `/editor` href preserving `variantId`, `resumeId`, `mode`, and Tailor return context. */
export function buildEditorHref(params: {
  variantId?: string | null;
  resumeId?: string | null;
  mode?: string | null;
  jobId?: string | null;
  tab?: string | null;
  from?: ApplicationReturnOrigin | null;
} = {}): string {
  return buildSafeInternalRouteHref("/editor", params) ?? "/editor";
}

/** Builds a validated `/settings` href preserving Tailor return context and editor context. */
export function buildSettingsHref(params: {
  from?: ApplicationReturnOrigin | null;
  jobId?: string | null;
  tab?: string | null;
  variantId?: string | null;
  resumeId?: string | null;
  mode?: string | null;
} = {}): string {
  return buildSafeInternalRouteHref("/settings", params) ?? "/settings";
}

/** Builds a validated `/library` href preserving Tailor return context, editor context, and optional skill filter. */
export function buildLibraryHref(params: {
  from?: ApplicationReturnOrigin | null;
  jobId?: string | null;
  tab?: string | null;
  variantId?: string | null;
  resumeId?: string | null;
  mode?: string | null;
  skill?: string | null;
} = {}): string {
  return buildSafeInternalRouteHref("/library", params) ?? "/library";
}

/**
 * Resolves the global navigation `/tailor` destination and active job metadata
 * for the current account or guest session.
 */
export function resolveGlobalTailorContext(
  scope: ApplicationAccountScope,
  storage: StorageLike | null = getDefaultSessionStorage()
): {
  href: string;
  activeContext: StoredApplicationContext | null;
} {
  const activeContext = readActiveApplicationContext(scope, storage);
  if (!activeContext) {
    return { href: "/tailor", activeContext: null };
  }
  return {
    href: buildTailorHref({
      jobId: activeContext.jobId,
      tab: activeContext.tab,
      variantId: activeContext.variantId,
      resumeId: activeContext.resumeId,
      mode: activeContext.mode,
    }),
    activeContext,
  };
}

/**
 * Resolves the global navigation `/tailor` destination for the active account/guest scope.
 * Preserves the stored active `jobId` and `tab` when present.
 */
export function resolveGlobalTailorHref(
  scope: ApplicationAccountScope,
  storage: StorageLike | null = getDefaultSessionStorage()
): string {
  return resolveGlobalTailorContext(scope, storage).href;
}

/**
 * Parses and validates a contextual "Back to Tailor" return action from query parameters.
 * Returns `null` unless `from=tailor` AND a valid application context (`jobId` or recognized `tab`) exists.
 */
export function parseTailorReturnContext(
  searchParams: SearchParamsInput,
  options?: {
    scope?: ApplicationAccountScope;
    storage?: StorageLike | null;
    requireJobId?: boolean;
    overrides?: {
      variantId?: string | null;
      resumeId?: string | null;
      mode?: string | null;
    };
  }
): TailorReturnContext | null {
  const params = toURLSearchParams(searchParams);
  if (params.get("from") !== "tailor") return null;

  const rawJobId = params.get("jobId");
  const hasRawJobId = rawJobId !== null && rawJobId.length > 0;
  if (hasRawJobId && !isValidContextId(rawJobId)) {
    return null;
  }
  const jobId = hasRawJobId ? rawJobId : null;

  if (options?.requireJobId && !jobId) {
    return null;
  }

  const rawTab = params.get("tab");
  const recognizedTab = isRecognizedTailorTab(rawTab) ? rawTab : null;
  if (!jobId && !recognizedTab) {
    return null;
  }

  const tab: TailorWorkspaceTab = recognizedTab ?? "job-info";

  const storage = options?.storage === undefined ? getDefaultSessionStorage() : options.storage;
  const stored =
    jobId && options?.scope
      ? readActiveApplicationContext(options.scope, storage)
      : null;
  const matchingStored = stored && stored.jobId === jobId ? stored : null;

  const urlVariantId = params.get("variantId");
  const urlResumeId = params.get("resumeId");
  const urlMode = normalizeEditorModeParam(params.get("mode"));

  const variantId =
    (isValidContextId(options?.overrides?.variantId) ? options?.overrides?.variantId : null) ??
    (isValidContextId(urlVariantId) ? urlVariantId : null) ??
    matchingStored?.variantId ??
    null;

  const resumeId =
    (isValidContextId(options?.overrides?.resumeId) ? options?.overrides?.resumeId : null) ??
    (isValidContextId(urlResumeId) ? urlResumeId : null) ??
    matchingStored?.resumeId ??
    null;

  const mode =
    normalizeEditorModeParam(options?.overrides?.mode) ??
    urlMode ??
    matchingStored?.mode ??
    null;

  const roleTitle = matchingStored?.roleTitle ?? null;
  const company = matchingStored?.company ?? null;

  const href = buildTailorHref({
    jobId,
    tab,
    variantId,
    resumeId,
    mode,
  });

  const label = roleTitle ? `Back to Tailor · ${roleTitle}` : "Back to Tailor";

  return {
    from: "tailor",
    href,
    jobId,
    tab,
    roleTitle,
    company,
    variantId,
    resumeId,
    mode,
    label,
  };
}

/**
 * Creates a re-entrant-safe controller for save-before-navigation flows:
 * - Waits for pending/dirty saves before navigating
 * - Preserves pending review choices when supported, or lets the user stay before discarding
 * - Keeps typed edits and focuses a retryable error on failure
 */
export function createSaveBeforeNavigationController(): SaveBeforeNavigationController {
  let pending = false;

  return {
    get isPending() {
      return pending;
    },
    async execute<TContext = unknown>(
      options: SaveBeforeNavigationOptions<TContext>
    ): Promise<SaveBeforeNavigationOutcome<TContext>> {
      if (pending) {
        return { status: "in-flight" };
      }

      pending = true;
      const fallbackError =
        options.fallbackErrorMessage ||
        "Could not save your job draft. Your edits are still here. Please retry.";

      try {
        if (options.hasPendingReviewChoices) {
          let preserved = false;
          if (options.canPreserveReviewChoices && options.preserveReviewChoices) {
            preserved = await options.preserveReviewChoices();
          }
          if (!preserved && options.confirmDiscardReviewChoices) {
            const proceed = await options.confirmDiscardReviewChoices();
            if (!proceed) {
              return { status: "cancelled", reason: "review-choices-retained" };
            }
          }
        }

        if (options.hasPendingSave) {
          const saveResult = await options.save();
          if (!saveResult.ok) {
            options.onErrorFocus?.();
            return {
              status: "failed",
              error: saveResult.error || fallbackError,
              canRetry: true,
            };
          }
          await options.onNavigate(saveResult.context);
          return { status: "navigated", context: saveResult.context };
        }

        await options.onNavigate(undefined);
        return { status: "navigated" };
      } catch (err) {
        options.onErrorFocus?.();
        const message =
          err instanceof Error && err.message ? err.message : fallbackError;
        return {
          status: "failed",
          error: message,
          canRetry: true,
        };
      } finally {
        pending = false;
      }
    },
  };
}
