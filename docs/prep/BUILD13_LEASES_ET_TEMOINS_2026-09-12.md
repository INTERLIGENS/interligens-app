# BUILD 13 — LOT COURT · les leases, les témoins du retrait, le repli

**Aucun merge, aucune PR, aucune branche poussée. Le guard reste intact.**
`.github/` lu, jamais touché. Aucune ligne de code écrite. Ce lot n'ajoute au
dépôt qu'un document ; tout le reste vit dans le scratchpad.

---

# CHANTIER 1 — LE SYSTÈME DE LEASES, CONÇU

## 1.1 La question que tu ne tranches pas à ma place — **l'horloge**

> *R1 peut-il redevenir une fonction pure ET bloquante… sauf pour comparer à
> maintenant ?*

**Réponse : non, et je ne vais pas prétendre le contraire. Mais la pureté n'est
pas la propriété qui compte — c'est la DIRECTION de la défaillance.**

### Ce que je remplace la pureté par : un théorème d'innocuité

Je **découpe le verdict en deux**, et je borne ce que l'horloge peut faire.

| partie | dépend de | verdict |
|---|---|---|
| **RECEVABILITÉ** — une lease existe, déclarée, bornée, couvrant **exactement** ces chemins, sur **ce** SHA de base, émise par cette PR | l'arbre seul | **fonction pure** |
| **FRAÎCHEUR** — la lease est-elle encore dans sa fenêtre | l'arbre **+ l'instant** | **impure, inévitablement** |

Puis la règle qui rend l'impureté inoffensive :

> **L'autorité n'est requise que pour ÉLARGIR. Jamais pour RESSERRER.**

Un diff dont le seul effet est de **retirer** une lease et de ne toucher à rien
d'autre **n'exige aucune lease**. Le verifier le reconnaît structurellement :
état de lease après ⊂ état avant, et **aucun** chemin gelé au diff.

**Conséquence, et c'est le théorème :** l'horloge peut refuser d'**ouvrir**, elle
ne peut **jamais** refuser de **fermer**. Une lease expirée bloque le chantier —
c'est l'effet voulu. Elle ne bloque **pas** sa propre fermeture. **On ne peut
donc pas fabriquer par l'expiration une fenêtre qu'on ne peut pas refermer** —
le défaut même qu'on répare.

### D'où vient « maintenant », et pourquoi l'attaquant ne peut que se nuire

```
maintenant := max( horloge du runner , date du commit de base sur main )
```

Trois sources possibles, une seule est sûre :

| source | problème | retenue |
|---|---|---|
| date de commit de la PR | **contrôlée par l'auteur** — `git commit --date` accepte n'importe quoi | ❌ jamais |
| date du commit de base sur `main` | non contrôlée par la PR, mais **sous-estime** l'écoulement — une branche vieille paraîtrait fraîche | plancher seulement |
| horloge du runner | dérive possible, non reproductible | primaire |

Le `max` est **monotone dans le bon sens** : toute manipulation ne peut que faire
paraître le temps **plus avancé**, donc **raccourcir** une lease, jamais
l'allonger. Une entrée hostile ne peut produire qu'un refus d'élargir.

**Reproductibilité, dite franchement :** le verdict de fraîcheur n'est pas
rejouable — rejoué demain, il change. C'est pourquoi le verifier doit **émettre
l'instant qu'il a évalué** dans sa sortie : le verdict n'est pas reproductible,
mais il est **explicable**. Et il n'est jamais opposé qu'à un élargissement.

### Ce que ça résout de ma limite assumée

J'avais écrit que fenêtre ouverte et fenêtre oubliée ont le même arbre. **C'était
vrai du mécanisme actuel, et faux du mécanisme à venir** : une lease porte son
`expiresAt` **dans l'arbre**. Les trois propriétés — **DÉCLARÉE + BORNÉE + NON
EXPIRÉE** — se lisent alors sur l'arbre plus un seul scalaire externe, dont je
viens de borner l'effet. La distinction devient faisable. **Ta correction est
juste et je la retiens.**

## 1.2 L'ancrage — identité sémantique, jamais cardinal

L'ancre est l'**ensemble des leases**, chacune identifiée par son contenu :

```
{ windowId, propriété gouvernée, chemins EXACTS (triés),
  SHA de base, identité PR/commit d'ouverture, openedAt, expiresAt, état }
```

Réindenter, réordonner, réécrire un commentaire : aucun effet. **Remplacer une
exemption par une autre à cardinal constant : détecté**, parce que c'est
l'ensemble des tuples qui est comparé, pas leur nombre. Un compteur `≤ 24`
fossiliserait le défaut — **ta critique est retenue, le compteur est abandonné.**

**Interdit par construction :** un motif large quand les fichiers exacts sont
connus. Mes rang-2 — `retail-gate` sur `^src/app/api/osint/`, un sous-arbre
d'API publique entier — sont exactement ce que le verifier doit refuser
d'enregistrer. Règle : un chemin de lease est un **fichier nommé**, sauf
justification portée dans la lease elle-même.

## 1.3 Deux objets, et où ils vivent

| objet | rôle | emplacement | lu depuis |
|---|---|---|---|
| **ÉTAT DE LEASE** | données versionnées des ouvertures autorisées | bloc déclaratif **dans** `scripts/guard-offline.sh` (étape 1) → fichier propre (étape 2) | **`origin/main`** |
| **VERIFIER** | le code qui applique la politique | `scripts/guard-offline.sh` | **`origin/main`** |
| **TÉMOINS** | les 9 preuves | `__tests__/garde/` — terrain libre | l'arbre de la PR |

**Les deux sont lus depuis `origin/main`, et c'est la propriété centrale.** Le
workflow le fait déjà pour le guard (`git show origin/main:scripts/guard-offline.sh`)
et il fetche déjà `main`. Le verifier doit lire l'état de lease **de la même
source**, jamais de l'arbre de travail.

> **Une PR ne doit jamais pouvoir redéfinir son juge puis être jugée par cette
> nouvelle définition.**

C'est vérifié, aujourd'hui, sur le guard **nettoyé** :

```
hotfix/guard-autoacceptation — réécrit le juge ET touche un chemin gelé
   guard de la BRANCHE (juge réécrit) → exit 0   « se déclare conforme »
   guard de MAIN       (juge réel)    → exit 1   « refuse »
```

**La propriété survit au nettoyage.** Et elle implique, sans détour : **une lease
ne prend effet qu'une fois MERGÉE dans `main`.** Les leases ne suppriment donc
pas la danse en deux temps — **elles font de l'ouverture un objet gouverné,
borné et auto-expirant.** Je le dis franchement plutôt que de vendre une
disparition qui n'aura pas lieu.

## 1.4 Le nom de branche cesse d'être une autorité

> *Branch naming may select a workflow; it must never itself grant authority.*

| | avant | après |
|---|---|---|
| ce que le nom de branche fait | **accorde** l'accès à des chemins gelés | **route** vers un mode (`hotfix/guard-*` = maintenance) |
| ce qui accorde | rien d'autre | la **lease** : chemins exacts, SHA de base, identité de PR, expiration |
| durée | **éternelle** | **bornée, dans l'arbre** |
| révocation | un retrait qu'il faut penser à faire | **automatique à expiration** |

## 1.5 Modes de défaillance

| situation | comportement exigé |
|---|---|
| état de lease **illisible / non analysable** | **ROUGE.** Jamais « 0 lease extraite = rien à vérifier » |
| état de lease **vide** | **zéro autorité** — tout chemin gelé refusé. Le vide est le plus strict, pas le plus permissif |
| lease sans `expiresAt`, ou `expiresAt` > `openedAt` + borne | **ROUGE** à l'enregistrement |
| horloge du runner en arrière du plancher | le `max` corrige — refus d'élargir, jamais d'autorisation |
| diff qui **retire** une lease | **aucune autorité requise** — jamais bloqué |
| doute quelconque | **crier**. Une garde qui garde trop crie à tort ; une garde qui efface trop se tait à tort |

**L'assertion de non-vacuité est obligatoire et vérifiée à chaque exécution :**
le nombre de leases extraites doit égaler le nombre d'enregistrements présents
dans la source. Tout écart → ROUGE. Sans elle, une réécriture mettant l'analyseur
en défaut rendrait « 0 extraite = conforme à une base de 0 » — la garde exacte
qu'on a fermée quatre fois aujourd'hui.

## 1.6 Les neuf témoins — obligatoires, `__tests__/garde/`

| # | corpus | attendu |
|---|---|---|
| 1 | lease valide, chemin exact autorisé | **VERT** |
| 2 | **la même lease, EXPIRÉE** | **ROUGE** |
| 3 | lease absente | **ROUGE** |
| 4 | nom de branche anciennement exempté, **sans lease** | **ROUGE** |
| 5 | lease pour le fichier A, la PR modifie B | **ROUGE** |
| 6 | PR qui réécrit le verifier pour s'auto-accepter | **ROUGE par le verifier de main** |
| 7 | lease fermée → l'ancienne branche | **ROUGE** |
| 8 | **fenêtre oubliée ouverte** (lease expirée, jamais retirée) | **ROUGE**, et elle le reste |
| 9 | **analyseur mis en défaut** | **ROUGE**, jamais vert par vacuité |

Le témoin 2 exige une **source de temps injectable** : paramètre en test, `max(...)`
en production. Sans injection, le témoin 2 serait non déterministe — donc inutile.

## 1.7 Ce que ça ne couvre PAS — dit d'avance

- **La pertinence** d'une lease accordée. Le verifier vérifie qu'elle est
  déclarée, bornée, exacte et fraîche — **jamais qu'elle est méritée.** Revue
  humaine, et rien d'autre.
- L'**usage** : il autorise des chemins, pas la correction de ce qu'on y écrit.
- Un acteur qui contrôle `main` : la protection redevient la protection de
  branche, pas le verifier.
- La **reproductibilité** du verdict de fraîcheur — bornée, pas supprimée (§1.1).
- Les **réouvertures répétées** de la même lease : un motif à surveiller, pas une
  propriété vérifiable.

## 1.8 Le bootstrap — le dernier passage par le mécanisme défaillant

**Contrainte : le plus court et le plus prouvé de tous.**

### Le piège que tu as retenu, et sa résolution

La voie de maintenance exige **« système de garde SEUL dans le diff »**. Une PR
d'ouverture ne peut donc pas modifier le guard **et** un fichier d'état séparé :
elle serait bloquée. Deux issues, et elles ne coûtent pas la même chose.

| | **A — état dans un fichier séparé** | **B — état dans un bloc du guard** |
|---|---|---|
| respecte « deux objets » au sens fichier | ✅ | ⚠️ deux objets logiques, un seul fichier |
| exige d'étendre `GUARD_SYSTEM_FILES` | **oui** | non |
| et donc — le nouveau fichier n'étant pas connu du guard de `main` — **exige une ULTIME fenêtre à l'ancienne** | **oui** | **NON** |
| ouvrir une lease passe par | `hotfix/guard-*` | `hotfix/guard-*` — **identique** |

**Recommandation : B pour le bootstrap, A comme cible.**

Motif : B **n'exige aucune neuvième fenêtre**. La voie de maintenance couvre déjà
`scripts/guard-offline.sh` ; un bloc déclaratif à l'intérieur est couvert avec
lui. Et la séparation en fichier propre devient alors **la première demande
gouvernée par le nouveau système** — le mécanisme autorise son propre
raffinement, sous lease, bornée et prouvée. C'est le bon ordre : on ne demande
pas au vieux mécanisme un dernier effort dont on peut se passer.

**Les témoins vivent dans `__tests__/garde/` — terrain libre — donc PAS dans la
PR de bootstrap.** Ils atterrissent **juste après**, en PR ordinaire. L'intervalle
est le seul point faible du plan, et je le nomme : entre les deux, le verifier
existe sans sa preuve permanente. **Atténuation : les neuf témoins sont exécutés
et joints au rapport AVANT le merge du bootstrap** — la preuve précède, seule sa
permanence suit.

### Contenu exact de la PR de bootstrap

Branche `hotfix/guard-leases-bootstrap`. **Un seul fichier au diff :**
`scripts/guard-offline.sh`.

1. **retrait des 26 exemptions statiques mortes** (§2) ;
2. **bloc déclaratif d'état de lease, VIDE** ;
3. **verifier de lease**, lisant l'état depuis `origin/main`, avec la source de
   temps `max(horloge, date de base)` et injectable ;
4. **assertion de non-vacuité** armée dès la première exécution.

**Rien d'autre.** Pas de première lease, pas de refactor, pas de renommage.

### Ce que le bootstrap doit prouver avant merge

Les neuf témoins **exécutés**, plus les six témoins avant/après du §2, plus :
`bash -n`, application à blanc, et la démonstration que la **voie de maintenance
survit** — c'est par elle qu'on refermera tout le reste.

---

# CHANTIER 2 — LE RETRAIT : LES TÉMOINS, PAS LE MERGE

## 2.1 ⚠️ L'INVENTAIRE HONNÊTE — et il n'est pas de 24

**La consigne de formulation mord sur mon propre chiffre, et c'est exactement
l'erreur qu'on vient de découvrir.** Mon patch retire 24 exemptions
**conditionnées à un nom de chantier**. Il en reste **deux groupes que je n'avais
pas comptés**, et ils ne sont pas anodins :

| groupe | condition | chemins | état mesuré |
|---|---|---|---|
| `EXEMPT_SETUP_PATTERNS` | branche `feat/offline-mode-setup` (égalité, pas regex — **mon patch ne l'attrape pas**) | **7**, dont **`^.github/workflows/guard-offline.yml$`** — *le runner CI du guard lui-même* | **la branche N'EXISTE PLUS** (aucune ref, locale ni distante) → **MORTE** |
| `OFFLINE_EXEMPT_PATTERNS` | **AUCUNE — toute branche, `main` comprise** | **2** : `^src/lib/pdf/nova/`, `^src/app/api/admin/casefile-nova/` | répertoires vivants, dernier commit **2026-05-21** → **JUSTIFIÉE, mais NON BORNÉE et NON CONDITIONNÉE** |

Le premier est **plus puissant que les 24 réunies** : il ouvre le workflow qui
applique le guard. Sa branche a disparu. **Il est mort et il doit partir.**

Le second est le seul qui ait un sujet vivant — mais il est **inconditionnel et
éternel**, c'est-à-dire exactement ce que la doctrine des leases interdit.

### L'annonce correcte

> **Ce n'est pas « 24 exemptions supprimées ».**
>
> **AVANT — STATIC EXEMPTION INVENTORY = 26** : 24 conditionnées à un nom de
> chantier (toutes mortes) + 1 conditionnée à une branche disparue (morte) +
> 1 inconditionnelle (sujet vivant, portée non bornée).
>
> **APRÈS le patch tel qu'il est aujourd'hui = 2**, et ce n'est pas assez.
>
> **APRÈS le patch ÉTENDU (recommandé) = 1** : `OFFLINE_EXEMPT_PATTERNS`,
> 2 chemins, **justifiée** (le module `casefile-nova` vit dans `main` sous un
> chemin gelé) mais **non bornée**. Elle devra devenir une lease, ou une règle
> de périmètre nommée — pas une exemption éternelle.
>
> **Cible : STATIC EXEMPTION INVENTORY = 0**, toute ouverture devenant une lease.

Je recommande d'**étendre le patch** au retrait de `EXEMPT_SETUP_PATTERNS`
(branche disparue, et c'est le groupe le plus puissant du fichier) —
même lot, même classe de défaut, conformément au motif de GPT : fractionner
créerait un passage de plus par le mécanisme qu'on remplace.

## 2.2 Les témoins AVANT/APRÈS — exécutés

Corpus synthétiques, dépôts jetables, `main` portant le guard **actuel** d'un
côté et le guard **nettoyé** de l'autre. Verdict = le guard extrait de `main`,
comme le fait la CI.

| cas | AVANT | APRÈS | lecture |
|---|---|---|---|
| **SENSIBLE** — `feat/cc-offline-99-fix-handle-leak` touche `api/v1/kol/[handle]/route.ts` | **0** ✅ | **1** 🛑 | **le retrait mord** |
| **BANAL** — `feat/cc-offline-99-moonbag-watchlist` touche `src/lib/watcher/handles.ts` | **0** ✅ | **1** 🛑 | **le retrait mord** |
| non-régression — chemin libre | 0 | 0 | identique |
| non-régression — chemin gelé, nom non exempté | 1 | 1 | identique |
| non-régression — `hotfix/*` générique sur chemin gelé | 1 | 1 | identique |
| **VOIE DE MAINTENANCE** — `hotfix/guard-*`, guard seul | **0** | **0** | **vivante des deux côtés** |

Le témoin **banal** compte autant que le spectaculaire : il prouve que la méthode
ne marche pas que sur le cas qui fait peur. **Les deux mordent identiquement.**

## 2.3 Les témoins APRÈS — réintroduction et source d'autorité

`main` portant le guard **nettoyé** :

| cas | guard de la branche | guard de **main** (= CI) |
|---|---|---|
| réintroduire l'exemption, branche ordinaire | 1 | **1 — BLOQUÉ** |
| réintroduire **et s'en servir** dans la même PR | 1 | **1 — BLOQUÉ** |
| réintroduire par la voie de maintenance auditée | 0 | 0 — **autorisé, et c'est voulu** : la réintroduction reste possible, mais **seulement** par le chemin revu |
| **PR qui réécrit son juge** pour s'auto-accepter | **0** « conforme » | **1 — REFUSE** |

Le dernier est le témoin 6 du contrat permanent : **la propriété de source
d'autorité survit au nettoyage**, et les deux guards divergent bien.

## 2.4 État du patch

`scratchpad/retrait-24-exemptions.patch` — **préparé, non appliqué**. `bash -n`
OK, application à blanc propre, aucune référence pendante. 51 blocs → 3, 887
lignes → 258.

**Le guard du dépôt est intact** — `sha256 ce13d0c0…`, inchangé.

---

# CHANTIER 3 — LE REPLI, RECONÇU COMME PROPRIÉTÉ DE LA LEASE

## 3.1 Ma voie réglages est retirée — et le motif de GPT est juste

Je proposais un contournement nominatif du ruleset. **Retiré.** Le motif tient :
une panne de gate ne doit pas pousser à affaiblir les gates, et un second bypass
permanent appelé *emergency* est un second mécanisme non gouverné — c'est-à-dire
le défaut qu'on répare, sous un autre nom. **Pas de deuxième porte.**

## 3.2 Ce qui la remplace : l'expiration EST le repli

C'est le théorème du §1.1 qui fait le travail, et il n'a besoin de personne à
23 h.

> **Une lease expirée ne s'annule pas : elle CESSE D'AUTORISER.**

Une fenêtre qu'on n'a pas pu refermer parce qu'un gate étranger est rouge se
retrouve dans cet état :

| ce qui est vrai | conséquence |
|---|---|
| la lease est **expirée** | **elle n'autorise plus rien** — toute PR qui s'en réclame est refusée |
| l'enregistrement est **encore dans `main`** | il est **visible**, daté, attribué — c'est une dette, pas un trou |
| la PR de fermeture est **un resserrement** | **n'exige aucune autorité** : elle n'est jamais bloquée par l'expiration |

**Le repli n'est donc plus une action, c'est un état par défaut.** Personne n'a
besoin d'intervenir pour que la fenêtre cesse de porter : elle cesse toute seule.
Le nettoyage de l'enregistrement devient du rangement, plus une urgence.

**La différence avec aujourd'hui, en une ligne :** aujourd'hui une fenêtre
oubliée **continue d'autoriser** ; avec une lease, une fenêtre oubliée **est
déjà fermée** — seule sa trace reste à balayer.

## 3.3 Et si le gate étranger bloque quand même la PR de fermeture ?

Il ne bloque plus rien de **dangereux**. L'exposition a cessé à `expiresAt`. Il
reste un enregistrement périmé dans `main` — visible, inerte. Deux conduites,
et aucune n'est un contournement :

1. **attendre** que `semgrep` ou `audit` reverdisse — le coût est désormais
   **cosmétique**, plus sécuritaire ;
2. **traiter la cause** à froid — accepter l'avis dans `audit-baseline.json`,
   corriger le finding — sans pression, puisque rien n'est ouvert.

Le critère de pré-vol de GPT — *aucun service externe requis pour obtenir
artificiellement le droit de fermer* — est alors **satisfait par construction** :
fermer n'exige plus aucun droit.

## 3.4 Le pré-vol, retenu et complété

Dans cet ordre, et **le chantier d'abord** — c'est lui qui déplacera `main` :

1. **branche du chantier** : `pnpm typecheck` · `pnpm test` · `pnpm lint:ci` ·
   `pnpm audit:classify` (**sans** `--write-baseline`) · `semgrep scan --config
   p/typescript --config p/react --config p/owasp-top-ten --config p/secrets
   --error --quiet`
2. **`main`** : les deux seuls réellement volatils — `audit:classify` et le même
   `semgrep`
3. `gitleaks` : action épinglée par SHA, et le diff de fermeture ne touche pas
   l'historique — couvert par l'étape 1
4. **SHA de `main` noté** — il entre dans la lease
5. **patch de fermeture rédigé** — son diff est connu d'avance
6. **lease exacte rédigée** : chemins nommés, `expiresAt`, identité de PR
7. **si l'un des cinq est rouge : NE PAS OUVRIR.** Seul instant où le refus est
   gratuit.

## 3.5 La borne — **60 appliquée, 45 défendue**

**J'applique 60.** Tant qu'on n'ouvre pas, l'écart est sans effet.

**Et je maintiens 45, sur la mesure, pas sur la prudence :**

| | |
|---|---|
| p50 · p75 · p90 | **12 · 16 · 22 mn** |
| p95 · max | 127 · 965 mn |
| **≤ 30 mn** | **60 fenêtres sur 64** |
| entre 30 et 127 mn | **AUCUNE** |

Les durées ne sont **pas continues**. Une borne posée n'importe où dans le
vide `]30, 127[` n'aurait coûté **aucune** des 64 danses réelles — 45 mn est
deux fois le p90, avec toute la marge du vide au-dessus.

**Effet : exposition cumulée 40,4 h → 14,4 h, soit −64 %, sans changer une seule
pratique existante.** À 60 mn : même 60/64, mais la marge sert moins.

Le reste du protocole est retenu tel quel : jamais pendant une absence, jamais
overnight, jamais « je finis demain », repli commencé à **T+45** si la fermeture
sous 15 mn n'est pas certaine, fermeture obligatoire à la borne **même
inachevée** — la réouverture coûte 12 minutes, et le dépôt l'a déjà payée de son
plein gré.

---

# CE QUI N'A PAS BOUGÉ

Le guard est intact (`ce13d0c0…`). Aucun merge, aucune PR, aucune branche
poussée, aucune ligne de code. `.github/` lu, jamais touché. La neuvième fenêtre
reste HOLD — et le §1.8 montre qu'avec l'option B **elle n'est pas nécessaire**.
Le « 14 » CLOSED. F absorbé dans C/P1. E ACTIVE, aucun mécanisme de vérification
construit, aucune remédiation storage, aucune mutation de compartiment. Périmètre
de T2 intact.

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
