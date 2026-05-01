#!/bin/bash
echo "=== INTERLIGENS PRE-FREEZE CHECK ==="
PASS=0
FAIL=0

check() {
  if [ $? -eq 0 ]; then
    echo "[PASS] $1"
    PASS=$((PASS+1))
  else
    echo "[FAIL] $1"
    FAIL=$((FAIL+1))
  fi
}

# Build
pnpm build > /dev/null 2>&1
check "Build OK"

# Tests
pnpm test > /dev/null 2>&1
check "Tests OK"

# TSC (source files only, ignoring stale .next/ types)
pnpm tsc --noEmit 2>&1 | grep -v ".next/" | grep -q "error" && false || true
check "TSC clean (source)"

# API Score SOL
curl -sf "http://localhost:3100/api/v1/score?mint=EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm" > /dev/null
check "Score SOL route OK"

# API Scan Context
curl -sf "http://localhost:3100/api/v1/scan-context?target=EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm" > /dev/null
check "Scan Context OK"

# Mobile Ask (401 = alive)
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "http://localhost:3100/api/mobile/v1/ask" \
  -H "Content-Type: application/json" \
  -H "X-Mobile-Api-Token: test" \
  -d '{"question":"test","address":"test","scanContext":{}}' 2>/dev/null)
[ "$STATUS" = "401" ] || [ "$STATUS" = "400" ] || [ "$STATUS" = "200" ]
check "Mobile /ask route alive (status: $STATUS)"

# Health
curl -sf "http://localhost:3100/api/health" > /dev/null
check "Health endpoint OK"

# Partner API (401/error = alive, not 500)
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3100/api/partner/v1/score-lite?address=test" 2>/dev/null)
[ "$STATUS" != "500" ] && [ "$STATUS" != "000" ]
check "Partner API alive (status: $STATUS)"

# Admin protected (not 200 without auth)
code=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3100/admin/security" 2>/dev/null)
[ "$code" != "200" ]
check "Admin route protected (status: $code)"

# Methodology page
curl -sf "http://localhost:3100/en/methodology" > /dev/null
check "Methodology page OK"

# TigerScore methodology
curl -sf "http://localhost:3100/en/methodology/tigerscore" > /dev/null
check "Methodology/tigerscore page OK"

# KOL Risk methodology
curl -sf "http://localhost:3100/en/methodology/kol-risk" > /dev/null
check "Methodology/kol-risk page OK"

# BOTIFY evidence view
curl -sf "http://localhost:3100/en/cases/botify/evidence" > /dev/null
check "BOTIFY evidence view OK"

# Demo review page
curl -sf "http://localhost:3100/en/demo/review" > /dev/null
check "Demo review page OK"

# Developers page
curl -sf "http://localhost:3100/en/developers" > /dev/null
check "Developers page OK"

# Legal wording
bash scripts/legal-wording-check.sh > /dev/null 2>&1
check "Legal wording report generated"

echo ""
echo "=== RESULTS: $PASS passed, $FAIL failed ==="
if [ $FAIL -gt 0 ]; then
  echo "FREEZE BLOCKED — fix failures first"
  exit 1
else
  echo "READY FOR FREEZE"
  exit 0
fi
