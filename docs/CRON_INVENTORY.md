# Inventaire des routes cron — arbitrage ligne par ligne

État au **2026-08-14**. Source de vérité de la planification : `vercel.json`.
Il n'en existe **aucune autre** : les GitHub Actions n'ont pas de `schedule:`,
`crontab -l` est vide, et les 3 agents launchd de Host-001 lancent des scripts
`tsx`, jamais une route HTTP.

**Aucun code n'a été supprimé.** Une route inerte reste une route inerte
documentée : le jour où son amont existe, elle est prête.

## Doctrine

> Configured ≠ Running ≠ Producing ≠ Consumed ≠ Correct.

Une route n'est planifiée que si sa sortie a un **consommateur prouvé**.
Planifier une collecte que personne ne lit, c'est précisément le défaut que cet
inventaire corrige — pas une case à cocher.

---

## PLANIFIÉES

| Route | Cadence | Consommateur prouvé |
|---|---|---|
| `/api/cron/shill-feed` | 05:00 | `ShillEvent` ← `social_post_candidates` (bridge B3) → consommé par `shill-shadow` |
| `/api/cron/shill-shadow` | 07:00 | sink shadow SHILL V2 — lecture des `ShillEvent`, aucune écriture d'analyse |
| `/api/cron/watcher-v2` | 06:00 | `WatcherCampaign`, `social_post_candidates` → watcher-bridge |
| `/api/cron/watcher-bridge` | 06:30 | `KolTokenLink` draft → file de revue admin |
| `/api/cron/daily-flow` | 02:00 | `KolProceedsSummary.rolling*` → `/api/kol/[handle]/proceeds` → `RetailCounter` |
| `/api/cron/helius-scan` | 04:00 | `KolProceedsEvent` → même chaîne |
| `/api/cron/process-events` | 03:00 | `DomainEvent` → snapshots KOL canoniques |
| `/api/cron/intel-rss` | 07:00 | `FounderIntelItem` → `/admin/intel` |
| `/api/cron/intel-summarize` | 07:30 | `FounderIntelItem.summary` → idem |
| `/api/cron/weekly-digest` | lundi 08:00 | email unifié FR |
| `/api/cron/watch-rescan` | 08:00 | `WatchAlert` (table vide — voir note) |
| `/api/cron/watch-alerts` | 08:00 | idem |
| `/api/cron/retail-process-queue` | 05:00 | `OsintSubmission` → cerveau A (ajouté 2026-08-14) |
| `/api/intelligence/ingest/ofac` | 01:00 | `intel_source_observations` → floor OFAC TigerScore |
| `/api/intelligence/ingest/scamsniffer` | 01:30 | idem |
| `/api/cron/reaper` | 02:30 | `intel_ingestion_batches` zombies → statut terminal + `intel_audit_log` (ajouté 2026-08-21) |
| `/api/cron/mm-batch-scan` | 09:00 | `MmScore` → badge public + mobile (ajouté 2026-08-14) |

### Note — `reaper` (ajouté 2026-08-21)

Un batch d'ingestion tué par le timeout serverless (`maxDuration = 300`) reste
`running` à vie : le kill n'est pas une exception JS, ni le finalize `success`
ni le `catch` ne s'exécutent, et il n'y a aucun `finally`. Mesuré le
2026-08-21 : **10 batches zombies**, dont 7 accumulés à 1/jour depuis le 08-15.

Le reaper passe tout `running` au-delà d'un TTL de **900 s** en statut terminal
explicite (`TIMED_OUT_WITH_WRITES` / `TIMED_OUT_UNKNOWN_WRITES`), journalise
chaque fermeture dans `intel_audit_log` (`action = ingest.batch.reaped`) et ne
supprime **aucune** ligne historique. Il est idempotent : l'`updateMany` est
gardé par `status = 'running'`.

**Pourquoi un cron dédié plutôt qu'un appel en tête d'`ingestSource()`** —
décision GPT/fondateur : le reaper surveille le pipeline d'ingestion, il ne
doit pas mourir avec lui. C'est quand l'ingestion tombe que les zombies
s'accumulent.

**Créneau 02:30** — une heure après le démarrage de l'ingestion scamsniffer
(01:30), donc un zombie né cette nuit est clos la même nuit ; et bien au-delà
des 300 s d'un run vivant, qui reste protégé par le TTL.

### Note — `watch-rescan` / `watch-alerts`

`WatchedAddress`, `WatchAlert`, `WatchScan`, `WatchedToken` sont toutes à 0.
Les deux crons tournent donc quotidiennement sur une table vide.

**Non retirés, et ce n'est pas de la complaisance** : la fonctionnalité est
atteignable (`POST /api/watch`, derrière session bêta), le premier utilisateur
qui met une adresse sous surveillance a besoin que le rescan tourne déjà. Le
coût d'un `SELECT` qui rend 0 ligne est négligeable — aucun appel externe n'est
émis quand la boucle est vide. Les débrancher créerait une fonctionnalité qui
marche « sauf le premier jour ».

### Pourquoi `mm-batch-scan` est planifié (2026-08-14)

`MmScore` est lu par 4 surfaces : `/api/v1/mm/public/badge`,
`/api/v1/mm/assess`, `/api/mobile/v1/mm/score`, `lib/mm/reporting/pdfReport`.

Le badge public renvoie **404 `stale`** au-delà de 24 h
(`badge/route.ts:95`). Les 15 lignes `MmScore` datent du 2026-07-22, soit
**23 jours**, et les 15 ont `expiresAt < now()`. **L'endpoint public renvoie donc
404 pour toutes les entités.** Le consommateur existe et il est cassé par la
péremption : c'est le cas où planifier est justifié.

Périmètre : 32 wallets `MmAttribution` à confiance ≥ 0.70. Coût externe réel
(etherscan / helius / birdeye), borné par `PARALLEL_LIMIT = 2` et
`SOFT_TIMEOUT_MS = 110 s`. Le TTL de cache interne est de 6 h : un run quotidien
rafraîchit tout.

---

## DÉCLENCHEUR MANUEL LÉGITIME — inchangées

### `/api/cron/alerts/deliver`

Déclencheur existant : bouton `testDeliver()` dans `src/app/admin/alerts/page.tsx`.

`alert_subscriptions` = 0, `alert_deliveries` = 0. **Il n'y a rien à livrer.**
Planifier une livraison sans abonné, c'est ajouter une invocation quotidienne
pour produire zéro. Le bouton admin suffit tant que la table est vide ; le jour
où des abonnements existent, cette ligne est à rouvrir.

### `/api/cron/price-cache-refresh`

Déclencheur documenté dans son propre en-tête (`curl -H "Authorization: Bearer
$CRON_SECRET"`).

**Délibérément NON planifiée.** `TokenPriceTracker` (340 lignes,
`lastRefreshAt` max = 2026-05-15) n'a **aucun lecteur** : ni délégué Prisma, ni
SQL brut, hors des scripts de seed et de ce cron lui-même. La planifier
créerait exactement ce que cet audit condamne — un job périodique qui rafraîchit
une table que personne ne lit.

L'en-tête du fichier annonce « every 6h (see vercel.json) ». **C'est faux** et ça
l'a toujours été. À corriger dans le fichier, ou à rendre vrai en lui donnant un
lecteur — les deux se valent, mais l'état actuel ment.

---

## INERTES — code conservé, non planifié

Aucune de ces routes n'est supprimée.

| Route | Pourquoi elle ne peut rien produire aujourd'hui |
|---|---|
| `/api/cron/digest` | No-op assumé. Répond `{ deprecated: true }`, fusionné dans `weekly-digest`. |
| `/api/cron/security-weekly-digest` | No-op assumé. Idem. |
| `/api/cron/mm-calibration` | Placeholder auto-déclaré : « Phase 3 ships the infrastructure but the sample gathering requires the Phase 5+ data layer ». Renvoie 200 sans rien calculer. `MmCohortPercentile` = 0. |
| `/api/cron/corroboration` | Lit `IntakeRecord` (**0 ligne**) pour écrire `AddressLabel`. Sans amont, la boucle ne s'exécute jamais. |
| `/api/cron/intake-watch` | Lit `WatchSource` (**0 ligne**). Idem. |
| `/api/cron/onchain/sync` | Sous-système `surveillance`. `onchain_events` = 0, `wallets` = 0. |
| `/api/cron/signals/run` | Sous-système `surveillance`. `signals` = 0, `influencer_scores` = 0. |
| `/api/cron/social/discover` | Sous-système `surveillance`, via Nitter/Playwright. |
| `/api/cron/social/capture` | Idem. `social_posts` figé au 2026-04-19. |

### Sur `social/discover` + `social/capture`

`social_watchlist` a 29 lignes — l'amont existe, contrairement aux autres.
Ce n'est donc pas « rien à faire », c'est **doublon** : `watcher-v2` couvre déjà
l'ingestion X par l'API officielle et alimente `social_post_candidates`
(6 909 lignes, dont une créée aujourd'hui). Les planifier ferait tourner un
second collecteur X par scraping, sur le même périmètre, avec un risque de
blocage et sans consommateur distinct.

**La question à trancher n'est pas « faut-il un cron » mais « lequel des deux
collecteurs X garde-t-on ».** Elle n'est pas tranchée ici.

---

## Contrainte de plateforme

Plan Vercel **Hobby** : aucune cadence infra-quotidienne. Une entrée horaire ou
sous-horaire fait **échouer le déploiement**. Un test le vérifie
(`__tests__/api/intelFreshness.test.ts`), pour que la contrainte se voie au
`pnpm test` plutôt qu'au déploiement.


### Pourquoi `shill-feed` et `shill-shadow` sont DEUX crons (2026-09-04)

Ils ont des modes de panne différents, et les coupler ferait dépendre
l'ingestion sociale d'un budget on-chain.

`shill-feed` est **Helius-free** : il lit `social_post_candidates`, applique le
prédicat de qualification puis la résolution d'identité, et écrit des
`ShillEvent`. Il n'a besoin d'aucun budget externe et peut tourner même quand
Helius est indisponible.

`shill-shadow` **dépense** : il lit les `ShillEvent` snowflake-vérifiés et
collecte des fenêtres on-chain, sous un budget global de 100 000 crédits par
passage — global, jamais par événement. Sa sortie va dans un sink ; il n'écrit
ni `ShillCorrelationCandidate`, ni `ShillBuyerObservation`, ni casefile.

Sous un cron unique, une panne Helius aurait tari le feed — et un feed vide se
lit comme « aucune promotion », pas comme « la collecte est tombée ». C'est le
genre de silence qu'on ne remarque pas avant des semaines.

**Consommateur prouvé** : `shill-feed` alimente `shill-shadow`, qui a produit
961 appels sur 5 sujets réels le 2026-09-04 (1 574 acheteurs observés). La
chaîne est exercée de bout en bout, pas supposée.

**Cadence du feed** : quotidienne à 05:00, en amont du shadow de 07:00. La
cible était horaire ; elle est bloquée par la garde de plan Vercel
(`intelFreshness.test.ts`), non levée faute d'avoir pu vérifier le plan.
