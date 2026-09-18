import { z } from "zod";

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 24;
export const USERNAME_PATTERN = /^[a-z][a-z0-9_-]*$/;

export const UsernameSchema = z
  .string()
  .trim()
  .min(USERNAME_MIN, "Username must be at least 3 characters")
  .max(USERNAME_MAX, "Username must be at most 24 characters")
  .transform((value) => value.toLowerCase())
  .refine((value) => USERNAME_PATTERN.test(value), {
    message: "Use letters, numbers, underscores, or hyphens. Start with a letter.",
  });

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

export function isEmailIdentifier(value: string): boolean {
  return value.includes("@");
}
