# Multi-stage production Dockerfile for ResumeForge
FROM node:22-alpine AS base

# 1. Install dependencies
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma/
COPY scripts/copy-pdf-worker.ts ./scripts/
RUN npm ci

# 2. Build the Next.js application
FROM base AS builder
WORKDIR /app
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/public/workers ./public/workers
COPY . .

# Generate Prisma Client & compile Next.js standalone build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npx prisma generate
RUN npm run build

# 3. Production runtime runner
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy static assets and compiled output
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/.next ./.next

USER nextjs

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]
