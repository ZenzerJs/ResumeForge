/**
 * Audited operator CLI to reset a user's password and invalidate all active sessions.
 *
 * Usage (interactive prompt — avoids passing password in shell history):
 *   npx tsx scripts/reset-user-password.ts --email user@example.com
 *
 * Or via stdin:
 *   printf '%s\n' 'NewStrongPassword!' | npx tsx scripts/reset-user-password.ts --email user@example.com --stdin
 */

import readline from "node:readline";
import { fileURLToPath } from "node:url";
import { prisma } from "@/lib/prisma";
import { hashPassword, normalizeEmail } from "@/lib/security/passwords";

export interface ResetUserPasswordResult {
  userId: string;
  email: string;
  previousSessionVersion: number;
  newSessionVersion: number;
}

export async function resetUserPassword(input: {
  email: string;
  newPassword: string;
}): Promise<ResetUserPasswordResult> {
  const email = normalizeEmail(input.email);
  if (!email || !email.includes("@")) {
    throw new Error("A valid --email address is required.");
  }
  if (typeof input.newPassword !== "string" || input.newPassword.length < 8 || input.newPassword.length > 200) {
    throw new Error("New password must be between 8 and 200 characters.");
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, sessionVersion: true },
  });
  if (!user) {
    throw new Error(`No user found for email: ${email}`);
  }

  const passwordHash = await hashPassword(input.newPassword);
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      sessionVersion: { increment: 1 },
    },
    select: { id: true, email: true, sessionVersion: true },
  });

  return {
    userId: updated.id,
    email: updated.email,
    previousSessionVersion: user.sessionVersion,
    newSessionVersion: updated.sessionVersion,
  };
}

function getFlagValue(argv: string[], flag: string): string | undefined {
  const idx = argv.indexOf(flag);
  if (idx === -1) return undefined;
  return argv[idx + 1];
}

async function readPasswordFromStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => resolve(data.replace(/\r?\n$/, "")));
    process.stdin.on("error", reject);
  });
}

async function promptPassword(label: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stderr,
    terminal: Boolean(process.stdin.isTTY),
  });
  return new Promise((resolve) => {
    rl.question(label, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function main() {
  const argv = process.argv.slice(2);
  const email = getFlagValue(argv, "--email");
  if (!email) {
    console.error("Usage: npx tsx scripts/reset-user-password.ts --email <email> [--stdin]");
    process.exit(1);
  }

  const newPassword = argv.includes("--stdin")
    ? await readPasswordFromStdin()
    : await promptPassword("Enter new password (min 8 chars): ");

  try {
    const result = await resetUserPassword({ email, newPassword });
    console.log(
      `Password reset for ${result.email} (user ${result.userId}). Session version incremented ${result.previousSessionVersion} -> ${result.newSessionVersion}; all existing sessions revoked.`
    );
  } finally {
    await prisma.$disconnect();
  }
}

const entry = process.argv[1];
if (entry && fileURLToPath(import.meta.url) === entry) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
