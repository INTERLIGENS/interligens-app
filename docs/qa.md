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


---

## TigerScore P1

### Curl ETH — champs TigerScore
```bash
curl -s "$BASE/api/scan/eth?address=0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045&deep=false" \
  | python3 -c "
import json,sys
try:
  d=json.load(sys.stdin)
  print('tiger_score:', d.get('tiger_score'))
  print('tiger_tier:', d.get('tiger_tier'))
  print('tiger_drivers:', len(d.get('tiger_drivers', [])), 'drivers')
  print('tiger_evidence:', len(d.get('tiger_evidence', [])), 'items')
  print('meta:', d.get('tiger_meta'))
except Exception as e:
  print('PARSE ERROR:', e)
"
```

### Curl SOL — champs TigerScore
```bash
curl -s "$BASE/api/scan/solana?mint=BYZ9CcZGKAXmN2uDsKcQMM9UnZacja4vWcns9Th69xb" \
  | python3 -c "
import json,sys
try:
  d=json.load(sys.stdin)
  print('tiger_score:', d.get('tiger_score'))
  print('tiger_tier:', d.get('tiger_tier'))
  print('tiger_drivers:', len(d.get('tiger_drivers', [])), 'drivers')
  print('tiger_evidence:', len(d.get('tiger_evidence', [])), 'items')
  print('meta:', d.get('tiger_meta'))
except Exception as e:
  print('PARSE ERROR:', e)
"
```

### Checklist TigerScore P1
- [ ] ETH: `tiger_score` présent + 0-100
- [ ] ETH: `tiger_tier` = GREEN/ORANGE/RED
- [ ] ETH: `tiger_drivers` array (peut être vide si GREEN)
- [ ] ETH: `tiger_evidence` array max 3 items
- [ ] SOL: idem
- [ ] `tiger_meta.version` = "p1"
- [ ] pnpm test: 40/40 verts


---

## P2.1 Animations

### Checklist manuelle
- [ ] Ring anime 0 → score en ~900ms (easeOutCubic) sur EN + FR
- [ ] Label numérique suit Math.round(animatedScore) pendant l'animation
- [ ] Proofs apparaissent en stagger: item 1 → 0ms, item 2 → 120ms, item 3 → 240ms
- [ ] Crossfade skeleton → contenu: skeleton fade-out 250ms, contenu fade-in 300ms
- [ ] Zéro layout shift (CLS=0): hauteurs stables entre skeleton et résultat
- [ ] Zéro flash blanc entre skeleton et contenu
- [ ] `prefers-reduced-motion`: ring affiche score direct, stagger sans translate, crossfade 100ms max
- [ ] RAF cleanup: pas de memory leak au unmount (DevTools > Memory)
- [ ] StrictMode safe: hasAnimated.current guard anti double RAF
- [ ] Score clampé 0–100 même si API renvoie valeur hors range

### Test rapide iPhone/PWA
```
1. Ouvrir http://<IP>:3100/en/demo sur Safari iPhone
2. Scanner une adresse ETH
3. Vérifier: ring anime smooth, pas de jank
4. Settings > Accessibility > Motion > Reduce Motion = ON
5. Re-scanner: ring apparaît direct, pas d'animation
6. Installer en PWA (partager > Sur l'écran d'accueil) et retester
```

### Commandes
```bash
pnpm test   # 41/41 verts attendus
open "http://localhost:3100/en/demo?mock=red"
open "http://localhost:3100/fr/demo?mock=red"
```
