# ── Stage 1: deps ────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# ── Stage 2: builder ─────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Minimal build-time env values so Next.js can compile without real secrets
ARG ADMIN_EMAIL=build@example.com
ARG ADMIN_PASSWORD=build-placeholder-long
ARG AUTH_SECRET=build-secret-placeholder-long-random
ARG NEXT_PUBLIC_SITE_URL=https://example.com

ENV ADMIN_EMAIL=$ADMIN_EMAIL
ENV ADMIN_PASSWORD=$ADMIN_PASSWORD
ENV AUTH_SECRET=$AUTH_SECRET
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL

RUN npm run build

# ── Stage 3: runner ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Copy the standalone output produced by next.config.ts (distDir: "dist/.next")
COPY --from=builder --chown=nextjs:nodejs /app/dist/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/dist/.next/static     ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public                ./public

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
