# Wasel — production image (Railway / any Docker host)
# Debian-based so Prisma's default engines run without extra binary targets.

FROM node:20-bookworm-slim AS base
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && npm install -g pnpm@9.15.4
WORKDIR /app

# ---- dependencies (postinstall runs `prisma generate`, so the schema is needed here)
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
COPY prisma/schema.prisma ./prisma/schema.prisma
RUN pnpm install --frozen-lockfile

# ---- build
FROM deps AS build
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# ---- runtime
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="file:/data/wasel.db"
COPY --from=build /app ./
RUN mkdir -p /data && chown -R node:node /data /app
USER node
EXPOSE 3000
CMD ["sh", "scripts/start.sh"]
