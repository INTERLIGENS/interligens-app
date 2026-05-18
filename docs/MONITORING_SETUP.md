# Monitoring INTERLIGENS

Objectif : savoir immédiatement si le site tombe, notamment pendant une
absence prolongée (ex. déplacement 1er juin – 27 juillet).

## Endpoint heartbeat

`GET https://app.interligens.com/api/monitoring/heartbeat`

- Public, sans authentification (un monitor externe doit pouvoir le ping).
- `Cache-Control: no-store` — jamais mis en cache.
- Ne jette jamais : chaque sous-check échoue silencieusement vers `false`.

Réponse :

```json
{
  "status": "ok",
  "timestamp": "2026-05-18T03:00:00.000Z",
  "version": "<VERCEL_GIT_COMMIT_SHA>",
  "checks": {
    "db": true,
    "scoring": true,
    "watcher": true
  }
}
```

- `status` vaut `"ok"` si les trois checks passent, sinon `"degraded"`.
- `checks.db` — `SELECT 1` sur la base Neon.
- `checks.scoring` — appel interne `/api/v1/score` sur le mint WIF, `true` si HTTP 200.
- `checks.watcher` — `true` si une `SocialPostCandidate` a été découverte il y a
  moins de 5 jours (le cron watcher tourne tous les 3 jours).

## Better Stack (gratuit)

1. Aller sur https://betterstack.com
2. Créer un compte gratuit
3. Add Monitor → HTTP Monitor
4. URL : `https://app.interligens.com/api/monitoring/heartbeat`
5. Check interval : 5 minutes
6. Alert via email : admin@interligens.com
7. Expected status : 200
8. Expected body contains : `ok`

> Le endpoint renvoie toujours HTTP 200 tant qu'il est joignable. La santé
> réelle est portée par le corps : `status: "ok"` quand tout va bien,
> `status: "degraded"` dès qu'un check échoue. Comme `"degraded"` ne contient
> pas la sous-chaîne `ok`, la règle « body contains ok » déclenche l'alerte
> aussi bien sur un site injoignable que sur une dégradation interne.

## Alertes

- Si le site tombe (endpoint injoignable / non-200) → email immédiat.
- Si la base est indisponible → `checks.db = false`, `status = "degraded"`.
- Si le scoring échoue → `checks.scoring = false`, `status = "degraded"`.
- Si le watcher n'a pas tourné depuis 5 jours → `checks.watcher = false`.

## Alternative : UptimeRobot (gratuit aussi)

Même configuration, URL identique. Keyword monitor avec keyword `ok`.

## Note proxy / beta gating

Aucune modification de `src/proxy.ts` n'est nécessaire : `isBetaExempt()`
exempte déjà l'intégralité de `/api/` du beta gating
(`if (pathname.startsWith("/api/")) return true;`). Le heartbeat est donc
accessible sans session beta dès son déploiement.

## Setup script existant

Le repo contient déjà `src/scripts/setup-betterstack.ts` et
`betterstack-monitors-to-create.json` pour provisionner des monitors via
l'API Better Stack (`BETTERSTACK_API_TOKEN` requis). Ajouter le heartbeat
à cette liste si l'on veut le créer par script plutôt qu'à la main.
