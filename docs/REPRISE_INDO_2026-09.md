# 🔄 REPRISE INTERLIGENS — Septembre 2026

**Date génération** : 2026-05-27 (J-5 avant départ Indo)
**Auteur** : Claude Code (session autonomie pré-départ)
**Lecteur cible** : David Douville, retour Indo fin juillet 2026
**Objectif** : un seul fichier pour reprendre le contexte de tous les modules gelés sans relire l'historique

> **Note** : cette doc a été générée le 2026-05-27 mais les artefacts qu'elle référence (tags, stash inventory) portent l'estampille du 2026-05-24, date des opérations groupées de figeage pré-Indo. Aucune incidence opérationnelle — c'est juste une convention de nommage.

---

## 📊 Vue d'ensemble

Snapshot du repo au 2026-05-27 (avant départ Indo 2026-06-01) :

- **Branche main HEAD** : `81f5b7e5cd83bbc3729eacf3eac4446567dc6fcd`
- **Dernier commit main** : `[DRAFT][CONTENT] MANIFEST.md — corpus pédagogique v1 (#20)`
- **Tag corpus pédagogique** : `corpus-pedagogique-v1-2026-05-23` ✅ posé
- **Tag prod pré-départ** : `prod-pre-2026-05-31` ⏳ **à poser le 31 mai par David**
- **Tags safety Website 2.0 (posés en Phase 1 de cette session)** :
  - `safety/website-v2-discipline-pages-pre-indo-2026-05-24` → `6a3929a`
  - `safety/website-v2-3d-constellation-poc-pre-indo-2026-05-24` → `b01304d`
- **Tags archive produit** (déjà posés antérieurement) :
  - `archive/feat-founding-intelligence-seed-2026-05-24`
  - `archive/feat-mm-tracker-2026-05-24`
  - `archive/feat-scam-universe-graph-2026-05-24`
- **Stashes WIP conservés** : 3 stashes (voir `docs/STASH_INVENTORY_2026-05-24.md` si créé, sinon `git stash list`)

---

## 🎯 Priorité de reprise recommandée

(Cet ordre est une suggestion CC basée sur le contexte du 27 mai. À ajuster selon le feedback enquêteurs et le retour lawyer reçus pendant l'Indo.)

1. **Casefile Engine V1** — décision flag (impact direct sur la beta enquêteurs)
2. **REFLEX V1** — bilan calibration shadow réel + décision bascule publique
3. **MM_TRACKER** — vérifier si lawyer D1+D2 a répondu, sinon module reste gelé
4. **Website 2.0** — décision merge ou refonte partielle
5. **Watcher V2 cron** — fix endpoint si motivation, sinon V1 launchctl Host-005 suffit
6. **iOS Build 3** — fix parsing `/ask` si TestFlight encore prioritaire
7. **LIBERTAS Sprint D Monero** — research, dernière priorité

---

## 1. CASEFILE ENGINE V1

### État actuel (scan code 2026-05-27)
- **Branche** : mergée sur main (le code vit en `src/lib/casefile-engine/` et `src/app/admin/casefile-engine/`)
- **Feature flag** : `FEATURE_CASEFILE_ENGINE_V1`
  - Source de vérité : `src/lib/featureFlags.ts:19` — `process.env.FEATURE_CASEFILE_ENGINE_V1 === 'true'`
  - Gate centralisé : `src/lib/casefile-engine/gate.ts`
  - **Default** : `false` (toute valeur non-`'true'` désactive)
  - **Comportement OFF** : `assertCasefileEngineEnabled()` appelle `notFound()` → 404 indiscernable d'une URL inconnue ; API → `{error:"feature_disabled"}` 404
- **Surfaces gatées par le flag** (404 quand OFF) :
  - `src/app/admin/casefile-engine/page.tsx`
  - `src/app/admin/casefile-engine/new/page.tsx`
  - `src/app/admin/casefile-engine/[id]/page.tsx`
  - `src/app/admin/casefile-engine/[id]/exhibits/page.tsx`
  - `src/app/admin/casefile-engine/[id]/generate-pdf/route.ts`
- **Migration Prisma** : `MIGRATION_casefile_engine_v1.sql` + `MIGRATION_PLAN_casefile_engine_v1.md` à la racine du repo. **NON appliquée** en prod Neon à ce jour.
- **Tests** : modules `src/lib/casefile-engine/validation.ts` couverts (banned-phrases linter + Evidence Integrity Gate)

### Ce qui bloque
- Décision stratégique : bascule prod ou refonte ?
- Migration Neon à appliquer **avant** la bascule (via SQL Editor, **jamais** `prisma db push`)
- Smoke tests admin à exécuter avec le flag ON en preview

### Premiers pas reprise
```bash
# 1. Vérifier état flag sur dashboard Vercel
#    Settings → Environment Variables → FEATURE_CASEFILE_ENGINE_V1

# 2. Si décision GO bascule :
#    a. Smoke tests locaux
FEATURE_CASEFILE_ENGINE_V1=true PORT=3100 pnpm dev
# Tester /admin/casefile-engine, /admin/casefile-engine/new, [id]/exhibits, [id]/generate-pdf

#    b. Migration Neon — copier-coller MIGRATION_casefile_engine_v1.sql dans Neon SQL Editor
#       Ne JAMAIS faire prisma db push

#    c. Bascule flag sur Vercel UI (preview d'abord, prod ensuite)
#    d. Déploiement prod manuel : npx vercel --prod
```

### Effort estimé
- Si GO simple : ~3-4h (smoke + migration + bascule + monitoring J+1)
- Si refonte : ~1-2 jours

### Risques
- Migration ratée = état DB inconsistant — toujours dump avant
- Bascule sans rollback prêt = surface admin visible avec bug
- Linter `banned-phrases` est l'outil principal → si faux-positif sur un draft → frustration enquêteur

---

## 2. WEBSITE 2.0

### État actuel (scan branches 2026-05-27)
- **Branche principale** : `feat/website-v2-discipline-pages` → `6a3929a` (taggué safety)
  - **Diff vs main** : **247 fichiers**, +12 285 / -18 911 lignes
  - Dernier commit : "feat(website-v2): investor-demo tightening pass — 5 corrections"
  - 5 resserrages déjà appliqués (commit `6a3929a`)
  - Page-gate forensic en place (`feat(website-v2): add lightweight shared-password gate on forensic routes`)
  - SEO metadata sur 5 forensic pages
- **POC 3D** : `feat/website-v2-3d-constellation-poc` → `b01304d` (taggué safety)
  - **Diff vs main** : **885 fichiers**, +9 271 / -132 115 lignes (énorme — la branche est divergée d'une version main bien plus ancienne ; ce n'est PAS un merge naïf)
  - Dernier commit : "polish(constellation): canvas size, initial zoomToFit, deployer halo, autopilot 90s"
- **Design system** : Forensic Editorial (ink/bone/signal `#FF6B00`, Gambarino, General Sans, JetBrains Mono)

### Ce qui bloque
- Review complète des 247 fichiers de la branche disciplines
- Décision merge complet vs merge progressif par page
- Le POC 3D constellation est **inreviewable en l'état** (885 fichiers, gros deletions) — il faut soit le rebase sur main actuel, soit en extraire un sous-ensemble manuellement
- Smoke tests preview Vercel

### Premiers pas reprise
```bash
# 1. Discipline pages — checkout + smoke
git checkout feat/website-v2-discipline-pages
git pull
git diff --stat main...HEAD   # 247 fichiers — review groupée par dossier

# 2. Smoke local
PORT=3100 pnpm dev
# Tester chaque forensic page (cf. password gate)

# 3. POC 3D — décider rebase ou pas
git checkout feat/website-v2-3d-constellation-poc
# Probable : rebase impossible proprement, mieux vaut cherry-pick les fichiers 3D utiles
git log --oneline main..HEAD

# 4. Si OK : laisser Vercel preview build sur push
git push
```

### Effort estimé
- Review disciplines : ~6h
- Merge + smoke : ~2h
- Total disciplines : ~1 journée si tout va bien
- POC 3D : ~2-3 jours (rebase ou extraction manuelle)

### Risques
- Merge = redéploiement complet du site
- Bug sur une forensic page = image catastrophique (cible : avocats, autorités, CEX)
- Le 3D Constellation POC peut être lourd côté perf — vérifier mobile et low-end avant prod
- ⚠️ **Le POC 3D semble construit sur une base main divergente** : prendre 30 min pour comprendre l'origine de la branche avant de toucher quoi que ce soit

---

## 3. iOS BUILD 3

### État actuel
- **Repo iOS** : **séparé du repo web** — voir machine David ou répertoire dédié
- **Bug** : parsing erreur côté `NetworkService.swift` sur la réponse de l'endpoint `/api/mobile/v1/ask`
- **Build 2** : sur TestFlight (utilisable, pas régressé)
- **Bundle ID** : `com.interligens.app`
- **Team Apple** : `Z6WAXGT3N9`
- **Backend `mobile/v1`** : **interdit en édition par CLAUDE.offline.md** (`src/app/api/mobile/v1/**` listé en forbidden paths) — David est le seul à pouvoir y toucher

### Ce qui bloque
- Diagnostic shape de la réponse backend nécessaire
- Le backend lui-même est gelé offline (sécurité)
- Xcode + Apple Developer 2FA pour build
- Certificats signing peuvent avoir expiré pendant les 2 mois

### Premiers pas reprise
```bash
# 1. Vérifier état certificats Apple Developer (priorité, peuvent avoir expiré)

# 2. Ouvrir repo iOS (chemin réel à confirmer)
cd ~/dev/interligens-ios  # ou autre

# 3. Reproduire bug en local sur device
# Xcode → run → tester /ask en TestFlight build 2

# 4. Diagnostic backend
#    Lire src/app/api/mobile/v1/ask/route.ts (repo web)
#    Identifier shape exact de la réponse JSON

# 5. Fix dans NetworkService.swift
#    Aligner le decoder Swift sur le shape backend

# 6. Build + push TestFlight
#    Xcode → Archive → Distribute → TestFlight
```

### Effort estimé
- Vérif certificats : 30 min - 2h selon état
- Diagnostic + fix : 1-2h
- Build + push : 1h
- Total : ~3-5h

### Risques
- Build raté = TestFlight cassé
- Signing complexe — certificats expirent silencieusement
- Si la priorité TestFlight a faibli : geler le module iOS et concentrer sur web

---

## 4. REFLEX V1

### État actuel (scan code 2026-05-27)
- **Mode runtime** : SHADOW forcé (gate dans `src/lib/reflex/persistence.ts:37-44` — `effectiveMode()` retourne `SHADOW` sauf si `REFLEX_PUBLIC_ENABLED === "true"`)
- **Flag** : `REFLEX_PUBLIC_ENABLED`
  - Default code : `false` (`src/lib/reflex/constants.ts:151` — `REFLEX_PUBLIC_ENABLED_DEFAULT = false`)
  - Lecture : `src/lib/reflex/persistence.ts:27` — `process.env.REFLEX_PUBLIC_ENABLED === "true"`
  - **Comportement** : même si l'orchestrateur reçoit `mode="PUBLIC"`, la persistance force `SHADOW` tant que le flag n'est pas explicitement `"true"`
- **Tag posé antérieurement** : ⚠️ Le tag `safety-before-reflex-launch` mentionné dans le contexte **n'a pas été retrouvé** dans `git tag`. Tags safety existants : `safety-before-{branch-cleanup, constellation-3d, enterprise, guard, password-gate, press, tightening, ungate}`. Le snapshot REFLEX se reconstitue via le tag `corpus-pedagogique-v1-2026-05-23` ou les commits autour de la mise en shadow.
- **Calibration shadow (lecture locale `__tests__/reflex/calibration/last-report.json`)** :
  - 200 fixtures synthétiques (50 par bucket : STOP / WAIT / VERIFY / NO_CRITICAL_SIGNAL)
  - Pass rate : 100% (200/200)
  - False-positive STOP : 0
  - False-negative NO_SIGNAL : 0
  - Global STOP rate : 23% (sous le cap CI ≤ 30%)
  - Generated at : `2026-05-25T13:58:58.420Z`
  - ⚠️ **Ces métriques sont SYNTHÉTIQUES** — c'est le harness CI qui rejoue les fixtures, pas des analyses shadow réelles produites par les enquêteurs en beta. Les vraies métriques shadow sont en DB (`ReflexAnalysis` ou équivalent) et/ou Better Stack.
- **Bug ouvert connu (cf. `docs/reflex-v1-tech-debt.md` §Bug #2)** :
  - Narrative matcher dark pour les inputs `URL` et `X_HANDLE`
  - L'engine est wired mais `enrichment.narrativeText` n'est jamais populé pour ces types
  - **Pré-condition explicite avant bascule publique** : "extend the harness with ≥20 URL/X fixtures (10 known scam-script hits, 10 clean) **before flipping `REFLEX_PUBLIC_ENABLED`**" (cf. `docs/reflex-v1-tech-debt.md:161-162`)
- **Monitoring** : Better Stack daily check (cf. `docs/MONITORING_SETUP.md`)

### Ce qui bloque
- **Bilan calibration shadow RÉEL** (pas le harness CI) à produire au retour avec :
  - Logs Better Stack des 2 mois d'absence
  - Query DB `ReflexAnalysis` pour la distribution des verdicts shadow
  - Comparaison divergence shadow vs verdict humain enquêteur (si feedback collecté)
- 20 fixtures URL/X manquants (pré-condition explicite tech-debt)
- Décision bascule publique
- UI publique non finalisée si bascule

### Premiers pas reprise
```bash
# 1. Récupérer les logs shadow complets pendant absence
#    Better Stack dashboard — filtrer sur REFLEX
#    Ou requête DB Neon (SQL Editor uniquement)

# 2. Lire les bilans laissés par CC pendant l'absence (si générés)
#    Probablement dans /tmp ou dans docs/reflex-* nouveaux fichiers

# 3. Ajouter les 20 fixtures URL/X (cf. tech-debt §Bug #2)
#    __tests__/reflex/calibration/cases/url-x.json
#    Rerun calibration : pnpm test __tests__/reflex/calibration/

# 4. Si calibration réelle ET fixtures URL/X OK :
#    a. Préparer comms publiques
#    b. Bascule flag REFLEX_PUBLIC_ENABLED=true (Vercel UI, jamais env local commité)
#    c. Monitoring renforcé J+1, J+3, J+7
```

### Effort estimé
- Bilan calibration réel : ~2h
- 20 fixtures URL/X : ~3-4h (rédaction + ajout fetchers `src/lib/reflex/fetchers/{url,xHandle}.ts`)
- Bascule + monitoring renforcé : ~4h
- Total : ~1.5 - 2 journées

### Risques
- Bascule sans calibration réelle validée = perte crédibilité enquêteur (un FP en public abîme la confiance plus qu'un FP en shadow)
- Bug #2 ouvert = recall gap sur **nouveaux** handles/URL inconnus. STOP sur `@bkokoski`/`@GordonGekko` continue via `knownBad` (couvert par 2/2 replay)
- Better Stack rétention : vérifier que les 2 mois de logs sont encore accessibles au retour

---

## 5. MM_TRACKER

### État actuel
- **Code** : `src/lib/mm-tracker/` présent ; `prisma/migrations_mm_tracker/{001_mm_tracker_phase1,002_phase9_fake_liquidity}.sql` présents
- **Branche distante active** : `feat/mm-tracker` toujours sur origin (au-delà du tag `archive/feat-mm-tracker-2026-05-24`)
- **Phases livrées** : 10
- **Tests** : 384 tests verts (à reconfirmer au retour avec `pnpm test`)
- **Entités DRAFT en DB** : ~10 (à requêter)
- **Pas de feature flag** : MM_TRACKER n'utilise PAS de flag env — c'est l'état `PUBLISHED` vs `DRAFT` sur les entités DB qui contrôle la visibilité. Conséquence : **la bascule se fait par UPDATE DB**, pas par toggle Vercel. Risque juridique direct si bascule sans validation lawyer.
- **Bloquants connus** :
  1. Lawyer D1 + D2 validation (asynchrone — email pro INTERLIGENS, dossier "outreach lawyers")
  2. `BIRDEYE_API_KEY` manquante
  3. `ARKHAM_API_KEY` manquante (Arkham = abonnement payant ~$200-500/mois)
  4. Première cron scan jamais lancée
- **Cron Vercel** : **aucun cron MM_TRACKER dans `vercel.json`** (vérifié 2026-05-27). Lancement = manuel via admin route ou script.

### Premiers pas reprise
```bash
# 1. Vérifier réponse lawyer pendant absence
#    Email pro INTERLIGENS, dossier "outreach lawyers" — D1 ET D2

# 2. Si lawyer OK :
#    a. Souscrire Arkham (~$200-500/mois) ou abandonner cette source
#    b. Obtenir Birdeye API key (free tier d'abord)
#    c. Configurer env vars sur Vercel UI (jamais en local commité)
#    d. Lancer première cron scan (manuelle, monitorer Better Stack)
#    e. Bascule entités DRAFT → PUBLISHED **UNIQUEMENT après green light lawyer écrit**

# 3. Si lawyer pas OK ou silencieux :
#    a. Module reste gelé — état actuel
#    b. Décision stratégique : geler définitivement, pivoter, ou relancer outreach
```

### Effort estimé
- Si tous les bloquants levés : ~1 journée
- Si lawyer bloque : 0h tant qu'il n'a pas répondu

### Risques
- **Bascule entités DRAFT → PUBLISHED sans validation lawyer écrite = risque juridique majeur**
- Pas de feature flag = pas de rollback simple côté Vercel — c'est un UPDATE DB qu'il faut savoir reverser

---

## 6. LIBERTAS RESEARCH

### État actuel
- **Sprint C** : terminé à 65/100 post red-team
- **Sprint D Monero FCMP++** : planifié, pas démarré
- **Code dans src/** : **aucun fichier `libertas` retrouvé** dans `src/` au 2026-05-27 — c'est de la research docs-only
- **Build-to-break** sur Solana devnet uniquement (jamais mainnet)
- **Pas de feature flag** : pas de surface produit, pas de flag

### Premiers pas reprise
```bash
# 1. Re-lire findings Sprint C dans docs/libertas/ ou content/whitepapers/
find docs content -name "*libertas*" -o -name "*sprint-c*" 2>/dev/null

# 2. Évaluer si Sprint D Monero FCMP++ encore pertinent
#    Monero FCMP++ stressnet beta lancée mai 2026 → check état réel en septembre

# 3. Décider : continuer Sprint D ou conclure LIBERTAS comme corpus pédagogique
```

### Effort estimé
- Sprint D si fait : 1-2 semaines plein temps
- Conclusion documentaire : 1-2 jours

### Risques
- Research lourde, demande concentration profonde — pas adaptée à la phase post-retour (énergie sur déblocage produit prioritaire)
- Pas de bénéfice direct beta INTERLIGENS

---

## 7. WATCHER V2 CRON

### État actuel (scan code 2026-05-27)
- **V1** : actif sur Host-005 (`krypt@MacBook-Pro-4`)
  - launchctl, 29 handles trackés
  - Stable
  - Décommissionnement V1 prévu **avant 2026-06-01** selon mémoire — à vérifier (peut-être encore actif pendant l'Indo, ce qui est OK)
- **V2 endpoint** : `src/app/api/cron/watcher-v2/route.ts` — code lu, **paraît correct** :
  - Auth fail-closed (`CRON_SECRET` requis)
  - GET et POST handlers, POST délègue à GET
  - `maxDuration: 300`, `runtime: nodejs`, `dynamic: force-dynamic`
  - Budget guard `WATCHER_MAX_HANDLES` (default 50)
  - Email mode `digest` par défaut
- **Cron Vercel actif** : ⚠️ **`vercel.json:8` planifie `/api/cron/watcher-v2` tous les 3 jours à 6h UTC** (`"schedule": "0 6 */3 * *"`). **Le cron est actif et continuera à tourner pendant l'Indo.**
- **Source des handles** : `src/lib/watcher/handles.ts` (cf. mémoire `project_watcher_v2_migration`)
- **Bug réel ?** : le memo mentionne "405/500" mais le code lu paraît bien formé. Hypothèses :
  - `CRON_SECRET` mal configuré sur Vercel
  - `X_BEARER_TOKEN` non configuré (route retourne 500 si `!hasToken()`)
  - Erreur interne pendant `scanAll()` (catch → 500 générique)
  - Cron Vercel n'envoie pas le header `Authorization: Bearer $CRON_SECRET` correctement
  - Vercel cron POST vs GET (route accepte les deux)
- **Conséquence pratique pendant l'Indo** : si le cron `watcher-v2` échoue silencieusement 24× sur 2 mois, **rien de catastrophique** — V1 launchctl Host-005 couvre. Mais Better Stack alertera probablement → David recevra des notifications email.

### Premiers pas reprise
```bash
# 1. Vérifier état V1 Host-005 (priorité absolue avant toucher V2)
ssh krypt@MacBook-Pro-4 'launchctl list | grep watcher'

# 2. Récupérer les derniers logs cron Vercel /api/cron/watcher-v2
#    Vercel dashboard → Functions → /api/cron/watcher-v2 → Logs

# 3. Identifier la vraie cause du 405/500
#    Probable : auth header, X_BEARER_TOKEN, ou erreur DB pendant scan
#    Lire la stack trace plutôt que deviner

# 4. Test local
PORT=3100 pnpm dev
curl -X GET http://localhost:3100/api/cron/watcher-v2 \
  -H "Authorization: Bearer $CRON_SECRET"

# 5. Fix + test prod (preview d'abord)
# 6. Décommissionnement V1 Host-005 UNIQUEMENT après 2 cycles V2 verts consécutifs
```

### Effort estimé
- Diagnostic logs Vercel : 30 min
- Fix selon cause : 1-3h
- Test + deploy preview + 2 cycles verts : ~1 semaine (puisque cron tous les 3 jours)
- Décommissionnement V1 : 30 min mais **ne pas précipiter**

### Risques
- Si V2 marche mais migre mal les handles V1 → perte de tracking
- Decommissioning Host-005 prématuré → V1 perdu sans backup
- **Pendant l'Indo** : le cron continue à tourner et à échouer si déjà en panne. Better Stack va alerter. Peut être bruyant. À voir si David veut désactiver le cron pendant l'absence (PR draft minimale — non fait dans cette session).

---

## 📂 Stashes WIP conservés

Voir `docs/STASH_INVENTORY_2026-05-24.md` si créé, sinon `git stash list`. Au 2026-05-27 :
- `stash@{0}` — `pre-offline-setup-20260520-120632`
- `stash@{1}` — `WIP on main: d75adf1 chore(watcher-v2): remove 21 dead handles confirmed by X API`
- `stash@{2}` — `WIP on main: 0b9a05d fix: structural foundations — layout system, responsive, routes, sparse graph, design consistency`

À arbitrer à froid au retour. **Ne pas drop sans relire.** Trois stashes représentent du travail accumulé sur 3 sujets distincts.

---

## 🏷️ Tags posés pour ce snapshot

```bash
# Snapshot global (à poser le 31 mai par David)
prod-pre-2026-05-31

# Corpus pédagogique (déjà posé)
corpus-pedagogique-v1-2026-05-23

# Safety branches Website 2.0 (posés cette session, 2026-05-27)
safety/website-v2-discipline-pages-pre-indo-2026-05-24
safety/website-v2-3d-constellation-poc-pre-indo-2026-05-24

# Archive branches produit (déjà posés antérieurement)
archive/feat-founding-intelligence-seed-2026-05-24
archive/feat-mm-tracker-2026-05-24
archive/feat-scam-universe-graph-2026-05-24
```

---

## 🔓 Commandes utiles au retour

```bash
# 1. Synchro repo
git checkout main
git pull origin main
git fetch --prune --tags

# 2. Voir tous les tags
git tag

# 3. Voir les branches stratégiques restantes
git branch -r | grep -v origin/main | grep -v origin/HEAD

# 4. Voir les stashes
git stash list

# 5. Voir l'historique récent
git log --oneline -20

# 6. Sanity check tests
pnpm install
pnpm typecheck
pnpm test
```

---

## 🎯 Stratégie distribution corpus pédagogique (post-Indo)

GPT a confirmé : marché KOL investigateurs parasitaire. Recentrer sur :
1. **Cabinets juridiques avec mandat** (paying clients)
2. **Autorités** (LCEN, AMF, BEFTI quand le moment vient)
3. **CEX / custodians / KYC providers** (signal externe crédible)
4. **Victimes directes** via canal d'accueil propre

À approfondir au retour. Ne pas perdre d'énergie sur les KOL investigateurs avant.

---

## ⚠️ Règles non-négociables au retour

- Ne **JAMAIS** reprendre tous les modules en même temps
- Maximum 1 module débloqué par semaine
- Tag safety **avant** toute reprise
- Tests verts + smoke **avant** toute bascule prod
- DB Neon migration **uniquement** via SQL Editor, jamais `prisma db push`
- Feature flag bascule **uniquement** via Vercel UI, jamais via `.env` committé

---

## 🚨 État de ce que CC a fait pendant l'Indo

Pendant la période 2026-06-01 → 2026-07-27, CC opère en mode OFFLINE sous `CLAUDE.offline.md`. Au retour, vérifier :

1. **PR draft offline ouvertes** : `gh pr list --state open --label offline` (ou `gh pr list --search "is:draft"`)
2. **Branches `feat/cc-offline-*` non mergées** : `git branch -r | grep cc-offline`
3. **Aucune bascule prod** : `git log --since 2026-06-01 --until 2026-07-27 main` doit montrer **uniquement** ce que David a fait avant son départ (le main est gelé hors hotfix)
4. **Aucune migration Neon** : Neon dashboard → vérifier qu'aucune migration n'a été appliquée pendant l'absence

---

**Document généré le 2026-05-27 par CC autonomie pré-Indo. À mettre à jour si nouvelle information avant départ.**
