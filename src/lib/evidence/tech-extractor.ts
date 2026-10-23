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
    const content = skillLine.includes(":") ? skillLine.split(":")[1] : skillLine;
    const tokens = content.split(/[,•|/–—]/);
    for (let token of tokens) {
      token = token.replace(/^[•\-\*\s]+/, "").trim();
      if (token.length > 1 && token.length < 35 && !/\s{3,}/.test(token) && !/^(and|or|the|with|etc)$/i.test(token)) {
        found.add(token);
      }
    }
  }

  return Array.from(found);
}
