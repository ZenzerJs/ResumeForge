import React from "react";
import {
  siAngular,
  siAnthropic,
  siApachekafka,
  siApachespark,
  siApple,
  siAtlassian,
  siBun,
  siCloudflare,
  siCodemirror,
  siCoinbase,
  siCplusplus,
  siCss,
  siCypress,
  siDatabricks,
  siDatadog,
  siDeno,
  siDjango,
  siDocker,
  siElastic,
  siExpress,
  siFastapi,
  siFigma,
  siFirebase,
  siFlask,
  siGit,
  siGithub,
  siGitlab,
  siGo,
  siGoogle,
  siGooglegemini,
  siGraphql,
  siHtml5,
  siHubspot,
  siHuggingface,
  siJavascript,
  siJest,
  siJupyter,
  siKeras,
  siKotlin,
  siKubernetes,
  siLangchain,
  siLinear,
  siLinux,
  siMeta,
  siMlflow,
  siMongodb,
  siMysql,
  siNestjs,
  siNetflix,
  siNextdotjs,
  siNginx,
  siNodedotjs,
  siNotion,
  siNumpy,
  siNvidia,
  siOllama,
  siOnnx,
  siOpencv,
  siOpenjdk,
  siPandas,
  siPnpm,
  siPostgresql,
  siPrisma,
  siPython,
  siPytorch,
  siRay,
  siReact,
  siRedis,
  siRedux,
  siRuby,
  siRust,
  siScikitlearn,
  siSentry,
  siShopify,
  siSnowflake,
  siSpotify,
  siSpringboot,
  siSqlite,
  siStripe,
  siSupabase,
  siSvelte,
  siSwift,
  siTailwindcss,
  siTensorflow,
  siTerraform,
  siTrpc,
  siTypescript,
  siTypst,
  siUber,
  siVercel,
  siVite,
  siVitest,
  siVuedotjs,
  siWeightsandbiases,
  siZod,
  type SimpleIcon,
} from "simple-icons";
import { cn } from "@/lib/utils";

const BRAND_ICONS: Record<string, SimpleIcon> = {
  // Tech / stack / ML / Evidence Bank
  angular: siAngular,
  apachekafka: siApachekafka,
  apachespark: siApachespark,
  bun: siBun,
  codemirror: siCodemirror,
  cplusplus: siCplusplus,
  css: siCss,
  cypress: siCypress,
  deno: siDeno,
  django: siDjango,
  docker: siDocker,
  express: siExpress,
  fastapi: siFastapi,
  firebase: siFirebase,
  flask: siFlask,
  git: siGit,
  go: siGo,
  graphql: siGraphql,
  html5: siHtml5,
  huggingface: siHuggingface,
  javascript: siJavascript,
  jest: siJest,
  jupyter: siJupyter,
  keras: siKeras,
  kotlin: siKotlin,
  kubernetes: siKubernetes,
  langchain: siLangchain,
  linux: siLinux,
  mlflow: siMlflow,
  mysql: siMysql,
  nestjs: siNestjs,
  nextdotjs: siNextdotjs,
  nginx: siNginx,
  nodedotjs: siNodedotjs,
  numpy: siNumpy,
  onnx: siOnnx,
  opencv: siOpencv,
  openjdk: siOpenjdk,
  pandas: siPandas,
  pnpm: siPnpm,
  postgresql: siPostgresql,
  prisma: siPrisma,
  python: siPython,
  pytorch: siPytorch,
  ray: siRay,
  react: siReact,
  redis: siRedis,
  redux: siRedux,
  ruby: siRuby,
  rust: siRust,
  scikitlearn: siScikitlearn,
  sentry: siSentry,
  snowflake: siSnowflake,
  springboot: siSpringboot,
  sqlite: siSqlite,
  supabase: siSupabase,
  svelte: siSvelte,
  swift: siSwift,
  tailwindcss: siTailwindcss,
  tensorflow: siTensorflow,
  terraform: siTerraform,
  trpc: siTrpc,
  typescript: siTypescript,
  typst: siTypst,
  vite: siVite,
  vitest: siVitest,
  vuedotjs: siVuedotjs,
  weightsandbiases: siWeightsandbiases,
  zod: siZod,

  // AI providers & companies
  anthropic: siAnthropic,
  apple: siApple,
  atlassian: siAtlassian,
  cloudflare: siCloudflare,
  coinbase: siCoinbase,
  databricks: siDatabricks,
  datadog: siDatadog,
  elastic: siElastic,
  figma: siFigma,
  github: siGithub,
  gitlab: siGitlab,
  google: siGoogle,
  googlegemini: siGooglegemini,
  hubspot: siHubspot,
  linear: siLinear,
  meta: siMeta,
  mongodb: siMongodb,
  netflix: siNetflix,
  notion: siNotion,
  nvidia: siNvidia,
  ollama: siOllama,
  shopify: siShopify,
  spotify: siSpotify,
  stripe: siStripe,
  uber: siUber,
  vercel: siVercel,
};

const BRAND_ALIASES: Record<string, string> = {
  golang: "go",
  postgres: "postgresql",
  kafka: "apachekafka",
  apachekafka: "apachekafka",
  spark: "apachespark",
  "apache spark": "apachespark",
  ts: "typescript",
  js: "javascript",
  reactjs: "react",
  "react.js": "react",
  nextjs: "nextdotjs",
  "next.js": "nextdotjs",
  k8s: "kubernetes",
  tailwind: "tailwindcss",
  "tailwind css": "tailwindcss",
  "c++": "cplusplus",
  cpp: "cplusplus",
  node: "nodedotjs",
  nodejs: "nodedotjs",
  "node.js": "nodedotjs",
  "py-torch": "pytorch",
  tf: "tensorflow",
  "scikit-learn": "scikitlearn",
  sklearn: "scikitlearn",
  sqlite3: "sqlite",
  html: "html5",
  css3: "css",
  expressjs: "express",
  "express.js": "express",
  "nest.js": "nestjs",
  "spring boot": "springboot",
  spring: "springboot",
  "hugging face": "huggingface",
  sveltekit: "svelte",
  vue: "vuedotjs",
  vuejs: "vuedotjs",
  "vue.js": "vuedotjs",
  angularjs: "angular",
  java: "openjdk",
  wandb: "weightsandbiases",
  "weights & biases": "weightsandbiases",
  "weights and biases": "weightsandbiases",
  gemini: "googlegemini",
  "google gemini": "googlegemini",
  claude: "anthropic",
  mongo: "mongodb",
  elasticsearch: "elastic",
  facebook: "meta",
};

const CORP_SUFFIX_RE = /,?\s+\b(?:inc|llc|ltd|corp|corporation|co)\.?$/i;

function resolveBrandKey(name?: string | null): string | null {
  if (!name) return null;
  const trimmed = name.trim().toLowerCase();
  if (!trimmed) return null;

  const direct = BRAND_ALIASES[trimmed] ?? trimmed;
  if (direct in BRAND_ICONS) return direct;

  const stripped = trimmed.replace(CORP_SUFFIX_RE, "").trim();
  const strippedAlias = BRAND_ALIASES[stripped] ?? stripped;
  if (strippedAlias in BRAND_ICONS) return strippedAlias;

  const compact = stripped.replace(/[\s._-]+/g, "");
  const compactAlias = BRAND_ALIASES[compact] ?? compact;
  if (compactAlias in BRAND_ICONS) return compactAlias;

  return null;
}

export const SUPPORTED_BRAND_ICON_SLUGS = Object.keys(BRAND_ICONS);

export function hasBrandIcon(name?: string | null): boolean {
  return resolveBrandKey(name) !== null;
}

export interface BrandIconProps extends Omit<React.SVGProps<SVGSVGElement>, "name"> {
  name?: string | null;
}

export function BrandIcon({ name, className, ...props }: BrandIconProps) {
  const key = resolveBrandKey(name);
  if (!key) return null;
  const icon = BRAND_ICONS[key];

  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={cn("h-3.5 w-3.5 shrink-0", className)}
      {...props}
    >
      <path d={icon.path} />
    </svg>
  );
}
