# Multi-stage production Dockerfile for ResumeForge (Next.js standalone)
FROM node:22-alpine AS base

# 1. Install dependencies and copy PDF.js worker asset
FROM base AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma/
COPY scripts/copy-pdf-worker.ts ./scripts/
RUN npm ci

# 2. Generate Prisma Client and build Next.js standalone bundle
FROM base AS builder
WORKDIR /app
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/public/workers ./public/workers
COPY . .

RUN npx prisma generate && npm run build

# 3. Minimal Prisma CLI stage for runtime `migrate deploy` (no devDependencies)
FROM base AS migrator
RUN apk add --no-cache libc6-compat openssl
WORKDIR /migrator
RUN npm install --no-save --omit=dev prisma@6.19.3

# 4. Minimal non-root production runtime runner
FROM base AS runner
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=migrator --chown=nextjs:nodejs /migrator/node_modules /migrator/node_modules

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/login').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["sh", "-c", "node /migrator/node_modules/prisma/build/index.js migrate deploy --schema=/app/prisma/schema.prisma && exec node server.js"]
