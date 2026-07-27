# syntax=docker/dockerfile:1
# check=skip=SecretsUsedInArgOrEnv

# Base image matching Railway/Nixpacks Ubuntu runtime with Node 22
FROM node:22-bookworm-slim AS base

WORKDIR /app

# Install system dependencies for Chromium / Playwright / Scraping
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libgbm1 \
    libasound2 \
    libpangocairo-1.0-0 \
    libxss1 \
    libgtk-3-0 \
    libxshmfence1 \
    libglu1-mesa \
    ca-certificates \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

# Stage 1: Install dependencies
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

# Stage 2: Build Next.js application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Ensure stale app/ directory is removed before building Next.js routes
RUN rm -rf app || true

# Next.js build-time public arguments (NEXT_PUBLIC_*)
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_DAILY_DOMAIN
ARG NEXT_PUBLIC_FACEBOOK_APP_ID
ARG NEXT_PUBLIC_GEMINI_API_KEY
ARG NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
ARG NEXT_PUBLIC_ROLLBAR_ALPHACLONE_NEXTJS_2_CLIENT_TOKEN_1773991523
ARG NEXT_PUBLIC_SENTRY_DSN
ARG NEXT_PUBLIC_STRIPE_PUBLIC_KEY
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_TURNSTILE_ALLOWED_HOSTS
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY
ARG NEXT_TELEMETRY_DISABLED=1

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV SERWIST_SUPPRESS_TURBOPACK_WARNING=1
ENV NODE_OPTIONS="--max-old-space-size=6144"

RUN npm run build

# Stage 3: Production Runner
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/next.config.ts ./next.config.ts

EXPOSE 3000

CMD ["node_modules/.bin/next", "start", "-H", "0.0.0.0", "-p", "3000"]
