# ── Stage 1: install deps ──────────────────────────────────────────────────────
FROM node:20-alpine AS deps
RUN npm install -g pnpm@9 --silent
WORKDIR /app

# Copy manifests first — maximises layer cache
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/db/package.json        ./packages/db/
COPY packages/scoring/package.json   ./packages/scoring/
COPY apps/api/package.json           ./apps/api/
COPY apps/ingestion/package.json     ./apps/ingestion/
COPY apps/dashboard/package.json     ./apps/dashboard/
COPY tools/synthetic-generator/package.json ./tools/synthetic-generator/
COPY tools/bulk-score/package.json   ./tools/bulk-score/
COPY tools/generate-key/package.json ./tools/generate-key/

RUN pnpm install --frozen-lockfile

# ── Stage 2: production image ───────────────────────────────────────────────────
FROM node:20-alpine AS runner
RUN npm install -g pnpm@9 --silent
WORKDIR /app

ENV NODE_ENV=production

# Re-copy manifests + install (prod only)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/db/package.json        ./packages/db/
COPY packages/scoring/package.json   ./packages/scoring/
COPY apps/api/package.json           ./apps/api/
COPY apps/ingestion/package.json     ./apps/ingestion/
COPY apps/dashboard/package.json     ./apps/dashboard/
COPY tools/synthetic-generator/package.json ./tools/synthetic-generator/
COPY tools/bulk-score/package.json   ./tools/bulk-score/
COPY tools/generate-key/package.json ./tools/generate-key/

RUN pnpm install --frozen-lockfile --prod

# Copy source (tsx resolves .ts at runtime — no compile step needed)
COPY packages/db       ./packages/db
COPY packages/scoring  ./packages/scoring
COPY apps/api          ./apps/api

# Generate Prisma client
RUN node_modules/.bin/prisma generate --schema packages/db/prisma/schema.prisma

# Railway injects PORT; we read API_PORT in index.ts
EXPOSE 3001

# Apply any pending DB migrations then start the API
CMD ["sh", "-c", \
  "node_modules/.bin/prisma migrate deploy --schema packages/db/prisma/schema.prisma && \
   node_modules/.bin/tsx apps/api/src/index.ts"]
