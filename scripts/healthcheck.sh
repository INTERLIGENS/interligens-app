#!/usr/bin/env bash
# scripts/healthcheck.sh — INTERLIGENS endpoint health check
# Usage:
#   bash scripts/healthcheck.sh                          # against production
#   bash scripts/healthcheck.sh http://localhost:3100    # against local dev
#   BASIC_AUTH="user:pass" bash scripts/healthcheck.sh  # with Basic auth
# Default BASE_URL: https://app.interligens.com
# Note: production may require Basic auth — set BASIC_AUTH="user:pass" env var

set -euo pipefail

BASE="${1:-https://app.interligens.com}"
PASS=0
FAIL=0

check() {
  local name="$1"
  local url="$2"
  local method="${3:-GET}"
  local accept="${4:-200}"   # "200" or "200|401" or "401|500" etc.

  local start
  start=$(date +%s%N 2>/dev/null || date +%s)

  local code
  local auth_arg=""
  [ -n "${BASIC_AUTH:-}" ] && auth_arg="-u ${BASIC_AUTH}"

  if [ "$method" = "POST" ]; then
    code=$(curl -s -L -o /dev/null -w "%{http_code}" -X POST \
      $auth_arg \
      -H "Content-Type: application/json" \
      -d '{}' \
      --max-time 10 \
      "$url" 2>/dev/null || echo "000")
  else
    code=$(curl -s -L -o /dev/null -w "%{http_code}" \
      $auth_arg \
      --max-time 10 \
      "$url" 2>/dev/null || echo "000")
  fi

  local end
  end=$(date +%s%N 2>/dev/null || date +%s)
  local ms=$(( (end - start) / 1000000 ))

  if echo "$accept" | grep -q "$code"; then
    printf "  \033[32m✓\033[0m  %-45s  %s  %dms\n" "$name" "$code" "$ms"
    PASS=$((PASS + 1))
  else
    printf "  \033[31m✗\033[0m  %-45s  %s (expected %s)  %dms\n" "$name" "$code" "$accept" "$ms"
    FAIL=$((FAIL + 1))
  fi
}

echo ""
echo "  INTERLIGENS HEALTHCHECK — $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo "  Base: $BASE"
echo "  ─────────────────────────────────────────────────────────"

check "Homepage"                    "$BASE"                                                                             GET "200"
check "Score API (WIF)"             "$BASE/api/v1/score?mint=EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm"           GET "200|400"
check "Scan context API"            "$BASE/api/v1/scan-context?target=EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm"  GET "200"
check "Partner API (no-key → 401)" "$BASE/api/partner/v1/score-lite?address=EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm" GET "401"
check "Demo page EN"                "$BASE/en/demo"                                                                    GET "200"
check "Data room"                   "https://data.interligens.com"                                                     GET "200"
check "Mobile API (no-token → 401)" "$BASE/api/mobile/v1/scan"                                                        POST "401"
check "Wallet scan page"            "$BASE/en/wallet-scan"                                                             GET "200"
check "Jupiter safe swap page"      "$BASE/en/jupiter"                                                                 GET "200"
check "Watcher V2 cron (guard)"     "$BASE/api/cron/watcher-v2"                                                        GET "401|500"

echo "  ─────────────────────────────────────────────────────────"
echo "  Result: $PASS passed, $FAIL failed"
echo ""

[ "$FAIL" -eq 0 ] && exit 0 || exit 1
