# =============================================================================
# Dockerfile — onetone-store (Next.js)
# Multi-stage build untuk image sekecil mungkin
# Letakkan file ini di ROOT repo onetone-store
# =============================================================================

# ── Stage 1: Build stage ────────────────────────────────────────────
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts

# ── Stage 2: Build aplikasi ───────────────────────────────────────────────────
FROM node:20-alpine AS build-stage
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY . .

# Build Next.js (butuh output: standalone di next.config.js)
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ── Stage 3: Production image (sekecil mungkin) ───────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Buat user non-root untuk keamanan
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy hasil build standalone
COPY --from=build-stage /app/public ./public
COPY --from=build-stage --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build-stage --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]