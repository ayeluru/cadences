#!/usr/bin/env bash
set -euo pipefail

# Non-interactive prod-to-dev sync for use in npm run dev.
# Snapshots production data into the dev database and re-applies migrations.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

export PATH="/opt/homebrew/opt/libpq/bin:$PATH"

# --- Check for pg_dump ---
if ! command -v pg_dump &>/dev/null; then
  echo "[sync] Skipping db sync — pg_dump not found (install: brew install libpq)"
  exit 0
fi

# --- Prod connection URL (direct, not pooler) ---
PROD_DATABASE_URL="postgresql://postgres:Arryak0222!!@db.xodqmkmsrsmjrahuegfl.supabase.co:5432/postgres"

# --- Load dev DATABASE_URL from .env.local ---
ENV_FILE="$PROJECT_ROOT/.env.local"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "[sync] Skipping db sync — .env.local not found"
  exit 0
fi

DEV_DATABASE_URL=$(grep '^DATABASE_URL=' "$ENV_FILE" | head -1 | cut -d'=' -f2-)
if [[ -z "$DEV_DATABASE_URL" ]]; then
  echo "[sync] Skipping db sync — DATABASE_URL not found in .env.local"
  exit 0
fi

# --- Convert pooler URL to direct connection URL ---
convert_to_direct() {
  local url="$1"
  if echo "$url" | grep -q "pooler\.supabase\.com"; then
    local project_ref
    project_ref=$(echo "$url" | sed -n 's|.*postgres\.\([^:]*\):.*|\1|p')
    if [[ -z "$project_ref" ]]; then
      echo "Error: Could not extract project ref from pooler URL: $url" >&2
      exit 1
    fi
    echo "$url" | sed \
      -e "s|postgres\.$project_ref|postgres|" \
      -e "s|@[^/]*pooler\.supabase\.com:[0-9]*|@db.$project_ref.supabase.co:5432|"
  else
    echo "$url"
  fi
}

DEV_DIRECT=$(convert_to_direct "$DEV_DATABASE_URL")

echo "[sync] Syncing production data into dev database..."

DUMP_FILE=$(mktemp /tmp/cadences-prod-snapshot.XXXXXX.dump)
trap 'rm -f "$DUMP_FILE"' EXIT

echo "[sync] 1/6 Dumping production database..."
pg_dump "$PROD_DATABASE_URL" \
  --format=custom \
  --no-owner \
  --no-privileges \
  --no-comments \
  --schema=public \
  --file="$DUMP_FILE"

echo "[sync] 2/6 Wiping dev database (public schema)..."
psql "$DEV_DIRECT" --quiet -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;" 2>&1 | grep -v '^NOTICE\|^DETAIL\|^drop cascades' || true

echo "[sync] 3/6 Restoring production data into dev..."
pg_restore \
  -d "$DEV_DIRECT" \
  --no-owner \
  --no-privileges \
  "$DUMP_FILE" 2>&1 | grep -v 'schema "public" already exists\|errors ignored on restore\|Command was:' | sed '/^$/d' || true

echo "[sync] 4/6 Resetting migration tracking..."
psql "$DEV_DIRECT" --quiet -c "DELETE FROM drizzle.__drizzle_migrations WHERE id > 1;" 2>/dev/null || true

echo "[sync] 5/6 Applying migrations..."
(cd "$PROJECT_ROOT" && npm run db:migrate 2>&1) | grep -E '^\[✓\]|applied successfully' || true

echo "[sync] 6/6 Refreshing query planner statistics..."
psql "$DEV_DIRECT" --quiet -c "ANALYZE;" 2>/dev/null || true

echo "[sync] Done — dev database mirrors production."
