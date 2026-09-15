# T1-INSCRIPTION-QUALIFICATIONS-VINE — l'écrivain du journal, et la répétition à blanc

**Fenêtre** : 2026-09-15 · branche `feat/cc-offline-192-qualifications-vine`
**Étape C** de la séquence GPT (A ✅ predicate TSA · B ✅ readback R2 · **C ici** · D bascule du contrat · E témoin synthétique · F recapture 0xSweep)

> « Le journal doit pouvoir enregistrer les vérités imparfaites, sinon il devient
> seulement un registre des preuves parfaites. »
> « Append-only provenance may record an honestly incomplete qualification;
> recording OPERATOR_DECLARED does not elevate it to VERIFIED. »

**⛔ RIEN N'A ÉTÉ INSCRIT.** La fenêtre s'arrête après la répétition à blanc, comme
prescrit. `evidence_provenance_journal` porte **0 ligne** en production. La séquence
est passée de `1 / is_called=false` à `2 / is_called=true` — deux valeurs consommées
par les INSERT annulés, effet de bord connu et déclaré (une séquence n'est pas
transactionnelle).

---

## 1 · Le localisateur canonique — mesuré, puis transformé

### La valeur LUE en production

Lue le 2026-09-15 sur `ep-square-band` (PostgreSQL 17.11), colonne
`"CaseFileSource"."sourceUrl"`, jamais citée de mémoire :

| source | snapshotId | `sourceUrl` lue | longueur |
|---|---|---|---|
| `SRC-0xS-09` | `34f4068a-57d8-45c5-9c8a-47b29b931e1b` | `https://x.com/search?q=from:0xSweep VINE` | 40 |
| `SRC-0xS-18` | `f24e3252-7d16-41a3-8253-eb0c1be67654` | `https://x.com/search?q=from:0xSweep VINE` | 40 |

Octets identiques sur les deux, vérifiés en hexadécimal :

```
68747470733a2f2f782e636f6d2f7365617263683f713d66726f6d3a307853776565702056494e45
                                                              ^^
                                                              0x20 · index 35 (0-based)
```

**Les deux sources portent la MÊME `sourceUrl`.** Ce n'est pas une anomalie : deux
pièces distinctes peuvent légitimement partager un même contexte de découverte —
c'est précisément ce que `QUERY_CONTEXT` nomme. `"EvidenceSnapshot"."sourceUrl"`
porte la même valeur sur les deux pièces.

### La valeur INSCRITE

```
https://x.com/search?q=from:0xSweep%20VINE
```

### La liste EXACTE de ce qui a changé

**Un seul caractère.** L'octet `0x20` (U+0020 SPACE) à l'index 35, remplacé par les
trois caractères `%20`. Longueur 40 → 42. Rien d'autre :

| ce qui aurait pu être « embelli » | fait ? | pourquoi |
|---|---|---|
| le `:` de `from:` → `%3A` | **non** | il passe le CHECK tel quel. Encoder plus serait embellir. |
| le `?` et le `=` | **non** | idem |
| le domaine `x.com` | **non** | pas de normalisation |
| le schéma `https` | **non** | déjà en minuscules, forme canonique du CHECK |
| l'ordre des paramètres | **non** | un seul paramètre, et on ne réordonne pas |

La minimalité n'est pas promise en commentaire : elle est **vérifiée à l'exécution**
par la répétition (`la valeur lue ne porte QU'UN SEUL caractère blanc`, `un seul '%'
dans la canonique`, `le ':' de from: n'est PAS encodé`).

### Pourquoi cette transformation est nécessaire, et ce qu'elle n'affirme pas

Le CHECK `evidence_provenance_journal_source_url_form_by_kind_check` impose pour
`QUERY_CONTEXT` la forme `^https?://[^/[:space:]]+\.[^/[:space:]]+(/[^[:space:]]*)?$` :
**aucun blanc, nulle part**. La valeur lue échoue ; la valeur encodée passe. Les deux
faits sont mesurés en base (23514 sur la première, `OK` sur la seconde).

**⛔ Cela ne corrige RIEN.** `CaseFileSource."sourceUrl"` et
`"EvidenceSnapshot"."sourceUrl"` ne sont ni touchées, ni relues pour comparaison, ni
réputées corrigées rétroactivement. La répétition le prouve explicitement :
`SRC-0xS-09.sourceUrl porte TOUJOURS son espace`.

---

## 2 · L'écrivain

### Où il vit

`src/lib/casefile/journalWriter.ts` — dans `src/`, pas un script jetable : le vertical
slice de samedi écrira dans la même table et réutilisera **ce** chemin.

### Ce qui est TYPÉ, pas passé en chaîne libre

`QualificationIntent` est une **union discriminée** sur `provenanceKind` :

| variante | `referenceKind` | `verification` |
|---|---|---|
| `QualificationDeclaree` — `OPERATOR_DECLARED \| EXTRACTED` | tout le domaine | **le champ n'existe pas** dans le type |
| `QualificationVerifiee` — `VERIFIED` | `Exclude<…, "QUERY_CONTEXT">` | **obligatoire**, `{ by, at, method }` |

Conséquences au niveau du **compilateur**, prouvées par deux `@ts-expect-error` :

- écrire `VERIFIED` sans `verification` **ne compile pas** ;
- écrire `VERIFIED` avec `referenceKind: "QUERY_CONTEXT"` **ne compile pas** (décision 4b).

`provenanceKind`, `referenceKind` et `verification.method` sont les domaines fermés
importés de `journalProvenance.ts` — pas des `string`.

**Le CHECK est le filet, pas la règle.** Parce qu'un appelant JavaScript peut mentir
au compilateur, les mêmes invariants sont revalidés à l'exécution, **avant** toute
requête, avec une cause nommée parmi dix (`VERIFICATION_REQUIRED`,
`VERIFIED_QUERY_CONTEXT_FORBIDDEN`, `MALFORMED_LOCATOR`, …).

### Le chemin d'écriture

Transaction → `INSERT … RETURNING id::text` → **relecture** par `id` → égalité exigée
sur les **dix colonnes cibles** → l'objet rendu porte ce que la base a gardé, pas
l'intention. Les erreurs de la base (23503, 23514) **remontent telles quelles** :
elles disent quelque chose que le module ne savait pas, et les traduire en refus
gouverné serait mentir sur leur origine.

### Le témoin « aucun UPDATE ni DELETE »

Pas « aucun n'est appelé » : **aucun n'est écrit**. Six assertions structurelles sur
le code dépouillé (`codeSeul`, commentaires retirés) :

```
UPDATE · DELETE FROM · TRUNCATE · ON CONFLICT · DROP · ALTER   → aucun
verbes d'écriture trouvés                                      → ["INSERT"] exactement
fonctions exportées                                            → formeLocalisateurAdmise,
                                                                  validerQualification,
                                                                  recordQualification
                                          (aucun nom ne promet une mutation)
```

Et **le témoin sait rougir** : la même garde, appliquée au fichier augmenté d'une
ligne `UPDATE evidence_provenance_journal SET …`, est rouge.

Au niveau du dépôt (témoin de `t1-lecteur-journal.test.ts`, amendé) : dans `src/`,
`INSERT INTO evidence_provenance_journal` n'existe **qu'à un seul endroit** ; et
**aucun** fichier ne porte `UPDATE`/`DELETE`/`TRUNCATE` sur cette table — hors le banc
de mutation, exempté **nommément**, dont une troisième assertion vérifie qu'il attend
un **refus** de chacune des trois.

### Deux amendements assumés à la fenêtre précédente

Deux assertions de `t1-lecteur-journal.test.ts` sont devenues fausses **par
construction**, et c'était le but de cette fenêtre :

1. *« le lecteur n'a AUCUN appelant »* → devient une **liste blanche nominative** de
   trois fichiers (l'écrivain, qui n'importe que ses types ; les deux bancs
   d'épreuve). Un appelant de plus la fait rougir.
2. *« aucun INSERT nulle part »* → devient *« dans `src/`, exactement un »*.

Ce qui **ne devait pas** changer et n'a pas changé : aucun consommateur de décision
(`decideFoundation`, `decidePublicRelease`, la projection publique) ne mentionne le
lecteur. **La bascule reste l'étape D.**

---

## 3 · Les sept preuves

Deux bancs, parce que deux choses différentes se prouvent à deux endroits différents.

**`__tests__/casefile/t1-ecrivain-journal.test.ts` — 45 assertions, sans base.**
**`scripts/casefile/harnais-ecrivain-journal-pglite.mts` — 34 scénarios, Postgres réel jetable (PGlite, PG 17.5 WASM).**

| # | affirmation | où | résultat |
|---|---|---|---|
| a | OPERATOR_DECLARED valide s'inscrit et se relit identique | les deux | **OK** — et requalifier crée une **nouvelle** ligne d'id supérieur, l'ancienne reste lisible, le lecteur rend `max(id)` |
| b | VERIFIED sans les trois champs → refusé **avant** la base, cause nommée | les deux | **OK** — `VERIFICATION_REQUIRED` sur 7 formes ; **0 requête émise**, **0 valeur de séquence consommée**. Filet : le même INSERT en SQL brut → **23514** |
| c | VERIFIED sur QUERY_CONTEXT → refusé, cause nommée | les deux | **OK** — le **type** l'interdit (`@ts-expect-error`), l'exécution rend `VERIFIED_QUERY_CONTEXT_FORBIDDEN`, et le CHECK `verified_not_query_context` refuse le même couple en SQL brut → **23514** |
| d | `evidence_snapshot_id` inexistant → 23503, rien ne reste | harnais | **OK** — 23503 **remonte tel quel** (non traduit), table vide, connexion réutilisable |
| e | `source_url` avec un blanc → refusé, cause nommée | les deux | **OK** — `MALFORMED_LOCATOR` sur la **valeur réelle** lue en base ; filet : **23514** en SQL brut, et **23514** aussi sur un localisateur bordé de blancs ; la forme `%20` passe |
| f | aucun UPDATE ni DELETE possible depuis ce module | test + harnais | **OK** — 6 gardes structurelles + le témoin qui rougit ; et en base les deux triggers append-only refusent `UPDATE`, `DELETE` **et** `TRUNCATE` → **23001** (`restrict_violation`), la ligne reste inchangée |
| g | **MUTANT** `declared_at` par `now()` côté serveur | les deux | **ROUGE, comme voulu** — voir ci-dessous |

**En prime : l'équivalence des deux moteurs de forme.** Le motif TypeScript de
`formeLocalisateurAdmise` et le CHECK SQL sont rejoués sur **le même corpus de 80 cas**
(5 `referenceKind` × 16 localisateurs) : **0 désaccord**. Sans cette mesure, « le type
est la règle » ne serait qu'une intention.

### Ce que le mutant (g) a rougi

La colonne est **sans DEFAULT par conception** : une déclaration que personne n'a
datée n'est pas une déclaration. Le mutant tente de contourner ça.

**Première forme essayée — et écartée.** Remplacer `$7::timestamptz` par `now()` tout
court : la requête échoue en **42P18** (`could not determine data type of parameter $7`)
avant même d'atteindre la table. Ce mutant ne prouve rien — il est rejeté par
l'analyseur, pas par la garde.

**Forme retenue, crédible** — le « défaut défensif » qu'un développeur écrirait
vraiment, et qui laisse `$7` référencé :

```diff
- VALUES ($1, …, $7::timestamptz, …)
+ VALUES ($1, …, coalesce(now(), $7::timestamptz), …)
```

`now()` n'étant jamais `NULL`, il gagne **toujours** : l'instant déclaré est
silencieusement remplacé par l'horloge du serveur.

Le mutant rougit **deux fois** :

1. **le témoin structurel** — `now()`, `CURRENT_TIMESTAMP`, `statement_timestamp`,
   `clock_timestamp` sont absents du code de l'écrivain, et `$7::timestamptz` y est
   présent. Rouge avant même l'exécution.
2. **la relecture, contre un vrai Postgres** :
   ```
   ABORTED · READBACK_MISMATCH
   declaredAt: attendu 2019-01-02T03:04:05.000Z, relu 2026-09-15T05:28:52.120Z
   ```
   et la transaction est **annulée** : 0 ligne inscrite.

**Contre-épreuve** — sans le mutant, le **même appel** est `RECORDED` avec
`declaredAt = 2019-01-02T03:04:05.000Z`. Sans elle, le rouge du mutant pourrait venir
d'autre chose.

Neuf variantes supplémentaires prouvent que la relecture garde aussi les **neuf autres**
colonnes cibles, qu'une relecture vide aborte, et que deux instants **équivalents**
(offsets différents, même point du temps) ne rougissent **pas** — la comparaison porte
sur l'instant, pas sur la chaîne.

---

## 4 · La répétition à blanc — `BEGIN … ROLLBACK` contre la production

`npx tsx scripts/casefile/qualifications-vine-rehearsal-rollback.mts`
PostgreSQL 17.11 · `neondb` · REPEATABLE READ · **41 scénarios, 0 KO**

### Les deux lignes, dans la transaction, champ par champ

```json
{
  "id": "1",
  "evidence_snapshot_id": "34f4068a-57d8-45c5-9c8a-47b29b931e1b",
  "sha256": "8c55dd83065ced33dbfd17a71c65f37df2ce366e2d8d4688399a27b5de39ace3",
  "provenance_kind": "OPERATOR_DECLARED",
  "reference_kind": "QUERY_CONTEXT",
  "source_url": "https://x.com/search?q=from:0xSweep%20VINE",
  "declared_by": "David Douville",
  "declared_at": "2026-09-15 05:29:26.712+00",
  "verified_by": null,
  "verified_at": null,
  "verification_method": null,
  "recorded_at": "2026-09-15 05:29:26.711408+00"
}
{
  "id": "2",
  "evidence_snapshot_id": "f24e3252-7d16-41a3-8253-eb0c1be67654",
  "sha256": "c60be4bb3f9f8ff0f09032eace6330016612f6c40c75d97149d28ae1ed6c4f0e",
  "provenance_kind": "OPERATOR_DECLARED",
  "reference_kind": "QUERY_CONTEXT",
  "source_url": "https://x.com/search?q=from:0xSweep%20VINE",
  "declared_by": "David Douville",
  "declared_at": "2026-09-15 05:29:26.875+00",
  "verified_by": null,
  "verified_at": null,
  "verification_method": null,
  "recorded_at": "2026-09-15 05:29:26.711408+00"
}
```

Points vérifiés, pas seulement affichés :

- **`declared_at` = l'instant de l'inscription**, pris **côté appelant** au moment du
  geste et passé en paramètre. Pas une date historique reconstruite. Les deux lignes
  portent deux instants **distincts** (`.712` et `.875`) — deux gestes, deux instants.
- **`declared_at ≠ recorded_at`** : l'instant déclaré et l'horloge de la base sont
  deux axes séparés, et on le voit (`recorded_at` est identique sur les deux lignes,
  c'est l'horloge du `BEGIN`).
- **`verified_by` / `verified_at` / `verification_method` : les trois à `NULL`** sur
  les deux lignes. Rien n'est promu.
- **Chaque ligne porte le `sha256` de SA pièce** — contrôle d'intégrité, jamais clé.
- **SQL réellement émis : 4 requêtes — 2 `INSERT`, 2 `SELECT`.** Aucun `UPDATE`,
  aucun `DELETE`. Mesuré sur le flux, pas déduit du code.

### Le lecteur, dans la transaction

```
SRC-001 … SRC-008     UNKNOWN (NO_SNAPSHOT_LINK)      ← les 8 BOTIFY
SRC-0xS-09            OPERATOR_DECLARED #1 QUERY_CONTEXT
SRC-0xS-18            OPERATOR_DECLARED #2 QUERY_CONTEXT
TÉMOIN-SANS-LIGNE     UNKNOWN (NO_JOURNAL_ENTRY)
```

La **pièce témoin** est un `EvidenceSnapshot` réel
(`00118f8a-ad3c-4118-be9b-706e3ddaeb0a`, choisi à l'exécution) qui **a** un pont et
**n'a pas** de ligne : elle sépare `NO_JOURNAL_ENTRY` de `NO_SNAPSHOT_LINK`. Aucune
`CaseFileSource` ne pouvait jouer ce rôle — les 2 seules qui portent un `snapshotId`
sont précisément celles qu'on inscrit.

Les **8 autres sources restent `NO_SNAPSHOT_LINK`**. BOTIFY passe donc bien à
`UNKNOWN` sous le nouveau lecteur, faute de `snapshotId` **et** de qualification
gouvernée : **conséquence acceptée**, aucune ligne fabriquée pour elles.

### Rien d'autre n'a bougé

`CaseFileSource` (10 lignes, md5 `982d4862…`) et `EvidenceSnapshot` (1171 lignes,
md5 `cf3cd367…`) inchangées. `SRC-0xS-09.sourceUrl` porte **toujours** son espace.

### Après le ROLLBACK

| | avant | après |
|---|---|---|
| lignes du journal | **0** | **0** |
| `evidence_provenance_journal_id_seq` | `last_value=1`, `is_called=false` | `last_value=2`, `is_called=true` |

**La table est de nouveau VIDE.** Deux ids consommés et perdus (séquence non
transactionnelle, effet déclaré) : à l'inscription réelle, les ids seront **#3 et #4**,
pas #1 et #2. Les trous sont normaux — seul l'ORDRE compte.

---

## 5 · Une correction de garde, faite en chemin

En vérifiant que la nouvelle table entrait bien à l'inventaire S24, j'ai mesuré qu'elle
**n'était découverte nulle part** — ni par l'écrivain, ni par le lecteur mergé la veille.

**Cause** : l'amorce du mécanisme « client SQL direct » exigeait `query\s*\(`, sans
tolérer un **paramètre de type**. `db.query<JournalRow>(…)` et
`db.query<Record<string, unknown>>(…)` étaient donc **invisibles**. Les amorces Prisma
portaient déjà cette tolérance ; celle-ci ne l'avait pas.

**Correctif** : `query\s*(?:<[^(]*>)?\s*\(` — `[^(]` plutôt qu'un appariement de
chevrons, parce qu'un générique ne contient pas de parenthèse et que l'imbrication
(`<Record<string, unknown>>`) défait un `[^>]*`.

**Ampleur mesurée avant d'agir** : 62 → 65 tables touchées, **une seule** gouvernée et
hors inventaire — `evidence_provenance_journal`, déclarée `RACINE_GOUVERNEE / piece`,
avec sa raison. Aucune entrée morte. Les 14 témoins S24 restent verts, y compris
celui qui exige que la déclaration des mécanismes **énumère des verbes, jamais des
tables** (il a d'ailleurs rougi sur un premier jet de commentaire qui nommait la
table — garde utile, correction faite).

---

## 6 · État, et ce qui reste

**Suite complète : 502 fichiers, 7257 tests verts** (2 `expected fail`, 3 skipped).
`tsc --noEmit` : 0. ESLint sur les six fichiers touchés : 0.

**Production, inchangée** : 22 claims · 10 sources · 6 décisions · **0 ligne de
journal** · 0 PUBLIC · séquence de décisions 39 · séquence du journal désormais à 2.

**⛔ L'inscription réelle attend l'autorisation explicite du fondateur**, puisque
`declared_by` portera son nom, et parce que les deux triggers append-only rendent la
ligne **définitivement** irrétractable. Le script d'inscription réelle sera une
exécution distincte : la répétition, elle, ne peut **que** rollback — le `ROLLBACK`
est dans un `finally`, sans drapeau pour le désarmer.

**Pas fait, à dessein** : aucune bascule du contrat (étape D) · aucun branchement du
lecteur sur `decideFoundation` ni `decidePublicRelease` · aucune variable `TSA_*` ·
aucun appel réseau · aucune ligne pour BOTIFY.

---

## 7 · Questions pour GPT

1. **`declared_at` des deux lignes diffère de ~160 ms** (deux appels, deux instants
   pris côté appelant). Alternative : **un seul** instant pour les deux, parce que
   c'est **un seul geste de qualification** portant sur deux pièces d'un même contexte
   de découverte. Les deux lectures sont défendables ; j'ai gardé « un instant par
   inscription » parce que c'est littéralement ce que la ligne dit. **Confirmes-tu, ou
   veux-tu un instant unique partagé ?**

2. **`recorded_at` est identique sur les deux lignes** (`now()` est figé pour toute la
   transaction). C'est correct — c'est l'horloge du `BEGIN` — mais cela signifie que
   `recorded_at` **n'ordonne pas** deux lignes d'une même transaction ; seul `id` le
   fait. Le lecteur utilise déjà `max(id)`, donc rien à corriger. **Signalé pour que ce
   ne soit pas découvert plus tard comme une surprise.**

3. **Les 46 pièces de `00_INBOX_RAW`** restent injournalisables : sans
   `EvidenceSnapshot`, pas d'identité gouvernée, donc pas de ligne possible. Point
   d'architecture déjà remonté au DDL, toujours ouvert.

4. **L'exemption de mutation** est aujourd'hui accordée à **un** fichier nommé (le banc
   PGlite). Si le vertical slice de samedi a besoin de prouver la même chose, il faudra
   soit l'ajouter à la liste, soit factoriser le banc. **Préférence ?**
