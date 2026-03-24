# ── Stage 1: install deps + build Next.js ─────────────────────────────────────
FROM node:20-slim AS builder
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

# Install ALL deps (NODE_ENV must NOT be production here — pnpm skips devDeps otherwise)
RUN pnpm install --frozen-lockfile

# Copy source
COPY . .

# Generate Prisma client then build Next.js
RUN node_modules/.bin/prisma generate --schema packages/db/prisma/schema.prisma
RUN NEXT_TELEMETRY_DISABLED=1 pnpm --filter @voltledger/dashboard build

# ── Stage 2: production image ──────────────────────────────────────────────────
FROM node:20-slim AS runner
RUN npm install -g pnpm@9 --silent
WORKDIR /app

# Copy everything from builder
COPY --from=builder /app .

# Set NODE_ENV AFTER install
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

EXPOSE 3000

CMD ["sh", "-c", "cd apps/dashboard && node_modules/.bin/next start -p ${PORT:-3000}"]
