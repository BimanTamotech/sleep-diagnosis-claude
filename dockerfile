# =============================================================================
# Stage 1: Build
# =============================================================================
FROM node:20-slim AS builder

WORKDIR /app

# Install OpenSSL (required by Prisma)
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# Install dependencies (including dev for build)
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm ci

# Copy rest of source code
COPY . .
RUN npx prisma generate

# Build Next.js — placeholder only; webpack is configured not to inline so runtime uses compose env
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="postgresql://local:local@localhost:5432/sleep_diagnosis?schema=public"
ENV DATABASE_URL_UNPOOLED="postgresql://local:local@localhost:5432/sleep_diagnosis?schema=public"
RUN npm run build

# =============================================================================
# Stage 2: Production
# =============================================================================
FROM node:20-slim AS runner

WORKDIR /app

# OpenSSL required by Prisma
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Copy prisma first so postinstall prisma generate can find schema
COPY package.json package-lock.json* ./
COPY --from=builder /app/prisma ./prisma

# Production dependencies (postinstall runs prisma generate)
RUN npm ci --omit=dev

# Copy build output and runtime files from builder
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.js ./

EXPOSE 3000

# Sync DB schema on startup then start Next (use db push when no migrations)
CMD ["sh", "-c", "npx prisma db push && node node_modules/next/dist/bin/next start"]
