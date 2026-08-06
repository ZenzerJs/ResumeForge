import { z } from "zod";

export const ProviderTypeSchema = z.enum(["openai", "anthropic", "gemini", "custom"]);
export type ProviderType = z.infer<typeof ProviderTypeSchema>;

export const ProviderConfigSchema = z.object({
  provider: ProviderTypeSchema,
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
  model: z.string().optional(),
});

export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;

export interface TestConnectionResult {
  success: boolean;
  provider: ProviderType;
  message: string;
  modelCount?: number;
  latencyMs?: number;
}
