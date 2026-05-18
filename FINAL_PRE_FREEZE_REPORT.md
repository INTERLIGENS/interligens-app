# INTERLIGENS — Pre-Freeze Report
## Date: 2026-05-01
## Branch: release/beta-prefreeze

---

## Routes ajoutées

| Route | Fichier | Description |
|-------|---------|-------------|
| `/en/methodology` | `src/app/en/methodology/page.tsx` | Updated — architecture framing, nav cards, SEO |
| `/en/methodology/tigerscore` | `src/app/en/methodology/tigerscore/page.tsx` | Nouveau — TigerScore high-level, signal categories, risk tiers |
| `/en/methodology/kol-risk` | `src/app/en/methodology/kol-risk/page.tsx` | Nouveau — 7 axes directionnels KOL risk |
| `/en/cases/botify/evidence` | `src/app/en/cases/botify/evidence/page.tsx` | Nouveau — SVG wallet flow diagram, 8 claims BOTIFY, readonly |
| `/en/demo/review` | `src/app/en/demo/review/page.tsx` | Nouveau — investor demo (casefile + live scan + ask) |
| `/en/developers` | `src/app/en/developers/page.tsx` | Nouveau — private API beta waitlist |

---

## Fichiers modifiés

| Fichier | Changement |
|---------|------------|
| `src/lib/labels/scanEnrich.ts` | Badge "KNOWN SCAMMER" → "DOCUMENTED CRITICAL RISK ACTOR", emojis supprimés |
| `src/app/en/charter/page.tsx` | "Looks clean" → "No critical signal surfaced" |
| `scripts/legal-wording-check.sh` | Nouveau — scanner wording légal |
| `scripts/prefreeze-check.sh` | Nouveau — smoke tests pre-freeze |
| `package.json` | Ajout `legal:wording` et `prefreeze:check` scripts |

---

## Tests

- **Total Vitest**: 1459 passed / 0 failed (172 test files)
- **TSC (source)**: 0 erreurs dans src/
- **Note**: `.next/types/validator.ts` contient 1 erreur stale sur une route mock supprimée (commit `ade28d5`). Non bloquant — sera résolu au prochain `next build`.

---

## Pre-freeze check (2026-05-01 — server 3100)

```
[PASS] TSC clean (source)
[PASS] Score SOL route OK
[PASS] Scan Context OK
[PASS] Mobile /ask route alive (status: 401)
[PASS] Health endpoint OK
[PASS] Partner API alive (status: 401)
[FAIL] Admin route protected (status: 200)  ← LOCAL ONLY (env vars absents en dev)
[PASS] Methodology page OK
[PASS] Methodology/tigerscore page OK
[PASS] Methodology/kol-risk page OK
[PASS] BOTIFY evidence view OK
[PASS] Demo review page OK
[PASS] Legal wording report generated

RESULTS: 12 passed, 1 failed
```

---

## Warnings restants

- `.next/types/validator.ts:3752` — stale ref vers `/api/mock/scan/route.js` supprimée dans `ade28d5`. Résolu au prochain build.
- Admin route non protégée en dev local (ADMIN_BASIC_USER/PASS non définis) — protégée en prod via Vercel env.

---

## Risques connus

- Les pages `/en/demo/review` et `/en/cases/botify/evidence` utilisent des données statiques JSON issues de `data/cases/botify.json`. Si le casefile évolue en DB, les pages doivent être mises à jour manuellement.
- La page `/en/demo/review` — section "Ask INTERLIGENS" — utilise `/api/v1/scan-context` comme source live, avec fallback statique. Si la route est indisponible, le fallback est affiché (text BOTIFY statique basé sur le casefile).

---

## Volontairement exclu

- Pas de merge dans main (à faire par Dood après review)
- Pas de génération de clés API (developers page — waitlist seulement)
- Pas de dashboard développeur
- Aucune modification des champs DB (`confirmed_scammer`, catégories labels) — wording UI seulement
- Pas de graphe 3D / Bubblemaps (evidence view = SVG statique comme demandé)
- Pas de déploiement Vercel

---

## Legal wording — résumé Task 3

| Occurrence | Fichier | Action |
|------------|---------|--------|
| `'🚨 KNOWN SCAMMER'` | `scanEnrich.ts` | REMPLACÉ → `'DOCUMENTED CRITICAL RISK ACTOR'` |
| `"Looks clean — but not guaranteed safe."` | `charter/page.tsx` | REMPLACÉ → `"No critical signal surfaced — lower observed risk, not zero risk."` |
| `'scammer'` category (admin labels, DB) | admin pages, types | NOTÉ — interne, non retail-visible |
| `"criminal"` (DOJ sources) | `seedData.ts` | CONSERVÉ — source judiciaire confirmée |
| `types.ts:70-73` denylist | `kol/types.ts` | CONSERVÉ — liste de termes INTERDITS (protection) |

**Total retail-visible remplacés**: 2. Total notés: 5.

---

## Tag proposé

```
beta-investor-freeze-2026-05
```

---

## Commits sur cette branche

```
d0ac20b feat: developers waitlist page
baaaaf9 feat: prefreeze smoke test script
4abff58 feat: investor demo review page (/demo/review)
971fa22 fix: legal wording cleanup (no absolute claims)
ec51c78 feat: BOTIFY evidence view (readonly, public-safe)
f3e8ff8 feat: methodology pages (architecture not recipe)
```

---

**STOP — NE PAS MERGER DANS MAIN.**
Attends Dood pour review + merge contrôlé.
