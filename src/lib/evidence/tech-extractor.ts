/**
 * Pure technology extraction helper module.
 * Separated from pdfExtractor to prevent pulling pdfjs-dist into initial page bundles.
 */

export const COMMON_TECH_CATALOG = [
  "TypeScript", "JavaScript", "Python", "Golang", "Go", "Rust", "Java", "C++", "C#", "Ruby", "PHP", "Swift", "Kotlin", "SQL", "HTML", "CSS", "Sass", "SCSS", "Bash", "Shell",
  "React", "Next.js", "Vue", "Vue.js", "Nuxt", "Angular", "Svelte", "SvelteKit", "Tailwind CSS", "Tailwind", "Bootstrap", "Redux", "Zustand", "GraphQL", "Vite", "Webpack",
  "Node.js", "Express", "FastAPI", "Django", "Flask", "NestJS", "Spring Boot", "Ruby on Rails", "ASP.NET",
  "PostgreSQL", "Postgres", "MySQL", "MongoDB", "SQLite", "Redis", "Cassandra", "DynamoDB", "Supabase", "Firebase", "Prisma", "TypeORM", "Drizzle", "SQLAlchemy",
  "Docker", "Kubernetes", "AWS", "GCP", "Azure", "Vercel", "Netlify", "Cloudflare", "Terraform", "Ansible", "CI/CD", "GitHub Actions", "Linux", "Nginx", "Git", "REST", "gRPC", "Kafka", "RabbitMQ",
  "PyTorch", "TensorFlow", "Keras", "LangChain", "OpenAI", "LLM", "RAG",
];

const PRESERVED_SLASH_COMPOUNDS =
  /^(?:CI\/CD|TCP\/IP|UI\/UX|HTML\/CSS|C\/C\+\+|AI\/ML|ML\/AI|I\/O|HTTP\/HTTPS|REST\/GraphQL|SQL\/NoSQL|OS\/2)$/i;

const SKILL_NOISE_WORDS = /^(?:and|or|the|with|etc|confirm|usage|only)$/i;

function balanceParentheses(token: string): string {
  let out = token.replace(/^[•\-\*\s]+/, "").replace(/[.;,\s]+$/, "").trim();
  // Strip outer enclosing parentheses only if the entire token is wrapped in a single matching pair
  while (out.startsWith("(") && out.endsWith(")")) {
    let depth = 0;
    let wrapsEntire = true;
    for (let i = 0; i < out.length; i++) {
      if (out[i] === "(") depth++;
      else if (out[i] === ")") {
        depth--;
        if (depth === 0 && i < out.length - 1) {
          wrapsEntire = false;
          break;
        }
      }
    }
    if (wrapsEntire && depth === 0) {
      out = out.slice(1, -1).trim();
    } else {
      break;
    }
  }
  // Remove stray unmatched leading/trailing parens or brackets
  const openParens = (out.match(/\(/g) || []).length;
  const closeParens = (out.match(/\)/g) || []).length;
  if (openParens > closeParens) {
    out = out.replace(/^\(+/, "").trim();
  } else if (closeParens > openParens) {
    out = out.replace(/\)+$/, "").trim();
  }
  return out;
}

/**
 * Splits a raw skills line while tracking parenthesis/bracket depth so
 * parenthetical tool lists like "DCIM (Sunbird dcTrack, NetBox)" stay intact
 * and compound slash terms like "CI/CD" are never fragmented.
 */
export function splitSkillList(raw: string): string[] {
  const parts: string[] = [];
  let buf = "";
  let parenDepth = 0;
  let bracketDepth = 0;

  const pushBuf = () => {
    const cleaned = balanceParentheses(buf);
    buf = "";
    if (!cleaned || SKILL_NOISE_WORDS.test(cleaned)) return;
    parts.push(cleaned);
  };

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === "(") {
      parenDepth++;
      buf += ch;
      continue;
    }
    if (ch === ")") {
      if (parenDepth > 0) parenDepth--;
      buf += ch;
      continue;
    }
    if (ch === "[") {
      bracketDepth++;
      buf += ch;
      continue;
    }
    if (ch === "]") {
      if (bracketDepth > 0) bracketDepth--;
      buf += ch;
      continue;
    }

    if (parenDepth === 0 && bracketDepth === 0) {
      if (ch === "," || ch === "•" || ch === "|" || ch === "–" || ch === "—" || ch === ";") {
        pushBuf();
        continue;
      }
      if (ch === "/") {
        // Keep known slash compounds intact (e.g., CI/CD, UI/UX, TCP/IP, C/C++)
        const leftMatch = buf.match(/([A-Za-z0-9+#.-]+)$/);
        const rightMatch = raw.slice(i + 1).match(/^([A-Za-z0-9+#.-]+)/);
        const candidate = `${leftMatch?.[1] ?? ""}/${rightMatch?.[1] ?? ""}`;
        if (PRESERVED_SLASH_COMPOUNDS.test(candidate)) {
          buf += ch;
          continue;
        }
        // Only split on slash when surrounded by spaces or distinct multi-word phrases
        const prevChar = raw[i - 1] ?? "";
        const nextChar = raw[i + 1] ?? "";
        if (prevChar === " " || nextChar === " ") {
          pushBuf();
          continue;
        }
      }
    }

    buf += ch;
  }
  pushBuf();

  return parts;
}

export function joinSummaryUpToLimit(parts: string[], maxLen = 200): string {
  let out = "";
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const candidate = out ? `${out}, ${trimmed}` : trimmed;
    if (candidate.length > maxLen) {
      if (!out) {
        // Single item longer than maxLen: truncate on word boundary
        const cut = trimmed.slice(0, maxLen).replace(/\s+\S*$/, "").trim();
        return cut || trimmed.slice(0, maxLen);
      }
      break;
    }
    out = candidate;
  }
  return out;
}

export function extractTechnologies(text: string, additionalSkills: string[] = []): string[] {
  const found = new Set<string>();

  for (const tech of COMMON_TECH_CATALOG) {
    let regex: RegExp;
    if (tech === "C++") {
      regex = /(?:^|[^\w])C\+\+(?=[^\w]|$)/i;
    } else if (tech === "C#") {
      regex = /(?:^|[^\w])C#(?=[^\w]|$)/i;
    } else if (tech === "Go") {
      regex = /\bGo\b/;
    } else if (tech === "Next.js") {
      regex = /\bNext(?:\.js)?\b/i;
    } else if (tech === "Node.js") {
      regex = /\bNode(?:\.js)?\b/i;
    } else if (tech === "Vue" || tech === "Vue.js") {
      regex = /\bVue(?:\.js)?\b/i;
    } else if (tech === "PostgreSQL" || tech === "Postgres") {
      regex = /\bPostgres(?:QL)?\b/i;
    } else if (tech === "Tailwind CSS" || tech === "Tailwind") {
      regex = /\bTailwind(?:\s*CSS)?\b/i;
    } else if (tech === "GitHub Actions") {
      regex = /\bGitHub\s+Actions\b/i;
    } else if (tech === "CI/CD") {
      regex = /\bCI\/CD\b/i;
    } else {
      const escaped = tech.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      regex = new RegExp(`\\b${escaped}\\b`, "i");
    }

    if (regex.test(text)) {
      found.add(tech);
    }
  }

  for (const skillLine of additionalSkills) {
    const colonIdx = skillLine.indexOf(":");
    const content = colonIdx > 0 && colonIdx < 35 ? skillLine.slice(colonIdx + 1) : skillLine;
    const tokens = splitSkillList(content);
    for (const token of tokens) {
      if (token.length > 1 && token.length < 45 && !/\s{3,}/.test(token)) {
        found.add(token);
      }
    }
  }

  return Array.from(found);
}
