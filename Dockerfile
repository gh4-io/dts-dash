# ============================================================
# DTSD Dashboard — Unified Dockerfile
# ============================================================
# Multi-stage build with two targets:
#   prod (default) — Minimal Next.js standalone image for production
#   dev            — Hot-reload dev server (source bind-mounted)
#
# Usage:
#   docker build -t dtsd .                    # prod (default)
#   docker build --target dev -t dtsd:dev .   # dev
#
# Stages:
#   base      → Alpine + native build tools (shared)
#   deps      → npm ci (all dependencies)
#   builder   → Next.js production build
#   prod-deps → npm ci --omit=dev
#   prod      → Lean production runner (DEFAULT)
#   dev       → Development runner with hot reload
# ============================================================

# ─── Build args for OCI labels ──────────────────────────────
ARG GIT_SHA=unknown
ARG BUILD_DATE=unknown
ARG VERSION=0.1.0

# ─── Shared base: Alpine + native build tools ───────────────
FROM node:20-alpine AS base

WORKDIR /app

# better-sqlite3 requires native compilation toolchain
RUN apk add --no-cache python3 make g++

# ─── Stage 1: Install all dependencies (dev + prod) ─────────
FROM base AS deps

COPY package.json package-lock.json* ./
RUN npm ci

# ─── Stage 2: Build the Next.js standalone app ──────────────
FROM base AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Skip database bootstrap during build (instrumentation.ts checks this)
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PHASE=phase-production-build

RUN npm run build

# ─── Stage 3: Production-only node_modules ───────────────────
FROM base AS prod-deps

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# ============================================================
# TARGET: prod (DEFAULT)
# Lean image with standalone output + db script support
# ============================================================
FROM node:20-alpine AS prod

WORKDIR /app

# Install build tools for native addon rebuild, create non-root user
RUN apk add --no-cache python3 make g++ && \
    addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# ── Next.js standalone output (server entrypoint) ────────────
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# ── Production node_modules (for db scripts + native addons) ─
# Standalone bundles its own deps, but db:* scripts need
# drizzle-orm, bcryptjs, pino, js-yaml, better-sqlite3, tsx, etc.
COPY --from=prod-deps --chown=nextjs:nodejs /app/node_modules ./node_modules

# Rebuild better-sqlite3 native addon for this Alpine environment
RUN cd /app/node_modules/better-sqlite3 && \
    npm rebuild better-sqlite3 --build-from-source 2>/dev/null || true

# Remove build tools now that native addon is compiled
RUN apk del python3 make g++

# ── Source files needed by db scripts ─────────────────────────
# Scripts reference src/lib/db/, src/lib/config/, src/lib/utils/, etc.
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
COPY --from=builder --chown=nextjs:nodejs /app/src/lib ./src/lib
COPY --from=builder --chown=nextjs:nodejs /app/src/types ./src/types
COPY --from=builder --chown=nextjs:nodejs /app/tsconfig.json ./tsconfig.json
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json

# ── Seed data (JSON files for db:seed / db:reset --seed) ─────
COPY --from=builder --chown=nextjs:nodejs /app/data/seed ./data/seed

# ── Fallback config (volume mount overrides at runtime) ───────
COPY --from=builder --chown=nextjs:nodejs /app/server.config.dev.yml ./server.config.yml

# ── Data + logs directories (mounted as volumes in production) ─
RUN mkdir -p /app/data /app/logs && \
    chown -R nextjs:nodejs /app/data /app/logs

# ── OCI labels ────────────────────────────────────────────────
LABEL org.opencontainers.image.title="DTSD Dashboard" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${GIT_SHA}" \
      org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.source="https://github.com/gh4-io/dts-dash"

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]

# ============================================================
# TARGET: dev
# Hot-reload dev server — source bind-mounted via compose
# ============================================================
FROM base AS dev

WORKDIR /app

# Full node_modules (including devDependencies)
COPY --from=deps /app/node_modules ./node_modules

# Project config files (source dirs bind-mounted at runtime)
COPY package.json package-lock.json* ./
COPY next.config.ts tsconfig.json ./
COPY server.config.dev.yml ./server.config.yml

EXPOSE 3000

CMD ["npm", "run", "dev"]
