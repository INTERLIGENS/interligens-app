# BUILD 13 — LOT COURT · classer les 24, concevoir le cliquet, décider le repli

**Aucun merge, aucune PR, aucune branche poussée.** `.github/` lu, jamais
touché. Le guard **n'est pas modifié** : le retrait existe comme **patch** dans
le scratchpad, hors du dépôt. Ce lot n'ajoute au dépôt que ce document.

---

# CHANTIER 1 — LES 24, CLASSÉES

## Verdict : **24 MORTES, 0 VIVANTE, 0 DOUTEUSE**

Mesuré sur le dépôt, pas sur nos notes. Trois signaux croisés par exemption :

1. **existe-t-il une branche satisfaisant la regex exemptée** — appariement par
   la regex elle-même, pas par ressemblance de nom ;
2. **`git cherry main <branche>`** — les patchs non retrouvés dans `main` ;
3. **le diff RÉSIDUEL sur les seuls chemins que l'exemption ouvre** — c'est le
   seul qui réponde à la vraie question : « retirer cette exemption
   casserait-il un travail vivant ? »

**Le signal naïf mentait.** `git rev-list --count main..<branche>` donnait 22
branches « en avance » — mais il compte des **SHA**, et `squash`/`rebase` les
réécrivent. Deux exemptions sont ressorties DOUTEUSES sur ce critère
(`casefile-engine` +2, `cleanup-sweep` +1) ; leurs patchs sont sur `main`, mergés
en squash — `02cfd1e` (PR #8) et `322b0cb`. **Elles sont MORTES.**

Aucune branche concernée n'a bougé depuis le **2026-08-13**, la plus ancienne
depuis le 2026-05-21.

## Classement par CE QU'ELLES OUVRENT, pas par leur âge

### ⛔ Rang 1 — elles ouvrent la frontière de publication nominative

| exemption | posée | ce qu'elle ouvre |
|---|---|---|
| **`fix-handle-leak`** | 2026-07-30 `f979eed` | **les 6 routes du gate de publication** : `v1/kol/[handle]`, `laundry/[handle]`, `kol/[handle]/class-action`, `/cashout`, `/wallet-history`, `watchlist` |

C'est **exactement** la surface de F. Ces six routes portent `PUBLIC_KOL_FILTER`,
et cette exemption les rouvre — à quiconque nomme sa branche
`feat/cc-offline-<n'importe quel nombre>-fix-handle-leak`.

### ⛔ Rang 2 — répertoire entier, sans ancrage sur un fichier

| exemption | posée | ce qu'elle ouvre |
|---|---|---|
| **`retail-gate`** | 2026-07-30 `00f0e4a` | **`^src/app/api/osint/`** — un sous-arbre d'API **publique** entier — + `^src/app/api/admin/osint/retail/` |
| **`osint-vision-ingest`** | 2026-07-30 `56c5dc3` | `^prisma/schema.prod.prisma$` + **`^migrations/`** (la seule) + `^src/app/api/admin/osint/` |
| `shill-correlation` | 2026-06-17 `3cf5942` | `^prisma/` + **`^src/lib/kol/proceeds.ts$`** + `^src/app/api/admin/shill-correlation/` |
| `casefile-engine` | 2026-05-21 `02cfd1e` | `^prisma/` + `^src/components/admin/casefile-engine/` |
| `prebuy-guard` | 2026-06-17 `c9deab2` | `^src/app/api/admin/prebuy/` |
| `intake-bridge-sprint7-approve-action` | 2026-06-27 `6c25d11` | `^prisma/` + `^src/app/api/admin/watcher-drafts/` |

### ⚠️ Rang 3 — écriture non authentifiée et cadence de production

| exemption | posée | ce qu'elle ouvre |
|---|---|---|
| `ratelimit-public-posts` | 2026-07-30 `a714cb4` | 3 POST publics : `scan/solana/graph/jobs`, `reflex/[id]/watch`, `v1/mm/challenge` |
| `watcher-budget-cadence` | 2026-06-26 `d65b47b` | cron watcher-v2 + **`^vercel.json$`** |
| `remove-dead-crons` | 2026-07-30 `af6966f` | **`^vercel.json$`** |
| `cleanup-sweep` | 2026-06-25 `322b0cb` | `^prisma/` + `^src/lib/watcher/handles.ts$` + cron watcher-v2 |
| `evidence-live-ingest` | 2026-08-13 `0cad945` | `^prisma/` + `api/osint/submit` + `api/admin/osint/commit` |
| `intake-bridge-sprint4-draft-bridge` | 2026-06-26 `6ce95ae` | `api/scan/resolve` + `api/watchlist` |
| `scan-resolver-dexscreener` | 2026-06-26 `9196ff1` | `api/scan/resolve` + `^src/components/scan/TokenPicker.tsx$` |
| `intake-bridge-sprint8-visibility-filter` | 2026-06-29 `089a2b4` | `^src/lib/kol/kolLeaderboard.ts$` |
| `hotfix/xapi-usage-authoritative` | 2026-07-30 `8611385` | cron watcher-v2 + son test |
| `xapi-usage-cron` · `watcher-window-fix` | 2026-06-25 | cron watcher-v2 |
| `watchlist-expansion` · `moonbag-watchlist` | 2026-06 | `^src/lib/watcher/handles.ts$` |

### ○ Rang 4 — schéma seul

`evidence-schema-sync`, `intake-bridge-sprint1-schema`,
`intake-bridge-sprint5-state-machine`, `bridge-cron-safety` → `^prisma/schema.prod.prisma$`.

### Concentration mesurée

| chemin gelé | nombre d'exemptions qui l'ouvrent |
|---|---|
| `^src/app/api/` | **15** |
| `^prisma/schema.prod.prisma$` | **10** |
| `^src/lib/watcher/` | 3 |
| `^src/lib/kol/` · `^vercel.json$` · `^src/components/` | 2 chacun |
| `^migrations/` | 1 |
| `^src/lib/security/` · le guard lui-même | **0** |

**Aucune des 24 n'ouvre `^src/lib/security/` ni le guard.** C'est la seule bonne
nouvelle du tableau, et elle est mesurée.

## Le témoin positif — l'exposition n'est pas théorique

Corpus synthétique, dépôt jetable, les deux guards sur le même arbre :

```
feat/cc-offline-99-fix-handle-leak  touche  src/app/api/v1/kol/[handle]/route.ts
   guard ACTUEL   → exit 0   ✅ « aucun chemin interdit modifié »
   guard NETTOYÉ  → exit 1   🛑 bloqué
```

**Aujourd'hui, n'importe qui peut nommer sa branche
`feat/cc-offline-<n>-fix-handle-leak` et modifier les six routes du gate de
publication avec la bénédiction du guard.** Ce n'est pas un raisonnement, c'est
une exécution.

Non-régression, quatre contrôles, verdicts **identiques** avant/après :
chantier quelconque sur chemin libre (0/0), chantier quelconque sur chemin gelé
(1/1), `hotfix/*` sur chemin gelé (1/1), `fix-handle-leak` sur chemin libre (0/0).

## Le diff proposé — **préparé, non appliqué**

`scratchpad/retrait-24-exemptions.patch` — **s'applique proprement** (essai à
blanc), **`bash -n` OK**.

| | avant | après |
|---|---|---|
| blocs conditionnels de branche | **51** | **3** |
| exemptions de chantier | 24 | **0** |
| lignes du guard | 887 | **258** |
| suppressions / ajouts | — | 630 / 1 |

Les 3 blocs restants sont structurels : les deux formats de branche autorisés, et
la voie de maintenance `^hotfix/guard-[a-z0-9-]+$`. `OFFLINE_EXEMPT_PATTERNS` et
`EXEMPT_SETUP_PATTERNS` sont conservés — ils ne sont pas conditionnés à un nom de
branche de chantier. **Aucune référence pendante** à un tableau supprimé.

⛔ **Rien n'est appliqué. Le guard du dépôt est intact.** Cette PR passe par la
voie de maintenance `hotfix/guard-*` et par ton ruling.

---

# CHANTIER 2 — LE CLIQUET, CONÇU

## a. Sur quoi il s'ancre — une IDENTITÉ, jamais une coordonnée

**Pas un numéro de ligne, pas un compte, pas un hash du fichier.** L'ancre est
l'**ensemble** :

```
{ regex de branche exemptée  →  ensemble trié des chemins qu'elle ouvre }
```

Réindenter, réordonner, réécrire un commentaire ne le change pas. **Ajouter une
exemption, ou élargir un chemin, le change.** C'est la propriété qu'on défend,
pas sa mise en page. Un compte seul serait une coordonnée déguisée : 24 → 24
avec un chemin élargi passerait.

## b. Ce qu'il autorise — la déclaration, **jamais l'horloge**

Deux cliquets, et il en faut deux :

**R1 — BLOQUANT, sans horloge.** L'ensemble extrait du guard doit être **égal**
à une ligne de base versionnée. Il attrape l'élargissement **non déclaré**. Son
verdict est une **fonction pure de l'arbre** : le même diff rend toujours le même
verdict. C'est délibéré — nous venons de mesurer ce que coûte une porte
étrangère au diff, et un cliquet à horloge en serait une de plus.

**R2 — NON BLOQUANT, et c'est là que vit l'horloge.** Chaque entrée de la ligne
de base porte `ouverte_le` et `fermeture_attendue`. Un contrôle périodique
signale les entrées échues. **Il ne gate aucun merge, jamais** : sinon une
fenêtre oubliée deviendrait une fenêtre qu'on ne peut pas refermer, et on aurait
fabriqué le défaut qu'on répare.

**Pourquoi il en faut deux, et c'est la limite honnête du dessin :** une fenêtre
légitimement ouverte **maintenant** et une fenêtre **oubliée** ont exactement le
même arbre. Aucune fonction pure de l'arbre ne peut les distinguer. **Le temps est
le seul discriminant** — donc il existe, mais il est mis là où il ne peut rien
bloquer.

## c. Où il vit — et le serpent qui se mord la queue, évité

| | |
|---|---|
| `.github/` | **gelé** — exclu |
| le guard lui-même | un cliquet sur le guard, posé dans le guard — **exclu** |
| **`__tests__/garde/`** | **terrain libre**, et déjà exécuté par `quality` → `Tests` → `All Security Gates Passed`, qui est **requis**. R1 devient bloquant **sans toucher à la CI** |
| `scripts/` | terrain libre — R2, invoqué à la main ou par un cron existant, jamais dans un check requis |

**Le piège que ce placement révèle, et il faut le traiter dans la même PR.** La
voie de maintenance exige « système de garde **SEUL** dans le diff ». Donc une PR
d'ouverture ne peut **pas** modifier le guard et la ligne de base ensemble : R1
virerait rouge sur la branche d'ouverture et **bloquerait la danse**.

→ **La ligne de base doit entrer dans `GUARD_SYSTEM_FILES`.** C'est une
modification du guard, donc elle fait partie du même ruling. Sans elle, le
cliquet rend la fenêtre impossible au lieu de la surveiller.

## d. Mode de défaillance — en cas de doute, il CRIE

**R1 échoue si son analyse est douteuse**, il ne passe jamais en silence. La
vérification de non-vacuité est explicite :

```
nombre de « if [[ "$BRANCH" =~ »  ==  structurels + exemptions extraites
```

Si le compte ne tombe pas, l'analyseur n'a pas compris le fichier → **ROUGE**.
Sans cette borne, une réécriture du guard qui met l'analyseur en défaut
produirait « 0 exemption extraite = conforme à une base de 0 » — vert par
vacuité, c'est-à-dire **la garde exacte qu'on vient de fermer trois fois
aujourd'hui**.

## e. Comment on prouve qu'il MORD — témoin positif, trois directions

| direction | corpus synthétique | attendu |
|---|---|---|
| **exemption oubliée** | guard portant une exemption absente de la base | **ROUGE** |
| **base périmée** | base portant une entrée absente du guard | **ROUGE** |
| **analyseur mis en défaut** | guard réécrit hors forme reconnue | **ROUGE**, jamais vert |
| conformité | guard == base | VERT |

Le premier est le témoin positif exigé : sans lui, un R1 vert serait indiscernable
d'un R1 qui ne regarde rien.

## Ce qu'il ne couvre PAS — dit d'avance

- Il ne juge **pas** si une exemption est *appropriée* — seulement si elle est
  **déclarée**. Une exemption abusive mais déclarée passe. Ça reste une revue
  humaine.
- Il ne détecte **pas** l'*usage* d'une exemption, seulement son existence.
- R2 est structurellement une porte étrangère au diff. C'est pourquoi il ne
  bloque rien, et c'est une limite, pas un défaut.
- Il ne protège pas contre un acteur qui contrôle la voie de maintenance — la
  protection y reste le guard de `main` et la revue humaine.

**Aucune ligne de code écrite.**

---

# CHANTIER 3 — LE REPLI, DÉCIDÉ À FROID

## a. Le pré-vol, concrètement

**Le diff de fermeture est connu d'avance** : c'est le retour à l'état actuel du
guard. Il est donc testable **avant** d'ouvrir. Mais l'arbre que la PR de
fermeture fera tourner n'est pas `main` d'aujourd'hui — c'est **`main` + le
chantier fraîchement mergé**. Le pré-vol doit donc porter sur **les deux**.

**Séquence, dans cet ordre :**

1. **Sur la branche du chantier** — c'est elle qui déplacera `main` :
   `pnpm typecheck` · `pnpm test` · `pnpm lint:ci` · `pnpm audit:classify`
   (**sans** `--write-baseline`) · `semgrep scan --config p/typescript --config
   p/react --config p/owasp-top-ten --config p/secrets --error --quiet`.
2. **Sur `main`** — les deux gates réellement volatils : `pnpm audit:classify` et
   le même `semgrep scan`. Ce sont eux qui rougissent sans qu'une ligne bouge.
3. **`gitleaks`** est le moins volatil : action épinglée par SHA, et le diff de
   fermeture ne touche pas l'historique. Il ne change pas d'avis entre
   l'ouverture et la fermeture, sauf si le chantier lui-même introduit un secret
   — donc couvert par l'étape 1.
4. **Si l'un des cinq est rouge à l'étape 1 ou 2 : NE PAS OUVRIR.** C'est le seul
   instant où le refus est gratuit.
5. Rédiger la PR de fermeture **avant** l'ouverture. Son diff est connu.

## b. Si ça bloque quand même — il n'y a pas trois voies, il y en a trois

`bypass_actors : AUCUN`. Personne ne contourne le ruleset.

| voie | coût | quand |
|---|---|---|
| **attendre que ça reverdisse** | la fenêtre reste ouverte, **durée non bornée** — un avis amont peut rester des jours. C'est l'exposition mesurée, prolongée sans plafond | jamais par défaut |
| **traiter la cause** (accepter l'avis dans `audit-baseline.json`, corriger le finding Semgrep) | un chantier non planifié, **pendant** que la fenêtre est ouverte — et s'il touche un chemin gelé, il faut une seconde fenêtre | quand la cause est petite et sûre |
| **la voie réglages** — ajouter temporairement un acteur de contournement pour poser la PR de fermeture **déjà préparée et byte-identique**, puis le retirer immédiatement | une modification de la protection de branche, tracée, réversible en une minute | **c'est la décision à prendre maintenant** |

**Recommandation : autoriser la troisième voie par avance, nominativement, et
sous conditions strictes** — uniquement pour poser une PR de fermeture *déjà
écrite et byte-identique au retour*, avec retrait du contournement dans la foulée
et mention au rapport. Sans cette autorisation prise à froid, la seule option
réelle à 23 h est « attendre », c'est-à-dire **laisser la fenêtre ouverte
indéfiniment** — précisément ce qu'on refuse.

## c. La borne dure — **45 minutes**, et elle ne coûte rien

Les durées ne sont pas continues. Il y a une **falaise nette** :

| | |
|---|---|
| p50 | **12 mn** |
| p75 | 16 mn |
| p90 | **22 mn** |
| p95 | 127 mn |
| max | 965 mn |

**60 fenêtres sur 64 tiennent en ≤ 30 mn. Les 4 autres sont à ≥ 127 mn. Il n'y a
RIEN entre 30 et 127.** Une borne posée n'importe où dans cet intervalle n'aurait
coûté **aucune** des 64 danses réelles.

**45 minutes** : deux fois le p90, largement au-dessus de toute fenêtre normale,
et bien sous la première anormale.

**Effet mesuré :** exposition cumulée **40,4 h → 14,4 h**, soit **−64 %**, sans
changer une seule pratique existante.

**Au-delà de 45 mn : on referme, même avec du code inachevé.** Le coût d'une
réouverture est de 12 minutes — le dépôt l'a déjà payé une fois de son plein gré
(fenêtre #55, « la première a été refermée trop tôt »). C'est le prix le plus bas
de la liste.

---

# CE QUI N'A PAS BOUGÉ

Le guard **n'est pas modifié**. Aucune PR, aucune branche poussée, aucun merge.
`.github/` lu, jamais touché. Le cliquet est **conçu, pas construit** — aucune
ligne de code. La neuvième fenêtre reste **HOLD**. F clos, le « 14 » CLOSED, E
sans mécanisme de vérification construit, aucune remédiation storage, aucune
mutation de compartiment. Périmètre de T2 intact.

---

# ÉPILOGUE — CE QUI A RÉELLEMENT ATTERRI

**Ce document est un rapport DATÉ.** Ce qui précède décrit l'état au moment où il
a été écrit, et n'est pas réécrit : un rapport qu'on corrige après coup cesse
d'être une mesure. Cet épilogue est ajouté parce que la livraison a rendu
plusieurs de ses phrases fausses — « non mergé », « le guard reste intact »,
« préparé, non appliqué » — et qu'une prose qui décrit un état que le dépôt n'a
plus est exactement le défaut que ce build referme.

> *Prose adjacent to an executable control is explanatory evidence only. It is
> never authority for the existence, semantics or effectiveness of that control.*

**Livré le 2026-09-12 par la voie normale — PR, CI, `gh`. Aucun push direct sur
`main`, aucun `--admin`.**

| PR | contenu | checks requis |
|---|---|---|
| **#383** | le guard seul — verifier, état de lease, retrait des 25 mortes | verts, **jugée par l'ANCIEN guard** (`ce13d0c0…`) par la voie de maintenance |
| **#384** | `__tests__/garde/leases.test.ts` — les témoins permanents | verts, **jugée par le NOUVEAU guard** |
| **#386** | l'inventaire devient un CLIQUET — correctif d'un défaut de #384 | verts |
| **#385** | la dernière exemption statique devient une lease | verts |

**Sur `origin/main` :** guard `ce13d0c0f9874837` → **`525e94b5e554f77c`**,
**STATIC PROJECT EXEMPTIONS = 0**, état de lease **vide**, borne `2700 s` dans le
mécanisme. Série de témoins rejouée contre `origin/main` : **13 / 13 conformes.**

**#386 n'était pas prévue.** L'assertion d'inventaire de #384 codait un chiffre en
dur, si bien que la PR atteignant l'objectif faisait échouer le test censé le
surveiller — l'asymétrie « l'autorité n'est requise que pour élargir » non
appliquée à son propre témoin. Corrigée en cliquet.
