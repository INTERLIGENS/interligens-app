# QA Validation — INTERLIGENS

## Start server
```bash
PORT=3100 pnpm dev
```

## Variables
```bash
BASE="http://localhost:3100"
```

## 1) Unit tests
```bash
pnpm test
# Expected: 31 passed, 0 failed
```

## 2) Build prod
```bash
pnpm build 2>&1 | tail -20
# Expected: no TS errors blocking build
```

## 3) API ETH scan — data_source / rpc fields
```bash
curl -s "$BASE/api/scan/eth?address=0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045&deep=false"   | python3 -c "
import json,sys
try:
  d=json.load(sys.stdin)
  print('data_source:', d.get('data_source'))
  print('source_detail:', d.get('source_detail'))
  print('rpc_fallback_used:', d.get('rpc_fallback_used'))
  print('cache_hit:', d.get('cache_hit'))
  print('rpc_down:', d.get('rpc_down'))
  print('is_contract:', d.get('is_contract'))
  print('spenders:', d.get('spenders'))
  print('counterparties_top:', d.get('counterparties_top'))
except Exception as e:
  print('PARSE ERROR:', e)
"
```

## 4) API ETH deep scan
```bash
curl -s "$BASE/api/scan/eth?address=0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045&deep=true"   | python3 -c "
import json,sys
try:
  d=json.load(sys.stdin)
  print('tier:', d.get('tier'))
  print('score:', d.get('score'))
  print('approvals_unlimited:', d.get('approvalsSummary',{}).get('unlimited'))
  print('spenders:', d.get('spenders'))
except Exception as e:
  print('PARSE ERROR:', e)
"
```

## 5) Mock scan API
```bash
curl -s "$BASE/api/mock/scan?mode=red"   | python3 -c "
import json,sys
try:
  d=json.load(sys.stdin)
  print('tier:', d['risk']['tier'])
  print('claims:', len(d['off_chain']['claims']))
except Exception as e:
  print('PARSE ERROR:', e)
"
```

## 6) PDF casefile
```bash
curl -s -o /tmp/test-casefile.pdf   "$BASE/api/report/casefile?mint=BYZ9CcZGKAXmN2uDsKcQMM9UnZacja4vWcns9Th69xb&lang=en"
file /tmp/test-casefile.pdf
# Expected: PDF document
```

## 7) Open URLs (browser)
```bash
open "$BASE/en/demo"
open "$BASE/fr/demo"
open "$BASE/en/demo?mock=green"
open "$BASE/en/demo?mock=orange"
open "$BASE/en/demo?mock=red"
open "$BASE/fr/demo?mock=red"
```

## Checklist UI
- [ ] Mock red EN: chip 🚨 → skeleton → RED result, VerdictCard "HIGH RISK" 3 bullets
- [ ] Mock red FR: RISQUE ÉLEVÉ, RÉFÉRENCÉ, zéro anglais visible
- [ ] Evidence Drawer: Data Source item visible
- [ ] Evidence Drawer: FALLBACK badge si rpc_fallback_used=true
- [ ] Evidence Drawer: CRITICAL badge si known bad address
- [ ] Evidence Drawer: OFFICIAL badge si Uniswap/Jupiter etc
- [ ] Evidence Drawer: cap 3 items respecté
- [ ] rpc_down=true → "RPC Unavailable" item visible dans drawer
- [ ] PDF: télécharge + filename casefile-BYZ9CcZG-*.pdf
- [ ] pnpm test: 31/31 verts

---

## SOL Scan

### Curls SOL safe
```bash
# Fast scan
curl -s "$BASE/api/scan/solana?mint=BYZ9CcZGKAXmN2uDsKcQMM9UnZacja4vWcns9Th69xb" \
  | python3 -c "
import json,sys
try:
  d=json.load(sys.stdin)
  print('tier:', d.get('risk',{}).get('tier'))
  print('data_source:', d.get('data_source'))
  print('source_detail:', d.get('source_detail'))
  print('rpc_fallback_used:', d.get('rpc_fallback_used'))
  print('rpc_down:', d.get('rpc_down'))
  print('rpc_error:', d.get('rpc_error'))
  print('is_contract:', d.get('is_contract'))
  print('claims:', len(d.get('off_chain',{}).get('claims',[])))
except Exception as e:
  print('PARSE ERROR:', e)
"

# Mock red SOL
curl -s "$BASE/api/mock/scan?mode=red" \
  | python3 -c "
import json,sys
try:
  d=json.load(sys.stdin)
  print('tier:', d['risk']['tier'])
  print('claims:', len(d['off_chain']['claims']))
  print('rpc_down:', d.get('rpc_down'))
except Exception as e:
  print('PARSE ERROR:', e)
"
```

### Checklist UI SOL
- [ ] Scan SOL: `data_source` = `rpc_primary` ou `rpc_fallback` ou `unknown`
- [ ] Scan SOL: `rpc_fallback_used` + `rpc_down` + `rpc_error` présents dans JSON
- [ ] Evidence Drawer SOL: badge FALLBACK visible si `rpc_fallback_used=true`
- [ ] Evidence Drawer SOL: "RPC Unavailable" si `rpc_down=true`
- [ ] Evidence Drawer SOL: CRITICAL > OFFICIAL > RPC_SOURCE (cap 3 respecté)
- [ ] Mock red FR `/fr/demo?mock=red`: zéro anglais visible
- [ ] Pas de crash si RPC SOL down (safe degrade)
- [ ] pnpm test: 34/34 verts
