#!/usr/bin/env bash
set -euo pipefail

# Snapshot production database into the dev database.
# Requires pg_dump and pg_restore (installed with PostgreSQL or via Homebrew: brew install libpq).
#
# Usage:
#   PROD_DATABASE_URL="postgresql://..." ./scripts/snapshot-prod-to-dev.sh
#
# PROD_DATABASE_URL must be a DIRECT connection URL (port 5432), not a pooler URL.
# DEV_DATABASE_URL is read from .env.local (the DATABASE_URL value), and is also
# converted to a direct connection URL automatically if it uses the pooler.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# --- Load dev DATABASE_URL from .env.local ---
ENV_FILE="$PROJECT_ROOT/.env.local"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: $ENV_FILE not found. Create it with your dev DATABASE_URL."
  exit 1
fi

DEV_DATABASE_URL=$(grep '^DATABASE_URL=' "$ENV_FILE" | head -1 | cut -d'=' -f2-)
if [[ -z "$DEV_DATABASE_URL" ]]; then
  echo "Error: DATABASE_URL not found in $ENV_FILE"
  exit 1
fi

# --- Validate PROD_DATABASE_URL ---
if [[ -z "${PROD_DATABASE_URL:-}" ]]; then
  echo "Error: PROD_DATABASE_URL environment variable is not set."
  echo ""
  echo "Usage:"
  echo "  PROD_DATABASE_URL=\"postgresql://...direct-connection...\" ./scripts/snapshot-prod-to-dev.sh"
  echo ""
  echo "Get the direct connection URL from your production Supabase project:"
  echo "  Settings > Database > Connection string > URI (select 'Direct connection', port 5432)"
  exit 1
fi

# --- Convert pooler URLs to direct connection URLs ---
# pg_dump/pg_restore require direct connections, not pooled ones.
# Supabase pooler: aws-0-us-west-2.pooler.supabase.com:6543
# Supabase direct: db.<project-ref>.supabase.co:5432
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

PROD_DIRECT=$(convert_to_direct "$PROD_DATABASE_URL")
DEV_DIRECT=$(convert_to_direct "$DEV_DATABASE_URL")

# --- Confirmation ---
echo "=== Prod-to-Dev Database Snapshot ==="
echo ""
echo "  Source (PROD):  $(echo "$PROD_DIRECT" | sed 's|://[^@]*@|://***@|')"
echo "  Target (DEV):   $(echo "$DEV_DIRECT" | sed 's|://[^@]*@|://***@|')"
echo ""
echo "This will WIPE the dev database and replace it with production data."
echo ""
read -rp "Type 'yes' to continue: " confirm
if [[ "$confirm" != "yes" ]]; then
  echo "Aborted."
  exit 0
fi

DUMP_FILE=$(mktemp /tmp/cadences-prod-snapshot.XXXXXX.dump)
trap 'rm -f "$DUMP_FILE"' EXIT

echo ""
echo "[1/3] Dumping production database..."
pg_dump "$PROD_DIRECT" \
  --format=custom \
  --no-owner \
  --no-privileges \
  --no-comments \
  --schema=public \
  --file="$DUMP_FILE"
echo "  Done. Dump size: $(du -h "$DUMP_FILE" | cut -f1)"

echo "[2/3] Wiping dev database (public schema)..."
psql "$DEV_DIRECT" --quiet -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;"

echo "[3/3] Restoring dump into dev database..."
pg_restore \
  -d "$DEV_DIRECT" \
  --no-owner \
  --no-privileges \
  "$DUMP_FILE"

echo ""
echo "Snapshot complete. Dev database now mirrors production data."
echo "You can verify with: npm run db:studio"
