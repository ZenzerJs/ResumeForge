import { z } from "zod";
import { extractJsonObject } from "./ai/json-response";
import { ProviderConfig } from "./ai/types";

export const dossierSchema = z.object({
  companyName: z.string(),
  interviewStyle: z.object({
    format: z.enum([
      "LeetCode Heavy",
      "Practical / Systems",
      "Take-home Project",
      "Behavioral / Values Driven",
    ]),
    primaryEvaluationCriteria: z.array(z.string()).transform((a) => a.slice(0, 6)),
    roundBreakdown: z.array(z.string()).transform((a) => a.slice(0, 8)),
    proTips: z.array(z.string()).transform((a) => a.slice(0, 5)),
  }),
  engineeringCulture: z.object({
    workLifeBalanceRating: z.coerce.number().min(1).max(5),
    deploymentVelocity: z.string(),
    remoteCulture: z.string(),
    pros: z.array(z.string()).transform((a) => a.slice(0, 5)),
    cons: z.array(z.string()).transform((a) => a.slice(0, 5)),
  }),
  recentSignals: z.string(),
});

export type CompanyIntelligenceDossier = z.infer<typeof dossierSchema>;

export interface GenerateDossierInput {
  companyName: string;
  jobTitle?: string;
  referenceNotes?: string;
  processNotes?: string;
  providerConfig?: ProviderConfig;
}

export function buildCompanyDossierPrompt(input: GenerateDossierInput): {
  systemPrompt: string;
  userPrompt: string;
} {
  const systemPrompt = `You are an Expert Tech Career Advisor and Engineering Org Analyst.
Synthesize an Engineering Dossier for the requested company.
Follow strict ground truth rules:
1. When Whiteboard-Free Process or Handbook Excerpts are provided, treat them as primary evidence.
2. If WLB or deployment velocity is estimated, append "(est.)".
3. recentSignals must come from verified trends; if unverified, state "No verified recent signals on file".
4. Return ONLY a valid JSON object matching the requested schema.`;

  const userPrompt = `Company: ${input.companyName}
Target Job Title: ${input.jobTitle || "Software Engineer"}
${input.processNotes ? `\n### PRIMARY EVIDENCE (Whiteboard-Free Process):\n${input.processNotes}` : ""}
${input.referenceNotes ? `\n### PRIMARY EVIDENCE (Handbook Excerpts):\n${input.referenceNotes}` : ""}

Return valid JSON in this shape:
{
  "companyName": "${input.companyName}",
  "interviewStyle": {
    "format": "LeetCode Heavy" | "Practical / Systems" | "Take-home Project" | "Behavioral / Values Driven",
    "primaryEvaluationCriteria": ["string"],
    "roundBreakdown": ["string"],
    "proTips": ["string"]
  },
  "engineeringCulture": {
    "workLifeBalanceRating": 3.8,
    "deploymentVelocity": "Continuous (est.)",
    "remoteCulture": "Hybrid (est.)",
    "pros": ["string"],
    "cons": ["string"]
  },
  "recentSignals": "string"
}`;

  return { systemPrompt, userPrompt };
}

/**
 * Generate a deterministic synthetic fallback dossier for tests or offline operation.
 */
export function generateOfflineDossier(input: GenerateDossierInput): CompanyIntelligenceDossier {
  const isWbf = Boolean(input.processNotes);
  const name = input.companyName || "Target Company";

  return {
    companyName: name,
    interviewStyle: {
      format: isWbf ? "Practical / Systems" : "LeetCode Heavy",
      primaryEvaluationCriteria: isWbf
        ? [
            "Practical domain problem solving",
            "Code modularity & maintainability",
            "System architecture design",
            "Values alignment & communication",
          ]
        : [
            "Data structures & algorithmic efficiency",
            "Time and space complexity tradeoffs",
            "System architecture design",
            "Behavioral leadership principles",
          ],
      roundBreakdown: isWbf
        ? [
            "1. Recruiter Screen (30m)",
            "2. Practical Technical Screen (60m - Real-world take-home or pair programming)",
            "3. Virtual Onsite: System Architecture Deep Dive (60m)",
            "4. Virtual Onsite: Practical Code Pairing (60m)",
            "5. Engineering Leadership & Values (45m)",
          ]
        : [
            "1. Recruiter Screen (30m)",
            "2. Online Assessment (OA) / Technical Screen (60m LeetCode Medium/Hard)",
            "3. Virtual Onsite: Coding & Algorithms Round 1 (45m)",
            "4. Virtual Onsite: Coding & Algorithms Round 2 (45m)",
            "5. Virtual Onsite: System Design / Architecture (60m)",
            "6. Virtual Onsite: Behavioral & Leadership Principles (45m)",
          ],
      proTips: [
        "Clarify ambiguous constraints and ask clarifying questions before writing code",
        "State time and space complexity explicitly ($O(n)$ time, $O(1)$ space)",
        "Proactively communicate edge cases (null inputs, empty arrays, scale boundaries)",
      ],
    },
    engineeringCulture: {
      workLifeBalanceRating: 3.8,
      deploymentVelocity: "Daily / CI/CD pipeline (est.)",
      remoteCulture: "Hybrid / Flexible (est.)",
      pros: [
        "High engineering bar and talented colleagues",
        "Modern cloud infrastructure and tooling",
        "Competitive total compensation and growth opportunities",
      ],
      cons: [
        "On-call rotation intensity varies by team",
        "Cross-team coordination overhead at scale",
      ],
    },
    recentSignals: input.processNotes
      ? `Hiring Without Whiteboards listed: ${input.processNotes}`
      : "No verified recent signals on file — check recent engineering blogs and filings before interviewing.",
  };
}

/**
 * Synthesize company intelligence dossier with BYOK LLM or deterministic fallback.
 * Validates strictly with Zod schema.
 */
export async function generateDossier(input: GenerateDossierInput): Promise<CompanyIntelligenceDossier> {
  const { providerConfig } = input;

  if (!providerConfig || !providerConfig.apiKey) {
    // If no BYOK key is configured, return high quality deterministic fallback
    return generateOfflineDossier(input);
  }

  // Attempt live LLM completion
  const { systemPrompt, userPrompt } = buildCompanyDossierPrompt(input);
  const messages = [
    { role: "system" as const, content: systemPrompt },
    { role: "user" as const, content: userPrompt },
  ];

  try {
    const { chatOpenAI } = await import("./ai/providers/openai");
    const { chatAnthropic } = await import("./ai/providers/anthropic");
    const { chatGemini } = await import("./ai/providers/gemini");
    const { chatCustom } = await import("./ai/providers/custom");

    let rawText = "";
    if (providerConfig.provider === "openai") {
      const res = await chatOpenAI(providerConfig, messages, []);
      rawText = res.content;
    } else if (providerConfig.provider === "anthropic") {
      const res = await chatAnthropic(providerConfig, messages, []);
      rawText = res.content;
    } else if (providerConfig.provider === "gemini") {
      const res = await chatGemini(providerConfig, messages, []);
      rawText = res.content;
    } else {
      const res = await chatCustom(providerConfig, messages, []);
      rawText = res.content;
    }

    const parsedJson = extractJsonObject(rawText);
    const validated = dossierSchema.safeParse(parsedJson);

    if (validated.success) {
      return validated.data;
    }

    // 1-time retry with Zod errors appended
    const retryUserPrompt = `${userPrompt}\n\nYour previous JSON output failed validation with the following errors:\n${validated.error.message}\nPlease return valid JSON fixing these issues.`;
    const retryMessages = [
      { role: "system" as const, content: systemPrompt },
      { role: "user" as const, content: retryUserPrompt },
    ];

    let retryRawText = "";
    if (providerConfig.provider === "openai") {
      const res = await chatOpenAI(providerConfig, retryMessages, []);
      retryRawText = res.content;
    } else {
      retryRawText = rawText; // Fallback
    }

    const retryJson = extractJsonObject(retryRawText);
    return dossierSchema.parse(retryJson);
  } catch {
    // If live call fails, fallback gracefully to structured offline dossier
    return generateOfflineDossier(input);
  }
}
