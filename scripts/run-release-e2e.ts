import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

const runId = randomUUID().replaceAll("-", "").slice(0, 12);
const container = `rf-release-${runId}`;
const schema = `rf_it_release_${runId}`;
const tempRoot = path.resolve(tmpdir());
const runDir = await mkdtemp(path.join(tempRoot, "resumeforge-release-"));
const dbPassword = randomUUID();
const appSecret = randomUUID() + randomUUID();
let app: ChildProcess | undefined;
let started = false;

function safeHostEnv(overrides: NodeJS.ProcessEnv = { NODE_ENV: "test" }): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { NODE_ENV: "test" };
  for (const key of ["PATH", "PATHEXT", "SystemRoot", "WINDIR", "TEMP", "TMP", "APPDATA", "USERPROFILE", "HOME", "COMSPEC"]) {
    if (process.env[key]) env[key] = process.env[key];
  }
  for (const key of ["OPENAI_API_KEY", "OPENAI_BASE_URL", "ANTHROPIC_API_KEY", "ANTHROPIC_BASE_URL", "GEMINI_API_KEY", "GEMINI_BASE_URL", "GOOGLE_API_KEY", "GROQ_API_KEY", "OLLAMA_BASE_URL", "CUSTOM_OPENAI_API_KEY", "CUSTOM_OPENAI_BASE_URL"]) env[key] = "";
  return { ...env, ...overrides };
}

function assertSafeTarget() {
  if (!/^rf_it_[a-z0-9_]+$/.test(schema)) throw new Error("Refusing a non-test PostgreSQL schema.");
  const resolved = path.resolve(runDir);
  if (!resolved.startsWith(tempRoot + path.sep)) throw new Error("Refusing to clean outside the OS temp directory.");
}

function run(command: string, args: string[], env: NodeJS.ProcessEnv = { NODE_ENV: "test" }) {
  const result = spawnSync(command, args, { cwd: process.cwd(), env: safeHostEnv(env), encoding: "utf8", stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) throw new Error(`${command} exited with ${result.status ?? result.signal}`);
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") return reject(new Error("Could not reserve a loopback port."));
      server.close((error) => error ? reject(error) : resolve(address.port));
    });
  });
}

async function waitForServer(url: string, child: ChildProcess) {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Owned Next.js server exited (${child.exitCode}).`);
    try {
      const response = await fetch(url);
      if (response.ok || response.status < 500) return;
    } catch { /* server is still starting */ }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for owned server at ${url}.`);
}

function stopApp() {
  if (!app || app.exitCode !== null) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const timeout = setTimeout(() => app?.kill("SIGKILL"), 5_000);
    app?.once("exit", () => { clearTimeout(timeout); resolve(); });
    app?.kill("SIGTERM");
  });
}

async function startMode(mode: "persistent" | "demo", port: number, databaseUrl: string) {
  app = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", String(port)], {
    cwd: process.cwd(),
    stdio: "inherit",
    env: safeHostEnv({
      PATH: process.env.PATH,
      NODE_ENV: "production",
      DATABASE_URL: databaseUrl,
      APP_ACCESS_SECRET: appSecret,
      APP_ACCESS_PASSWORD: appSecret,
      JOB_SYNC_SECRET: randomUUID(),
      DEMO_MODE: mode === "demo" ? "true" : "false",
      RELEASE_E2E_RUN_DIR: runDir,
      PORT: String(port),
      NEXT_PUBLIC_APP_URL: `http://127.0.0.1:${port}`,
    }),
  });
  const baseURL = `http://127.0.0.1:${port}`;
  await waitForServer(baseURL, app);
  run("npx", ["playwright", "test", "--config", "playwright.release.config.ts", "--grep", mode === "demo" ? "@demo" : "@persistent"], {
    PATH: process.env.PATH,
    NODE_ENV: "production",
    DATABASE_URL: databaseUrl,
    VITEST_POSTGRES_INTEGRATION: "1",
    RELEASE_E2E_MODE: mode,
    RELEASE_E2E_BASE_URL: baseURL,
    RELEASE_E2E_RUN_DIR: runDir,
    RELEASE_E2E_ARTIFACT_DIR: process.env.RELEASE_E2E_ARTIFACT_DIR,
  });
  await stopApp();
  app = undefined;
}

try {
  assertSafeTarget();
  const docker = spawnSync("docker", ["run", "--detach", "--rm", "--name", container, "-e", "POSTGRES_USER=rf_release", "-e", `POSTGRES_PASSWORD=${dbPassword}`, "-e", "POSTGRES_DB=rf_release", "-p", "127.0.0.1::5432", "postgres:16-alpine"], { encoding: "utf8" });
  if (docker.status !== 0) throw new Error(`Docker could not start isolated PostgreSQL: ${docker.stderr || docker.stdout}`);
  started = true;
  const portResult = spawnSync("docker", ["port", container, "5432/tcp"], { encoding: "utf8" });
  const mapped = portResult.stdout.trim().match(/127\.0\.0\.1:(\d+)$/m);
  if (portResult.status !== 0 || !mapped) throw new Error("Could not resolve the isolated PostgreSQL port.");
  const pgPort = mapped[1];
  const adminUrl = `postgresql://rf_release:${encodeURIComponent(dbPassword)}@127.0.0.1:${pgPort}/rf_release`;
  const databaseUrl = `${adminUrl}?schema=${schema}`;
  const deadline = Date.now() + 60_000;
  let postgresReady = false;
  while (Date.now() < deadline) {
    const ready = spawnSync("docker", ["exec", container, "pg_isready", "-U", "rf_release", "-d", "rf_release"]);
    if (ready.status === 0) {
      postgresReady = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!postgresReady) throw new Error("Isolated PostgreSQL did not become ready.");
  const createSchema = spawnSync("docker", ["exec", container, "psql", "-U", "rf_release", "-d", "rf_release", "-v", "ON_ERROR_STOP=1", "-c", `CREATE SCHEMA \"${schema}\"`], { encoding: "utf8" });
  if (createSchema.status !== 0) throw new Error(`Could not create isolated schema ${schema}: ${createSchema.stderr || createSchema.stdout}`);
  run("npx", ["prisma", "migrate", "deploy"], { ...safeHostEnv(), DATABASE_URL: databaseUrl, VITEST_POSTGRES_INTEGRATION: "1", NODE_ENV: "test" });
  const persistentPort = await freePort();
  const demoPort = await freePort();
  run("npm", ["run", "build"], safeHostEnv({
    PATH: process.env.PATH,
    NODE_ENV: "production",
    DATABASE_URL: databaseUrl,
    APP_ACCESS_SECRET: appSecret,
    APP_ACCESS_PASSWORD: appSecret,
    JOB_SYNC_SECRET: randomUUID(),
    DEMO_MODE: "false",
    NEXT_PUBLIC_APP_URL: `http://127.0.0.1:${persistentPort}`,
  }));
  const seed = spawnSync("npx", ["tsx", "e2e/release/seed-fixture.ts"], {
    cwd: process.cwd(), encoding: "utf8", stdio: "inherit", shell: process.platform === "win32",
    env: safeHostEnv({ PATH: process.env.PATH, DATABASE_URL: databaseUrl, APP_ACCESS_SECRET: appSecret, RELEASE_E2E_RUN_DIR: runDir, VITEST_POSTGRES_INTEGRATION: "1", NODE_ENV: "test" }),
  });
  if (seed.status !== 0) throw new Error("Could not seed isolated release fixtures.");
  await startMode("persistent", persistentPort, databaseUrl);
  await startMode("demo", demoPort, databaseUrl);
} finally {
  await stopApp();
  if (started) {
    const removed = spawnSync("docker", ["rm", "--force", container], { encoding: "utf8" });
    if (removed.status !== 0) process.stderr.write(`Could not remove owned container ${container}: ${removed.stderr}\n`);
  }
  assertSafeTarget();
  await rm(runDir, { recursive: true, force: true });
}
