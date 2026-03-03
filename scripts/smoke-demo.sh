#!/usr/bin/env bash
PORT="${1:-3100}"
BASE="http://localhost:${PORT}"
PASS=0; FAIL=0; ERRORS=()

check() {
  local name="$1" url="$2" marker="$3"
  local body http_code
  body=$(curl -s -w "\n__CODE__:%{http_code}" --max-time 10 "${url}" 2>/dev/null)
  http_code=$(echo "$body" | grep -o '__CODE__:[0-9]*' | cut -d: -f2)
  body=$(echo "$body" | sed '/__CODE__:/d')
  if [ "${http_code}" != "200" ]; then
    echo "  ✗ [${name}] HTTP ${http_code}"; ERRORS+=("${name}: HTTP ${http_code}"); ((FAIL++)); return
  fi
  if echo "$body" | grep -q "${marker}"; then
    echo "  ✓ [${name}] 200 + marker OK"; ((PASS++))
  else
    echo "  ✗ [${name}] marker absent: ${marker}"; ERRORS+=("${name}: marker absent"); ((FAIL++))
  fi
}

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  INTERLIGENS Smoke Demo (port ${PORT})"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

check "1 /en/demo?mock=red"        "${BASE}/en/demo?mock=red"                                                                   "INTERLIGENS"
check "2 /fr/demo?mock=red"        "${BASE}/fr/demo?mock=red"                                                                   "INTERLIGENS"
check "3 /en/demo?addr=BOTIFY"     "${BASE}/en/demo?addr=BYZ9CcZGKAXmN2uDsKcQMM9UnZacja4vWcns9Th69xb&auto=1"                   "INTERLIGENS"
check "4 /en/demo?addr=pump"       "${BASE}/en/demo?addr=a3W4qutoEJA4232T2gwZUfgYJTetr96pU4SJMwppump&auto=1"                    "INTERLIGENS"
check "5 /en/demo?addr=bsc"        "${BASE}/en/demo?addr=bsc%3A0x0000000000000000000000000000000000000000&auto=1"               "bsc:0x"
check "6 api mock red"             "${BASE}/api/mock/scan?mode=red"                                                             '"score":100'
check "7 api mock green"           "${BASE}/api/mock/scan?mode=green"                                                           '"tier":"GREEN"'
check "8 api scan/bsc demo-stable" "${BASE}/api/scan/bsc?address=0x0000000000000000000000000000000000000000"                    '"chain":"bsc"'

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  $((PASS))/$((PASS+FAIL)) passed"
if [ ${FAIL} -gt 0 ]; then
  for e in "${ERRORS[@]}"; do echo "  ✗ ${e}"; done
  echo "  RESULT: ✗ FAIL"; exit 1
else
  echo "  RESULT: ✓ ALL PASS"
fi
