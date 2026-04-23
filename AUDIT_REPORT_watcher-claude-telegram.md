# AUDIT REPORT — Watcher V2 Fix + CLAUDE.md + Telegram Bot

## MODÈLE : Sonnet 4.6 OUI
## STATUT GLOBAL : GREEN

---

## WATCHER V2

### Cause du bug identifiée
`hasToken()` dans `src/lib/xapi/client.ts` utilisait `return getToken() !== null`.
`X_BEARER_TOKEN=""` (chaîne vide dans `.env.vercel`) passe ce guard car `"" !== null === true`.
En conséquence, la route dépasse le check `if (!hasToken())` et tombe dans `scanAll()`.
`headers()` utilise `if (!token)` (falsy check), détecte la chaîne vide, et throw `Error('X_BEARER_TOKEN not set')`.
L'exception est catchée par le bloc `try/catch` du GET handler → retourne `{"error":"Internal error"}` (500).

### Fix appliqué
`src/lib/xapi/client.ts` ligne 156 :
```
AVANT : return getToken() !== null;
APRÈS : return !!getToken();
```
Désormais `!!""` → `false` → le guard `if (!hasToken())` retourne immédiatement `{"error":"X_BEARER_TOKEN not configured"}` (500 explicite) au lieu de crash opaque.

### Test local curl
HTTP 000 — serveur local non démarré. Fix vérifié par analyse statique du code.

### BLOCKER production
`X_BEARER_TOKEN` est une chaîne vide dans l'env Vercel. Il faut le configurer dans le dashboard Vercel avec le vrai token X (Twitter) Bearer pour que le cron fonctionne réellement.

---

## CLAUDE.md
- Créé à la racine de `src/` : `src/CLAUDE.md` — OUI

---

## TELEGRAM BOT
- Route existante : `src/app/api/telegram/webhook/route.ts` — déjà présente et complète
- Lib existante : `src/lib/telegram/bot.ts` — déjà présente avec `/scan` et `/help`
- Lib utilisée : native fetch (pas de grammy/telegraf)
- Ajout `/kol` : OUI — `handleKolCommand()` ajoutée dans `bot.ts`, routée dans `route()`
- Commandes actives : `/scan` `/kol` `/help` `/start`
- `TELEGRAM_BOT_TOKEN` : présent dans `.env.local` — OUI
- `TELEGRAM_WEBHOOK_SECRET` : présent dans `.env.local` — OUI

### Config webhook (manuel)
```
curl "https://api.telegram.org/bot{TOKEN}/setWebhook?url=https://{DOMAIN}/api/telegram/webhook&secret_token={WEBHOOK_SECRET}"
```

---

## TESTS
- Baseline : 1141
- Total après : 1141
- Tous green : OUI

## TSC
exit 0 — aucune erreur

## BUILD
240 pages, 0 erreurs — `✓ Compiled successfully`

## DEPS REQUESTED
Aucune — native fetch utilisé pour Telegram

## BLOCKERS
- `X_BEARER_TOKEN` vide sur Vercel — à configurer dans Vercel dashboard pour activer le cron watcher-v2

---

## PROCHAINE ÉTAPE
Attente OK humain pour merger `feat/watcher-v2-fix` sur main.
