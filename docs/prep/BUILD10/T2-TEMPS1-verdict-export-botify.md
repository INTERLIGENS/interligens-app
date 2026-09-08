# BUILD 10 · FENÊTRE 3 — TEMPS 1 : verdict de mécanicité
## `api/admin/export/botify` — bascule d'autorité

Rendu le 2026-09-08. Lecture seule. 0 write, 0 DDL, 0 RPC, 0 accès base
(aucun `.env.local` dans ce worktree — toute affirmation sur le contenu de la
base est marquée comme telle et attribuée à la mesure de T1).

---

## VERDICT

**`BLOCKED_ON_KEY_RULING`**

La bascule est mécaniquement réalisable sur le corps du dossier — le lecteur
existe, il est libre, le mapping champ par champ est complet et aucune donnée
n'a besoin d'être reconstruite. Elle est bloquée sur **un seul point**, et ce
point est exactement celui que GPT m'interdit de trancher : après la bascule,
`case_meta.case_id` n'existe plus, et il faut bien passer *une* valeur à
`loadBotifyDbEnrichment`. Cette valeur est la clé de rattachement nominatif.

Trois valeurs coexistent dans le système :

| valeur | origine | ce qu'elle vaut |
|---|---|---|
| `CASE-2024-BOTIFY-001` | `data/cases/botify.json` — mesuré ici | ce que la route passe aujourd'hui |
| `BOTIFY` | `KolCase.caseId` — mesuré par T1, non revérifié ici | ce que la base porte réellement |
| `IL-SHILL-BOTIFY-001` | `BOTIFY_CASEFILE_REF` — mesuré ici | ce que l'autorité canonique porte |

Aucune n'est déductible des deux autres. Le choix décide si le CSV porte zéro
ligne nominative ou en porte plusieurs — donc si l'export publie ou non des
handles et des adresses. Ce n'est pas un détail d'implémentation.

Et le maintien du littéral actuel *est aussi* un choix de clé : conserver en dur
`"CASE-2024-BOTIFY-001"` dans le code après avoir retiré le JSON qui le portait,
c'est ratifier qu'une clé mesurée sans correspondance reste la clé du dossier.
C'est la seule variante à sortie inchangée, mais elle n'est pas neutre.

---

## MAPPING CHAMP PAR CHAMP

Périmètre réel : `buildBotifyEvidenceRows` ne lit que `caseData.claims` et
`caseData.detective_trade` ; la route ne lit que `caseData.case_meta.case_id`.
Les six autres champs de `case_meta` (`token_name`, `ticker`, `mint`, `chain`,
`status`, `severity`) sont **typés et jamais consommés** sur ce chemin —
vérifié par grep sur les seuls appelants (`route.ts`, `main()` du script).

### Claims — 8 lignes `C1`…`C8`

| champ JSON | champ canonique | état |
|---|---|---|
| `claim_id` | `PublicClaim.claimId` | **COVERED** |
| `title` | `PublicClaim.title` | **COVERED** |
| `severity` | `PublicClaim.severity` (nullable) | **COVERED** |
| `status` | `PublicClaim.status` **et/ou** `PublicClaim.state` | **COVERED — décision requise, voir D2** |
| `thread_url` | `provenance.threadUrl` | **COVERED** (6/8 non nuls côté JSON) |
| `evidence_refs` | `provenance.sources[].sourceId` + `provenance.unresolvedRefs` | **COVERED** — le canonique est plus riche : il sépare résolu et non résolu, là où le JSON ne distingue pas. Composable sans invention. |

### `detective_trade` — 1 ligne `DT-1`

| champ JSON | champ canonique | état |
|---|---|---|
| `wallet` | *(aucun)* — `keyWallets[]` porte `{role, address}` et est **vide sur BOTIFY** (valeur ratifiée en étape 7) | **ABSENT** |
| `buy_tx` | *(aucun)* | **ABSENT** |
| `sell_tx` | *(aucun)* | **ABSENT** |
| `pnl_usd` | *(aucun)* | **ABSENT** |
| `notes_en` | *(aucun)* | **ABSENT** |

`CanonicalCaseFile` ne porte **aucun** champ de transaction ni de montant.
Reconstituer DT-1 supposerait d'aller chercher ces valeurs ailleurs — c'est
précisément la reconstruction qui rendrait le verdict `NOT_MECHANICAL`.

**Omission propre, donc.** La ligne disparaît. Aucun `0`, aucun `null`, aucune
chaîne vide : la ligne n'est pas rendue du tout. C'est conforme à la règle
ratifiée (« absence canonique ⇒ absence explicite ou omission »).

### `case_meta.case_id`

| champ JSON | champ canonique | état |
|---|---|---|
| `case_id` | `CanonicalCaseFile.ref` — **valeur différente**, pas le même identifiant | **ABSENT au sens de la jointure** |

`ref` est l'identité du dossier canonique. `caseId` est la clé de la table
`KolCase`. Que la première puisse servir de seconde est une **affirmation sur la
base**, pas un mapping. C'est le blocage.

---

## FICHIER GELÉ STRICTEMENT NÉCESSAIRE : UN SEUL

`src/app/api/admin/export/botify/route.ts` — gelé par `^src/app/api/`.

**Aucun fichier libre ne peut interposer la bascule**, et la raison est
mécanique, pas esthétique : l'import statique
`import botifyCaseJson from "…/data/cases/botify.json"` est **dans la route**.
Un fichier libre peut fournir le remplaçant, il ne peut pas retirer l'import.
Et tant que l'import est là, la surface reste `PRESET` au sens du registre — la
garde de `surface-registry.test.ts` cherche le motif `data/cases/botify\.json`
dans les fichiers `src/app`, pas la trace de son usage.

Le diff gelé peut rester **minimal** — 3 lignes utiles : retirer l'import,
appeler un chargeur canonique exporté depuis le fichier libre, passer la clé.
Toute la logique de projection s'écrit dans `src/scripts/export/botifySpreadsheet.ts`,
qui est **libre** (vérifié contre la liste de gel).

Périmètre confirmé libre : `botifySpreadsheet.ts`, `canonicalReader.ts`,
`publicProjection.ts`, `data/cases/botify.json`. Je ne touche ni au JSON ni au
spreadsheet sans instruction — c'est un STOP posé par GPT ; je note seulement
que le second est le bon endroit pour le code.

---

## CE QUE DEVIENT LE CSV

État actuel, sous réserve de la mesure T1 (`KolCase.caseId = 'BOTIFY'`, donc
sans correspondance avec `CASE-2024-BOTIFY-001`, donc `handles.size === 0`,
donc **fail closed** posé par T1 en #296) :

```
8 lignes claims (C1…C8, colonne Status = CONFIRMED)
1 ligne DT-1
0 ligne DB-WALLET   ← fail closed
0 ligne DB-PROCEEDS ← fail closed
─────────────────────
9 lignes
```

Après bascule, variante recommandée (D2 = état canonique, DT omis) :

```
N lignes claims, N = nombre de claims BOTIFY dans l'autorité
                 (8 selon l'inventaire étape 7 ; contenu DISJOINT du JSON
                  bien que les identifiants C1…C8 coïncident)
0 ligne DT-1        ← omission, champ absent de l'autorité
0 ou k lignes DB    ← dépend entièrement de la décision D1
```

Deux conséquences à énoncer avant tout feu vert :

1. **Le CSV n'est pas identique avant/après, et ne peut pas l'être.** Les 8
   claims JSON et les 8 claims canoniques partagent leurs identifiants et rien
   d'autre — c'est le constat de l'étape 7. Titres, sévérités, statuts et URL
   de preuve changent. C'est l'objet même d'une bascule d'autorité, pas un
   effet de bord ; mais cela veut dire qu'aucun test d'égalité de sortie ne
   peut servir de preuve ici, contrairement à la fermeture de tuyau P0.
2. **Sous la lecture stricte de la doctrine (D2, variante b), le CSV devient
   un fichier d'en-têtes seul.** Aucun claim BOTIFY n'est `PUBLIC` dans
   l'autorité — c'est ce que P3 a mesuré et rendu sur la page publique. Un
   export vide qui déclare pourquoi il est vide reste un résultat correct, mais
   c'est une conséquence produit visible.

---

## DÉCISIONS REQUISES

### D1 — la clé de rattachement (bloquante)
Quelle valeur passe à `loadBotifyDbEnrichment` après la bascule ?
`CASE-2024-BOTIFY-001` (statu quo figé en dur) · `BOTIFY` (ce que porte la base)
· `IL-SHILL-BOTIFY-001` (l'autorité) · ou un mapping déclaré explicitement.
**Je ne choisis pas.**

### D2 — quel lecteur, et que porte la colonne « Status »
- (a) `loadCanonicalCaseFile(ref)` sans filtre, colonne Status = `state`
  (`ATTACHED` / `ADMISSIBLE` / `PUBLIC`). L'export reste utile en data-room et
  n'affirme rien que l'autorité ne porte. **Ma recommandation** — c'est la
  forme déjà retenue sur `/cases/botify/evidence` en P3 (`{c.state}`).
- (b) `loadPublicProjection(ref)` (`onlyPublishable`), lecture stricte de la
  doctrine « admin ≠ exempt des gates ». Rend le CSV vide aujourd'hui.

### D3 — DT-1
Confirmation que l'omission est acceptée. Je ne vois pas d'alternative qui ne
soit pas une reconstruction.

---

## CONSTAT ANNEXE — même défaut que la troisième autorité, pas d'une nature nouvelle

Deux points relevés en mesurant, que je signale sans les corriger et sans
élargir le périmètre :

1. Les 8 claims du JSON portent tous `status: "CONFIRMED"` (mesuré : c'est le
   seul statut présent), et `buildBotifyEvidenceRows` recopie `c.status` tel
   quel dans la colonne « Status ». L'export publie donc `CONFIRMED` pour du
   matériel que l'autorité porte en `ATTACHED`. C'est **exactement** le défaut
   que P3 a fermé sur `/cases/botify/evidence` — même cause, autre surface. Ce
   n'est pas une nature nouvelle de contournement : pas de STOP, mais c'est le
   meilleur argument pour la bascule.
2. La ligne DT-1 publie `dt.wallet` en adresse et `dt.pnl_usd` en montant sans
   passer par `PUBLISHABLE_WALLET_FILTER` ni par `redactProceeds` — les deux
   gates que T1 a posées en #296 sur le chemin base. Le chemin JSON les
   contourne. Là encore ce sont les axes déjà connus, pas un axe neuf. À noter :
   la bascule **ferme** ce contournement par construction, puisqu'elle supprime
   la ligne.

---

## ÉTAT DE LA FENÊTRE

- `origin/main` = `74cd0e5195bbfaf93442657863e619892ec43e1c` (#296 de T1 mergée)
- guard = `ce13d0c0f987483786c26346c832fb8ff5e082206259bc46c23073f8b9013e50`, inchangé
- `feat/cc-offline-171-p3-pdf-authority` (#295) rebasée sur ce main, HEAD `952fc3d`, **non mergée**
- les trois patches de la fenêtre 1 revérifiés en worktree détaché sur `origin/main` :
  `P3-report-casefile-route` OK · `P3-pdfRenderer` OK · `P3-i18n` OK
- DEPLOY HOLD maintenu. Aucune fenêtre ouverte. Rien de poussé.

---

# CASE IDENTITY — CHANTIER SÉPARÉ

*Section ajoutée après l'arbitrage du 2026-09-08. La fenêtre 3 est ANNULÉE ; la
bascule d'autorité de `api/admin/export/botify` est requalifiée
**NOT_MECHANICAL**, parce qu'elle exige un pont d'identité de dossier qui
n'existe nulle part. Ce document devient le point de départ du chantier qui
devra le construire — ou décider de ne pas le construire.*

Arbitrage GPT, mot pour mot :

> RETRACT previous conceptual mapping GO. NO-GO.
> `CASE-2024-BOTIFY-001` <-> `BOTIFY` is nowhere declared.
> Three namespaces exist; do not manufacture equivalence.
> No `token_name` fallback, no symbol fallback, no implicit route mapping,
> no new mapping table in BUILD10.
> If export authority switch requires this bridge: NOT_MECHANICAL / HOLD.
> Case Identity becomes separate qualified work.

## Les trois référentiels, et leur origine mesurée

Ce ne sont pas trois écritures d'une même clé. Ce sont **trois espaces de noms
distincts**, chacun avec son producteur, sa table et sa raison d'être.

| valeur | espace de noms | producteur | mesuré où, quand |
|---|---|---|---|
| `CASE-2024-BOTIFY-001` | identifiant de dossier documentaire | `data/cases/botify.json`, champ `case_meta.case_id` | lu dans le fichier, 2026-09-08 |
| `BOTIFY` | clé de rattachement KOL↔dossier | colonne `KolCase."caseId"` | **mesuré par T1**, non revérifié depuis ce worktree (aucun `.env.local`) |
| `IL-SHILL-BOTIFY-001` | référence de dossier canonique | `token_casefiles."ref"`, exposée par `BOTIFY_CASEFILE_REF` | lu dans `src/lib/casefile/publicProjection.ts`, 2026-09-08 |

Aggravant, et à ne pas perdre : `BOTIFY` est **aussi** la valeur de
`case_meta.token_name` dans le JSON (mesuré). Une équivalence
`case_id ↔ caseId` fondée sur cette coïncidence serait un `token_name` fallback
déguisé — exactement ce que l'arbitrage interdit. La ressemblance des chaînes
est un piège, pas un indice.

## Aucune équivalence n'est déclarée

Constat, pas opinion : il n'existe dans le dépôt **aucune** table de
correspondance, aucune contrainte de clé étrangère, aucun commentaire de
contrat, aucune constante partagée qui relie l'un de ces trois espaces à un
autre. La route actuelle ne *joint* pas les référentiels — elle passe la valeur
documentaire à une requête qui attend la valeur de rattachement, et le
désaccord est absorbé en silence par le `fail closed` que T1 a posé en #296.

Autrement dit : le pont n'est pas cassé, **il n'a jamais été construit**. Ce
qui tenait lieu de pont était une absence de correspondance rendue inoffensive
par une garde ajoutée pour une autre raison.

## L'argument central : il n'existe pas d'option neutre

C'est le point qui rend le HOLD cohérent, et c'est lui que le futur chantier
doit lire en premier.

Après une bascule, `case_meta` disparaît : **une** valeur doit être passée à
`loadBotifyDbEnrichment`. Les quatre variantes possibles sont toutes des
affirmations sur l'identité du dossier :

- passer `IL-SHILL-BOTIFY-001` affirme que la référence canonique est la clé de
  rattachement KOL ;
- passer `BOTIFY` affirme que la valeur observée en base fait autorité sur
  l'identité du dossier ;
- **garder `CASE-2024-BOTIFY-001` en dur** affirme qu'une clé mesurée sans
  correspondance reste la clé du dossier — c'est la seule variante à sortie
  inchangée, et elle n'est pas plus neutre que les autres ;
- déclarer une table de correspondance fabrique l'équivalence que l'arbitrage
  interdit de fabriquer.

**Ne pas basculer ne crée aucune affirmation nouvelle. Basculer en crée une,
quelle que soit la valeur choisie.** C'est la seule asymétrie du problème, et
c'est pourquoi le statu quo est ici un choix défendable et non un renoncement.

## Ce qu'une décision de clé changerait dans l'export

Le périmètre de l'impact est étroit et entièrement mesuré — utile à savoir pour
dimensionner le chantier.

La clé n'alimente qu'un seul appel : `loadBotifyDbEnrichment(caseId)` →
`prisma.kolCase.findMany({ where: { caseId } })`. De là dépendent **uniquement**
les lignes `DB-WALLET-*` et `DB-PROCEEDS-*` du CSV. Les lignes de claims et la
ligne `DT-1` n'en dépendent pas.

- **Clé sans correspondance** (état actuel présumé) : `handles.size === 0`, le
  `fail closed` de #296 s'applique, l'enrichissement nominatif est **omis
  entièrement**. Le CSV ne porte aucun handle, aucune adresse, aucun montant
  issu de la base.
- **Clé avec correspondance** : les handles rattachés remontent, et avec eux les
  adresses filtrées par `PUBLISHABLE_WALLET_FILTER` puis les montants passés par
  `redactProceeds`. Le CSV devient **nominatif**.

Le chantier Case Identity ne décide donc pas d'un détail de jointure : il décide
si cet export publie ou non des personnes nommées. C'est ce que la décision
engage réellement, et c'est la raison pour laquelle elle ne pouvait pas être
prise à l'intérieur d'une bascule présentée comme mécanique.

## Ce que le chantier devra trancher, et dans quel ordre

1. Lequel des trois espaces de noms fait autorité sur l'identité d'un dossier —
   ou s'il en faut un quatrième, explicitement déclaré.
2. Comment la correspondance est **déclarée** plutôt que devinée : contrainte,
   colonne, ou constante de contrat — jamais une égalité de chaînes constatée.
3. Ce que devient `data/cases/botify.json` une fois l'identité tranchée.
4. Alors seulement : la bascule d'autorité de l'export, et avec elle les
   décisions D2 (quel lecteur, que porte la colonne « Status ») et D3
   (omission de `DT-1`), qui n'ont de sens qu'après.

## Ce qui reste ouvert en attendant

Le constat annexe ci-dessus est requalifié par l'arbitrage. Je l'avais rangé en
« axes déjà connus » : sur la cause, c'est exact ; sur la conséquence, non. La
bascule qui devait les fermer **par construction** vient d'être annulée, donc
ils ne se referment plus d'eux-mêmes.

Les deux subsistent sur un chemin **libre** (`src/scripts/export/botifySpreadsheet.ts`),
donc fermables sans exemption :

- le builder recopie `status: "CONFIRMED"` du JSON dans la colonne « Status »
  alors que l'autorité porte `ATTACHED` — le défaut que P3 a fermé ailleurs ;
- `DT-1` publie une adresse et un montant sans passer par
  `PUBLISHABLE_WALLET_FILTER` ni par `redactProceeds`. T1 a mesuré **0 adresse
  non publiable en sortie** : les deux constats sont vrais simultanément — la
  gate est absente, et la donnée passe par chance. C'est de la sécurité par
  hasard au point de consommation, du même genre que le `LIMIT 500`.

Remontés à GPT comme contournements démontrés sur chemin libre. **Non traités
par moi** : le fichier vient d'être mergé par T1, qui est sur le P0 public.

