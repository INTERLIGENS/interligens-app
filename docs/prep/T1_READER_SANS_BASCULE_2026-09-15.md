# T1-READER-SANS-BASCULE — le lecteur du journal, sans autorité

**Fenêtre** : 2026-09-15 · branche `feat/cc-offline-190-reader-journal`
**Base** : `main` = 3177330 · version servie 9ee790c
**Écritures de production** : AUCUNE. Aucun DDL, aucun déploiement, aucune ligne
inscrite dans `evidence_provenance_journal`, aucun branchement sur
`decideFoundation` ni `decidePublicRelease`.

> « A new authority is not made operational merely because its schema exists.
>   It becomes authoritative only after a positive governed witness proves the
>   path it is meant to govern. »

---

## 1 · Vérification d'état — lecture seule, avant toute construction

Cinq points, cinq mesures. Aucun ne diverge.

| # | Point | Méthode | Résultat |
|---|-------|---------|----------|
| 1 | Schéma des décisions, étendu à `cause` | `verifier-decisions-publication-schema.ts` | **exit 0** — CONFORME |
| 2 | Schéma du journal de provenance | `verifier-provenance-journal-schema.ts` | **exit 0** — CONFORME, **0 ligne** |
| 3 | FK `CaseFileSource_snapshotId_fkey` | `pg_get_constraintdef` | `FOREIGN KEY ("snapshotId") REFERENCES "EvidenceSnapshot"(id) ON UPDATE RESTRICT ON DELETE RESTRICT` |
| 4 | Les 3 claims VINE v2 | `SELECT` sur `CaseFileClaim` | `VINE-0xS-01 v2 ATTACHED 9074c4c7` · `-02 v2 ATTACHED 2f6f77bf` · `-03 v2 ATTACHED 8ed3499d`, chacune chaînée sur sa v1 (elle-même ATTACHED, intacte) |
| 5 | Les 6 décisions | `SELECT` + vérificateur | `#16 #17 #18 GRANT cause NULL` · `#37 #38 #39 REVOKE cause INSUFFICIENT_SOURCE_PROVENANCE` |

Détail du point 1 : 10 colonnes (dont `cause` text NULL sans défaut), 7 contraintes
(PK, `audience_check`, `decision_check`, `decided_by_check`, `cause_vocabulaire`,
`cause_coherence`, `target_fkey`), 2 index, 2 triggers append-only **actifs**
(`tgenabled = 'O'`).

Détail du point 2 : 12 colonnes, 12 contraintes (dont `provenance_kind_check`
**sans UNKNOWN**, `source_url_form_by_kind_check`, `verified_iff_verification_check`,
`verified_not_query_context_check`), 2 index, 2 triggers append-only actifs.

Comptes de production, mesurés : **22 claims · 10 sources · 6 décisions · 0 ligne
de journal · 1171 EvidenceSnapshot**. Séquence des décisions `last_value = 39`.
Décisions EN VIGUEUR : `#37 #38 #39` = REVOKE → **0 PUBLIC**.

Pont `snapshotId` : 2 sources sur 10.
`SRC-0xS-09 → 34f4068a…` (sha `8c55dd83`), `SRC-0xS-18 → f24e3252…` (sha `c60be4bb`) ;
les 8 sources BOTIFY n'ont ni pont, ni sha256. Les deux `EvidenceSnapshot` pontés
portent la même `sourceUrl` de RECHERCHE (`https://x.com/search?q=from:0xSweep VINE`,
espace comprise) — le contexte de découverte, pas le post.

> ⚠️ Un état de la mémoire de travail était **périmé** : « journal : DDL amendé
> 4a/4b/5, NOT posé ». La table est posée, conforme et vide. Corrigé.

---

## 2 · Le lecteur — `src/lib/casefile/journalProvenance.ts`

### Le chemin de résolution

```
CaseFileSource.snapshotId → EvidenceSnapshot.id → evidence_provenance_journal
```

| Cas | Verdict | Cause dérivée |
|-----|---------|---------------|
| `snapshotId` absent, vide, ou d'un type inattendu | UNKNOWN | `NO_SNAPSHOT_LINK` |
| pont présent, aucune ligne pour cette pièce | UNKNOWN | `NO_JOURNAL_ENTRY` |
| pont présent, n lignes | la DERNIÈRE qualification — `max(id)` | — |
| ligne dont `provenance_kind` sort du domaine fermé | UNKNOWN | `ROW_OUT_OF_DOMAIN` |
| ligne dont l'`id` n'est pas ordonnable | UNKNOWN | `ROW_OUT_OF_DOMAIN` |
| `VERIFIED` sans son triplet, ou non-VERIFIED avec | UNKNOWN | `ROW_OUT_OF_DOMAIN` |

Trois décisions de forme méritent d'être dites :

1. **L'ordre du tableau reçu n'est jamais présumé.** La dernière qualification est
   `max(id)`, calculée dans la fonction pure, en `BigInt` — la colonne est un
   BIGINT IDENTITY, et au-delà de 2^53 deux ids distincts se confondraient en
   flottant. La requête SQL trie de la même façon ; la résolution ne s'y fie pas.

2. **UNKNOWN n'est jamais lu.** Le domaine du journal est
   `OPERATOR_DECLARED | EXTRACTED | VERIFIED`. Une ligne portant `'UNKNOWN'`,
   `'unknown'`, `'Verified'` ou toute valeur hors domaine ne rend **pas** cette
   valeur : elle rend UNKNOWN **dérivé**, cause `ROW_OUT_OF_DOMAIN`. Le CHECK
   l'interdit en base ; le lecteur ne s'y fie pas.

3. **Un id non ordonnable ne se devine pas.** « Le dernier état connu » doit être
   non ambigu ; s'il ne l'est pas, on rend UNKNOWN plutôt qu'un choix inventé.

### ⛔ Aucun repli sha-256

`sha256` est **déclaré** dans `JournalProvenanceRef` et **jamais lu** par la
résolution. Il y figure pour que l'interdit ait un LIEU : le retirer du type
rendrait la faute inexprimable, donc la garde invérifiable. Le mutant qui ajoute
le repli tient en une ligne — et le témoin (f) rougit dessus (§3).

### Ce que le lecteur n'est PAS

`readProvenanceKind` reste **l'autorité effective** jusqu'à la PHASE C, avec son
registre en code (deux entrées `OPERATOR_DECLARED`, SRC-0xS-09 et SRC-0xS-18).
Ses appelants sont inchangés : `canonicalReader.ts` et `governedExecutor.ts`.

---

## 3 · Preuve par mutation

`__tests__/casefile/t1-lecteur-journal.test.ts` — **30 cas, 30 verts.**
Sept mutants appliqués, mesurés, revertis.

| Mutant | Ce qu'il casse | Rouges | Cas rougis |
|--------|----------------|--------|------------|
| **M1** | **le repli sha-256**, nommément interdit | **3** | (a)×2 + **(f)** « sha256 identique de part et d'autre, snapshotId NULL » — rend `VERIFIED` au lieu d'`UNKNOWN` |
| M2 | la PREMIÈRE ligne du tableau gagne | 3 | (d) les trois cas d'ordre, dont « une requalification qui AFFAIBLIT est aussi la dernière » |
| M3 | le filtre par pièce disparaît | 4 | (e) les trois cas d'étanchéité + le lecteur en base |
| M4 | le domaine fermé n'est plus vérifié | 1 | (c) « un `'UNKNOWN'` stocké ne ressort jamais » |
| M5 | les deux causes d'absence se confondent | 3 | (b) journal vide, causes distinctes, (e) autre pièce |
| M6 | `governedExecutor` importe le lecteur | 2 | **(g)** « aucun appelant » + « les consommateurs de décision ne le mentionnent nulle part » |
| M7 | l'échec attendu du e2e vise un AUTRE emplacement | exit 1 | le e2e cesse d'absorber le refus et échoue franchement (§4) |

**Le mutant (f) en détail.** Le cas est construit pour qu'un repli *fonctionne* :
la ligne de journal porte **exactement** le sha256 réel de `SRC-0xS-09`
(`8c55dd83…ace3`), et la pièce n'a pas de pont. Sous M1 le lecteur rend
`VERIFIED` ; sans M1 il rend `UNKNOWN / NO_SNAPSHOT_LINK`. C'est précisément le
cas dont GPT dit qu'il « fonctionnerait aujourd'hui pour VINE » — et il est
refusé.

Un cas complémentaire verrouille l'autre sens : la résolution rend le **même
verdict** que le `sha256` de la pièce soit `null`, vide, concordant, discordant
ou malformé. Le hash n'entre pas dans la décision.

### Le témoin « aucun consommateur » — (g)

Quatre assertions structurelles, sur le code DÉPOUILLÉ (`codeSeul`, pour qu'une
mention en commentaire ne compte pas comme un appel) :

1. **aucun** fichier de `src/` ni `scripts/` n'appelle le nouveau lecteur — la
   liste des appelants est `[]` ;
2. les six consommateurs de décision — `governedWriter`, `governedExecutor`,
   `governedExecutorPrisma`, `publicProjection`, `publicationAuthority`,
   `canonicalReader` — ne le mentionnent nulle part ;
3. `readProvenanceKind` reste l'autorité : ses appelants sont **inchangés** ;
4. le lecteur n'écrit rien — aucun `INSERT` / `UPDATE` / `DELETE` / `TRUNCATE`
   sur `evidence_provenance_journal`, ici ni ailleurs dans `src/` et `scripts/`.

Suite complète : **500 fichiers, 7180 tests verts** (2 expected fail, 2 skipped —
préexistants). `tsc --noEmit` : 0. `eslint` : 0.

---

## 4 · Le e2e — voie prise : **voie 2, échec attendu documenté**

### L'état constaté

`scripts/casefile/executor-e2e-pglite.mts` **plantait** — `TypeError: Cannot read
properties of undefined (reading 'contentHash')`. Un plantage, pas un rouge : il
masquait tout ce qui suit.

Cause mesurée, et **différente de celle attendue** : le témoin positif de
fondation est refusé

```
SOURCE_PROVENANCE_INCOMPLETE @ SRC-001.provenanceKind
```

et non `SOURCE_PROVENANCE_UNQUALIFIED`. Au niveau de l'**éligibilité**, UNKNOWN
tombe bien sous `SOURCE_PROVENANCE_UNQUALIFIED` ; mais `causeDeContrat`
(`governedWriter.ts`) replie **toute** cause d'éligibilité, sauf
`SOURCE_PROVENANCE_NOT_VERIFIED`, sur `SOURCE_PROVENANCE_INCOMPLETE`. C'est
l'**emplacement** qui distingue : une pièce sans empreinte refuserait
`SRC-001.sha256`, une pièce non qualifiée refuse `SRC-001.provenanceKind`.

### Pourquoi la voie 1 est impossible

**Obstacle 1 — inventer une fausse autorité.** L'autorité de provenance
aujourd'hui est le registre en code de `provenanceKind.ts`, clef sur sha256, deux
entrées `OPERATOR_DECLARED` transcrites du ruling. Y ajouter une entrée pour une
pièce FABRIQUÉE — a fortiori `VERIFIED`, alors que le registre n'en porte aucune
par doctrine, et qu'un test l'interdit — rendrait un sha256 fictif publiable dans
le code de production. C'est exactement ce que GPT exclut.

**Obstacle 2, dirimant — l'index unique.** Emprunter un sha256 *réellement*
qualifié (ceux de `SRC-0xS-09` / `SRC-0xS-18`) est **impossible** en mode
`--pg17-rollback` : `"EvidenceSnapshot"` porte l'index UNIQUE
`EvidenceSnapshot_sha256_key`, et l'insertion du snapshot synthétique échouerait
en `23505` — le harnais documente déjà cet échec, mesuré. Un fixture vert en WASM
et rouge en PG17 réel ne serait pas une adaptation, ce serait une divergence de
modes.

**Voie 2, donc**, telle que GPT l'a prévue.

### Ce qui a été fait

Le plantage est remplacé par un **échec attendu, nommé, daté, avec sa condition
de levée** :

* le refus est reconnu par le **couple** (cause, emplacement), jamais par « ça a
  raté » — le mutant **M7**, qui vise `SRC-001.sha256` au lieu de
  `SRC-001.provenanceKind`, fait échouer le script en **exit 1**. Une régression
  ne peut pas se déguiser en échec attendu, et la cause seule ne suffirait pas :
  elle est déjà exercée par un autre scénario du script ;
* le script imprime un bloc `⚠️ ÉCHEC ATTENDU, DOCUMENTÉ` : cause, éligibilité
  sous-jacente, date d'origine, date de constat, condition de levée ;
* la ligne de synthèse ne dit plus `✅` mais `⚠️ … la suite POSITIVE n'a pas
  tourné` ;
* **code de sortie 4** — ni 0 (ce serait tolérer), ni 1 (ce serait confondre avec
  une régression réelle).

### Ce qui est dans le noir, et où la couverture vit encore

**Dans le noir** tant que l'échec dure : le contrat SQL de bout en bout —
atomicité, SAVEPOINT, relecture sous verrou, sceau persisté — et la complétude
« les 16 causes de `FOUNDATION_REFUSAL_CAUSES` atteintes ».

**Toujours prouvé ailleurs**, en vitest :

* `spine-00-revoke-eligibility.test.ts` — les deux éligibilités, UNKNOWN ni
  fondable ni publiable, le chemin REVOKE ;
* `rc-spine-00-ecrivain-gouverne.test.ts` — le décideur pur, témoin POSITIF de
  fondation avec provenance injectée ;
* `spine-00-executeur-gouverne.test.ts` — l'exécuteur, témoin POSITIF de
  libération avec lecteur simulé ;
* `t1-lecteur-journal.test.ts` — le lecteur du journal (cette fenêtre).

### Condition de levée

Le **vertical slice du samedi 2026-09-19**. Quand `evidence_provenance_journal`
devient l'autorité effective (PHASE C), le fixture porte un **témoin synthétique
VERIFIED légitime** — une ligne de journal pour SON PROPRE snapshot synthétique,
signée, datée, avec sa `verification_method` — sans toucher ni la règle métier ni
aucun registre réel. Le bloc `ECHEC_ATTENDU` disparaît alors, et le script
redevient vert par lui-même.

---

## 5 · Questions pour GPT

1. **La cause repliée.** `causeDeContrat` replie `SOURCE_PROVENANCE_UNQUALIFIED`
   sur `SOURCE_PROVENANCE_INCOMPLETE` : au niveau du contrat, « pièce non
   qualifiée » et « pièce incomplète » portent le **même nom**, et seul
   l'emplacement les sépare. Est-ce voulu ? Une décision de REVOKE motivée
   `INSUFFICIENT_SOURCE_PROVENANCE` ne distingue pas non plus les deux. Faut-il
   ouvrir `FOUNDATION_CONTRACT_CAUSES` à une cause propre — ou est-ce une
   distinction qui doit rester interne à l'éligibilité ?

2. **La cause dérivée, à la bascule.** Le lecteur rend `NO_SNAPSHOT_LINK`,
   `NO_JOURNAL_ENTRY` ou `ROW_OUT_OF_DOMAIN` avec son UNKNOWN. En PHASE C,
   `readProvenanceKind` rend un `SourceProvenanceKind` **nu**. Faut-il que la
   cause dérivée remonte jusqu'au refus (un REVOKE saurait alors dire *pourquoi*
   la provenance manque), ou la bascule doit-elle se faire à iso-signature, la
   cause restant un outil de diagnostic ?

3. **Les deux entrées du registre en code.** À la bascule, SRC-0xS-09 et
   SRC-0xS-18 perdent leur qualification `OPERATOR_DECLARED` si aucune ligne de
   journal ne la porte : le journal est vide. Confirmez-vous que la PHASE B doit
   **d'abord** produire ces deux lignes (écriture gouvernée, signée, datée) avant
   que la PHASE C ne retire le registre — et non l'inverse ? Sans quoi la bascule
   ferait retomber VINE de `OPERATOR_DECLARED` à UNKNOWN, c'est-à-dire de
   FONDABLE à non fondable.

4. **`ROW_OUT_OF_DOMAIN` sur un id non ordonnable.** J'ai choisi de rendre UNKNOWN
   plutôt que d'ignorer la ligne fautive et de prendre la précédente. Une ligne
   illisible rend l'ordre ambigu, et « le dernier état connu » cesse d'être non
   ambigu. Confirmez-vous ce mode de défaillance — fermé plutôt que dégradé ?

---

## Fichiers

| Fichier | Nature |
|---------|--------|
| `src/lib/casefile/journalProvenance.ts` | **neuf** — le lecteur, sans appelant |
| `__tests__/casefile/t1-lecteur-journal.test.ts` | **neuf** — 30 cas, 7 mutants |
| `scripts/casefile/executor-e2e-pglite.mts` | **modifié** — échec attendu documenté, exit 4 |
| `docs/prep/T1_READER_SANS_BASCULE_2026-09-15.md` | **neuf** — ce rapport |
