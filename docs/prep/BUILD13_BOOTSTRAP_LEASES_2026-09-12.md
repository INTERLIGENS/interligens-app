# BUILD 13 — LE BOOTSTRAP DES LEASES · construit, prouvé, **non mergé**

**Deux branches LOCALES, aucune poussée, aucun merge. `main` est intact** —
le guard y porte toujours `sha256 ce13d0c0…`.

| branche locale | contenu | pourquoi séparée |
|---|---|---|
| `hotfix/guard-leases-bootstrap` (`3dbfa74`) | **`scripts/guard-offline.sh` seul** — verifier + état de lease + retrait des mortes | la voie de maintenance exige « système de garde SEUL dans le diff » |
| `feat/cc-offline-176-temoins-leases` (`c3a9839`) | `__tests__/garde/leases.test.ts` — **20 témoins** | `__tests__/` n'est pas un fichier du système de garde : il ne PEUT pas entrer dans la première |

**Aucun code produit, aucune route, aucun changement fonctionnel INTERLIGENS.**
C'est une migration du mécanisme de gouvernance. `.github/` lu, jamais touché.

---

# 1. CE QUE LA PR DE BOOTSTRAP CONTIENT

`scripts/guard-offline.sh` : **188 insertions, 654 suppressions**. Rien d'autre.

## 1.1 Le verifier de lease

Six conditions **simultanées** pour qu'un chemin gelé passe :

| condition | comment elle est vérifiée |
|---|---|
| **chemin EXACT** | égalité de chaîne. Joker, ancre et `*` sont **refusés à l'enregistrement** |
| **sujet** | la branche nommée dans la lease — **sélecteur, jamais autorité** |
| **SHA de base** | `git merge-base --is-ancestor` : la PR est bâtie sur le `main` de la lease |
| **état** | `OPEN` |
| **forme** | 8 champs, ISO-8601 UTC strict, durée ≤ 45 mn |
| **fraîcheur** | `now < expiresAt` |

`[handle]` reste un nom de répertoire Next.js parfaitement légitime : puisque la
comparaison est une **égalité**, il n'y a rien à échapper. Ce qui est interdit,
c'est ce qui ferait d'un chemin une **famille** de chemins. *(Corrigé en cours de
route : ma première version bannissait `[`, et le témoin 1 est tombé rouge — le
témoin a trouvé le défaut avant moi.)*

## 1.2 L'horloge

```
maintenant := max( horloge du runner , date du commit de BASE sur main )
```

La date de commit de la PR est **écartée** : `git commit --date` accepte
n'importe quoi. Le `max` est **monotone dans le bon sens** — une manipulation ne
peut que faire paraître le temps plus avancé, donc **raccourcir** une lease.

**Le plancher n'est pas décoratif, et je l'ai constaté en le subissant :** au
premier essai réel, il a **écrasé une horloge injectée à 14:30** parce que les
commits du laboratoire dataient de l'instant réel. Le témoin 1 est passé rouge
pour la bonne raison. C'est noté dans l'en-tête du fichier de test pour que
personne ne le redécouvre.

Le `now` évalué est **imprimé à chaque exécution** :

```
🔑 GUARD/LEASE: 0 lease(s) dans l'état · now évalué = 2026-09-12T15:04:53Z
```

> Le verdict de fraîcheur n'est pas rejouable. Il est **explicable**.

## 1.3 La borne est DANS le mécanisme

```bash
LEASE_DUREE_MAX_S=2700   # 45 minutes
```

Une lease de 60 minutes est **refusée à l'enregistrement** :
`lease « W9 » : durée 60 mn > 45 mn — la borne est dans le mécanisme.`
Ce n'est plus une consigne dans nos notes. **Mesurée, pas choisie** : sur 64
fenêtres réelles, 60 tiennent en ≤ 30 mn et les 4 autres sont à ≥ 127 mn.

## 1.4 Le théorème, inscrit dans l'ordre du code

La voie de maintenance `continue` **avant** toute évaluation de lease. Une
fermeture n'interroge donc **jamais** l'horloge.

> **L'autorité n'est requise que pour ÉLARGIR, jamais pour RESSERRER.**

Vérifié : la même fermeture est **verte à `now` = 2027-01-01**.

---

# 2. ⚠️ L'INVENTAIRE — CE QUI RESTE, PAS CE QUI PART

**Ce n'est pas « 25 exemptions supprimées ».**

> ## STATIC PROJECT EXEMPTIONS = **1**
>
> **`OFFLINE_EXEMPT_PATTERNS`** — 2 chemins (`^src/lib/pdf/nova/`,
> `^src/app/api/admin/casefile-nova/`). **Sujet vivant** dans `main`.
> **JUSTIFIÉE** — le module vit sous un chemin gelé et la retirer le figerait.
> **NON BORNÉE et SANS CONDITION** — elle s'applique à *toute* branche, `main`
> comprise. C'est exactement ce qu'une lease existe pour remplacer.
>
> **+ 3 mécanismes de workflow / maintenance** — deux formats de branche
> autorisés et la voie `^hotfix/guard-[a-z0-9-]+$`. **Ce ne sont pas des
> exemptions** : ils n'ouvrent aucun chemin.

**Ce qui part : 25 exemptions statiques MORTES.**

- **24** conditionnées à un nom de chantier — les 24 branches sont mergées,
  **aucun diff résiduel** sur les chemins qu'elles ouvraient.
- **`EXEMPT_SETUP_PATTERNS`** — la 25ᵉ, que mon patch initial ratait parce
  qu'elle est testée par **égalité** et non par regex. Sa branche
  `feat/offline-mode-setup` **n'existe plus**, et elle exemptait
  **`^.github/workflows/guard-offline.yml$` — le runner CI du guard lui-même**.
  Plus puissante que les 24 réunies.

**La conversion de la restante en lease n'est PAS dans cette PR.** Elle est le
premier client naturel du mécanisme — le prouver sur un cas réel plutôt que
fabriqué. **Je la cite, tu la poses.**

---

# 3. LES PREUVES — exécutées, pas raisonnées

## 3.1 Les sept témoins + les trois points d'horloge

| # | témoin | verdict |
|---|---|---|
| 1 | lease valide → chemin exact autorisé | **VERT** ✅ |
| 2 | la **même** lease, expirée | **ROUGE** ✅ |
| 3 | lease absente — état vide = **zéro autorité** | **ROUGE** ✅ |
| 4 | nom anciennement exempté, **sans lease** | **ROUGE** ✅ |
| 5 | lease pour A, la PR modifie B | **ROUGE** ✅ |
| 6 | **PR qui réécrit son juge** pour s'accorder sa lease | branche **exit 0**, `main` **exit 1** ✅ |
| 7 | lease `CLOSED` → l'ancienne branche, horloge pourtant valide | **ROUGE** ✅ |
| + | le **sujet** compte — la lease ne couvre pas une autre branche | **ROUGE** ✅ |
| + | chemin **libre** → reste libre | **VERT** ✅ |

**Horloge** (`expiresAt = 14:45:00Z`) : **T−1s VERT · T ROUGE · T+1s ROUGE**.
`now >= expiresAt` — l'instant d'expiration appartient au refus.

## 3.2 Non-vacuité — cinq formes, sur un chemin LIBRE

```
champs manquants      → 🛑 lease « W9 » : champ manquant — 8 champs exigés.
openedAt non ISO      → 🛑 lease « W9 » : openedAt non ISO-8601 UTC strict.
durée > 45 mn         → 🛑 lease « W9 » : durée 60 mn > 45 mn — la borne est dans le mécanisme.
joker dans un chemin  → 🛑 lease « W9 » : joker ou ancre interdit — chemins EXACTS uniquement.
état inconnu          → 🛑 lease « W9 » : état « PEUT-ÊTRE » inconnu.
```

Le témoin porte sur une branche qui **ne touche qu'un chemin libre** : la
validation tourne **inconditionnellement**. « 0 lease extraite = rien à
autoriser » est structurellement impossible.

## 3.3 AVANT / APRÈS — le retrait mord, et rien d'autre ne bouge

| cas | AVANT | APRÈS | lecture |
|---|---|---|---|
| **SENSIBLE** · `fix-handle-leak` → route du gate de publication | **0** | **1** | *** mord *** |
| **BANAL** · `moonbag-watchlist` → `handles.ts` | **0** | **1** | *** mord *** |
| **SETUP MORT** · `feat/offline-mode-setup` → **le runner CI du guard** | **0** | **1** | *** mord *** |
| non-régression · chemin libre | 0 | 0 | identique |
| non-régression · chemin gelé, nom non exempté | 1 | 1 | identique |
| non-régression · `hotfix/*` générique, chemin gelé | 1 | 1 | identique |
| non-régression · `OFFLINE_EXEMPT` (nova) | 0 | 0 | **conservée** |
| **VOIE DE FERMETURE** · `hotfix/guard-*`, guard seul | **0** | **0** | **vivante des deux côtés** |

Le témoin **banal** compte autant que le spectaculaire : il prouve que la méthode
ne marche pas que sur le cas qui fait peur.

## 3.4 Le nouveau guard s'auto-vérifie déjà

Le commit de bootstrap a été jugé par le guard de `main` — c'est-à-dire par
l'ancien — et **il passe la voie de maintenance**. Puis le commit des témoins a
été jugé par le **nouveau** :

```
🔑 GUARD/LEASE: 0 lease(s) dans l'état · now évalué = 2026-09-12T15:04:53Z
✅ GUARD: aucun chemin interdit modifié.
```

## 3.5 Chaîne de qualité

| contrôle | résultat |
|---|---|
| `__tests__/garde/leases.test.ts` | **20 / 20** |
| suite complète | **445 fichiers · 5 957 verts** · 1 échec attendu · 2 ignorés |
| `npx tsc --noEmit` | **0 erreur** |
| `eslint` sur le fichier | **0 problème** |
| `bash -n` sur le guard | **OK** |

---

# 4. L'ORDRE DE MERGE, ET SON UNIQUE POINT FAIBLE

1. **`hotfix/guard-leases-bootstrap`** — guard seul. Jugé par l'ancien guard,
   voie de maintenance. **Vérifié : passe.**
2. **`feat/cc-offline-176-temoins-leases`** — les 20 témoins, immédiatement
   après. Terrain libre, PR ordinaire.

**Le point faible, nommé :** entre les deux merges, le verifier existe **sans sa
preuve permanente**. Il ne peut pas en être autrement — `__tests__/` n'est pas un
fichier du système de garde, et l'y faire entrer exigerait d'étendre
`GUARD_SYSTEM_FILES`, donc **une ultime fenêtre à l'ancienne** : précisément ce
que l'option B évite.

**Atténuation, et elle est réelle :** les 20 témoins sont **exécutés, verts, et
joints à ce rapport AVANT le merge du bootstrap**. La preuve précède ; seule sa
permanence suit.

**Pré-vol de la fenêtre : sans objet.** Le bootstrap **n'ouvre aucune fenêtre** —
il passe par la voie de maintenance, qui n'est pas une exemption mais un contrat
de périmètre. Aucune lease n'est ouverte, l'état livré est **vide**.

---

# 5. CE QUE JE NE FAIS PAS

**Je ne merge pas.** Les deux branches sont locales et non poussées. `main` porte
toujours le guard `ce13d0c0…`.

Et le reste est inchangé : aucun code produit, aucune route, aucun changement
fonctionnel. `.github/` intact. La conversion d'`OFFLINE_EXEMPT_PATTERNS` **citée,
pas faite**. L'option A — l'état de lease en fichier propre — reste la cible, à
demander **sous lease**, pour que le mécanisme autorise son propre raffinement.
Le « 14 » CLOSED. F absorbé dans C/P1. E ACTIVE, aucun mécanisme de vérification
d'intégrité construit, aucune remédiation storage. Périmètre de T2 intact.

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
