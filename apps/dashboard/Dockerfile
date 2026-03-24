# ── Stage 1: install deps ──────────────────────────────────────────────────────
FROM node:20-slim AS deps
RUN npm install -g pnpm@9 --silent
WORKDIR /app

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

# ── Stage 2: build Next.js ─────────────────────────────────────────────────────
FROM deps AS builder
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY . .

RUN node_modules/.bin/prisma generate --schema packages/db/prisma/schema.prisma
RUN pnpm --filter @voltledger/dashboard build

# ── Stage 3: production image ──────────────────────────────────────────────────
FROM node:20-slim AS runner
RUN npm install -g pnpm@9 --silent
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/db/package.json        ./packages/db/
COPY packages/scoring/package.json   ./packages/scoring/
COPY apps/dashboard/package.json     ./apps/dashboard/
COPY apps/api/package.json           ./apps/api/
COPY apps/ingestion/package.json     ./apps/ingestion/
COPY tools/synthetic-generator/package.json ./tools/synthetic-generator/
COPY tools/bulk-score/package.json   ./tools/bulk-score/
COPY tools/generate-key/package.json ./tools/generate-key/

RUN pnpm install --frozen-lockfile --prod

# Copy built output and generated Prisma client from builder
COPY --from=builder /app/apps/dashboard/.next     ./apps/dashboard/.next
COPY --from=builder /app/apps/dashboard/public    ./apps/dashboard/public
COPY --from=builder /app/packages/db/src          ./packages/db/src
COPY --from=builder /app/packages/db/prisma       ./packages/db/prisma
COPY --from=builder /app/node_modules/.pnpm       ./node_modules/.pnpm

EXPOSE 3000

CMD ["sh", "-c", "cd apps/dashboard && node_modules/.bin/next start -p ${PORT:-3000}"]
