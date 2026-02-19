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
#   base         → Alpine + native build tools (build stages only)
#   deps         → npm ci (all dependencies)
#   builder      → Next.js production build + standalone cleanup
#   native-build → Compiles better-sqlite3 for Alpine musl
#   script-deps  → Minimal packages for db:* scripts
#   dev          → Development runner with hot reload
#   prod         → Lean production runner (DEFAULT — last stage)
# ============================================================

# ─── Build args for OCI labels ──────────────────────────────
ARG GIT_SHA=unknown
ARG BUILD_DATE=unknown
ARG VERSION=0.1.0

# ─── Shared base: Alpine + native build tools ───────────────
# Used by build stages only — never used as the final image
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

# Build and prune standalone node_modules of build-time-only packages
RUN npm run build && \
    # typescript (19 MB) — only used by next build/cli, not by node server.js
    rm -rf .next/standalone/node_modules/typescript && \
    # better-sqlite3 C/C++ sources (~10 MB) — compiled binary provided by native-build
    rm -rf .next/standalone/node_modules/better-sqlite3/deps \
           .next/standalone/node_modules/better-sqlite3/src

# ─── Stage 3: Compile better-sqlite3 native addon ───────────
# Builds the .node binary for Alpine musl; only the binary is
# extracted into the prod stage — build tools never touch prod.
FROM base AS native-build

WORKDIR /app

COPY --from=deps /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3
COPY --from=deps /app/node_modules/bindings ./node_modules/bindings
COPY --from=deps /app/node_modules/file-uri-to-path ./node_modules/file-uri-to-path
COPY package.json ./
RUN npm rebuild better-sqlite3 --build-from-source

# ─── Stage 4: Minimal dependencies for db:* scripts ─────────
# Standalone bundles most runtime deps. These are the packages
# that db scripts need which are NOT in standalone output.
# Versions pinned to match package.json — update together.
FROM base AS script-deps

WORKDIR /app

RUN printf '{"dependencies":{"drizzle-orm":"0.45.1","tsx":"4.21.0","bcryptjs":"3.0.3","js-yaml":"4.1.1","nanoid":"5.1.6"}}' > package.json && \
    npm install --ignore-scripts

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

# ============================================================
# TARGET: prod (DEFAULT — last stage)
# Lean image: no build tools, standalone + targeted overlays
# ============================================================
FROM node:20-alpine AS prod

WORKDIR /app

# Non-root user — no build tools needed in this stage
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# ── Next.js standalone output (selective — skip node_modules) ─
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone/server.js ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone/package.json ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone/.next ./.next

# ── Static assets ─────────────────────────────────────────────
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# ── Standalone's pruned node_modules (base runtime deps) ──────
# Contains: next, react, react-dom, pino, node-cron, @img/sharp,
# better-sqlite3 (JS only), and other bundled deps (~53 MB)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone/node_modules ./node_modules

# ── Overlay: rebuilt better-sqlite3 native binary ─────────────
# Replaces the binary compiled during deps (wrong platform) with
# one compiled for Alpine musl in the native-build stage
# Only copy the compiled .node binary (2.2 MB), not intermediate build artifacts (17 MB)
COPY --from=native-build --chown=nextjs:nodejs /app/node_modules/better-sqlite3/build/Release/better_sqlite3.node ./node_modules/better-sqlite3/build/Release/better_sqlite3.node

# ── Overlay: db script dependencies ───────────────────────────
# These packages are NOT in standalone output but required by
# tsx scripts/db/*.ts (drizzle-orm, tsx/esbuild, bcryptjs, etc.)
COPY --from=script-deps --chown=nextjs:nodejs /app/node_modules/drizzle-orm ./node_modules/drizzle-orm
COPY --from=script-deps --chown=nextjs:nodejs /app/node_modules/bcryptjs ./node_modules/bcryptjs
COPY --from=script-deps --chown=nextjs:nodejs /app/node_modules/js-yaml ./node_modules/js-yaml
COPY --from=script-deps --chown=nextjs:nodejs /app/node_modules/argparse ./node_modules/argparse
COPY --from=script-deps --chown=nextjs:nodejs /app/node_modules/nanoid ./node_modules/nanoid
COPY --from=script-deps --chown=nextjs:nodejs /app/node_modules/tsx ./node_modules/tsx
COPY --from=script-deps --chown=nextjs:nodejs /app/node_modules/esbuild ./node_modules/esbuild
COPY --from=script-deps --chown=nextjs:nodejs /app/node_modules/@esbuild ./node_modules/@esbuild
COPY --from=script-deps --chown=nextjs:nodejs /app/node_modules/get-tsconfig ./node_modules/get-tsconfig
COPY --from=script-deps --chown=nextjs:nodejs /app/node_modules/resolve-pkg-maps ./node_modules/resolve-pkg-maps

# Create tsx binary symlink (npm install normally creates this)
RUN mkdir -p node_modules/.bin && \
    ln -s ../tsx/dist/cli.mjs node_modules/.bin/tsx

# ── Source files needed by db scripts ─────────────────────────
# Scripts reference src/lib/db/, src/lib/config/, src/lib/utils/, etc.
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
COPY --from=builder --chown=nextjs:nodejs /app/src/lib ./src/lib
COPY --from=builder --chown=nextjs:nodejs /app/src/types ./src/types
COPY --from=builder --chown=nextjs:nodejs /app/tsconfig.json ./tsconfig.json

# ── Seed data (JSON files for db:seed / db:reset --seed) ─────
COPY --from=builder --chown=nextjs:nodejs /app/data/seed ./data/seed

# ── Data + logs directories (mounted as volumes in production) ─
RUN mkdir -p /app/data /app/logs && \
    chown -R nextjs:nodejs /app/data /app/logs

# ── OCI labels ────────────────────────────────────────────────
ARG GIT_SHA=unknown
ARG BUILD_DATE=unknown
ARG VERSION=0.1.0
LABEL org.opencontainers.image.title="DTS Dashboard" \
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
