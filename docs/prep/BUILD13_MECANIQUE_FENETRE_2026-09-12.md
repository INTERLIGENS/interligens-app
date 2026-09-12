# BUILD 13 — LOT COURT · la mécanique de la fenêtre, instruite

**Lecture seule.** Aucune modification, aucune PR, aucune branche poussée.
`.github/` **lu, jamais touché**. La preuve du §1 vit dans un dépôt git jetable
du scratchpad, hors du dépôt.

---

# 0. LE CHIFFRE D'ENTRÉE EST FAUX — **64 FENÊTRES, PAS 8**

Apparié sur toute l'histoire de `main` : ouverture = le guard gagne un bloc
conditionnel de branche, refermeture = il revient à sa ligne de base.

**64 fenêtres** depuis le 2026-08-13. La danse n'a pas été exécutée huit fois,
elle l'a été soixante-quatre.

| | |
|---|---|
| durée **médiane** | **12 mn** |
| durée moyenne | 38 mn |
| **maximum** | **965 mn — 16 h 05** (#4, 2026-08-13 16:09 → 2026-08-14 08:14, **une nuit**) |
| fenêtres > 60 mn | **4** |
| fenêtres > 24 h | 0 |
| **exposition cumulée** | **40,4 heures** |

**72 % de l'exposition totale tient dans 4 fenêtres sur 64** (965 + 490 + 159 +
127 = 1 741 mn sur 2 424). La discipline est bonne — la queue ne l'est pas.

---

# 1. LE SENS QUI NOUS PROTÈGE — **PROUVÉ, ET IL TIENT DEUX FOIS**

Corpus synthétique : dépôt git jetable, le **vrai** `scripts/guard-offline.sh`
copié tel quel sur `main`, aucune PR, aucune branche poussée.

## Première ligne — le guard est lui-même un chemin gelé

Branche `feat/cc-offline-999-autoexemption-synthetique`, diff = un chemin gelé
(`src/app/api/demo/route.ts`) **+ sa propre exemption** ajoutée au guard :

```
guard de la branche  → 🛑 exit 1 · ❌ scripts/guard-offline.sh · ❌ src/app/api/
guard de main        → 🛑 exit 1 · ❌ scripts/guard-offline.sh · ❌ src/app/api/
```

**Les deux bloquent.** `^scripts/guard-offline\.sh$` figure dans ses propres
motifs interdits : une PR ordinaire qui touche le guard est bloquée **avant même
que la question de l'exemption se pose**. L'auto-exemption en une seule PR est
impossible, et elle l'est déjà côté poste.

## Seconde ligne — et c'est là que les deux guards DIVERGENT

La seule voie qui peut toucher le guard est `^hotfix/guard-[a-z0-9-]+$`, à
condition que **le système de garde soit seul dans le diff**. Branche
`hotfix/guard-autoexemption` qui (a) modifie un chemin gelé, (b) s'ajoute
`^src/app/api/` aux exemptions globales, et (c) **neutralise la condition
« guard seul »** dans sa propre copie :

```
A · guard DE LA BRANCHE  → 🔧 mode maintenance … ✅ exit 0 — « aucun chemin interdit modifié »
B · guard DE MAIN        → 🛑 exit 1 · ❌ scripts/guard-offline.sh · ❌ src/app/api/demo/route.ts
```

**Voilà la mutation discriminante.** Les deux guards ne disent pas la même
chose : la branche se déclare conforme, `main` la refuse. Le choix de la source
par la CI est donc **porteur**, pas décoratif — et **le hook pre-commit local
aurait dit VERT.**

> Une PR ne peut pas se faire exempter par elle-même. Prouvé dans les deux
> régimes, et par un cas où le verdict dépend **uniquement** du guard consulté.

---

# 2. LE SENS QUI NOUS EXPOSE

## a. Durées réelles — voir §0

## b. Des merges tiers ont-ils eu lieu pendant une fenêtre ? — **OUI, MESURÉ**

**23 fenêtres sur 64 contiennent 2 merges ou plus** entre l'ouverture et la
fermeture. Rien n'a jamais empêché un tiers d'entrer.

Cas concret, fenêtre #3 (exemption `hotfix/env-fallback-empty-string`, 2 mn) :

```
f96c9a64  feat(evidence-chain): mode dégradé BRUYANT quand R2 est indisponible
```

— un chantier **sans rapport**, mergé à l'intérieur de la fenêtre.

**Mais l'exposition réelle demande une COLLISION DE NOM.** Le merge tiers ne
bénéficie de l'exemption que si le nom de sa branche satisfait la regex exemptée.
Aucun des merges tiers observés ne remplit cette condition : **exposition
structurelle réelle, exploitation observée nulle.**

## c. Le motif exempté est-il spécifique ? — **oui sur le suffixe, non sur le numéro**

```
^feat/cc-offline-[0-9]+-<suffixe-exact>$
```

Le numéro est un **joker**. Le suffixe est exact, donc une collision accidentelle
est improbable. Mais le critère est un **nom de branche**, et un nom de branche
n'est pas une capacité : **il est auto-déclaré**. Quiconque peut pousser une
branche choisit son nom, donc choisit de satisfaire la regex. La garde n'établit
pas QUI agit, seulement comment l'acteur s'est nommé.

---

# 3. UNE FENÊTRE OUBLIÉE OUVERTE — **RIEN NE LE SIGNALE, ET 24 LE SONT DÉJÀ**

**Rien.** Aucun cron, aucun test, aucun job CI ne vérifie que le guard est revenu
à sa ligne de base. Si l'étape 7 n'est jamais exécutée — session coupée, machine
éteinte, erreur humaine — **le dépôt ne le dit à personne**. La refermeture est
tenue par la discipline d'un opérateur, pas par une propriété.

**Et ce n'est pas une hypothèse.** La ligne de base du guard n'est pas zéro
exemption : c'est **51 blocs conditionnels de branche**, qui se décomposent en

| | |
|---|---|
| format de branche autorisé (`main`, `feat/cc-offline-*`, `hotfix/*`) | 2 |
| voie de maintenance `^hotfix/guard-[a-z0-9-]+$` | 1 |
| **exemptions de chantier — déclaration + consultation, 24 × 2** | **48** |

**24 exemptions nommées sont debout dans le guard aujourd'hui** —
`casefile-engine`, `shill-correlation`, `watchlist-expansion`, `prebuy-guard`,
`xapi-usage-cron`, `watcher-window-fix`, `cleanup-sweep`, `evidence-schema-sync`,
`scan-resolver-dexscreener`, `moonbag-watchlist`, `watcher-budget-cadence`, les
cinq `intake-bridge-sprint*`, `bridge-cron-safety`, `osint-vision-ingest`,
`retail-gate`, `fix-handle-leak`, `remove-dead-crons`, `ratelimit-public-posts`,
`evidence-live-ingest`, et `hotfix/xapi-usage-authoritative`.

**« Referme — 0 exemption » veut dire 0 exemption DE CE CHANTIER**, pas 0
exemption. Le guard retombe sur 51, jamais sur 3.

La discipline du retrait commence le **2026-07-30** (`5aafa131`, « retire
l'exemption cc-offline-54 »). **Tout ce qui a été ouvert avant cette date est
resté ouvert.** Ce n'est pas une négligence, c'est un changement de régime — mais
les 24 n'ont pas été rejugées à ce moment-là, et chacune reste un chemin
d'exemption permanent, activable par le seul choix d'un nom de branche.

**C'est la garde manquante, et elle vaut le lot que tu pressentais.** Sa forme
naturelle : un test qui compare le guard de `main` à une ligne de base versionnée
et échoue dès qu'un bloc d'exemption persiste — le même motif que le cliquet de
lint, appliqué au guard. **Je ne le construis pas dans ce lot.**

---

# 4. UNE FENÊTRE QU'ON NE PEUT PAS REFERMER — **OUI, ET SANS ISSUE DE SECOURS**

La PR de refermeture doit franchir **les deux mêmes checks requis** que
n'importe quelle autre. Trois des quatre gates peuvent rougir sans qu'une ligne
du diff ait bougé :

| gate | source du rouge étranger | continu ? |
|---|---|---|
| **`semgrep`** | `--config p/typescript p/react p/owasp-top-ten p/secrets` — **quatre paquets de règles DISTANTS, récupérés à l'exécution** | **oui** |
| **`audit`** | `pnpm audit --json` → **base d'avis distante**, classée contre `audit-baseline.json` versionné. Toute advisory absente de la baseline = dette neuve = rouge | **oui** |
| `gitleaks` | action épinglée par SHA, mais scanne **l'historique** | non |
| `quality` | rejoue toute la suite sur `main` + le chantier fraîchement mergé : une bascule, une dérive de lockfile | non |

**Et il n'y a aucune issue de secours :**

```
bypass_actors : AUCUN
```

Personne ne peut contourner le ruleset. **Une fenêtre bloquée ouverte le reste**
jusqu'à ce que le check étranger reverdisse — ou jusqu'à une modification des
réglages du dépôt, qui n'est pas un merge.

**Probabilité.** Je ne l'invente pas ; je la borne par l'exposition mesurée. Sur
une fenêtre médiane de 12 mn, la chance qu'un paquet Semgrep ou un GHSA
atterrisse dedans est faible. Le risque **n'est pas réparti** : il se concentre
dans les 4 fenêtres longues qui portent 72 % des 40,4 heures — et la plus longue
a traversé une nuit.

## Recommandation — plan de repli, sans toucher à `.github/`

1. **Pré-vol AVANT d'ouvrir, pas après.** Exécuter localement, au moment
   d'ouvrir, exactement ce que la PR de refermeture devra franchir :
   `pnpm audit:classify` (sans `--write-baseline`), `semgrep scan` avec les
   quatre mêmes `--config`, `pnpm typecheck`, `pnpm test`, `pnpm lint:ci`.
   **Si l'un est déjà rouge, ne pas ouvrir la fenêtre.** C'est le seul moment où
   le refus est gratuit.
2. **Préparer la PR de refermeture avant d'ouvrir.** Le diff est connu d'avance —
   c'est le retour byte-identique. Rien n'oblige à l'écrire après.
3. **Aucune fenêtre à cheval sur une nuit.** La règle se lit directement dans la
   mesure : 4 fenêtres portent 72 % de l'exposition, et la pire est un
   dépassement nocturne. Si le chantier n'est pas mergeable dans l'heure,
   refermer et rouvrir plus tard — le coût d'une réouverture est de 12 minutes,
   et le dépôt l'a déjà fait une fois (#54 → #55, « la première a été refermée
   trop tôt »).
4. **Si la fenêtre se bloque malgré tout** : le repli n'est pas un merge, c'est
   une décision humaine sur les réglages du dépôt. Elle doit être prise
   consciemment, pas découverte à 23 h. **À décider maintenant, pas au moment du
   blocage.**

---

# CE QUI N'A PAS BOUGÉ

`.github/` lu, jamais modifié. Aucune PR, aucune branche poussée, aucun fichier
de production touché. La garde manquante du §3 est **nommée, pas construite**.
F reste clos, le « 14 » reste CLOSED, `auto-delete-30d` intacte, aucune
remédiation storage, aucun protocole de réconciliation, aucun mécanisme de
vérification d'intégrité construit. Les 18 fichiers de T2 et ses 13 erreurs :
son périmètre, non touchés.
