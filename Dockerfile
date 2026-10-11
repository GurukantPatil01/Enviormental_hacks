# Multi-stage production Dockerfile for EcoPulse API
# Target: AWS App Runner / AWS ECS Fargate / Container Registry

# ==============================================================================
# Stage 1: Build & Prune
# ==============================================================================
FROM node:22-alpine AS builder

WORKDIR /app

# Install pnpm via corepack
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy root workspace manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/config/package.json ./packages/config/
COPY packages/types/package.json ./packages/types/
COPY packages/validation/package.json ./packages/validation/

# Install dependencies (frozen lockfile)
RUN pnpm install --frozen-lockfile

# Copy package source directories
COPY packages/config ./packages/config
COPY packages/types ./packages/types
COPY packages/validation ./packages/validation
COPY apps/api ./apps/api

# Compile TypeScript to dist/
RUN pnpm --filter @ecopulse/api build

# ==============================================================================
# Stage 2: Production Runtime
# ==============================================================================
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000
ENV HOST=0.0.0.0

# Install pnpm in runner stage for production dependencies
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/config/package.json ./packages/config/
COPY packages/types/package.json ./packages/types/
COPY packages/validation/package.json ./packages/validation/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy shared source packages needed at runtime
COPY packages/config ./packages/config
COPY packages/types ./packages/types
COPY packages/validation ./packages/validation

# Copy compiled API dist and assets from builder
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY apps/api/uploads ./apps/api/uploads

WORKDIR /app/apps/api

EXPOSE 4000

# Health check against Fastify /health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:4000/health || exit 1

# Start Fastify server (which runs idempotent DB migrations on boot)
CMD ["node", "dist/server.js"]
