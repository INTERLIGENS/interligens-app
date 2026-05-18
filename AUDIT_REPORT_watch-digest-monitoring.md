# AUDIT REPORT — Watch + Digest + Better Stack

## MODÈLE : Sonnet 4.6 OUI
## STATUT : GREEN

---

## MODULE A — WATCH

### WatchButton intégré : OUI
- `src/components/scan/WatchButton.tsx` — bouton idle → modal email → done
- Intégré dans `src/app/en/demo/page.tsx` et `src/app/fr/demo/page.tsx` après OffChainCredibilityBlock
- Design : `border border-[#FF6B00] text-[#FF6B00] uppercase tracking-widest text-[10px]`

### Table WatchedToken : À CRÉER VIA NEON SQL EDITOR
- Schema doc : `src/lib/watch/schema-extension.prisma` (SQL inclus)
- Engine : `src/lib/watch/engine.ts` — `@ts-expect-error` sur les appels Prisma (table pas encore générée)
- Comportement si table absente : log + retour gracieux `{ alerted: 0, checked: 0, errors: 0 }`

### API POST /api/v1/watch : OUI
- Rate-limited (RATE_LIMIT_PRESETS.scan)
- Valide email + mint + chain

### Cron /api/cron/watch-alerts ajouté : OUI
- `src/app/api/cron/watch-alerts/route.ts`
- `vercel.json` : `{ "path": "/api/cron/watch-alerts", "schedule": "0 */6 * * *" }`
- Auth CRON_SECRET Bearer token

### Resend : Natif fetch — RESEND_API_KEY présent dans .env.local ✓

---

## MODULE B — DIGEST

### DigestGenerator : OUI
- `src/lib/digest/generator.ts` — KolProfile + CaseFile + KolTokenInvolvement proceeds
- Fenêtre : 7 derniers jours

### Email template : OUI
- `src/lib/digest/emailTemplate.ts` — HTML inline, EN + FR, on-brand
- BG #000000, accent #FF6B00, danger #FF3B5C

### Resend configuré : OUI (RESEND_API_KEY dans .env.local)
- Destinataires : `DIGEST_RECIPIENTS` ou fallback `ALERT_EMAIL`
- Si ni l'un ni l'autre → log console, pas de crash

### Cron /api/cron/digest ajouté : OUI
- `src/app/api/cron/digest/route.ts`
- `vercel.json` : `{ "path": "/api/cron/digest", "schedule": "0 9 * * 1" }`

---

## MODULE C — BETTER STACK

### Script créé : OUI
- `src/scripts/setup-betterstack.ts` — 10 monitors, API Better Stack v2
- `npx tsx src/scripts/setup-betterstack.ts`

### BETTERSTACK_API_TOKEN : MANQUANT dans .env.local
- JSON fallback généré : `betterstack-monitors-to-create.json` (10 monitors)
- Import manuel : https://uptime.betterstack.com/monitors

### Monitors configurés : 0/10 (token absent) — JSON fourni
- `src/CLAUDE.md` mis à jour avec section Monitoring

---

## TESTS
- Baseline : 1141
- Total après : 1141
- Tous green : OUI

## TSC
Exit 0 — une erreur corrigée pendant build (riskFlag manquant dans select Prisma)

## BUILD
240 pages, 0 erreurs — `✓ Compiled successfully`

## DEPS REQUESTED
Aucune — Resend via native fetch (RESEND_API_KEY déjà présent), pas de lib nécessaire

## BLOCKERS
1. **WatchedToken** — Table à créer via Neon SQL Editor (SQL dans `src/lib/watch/schema-extension.prisma`)
2. **BETTERSTACK_API_TOKEN** — À ajouter en env local pour activer les monitors
3. **DIGEST_RECIPIENTS** — À configurer en env Vercel (liste d'emails séparés par virgule)

---

## PROCHAINE ÉTAPE
Attente OK humain pour merger `feat/watch-digest-monitoring` sur main.
