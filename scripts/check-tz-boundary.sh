#!/usr/bin/env bash
# Bans ad-hoc timezone primitives outside api/_lib/tz.ts.
#
# Rationale: every handler that interprets a YYYY-MM-DD string via parseISO,
# enumerates days with eachDayOfInterval, or formats with formatInTimeZone
# becomes tz-poisoned the moment the server's tz != user's tz. We centralized
# the boundary crossings in api/_lib/tz.ts — keep them there.

set -euo pipefail

cd "$(dirname "$0")/.."

# Patterns to ban in api/ outside _lib/tz.ts.
PATTERNS='parseISO|eachDayOfInterval|formatInTimeZone|toZonedTime|fromZonedTime'

# grep -rE returns 0 when matches found. We want NO matches → invert.
violations=$(grep -rE --include='*.ts' --exclude-dir=node_modules "$PATTERNS" api \
  | grep -v '^api/_lib/tz\.ts:' \
  || true)

if [[ -n "$violations" ]]; then
  echo "✘ Ad-hoc timezone primitives found outside api/_lib/tz.ts:" >&2
  echo "$violations" >&2
  echo >&2
  echo "Use the helpers in api/_lib/tz.ts instead:" >&2
  echo "  parseISO('YYYY-MM-DD')   → parseLocalDateKey(key, tz)" >&2
  echo "  eachDayOfInterval(...)   → localDaysInRange(startKey, endKey)" >&2
  echo "  formatInTimeZone(d, tz)  → formatDateKey(d, tz)" >&2
  echo "  toZonedTime / fromZonedTime → toLocal / toUTC" >&2
  exit 1
fi

echo "✓ No ad-hoc tz primitives outside api/_lib/tz.ts"
