# ── Stage 1: install deps + build Next.js ─────────────────────────────────────
FROM node:20-slim AS builder
RUN npm install -g pnpm@9 --silent
WORKDIR /app

# Copy manifests for layer caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/mock-los/package.json ./apps/mock-los/

# Install ALL deps (NODE_ENV must NOT be production here — pnpm skips devDeps otherwise)
RUN pnpm install --frozen-lockfile

# Copy source
COPY . .

RUN NEXT_TELEMETRY_DISABLED=1 pnpm --filter @voltledger/mock-los build

# ── Stage 2: production image ──────────────────────────────────────────────────
FROM node:20-slim AS runner
RUN npm install -g pnpm@9 --silent
WORKDIR /app

COPY --from=builder /app .

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

EXPOSE 3003

CMD ["sh", "-c", "cd apps/mock-los && node_modules/.bin/next start -p ${PORT:-3003}"]
