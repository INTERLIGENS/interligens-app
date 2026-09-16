# LE PREMIER CONSTAT NÉGATIF GOUVERNÉ — UNE MESURE QUI PEUT FONDER

**2026-09-16 · CC-OFFLINE-230 · BUILD B · witness réel en production**

INTERLIGENS savait citer une **preuve externe**. Il ne savait pas citer comme fondement **une mesure
déterministe qu'il a lui-même produite sur son propre corpus**. C'était le premier gap causal de
CONCLUSION ; il est fermé.

```
MEASURE → GOVERNED IDENTITY → PERSISTED OBJECT → READBACK DIGEST →
MACHINE_MEASURED PROVENANCE → CaseFileSource → PRIMARY_OBSERVATION → FOUNDATION MET
```

Et le principe qui gouverne tout le reste :

> **UN MOTEUR QUI EXPLIQUE POURQUOI IL REFUSE D'ÉCRIRE UN CHIFFRE
> DOIT LE REFUSER DANS SA PROPRE GRAMMAIRE.**

---

## 1. LA TROISIÈME CAUSE — CE QUE L'INSTRUMENT A TROUVÉ ET QUE PERSONNE N'AVAIT ÉCRIT

La consigne annonçait deux causes attendues. L'instrument en a rendu **trois**, et la troisième est
la découverte de la fenêtre :

```
RESULT = NOT_ESTABLISHED
CAUSES = NO_FOUNDED_ACTOR_WALLET_ATTRIBUTION
       · NO_GOVERNED_WALLET_CASE_TOKEN_BRIDGE
       · WALLET_SHAPED_STRINGS_PRESENT_BUT_UNFOUNDED   ← la sienne
```

Le corpus **n'est pas vide de wallets**. Trois claims du dossier portent des chaînes en forme de
wallet dans `actors` — les legacy `C9`–`C17`, `rowNature` NULL, `evidenceRefs` vide. Elles ne fondent
rien **parce qu'elles ne sont ni classées ni citantes**, pas parce que la donnée manquerait.

> **L'INFORMATION EXISTE, L'AUTORITÉ MANQUE.**

Pour un counsel ou un investisseur, c'est la phrase juste — et elle n'aurait pas été obtenue en
recopiant les causes de la consigne. C'est pourquoi les causes sont produites par l'instrument et
jamais dictées.

Chiffres rendus par la mesure :

| | |
|---|---|
| claims examinées | 15 |
| claims portant un acteur en forme de wallet | 3 |
| attributions acteur↔wallet **fondées** | **0** |
| en forme de wallet mais non fondées | 3 |
| pièces gouvernées examinées | 5 |
| bridges wallet↔dossier gouvernés | **0** |
| tables non gouvernées portant un wallet | 47 — **EXCLUES**, non fouillées |

---

## 2. LA BORNE FAIT PARTIE DU VERDICT

Un constat négatif exige un **univers de recherche explicitement borné**.

```
⛔ « aucun bridge n'existe »
✅ « aucun bridge admissible n'a été trouvé dans [périmètre mesuré],
    selon [instrument/version], à [instant] »
```

C'est la même règle que les fermetures de credentials de la veille — `CLOSED_ON_CANONICAL_SERVED_RUNTIME`,
jamais `CLOSED` tout court. Ici elle prend une forme particulière : **47 tables applicatives portent
une colonne wallet, et l'objet de mesure le DIT**, avec le motif de leur exclusion — elles ne portent
ni pièce citée ni provenance qualifiée, donc ne peuvent rien fonder. On ne prétend pas les avoir
fouillées.

Le mutant 2 (§5) existe précisément pour ça : **modifier le périmètre en douce, à verdict constant,
change le digest.** Sans borne scellée dans l'objet, un constat négatif est falsifiable sans trace.

---

## 3. LA NOUVELLE AUTORITÉ — MACHINE_MEASURED

Le vocabulaire de provenance était **fermé à quatre mots** et contraint en base. Aucun ne décrivait une
mesure machine : `OPERATOR_DECLARED` l'aurait attribuée à une personne, `EXTRACTED` aurait effacé la
distinction *external evidence / system measurement*.

`MACHINE_MEASURED` signifie : **la provenance de cet objet est une mesure produite par un instrument
INTERLIGENS identifié.** Elle ne signifie ni VERIFIED, ni EXTRACTED, ni OPERATOR_DECLARED, et **elle
n'a rien changé à ces trois-là**.

### Les gardes sont arrivées AVEC la valeur

> Une nouvelle autorité doit porter les gardes qui définissent sa sémantique **au moment où elle
> devient opérationnelle**. Sans elles, `MACHINE_MEASURED` serait un label libre dont les propriétés
> essentielles resteraient des conventions dépendantes de l'appelant.

Trois blocs DDL, posés par le fondateur dans l'éditeur SQL Neon, jamais depuis le code :

```sql
CHECK (provenance_kind IN ('OPERATOR_DECLARED','EXTRACTED','VERIFIED','MACHINE_MEASURED'))
CHECK (NOT (provenance_kind = 'MACHINE_MEASURED' AND reference_kind <> 'DOCUMENT'))
CHECK (provenance_kind <> 'MACHINE_MEASURED'
       OR declared_by ~ '^instrument:[a-z0-9][a-z0-9-]*@[0-9]+\.[0-9]+\.[0-9]+$')
```

*« Machine-observed facts identify the instrument »* n'est plus une phrase : **c'est un CHECK qui
refuse un nom de personne.**

### ⚠️ UN NOM DE CONTRAINTE TRONQUÉ PAR POSTGRESQL

Le nom écrit faisait **65 caractères** ; PostgreSQL limite les identifiants à **63**. Le nom réel est :

```
evidence_provenance_journal_measurement_declares_instrument_che
```

sans le `ck` final. **Conséquence mesurée : le post-check indexé sur le nom complet ne pouvait rien
renvoyer** — il aurait fait croire la contrainte absente alors qu'elle était posée.

> **UN POST-CHECK INDEXÉ SUR UN NOM QUE LA BASE A TRONQUÉ EST UN POST-CHECK QUI MENT.**

Vérifié : **aucun code, test ou requête du dépôt ne référence le nom complet.** C'est le nom réel qui
fait autorité. Consigné, rien renommé.

### L'asymétrie fonder / publier — déjà écrite, pas à tenir

`MACHINE_MEASURED` entre dans `FOUNDATION_TOLERATED_PROVENANCE`. Elle ne peut **jamais** publier, et
**aucune liste d'exclusion n'a eu à être tenue** : `isPublicationEligibleSource` exige littéralement
`=== "VERIFIED"`. Le fondement tolère un ensemble, la publication nomme une valeur — l'asymétrie fait
le travail toute seule, et c'est une garantie qu'on ne peut pas oublier de maintenir.

---

## 4. LE WITNESS RÉEL — PRODUCTION, DOSSIER IL-SHILL-VINE-001

```
1 · MESURE            RESULT NOT_ESTABLISHED · 3 causes · 2596 octets canoniques
                      sha256 d5cc1def3c38fc757023abfbce704244e94c228274d2c52689397f17077b73f8
                      instrument:il-measure-vine-wallet-attribution@1.0.0
                      identité de code 165d82c684b5c85f…
2 · NAISSANCE         interligens-evidence (READ+WRITE) · PUT conditionnel
                      EvidenceItem cmu3wy8xf0000s51utr1hqtkh
                      clé evidence/d5/d5cc1def….json · localisation DÉCLARÉE À L'ÉCRITURE
3 · RELECTURE         2596 octets relus · sha256 RECALCULÉ · CONCORDE
4 · IDENTITÉ          EvidenceSnapshot vinemeas-d5cc1def3c38fc75 · canonicalMint VINE · isPublic=false
5 · PROVENANCE        journal #17 · MACHINE_MEASURED / DOCUMENT · déclarant = instrument
6 · FONDEMENT         SRC-MEASURE-01 → VINE-MEASURE-01 v1 PRIMARY_OBSERVATION · ATTACHED
                      contentHash d6551a10e6977186…
```

Relu en base après coup :

```
claim    VINE-MEASURE-01 v1 ATTACHED PRIMARY_OBSERVATION evidenceRefs ["SRC-MEASURE-01"]
pièce    SRC-MEASURE-01 · SYSTEM_MEASUREMENT · sha256 d5cc1def… · snapshotId vinemeas-…
journal  #17 MACHINE_MEASURED / DOCUMENT / instrument:…@1.0.0 / r2://interligens-evidence/…
PUBLIC   0 ligne dans le dossier          verdict  UNDETERMINED (intact)
```

**Le digest qui compte est celui des octets PERSISTÉS**, relus depuis le compartiment — jamais celui
de ce qu'on avait en main.

### La claim se limite EXACTEMENT au résultat mesuré

Elle ne dit pas « aucune attribution n'existe ». Elle dit ce qui a été cherché, où, avec quel
instrument, à quel instant, ce qui n'a pas été trouvé, et ce qui n'a pas été fouillé. C'est
`PRIMARY_OBSERVATION` parce que c'est une **observation**, et rien d'autre.

---

## 5. LES MUTANTS — SANS ROUGE, LA GARDE N'EST PAS PROUVÉE

`__tests__/casefile/cc-offline-230-mesure-gouvernee.test.ts` — 11 témoins.

| # | Mutant | Détection |
|---|---|---|
| 1 | **RESULT** altéré (`NOT_ESTABLISHED` → `ESTABLISHED`) | digest différent |
| 2 | **SCOPE** rétréci à verdict constant | digest différent |
| 3 | **INSTRUMENT IDENTITY** (version, identité de code) | digest différent |
| 4 | `MACHINE_MEASURED` hors `DOCUMENT` | `MEASUREMENT_NOT_DOCUMENT` |
| 5 | déclarant humain (`David Douville`, `operator`, `instrument:sans-version`) | `MEASUREMENT_DECLARANT_NOT_INSTRUMENT` |

**Le mutant gouverné, exécuté en vif contre la production** — `--mutant` : présenter `SRC-MEASURE-01`
dérivée d'un AUTRE snapshot, c'est-à-dire altérer l'**identité de la pièce** :

```
✓ REFUSÉ [SOURCE_COLLISION] à SRC-MEASURE-01
✓ aucune ligne écrite : 6 pièces avant, 6 après
```

Une pièce gouvernée **ne s'adopte pas, elle se refuse.**

**Et les témoins ont des dents** : garde `MEASUREMENT_NOT_DOCUMENT` retirée → le témoin 4 rougit,
`1 failed | 10 passed`. Garde restaurée. Un témoin qui ne rougit jamais ne prouve rien.

---

## 6. TROIS TÉMOINS ANTI-RÉGRESSION ONT ROUGI, ET ILS AVAIENT RAISON

Aucun n'a été affaibli ; chacun a été **satisfait**.

1. **Recensement des sites gouvernés** — l'instrument ouvre la porte de naissance ET celle de
   relecture. Il devait être DÉCLARÉ, il l'est. Le recensement l'a attrapé de lui-même : c'est
   exactement son office.
2. **Poseurs de `provenanceKind`** — l'instrument inscrit `MACHINE_MEASURED`. Même statut que la
   tranche témoin : **appelant de l'écrivain, jamais second resolver**. Il ne lit aucune identité pour
   en déduire une qualification.
3. **S19 · recensement des littéraux du dossier** — l'instrument **recopiait** `IL-SHILL-VINE-001` et
   le mint, fabriquant une **troisième autorité** sur le même fait. Corrigé à la source : il IMPORTE
   `VINE_CASEFILE_REF` et `VINE_MINT` de `publicProjection`. Le témoin avait raison, et le code est
   meilleur après.

Suite complète : **522 fichiers, 7759 tests verts.**

---

## 7. INFERENCE CAPABILITY = **MISSING** — mesuré, et non simulé

La consigne demandait de MESURER le chemin réel avant d'écrire. Mesuré :

- `evidenceRefs` résout **strictement** vers un registre de `CaseFileSource`
  (`ReadonlyMap<string, PublicSource>`), jamais vers une claim ;
- la seule FK claim→claim de `CaseFileClaim` est **`supersedes → CaseFileClaim(id)`**, dont la
  sémantique est la **supplantation de version d'un même `claimId`**, résolue par
  `(casefileRef, claimId, version)` — pas une dépendance causale ;
- `natureBasis` et `methodRef` existent pour l'**auditabilité des ESTIMATE**, pas pour porter une
  dérivation.

**Le modèle ne porte pas la dépendance `PRIMARY_OBSERVATION → INFERENCE`.** La claim de conclusion
bornée n'a donc **pas** été écrite. Répéter la même `evidenceRef` sur les deux claims aurait produit
une inférence qui cite sa propre source d'observation en prétendant citer l'observation — le raccourci
que la fenêtre refuse explicitement.

C'est un **BLOCKER nommé**, pas un échec : B est évaluable séparément de CONCLUSION, et le witness
`PRIMARY_OBSERVATION → foundation MET` suffit à le clore.

---

## 8. CE QUE CE BUILD N'A PAS FAIT

Aucun GRANT, aucune ligne `PUBLIC`. `verdict` reste `UNDETERMINED`. `tigerScore`, `summary`,
`bodyMarkdown` non touchés. Les cinq dossiers ne sont pas normalisés, les quatre vocabulaires
concurrents de `verdict` ne sont pas corrigés — chantier D, après B. SG-1 reste `UNFOUNDED /
EXCLUDED`. L'auto-attribution DADDY reste close. Aucune table, aucune colonne, aucune migration de
données historiques, aucune taxonomie générale de mesures.

---

## 9. CONSIGNÉ, NON INSTRUIT

- **`DEPLOY_COMMAND_DOCUMENTATION_DRIFT` s'aggrave** : la commande de déploiement périmée figure dans
  **`AGENTS.md` ET `src/CLAUDE.md`**, deux fichiers, pas un. **BACKLOG P1.**
- Nom de contrainte tronqué à 63 caractères (§3). Le nom réel fait autorité. **Consigné.**
- `token_casefiles` **ne porte pas** de colonne `canonicalMint` : l'identité que le contrat de
  fondement compare vient de l'appelant et des snapshots. C'est ce qui a refusé la pièce
  `@0xSweep DADDY`, et c'est cohérent.
