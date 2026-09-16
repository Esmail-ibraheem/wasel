#!/bin/sh
# Container entrypoint: sync the schema, seed what's missing, start Next.js.
set -e

: "${DATABASE_URL:=file:/data/wasel.db}"
export DATABASE_URL

# Make sure the SQLite directory exists (Railway mounts the volume at /data).
case "$DATABASE_URL" in
  file:*) mkdir -p "$(dirname "${DATABASE_URL#file:}")" 2>/dev/null || true ;;
esac

echo "[wasel] syncing database schema ($DATABASE_URL)"
pnpm exec prisma db push --skip-generate

echo "[wasel] seeding wallets / admin"
node_modules/.bin/tsx prisma/seed.ts

echo "[wasel] starting on port ${PORT:-3000}"
exec pnpm exec next start -p "${PORT:-3000}" -H 0.0.0.0
