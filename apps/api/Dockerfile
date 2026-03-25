# ── Stage 1: install all deps + generate Prisma ───────────────────────────────
FROM node:20-slim AS builder
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm@9 --silent
WORKDIR /app

# Copy manifests for layer caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/db/package.json        ./packages/db/
COPY packages/scoring/package.json   ./packages/scoring/
COPY apps/api/package.json           ./apps/api/
COPY apps/ingestion/package.json     ./apps/ingestion/
COPY apps/dashboard/package.json     ./apps/dashboard/
COPY tools/synthetic-generator/package.json ./tools/synthetic-generator/
COPY tools/bulk-score/package.json   ./tools/bulk-score/
COPY tools/generate-key/package.json ./tools/generate-key/

# Install ALL deps (no NODE_ENV=production here — that would skip devDeps)
RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/db       ./packages/db
COPY packages/scoring  ./packages/scoring
COPY apps/api          ./apps/api

# Generate Prisma client (node:20-slim uses glibc — native target works fine)
RUN node_modules/.bin/prisma generate --schema packages/db/prisma/schema.prisma

# ── Stage 2: production image ──────────────────────────────────────────────────
FROM node:20-slim AS runner
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm@9 --silent
WORKDIR /app

# Copy everything from builder — node_modules, source, generated Prisma client
COPY --from=builder /app .

# Set NODE_ENV AFTER install (setting it before causes pnpm to skip devDeps)
ENV NODE_ENV=production

EXPOSE 3001

CMD ["sh", "-c", \
  "(node_modules/.bin/prisma migrate deploy --schema packages/db/prisma/schema.prisma 2>&1 || echo '⚠️  migrate deploy had warnings — continuing') && \
   node_modules/.bin/tsx apps/api/src/index.ts"]
