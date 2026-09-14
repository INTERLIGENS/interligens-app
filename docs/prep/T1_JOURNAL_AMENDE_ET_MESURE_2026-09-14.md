# T1-JOURNAL-AMENDE-ET-MESURE — rapport de fenêtre, 2026-09-14

Branche `feat/cc-offline-187-journal-amende`, depuis `origin/main` = 00d17e0. Aucun DDL posé, aucune écriture de production, `readProvenanceKind` non basculé, `CaseFileSource` non touchée, rien déployé.

## 1. La mesure de l'étape 0 — lecture seule, ep-square-band, PostgreSQL 17.11

Toutes les requêtes sont des SELECT dans une transaction `BEGIN READ ONLY … ROLLBACK`. Rien n'a été déduit d'un nom de colonne : chaque lien est prouvé par jointure.

**a) `"EvidenceSnapshot"` compte 1171 lignes.**

**b) Le pont existe, par une seule colonne : `"CaseFileSource"."snapshotId"`.**
Colonne `text NULL`, contrainte `CaseFileSource_snapshotId_fkey` : `FOREIGN KEY ("snapshotId") REFERENCES "EvidenceSnapshot"(id) ON DELETE SET NULL`. C'est la seule FK entrante sur `"EvidenceSnapshot"` dans toute la base. `"CaseFileSource"` n'est pas un modèle Prisma : elle n'existe qu'en SQL brut.

| Sources | snapshotId | sha256 | sourceUrl |
|---|---|---|---|
| 2 sur 10 (SRC-0xS-09, SRC-0xS-18, dossier IL-SHILL-VINE-001) | présent, et la jointure trouve la ligne | présent, identique à celui du snapshot | URL de recherche, identique à celle du snapshot |
| 8 sur 10 (SRC-001 … SRC-008, dossier IL-SHILL-BOTIFY-001) | NULL | NULL | NULL |

**c) SRC-0xS-09 et SRC-0xS-18 correspondent à un EvidenceSnapshot existant : OUI.**

| Source | EvidenceSnapshot.id | sha256 concordant | relationKey |
|---|---|---|---|
| SRC-0xS-09 | `34f4068a-57d8-45c5-9c8a-47b29b931e1b` | oui (8c55dd83…39ace3, unique dans la table) | 0xSweep:VINE |
| SRC-0xS-18 | `f24e3252-7d16-41a3-8253-eb0c1be67654` | oui (c60be4bb…c4f0e, unique dans la table) | 0xSweep:VINE |

Les deux snapshots portent `snapshotType = osint_x_search`, `sourceUrl = https://x.com/search?q=from:0xSweep VINE`, `reviewStatus = approved`, `localFilePath` vers les captures du 2026-06-18 (17:37:40 et 17:37:57), `sourceType`/`sourceRefId`/`evidenceLevel`/`hashStatus` NULL. Le journal peut donc recevoir une ligne pour chacune d'elles, par ces deux ids, dès qu'il sera posé. Les deux entrées OPERATOR_DECLARED du registre temporaire (clé sha256) ont chacune exactement un EvidenceSnapshot cible : la bascule de `readProvenanceKind` vers le journal est **possible pour ces deux pièces**, par le chemin `CaseFileSource.snapshotId → evidence_provenance_journal.evidence_snapshot_id`.

**d) Pour les 8 sources BOTIFY, il manque tout.**
Elles n'ont ni `snapshotId`, ni `sha256`, ni `sourceUrl`. Seuls `filename` (IMG_2239.jpg … IMG_2246.jpg), `caption` et `capturedAt` (novembre 2024) sont renseignés. Aucun EvidenceSnapshot ne porte ces noms de fichier dans `localFilePath`, `imageUrl`, `title` ou `caption`. Les 13 EvidenceSnapshot BOTIFY existants sont d'autres pièces (deck interne, posts @DonWedge, @planted…), toutes `reviewStatus = excluded`, toutes sans sha256. Pour qu'une source BOTIFY devienne journalisable, il faudrait : (1) les octets du fichier, pour un sha256 ; (2) une ligne `"EvidenceSnapshot"` créée pour cette capture, avec ce sha256 ; (3) `"CaseFileSource"."snapshotId"` posé sur cet id, ce qui est une écriture sur `CaseFileSource`, interdite dans cette fenêtre. Ces 8 sources fondent les 8 claims C1…C8 v1 ATTACHED de BOTIFY. Sous la décision 5, elles sont UNKNOWN dérivé, donc non fondables, et le resteront tant que ces trois étapes ne sont pas faites.

**Conséquence sur la bascule.** Le journal, une fois posé, sera vide. `readProvenanceKind` reste sur le registre en code jusqu'au vertical slice. Quand il basculera, il devra lire par `evidence_snapshot_id`, pas par sha256 : le journal est clé par identité, et 244 pièces n'ont pas de sha256. Le lecteur devra passer par `CaseFileSource.snapshotId` ; une source sans `snapshotId` est UNKNOWN dérivé sans même consulter le journal.

**Point relevé, pas traité : la FK `ON DELETE SET NULL`.** Une pièce qui porte un journal ne peut plus être supprimée (RESTRICT). Une pièce sans journal, elle, peut l'être, et `CaseFileSource.snapshotId` passe alors silencieusement à NULL : la projection perd son observation sans que rien ne l'écrive. Sous la décision 5, c'est une divergence journal ↔ CaseFileSource qui devrait faire FAIL CLOSED. Question pour GPT, plus bas.

État de production au moment de la mesure : 22 claims, 10 sources, 6 décisions, séquence 39, `evidence_provenance_journal` absente. Inchangé à la fin de la fenêtre.

## 2. Nullabilité de `source_url` et `reference_kind` : NOT NULL, les deux

Depuis 4a, une ligne est une qualification apportée. Qualifier, c'est dire comment une référence a été obtenue (`provenance_kind`) et ce qu'elle désigne (`reference_kind`). Une ligne sans référence dirait « quelqu'un a déclaré » sans dire quoi : c'est la ligne UNKNOWN qui vient d'être bannie, sous un autre nom. Les trois valeurs du domaine présupposent une référence (déclarée, extraite, vérifiée) ; la seule qui n'en présupposait pas était UNKNOWN. Nullable, `source_url` aurait laissé passer une déclaration sans objet que plus aucun CHECK ne refusait, puisque `unknown_has_no_reference` disparaît.

`source_url` est le localisateur de la référence : une URL pour PUBLICATION, PROFILE, QUERY_CONTEXT ; pour un DOCUMENT sans URL publique, l'emplacement gouverné où il se lit (clé R2, chemin d'archive). Le CHECK existant (non vide, sans blanc de bord) n'impose pas la forme `http`, à dessein. Une référence dont la nature ne tient dans aucun domaine se déclare OTHER, elle ne se tait pas.

Le NOT NULL est la forme structurelle de 4a : il remplace une contrainte de cohérence à deux branches par un invariant plus simple, « toute ligne porte une référence et sa nature ». Les quatre axes restent séparés : qui a capturé (EvidenceSnapshot), comment l'URL a été obtenue (`provenance_kind`), ce qu'elle désigne (`reference_kind`), si la correspondance a été vérifiée (`verified_by`/`verified_at`/`verification_method`). Aucune colonne ajoutée, aucune retirée.

## 3. Le harnais : 76 sur 76, PGlite 0.3.15 (PostgreSQL 17.5 WASM)

```
PGLITE_PATH=…/@electric-sql/pglite/dist/index.js npx tsx scripts/casefile/harnais-provenance-journal-pglite.mts
✅ scénarios KO = 0 / 76
```

Trois séries. Le harnais ne s'est pas rougi lui-même cette fois : premier passage vert, sans correction intermédiaire. Le piège de l'opérateur `??` (NULL explicite remplacé par le défaut) était déjà neutralisé par `in v ? v[k] : DEFAUTS[k]` ; les deux scénarios « sans URL » et « sans reference_kind » envoient bien NULL, et c'est le NOT NULL qui répond (23502), pas un CHECK.

**(A) Le vérificateur sait échouer, 21 scénarios.** Témoin exit 0 ; table absente exit 2 ; 19 sabotages exit 3 avec l'écart nommé. Les six commandés :

| Sabotage | Écart nommé |
|---|---|
| UNKNOWN réintroduit dans le domaine | `contrainte …_provenance_kind_check : forme divergente — réel CHECK ((provenance_kind = ANY (ARRAY['UNKNOWN'::text, …` |
| `unknown_has_no_reference` réintroduite | `contrainte INATTENDUE : …_unknown_has_no_reference_check` |
| `verified_not_query_context` retirée | `contrainte ABSENTE : …_verified_not_query_context_check` |
| DEFAULT ajouté sur `declared_at` | `défaut INTERDIT (donnée déclarée, pas une horloge) : declared_at — réel now()` |
| FK affaiblie en CASCADE | `contrainte …_snapshot_fkey : forme divergente — réel … ON DELETE CASCADE` |
| trigger absent (`no_rewrite`, `no_truncate`) | `APPEND-ONLY non exécutable : trigger ABSENT …` |

Ajoutés cette fenêtre : `reference_kind` et `source_url` DROP NOT NULL (écart `nullabilité divergente`), et un trigger présent mais désactivé (`ALTER TABLE … DISABLE TRIGGER` → `tgenabled = D`, écart `trigger … DÉSACTIVÉ`). Le vérificateur lit désormais `tgenabled` : un trigger désactivé ne protège rien.

**(B) Le DDL tient ses règles, 34 écritures réelles.**

| Cas | SQLSTATE |
|---|---|
| INSERT `provenance_kind = 'UNKNOWN'`, référence complète | 23514 (le domaine refuse) |
| INSERT `'UNKNOWN'` dans l'ancienne forme, sans URL ni reference_kind | 23502 (le NOT NULL refuse avant le CHECK) |
| INSERT VERIFIED sans `verification_method` | 23514 |
| INSERT VERIFIED sur `reference_kind = 'QUERY_CONTEXT'` | 23514 |
| INSERT `verification_method` hors vocabulaire | 23514 |
| INSERT sha256 mal formé | 23514 |
| INSERT `evidence_snapshot_id` inexistant | 23503 |
| INSERT sans `source_url` / sans `reference_kind` | 23502 / 23502 |
| UPDATE, DELETE, TRUNCATE | 23001, 23001, 23001 |
| INSERT OPERATOR_DECLARED valide | PASSE |
| INSERT DOCUMENT avec clé R2 en `source_url` | PASSE |

Postgres évalue les NOT NULL avant les CHECK : c'est pourquoi l'ancienne forme d'UNKNOWN sort en 23502 et non 23514. Les deux formes sont refusées ; aucune ligne stockée ne porte `'UNKNOWN'` après tous les essais (compté : 0). Lecture canonique : le dernier état de `snap-1` est sa 4e ligne, `snap-2` sans ligne vaut UNKNOWN par COALESCE, plan servi par l'index sans tri.

**(C) Le post-check SQL sait rougir, 21 scénarios.** Le second bloc Neon est rejoué sur chaque schéma saboté : 34 lignes `ok = true` sur le témoin, 42P01 sur table absente, au moins une ligne `ok = false` sur chacun des 19 sabotages, avec le point nommé. Après 4 lignes écrites, exactement une ligne `false` : « table VIDE ». Le post-check vérifie la pose, pas la vie de la table.

Contre la production : `npx tsx scripts/casefile/verifier-provenance-journal-schema.ts` → exit 2, `ABSENTE`, prérequis FK (`PRIMARY KEY (id)` sur `"EvidenceSnapshot"`) PRÉSENT.

## 4. Le SQL prêt à poser

- **Bloc 1, le DDL** : `docs/prep/MIGRATION_PROVENANCE_JOURNAL_2026-09-14.sql`, section `BEGIN; … COMMIT;`, à coller d'un coup. Domaine `('OPERATOR_DECLARED','EXTRACTED','VERIFIED')` ; `unknown_has_no_reference` supprimée ; `reference_kind` et `source_url` NOT NULL, justification en commentaire ; `verified_iff_verification` et `verified_not_query_context` conservées telles quelles ; FK RESTRICT/RESTRICT ; sha256 attribut nullable au format contrôlé ; `declared_at` et `verified_at` sans DEFAULT ; `recorded_at DEFAULT now()` ; index `(evidence_snapshot_id, id DESC)` ; deux triggers sur une fonction propre à la table. Aucune colonne ajoutée. Le COALESCE vers `'UNKNOWN'` de la lecture canonique reste, et le commentaire dit qu'il est désormais la seule façon dont UNKNOWN existe.
- **Bloc 2, le post-check** : `docs/prep/POSTCHECK_PROVENANCE_JOURNAL_2026-09-14.sql`, une seule requête, une ligne par point : 12 colonnes et types, `id` GENERATED ALWAYS, absence de DEFAULT sur `declared_at` et `verified_at`, chaque contrainte par `pg_get_constraintdef` (11 = 1 PK + 9 CHECK + 1 FK, FK `ON UPDATE RESTRICT ON DELETE RESTRICT`), contraintes inattendues, index, deux triggers et leur `tgenabled = 'O'`, table VIDE. `ORDER BY ok` remonte les `false` en tête. Filtre `contype <> 'n'` conservé.

Attendu après pose : 12 colonnes · 1 PK · 9 CHECK · 1 FK · 2 index (pkey + snapshot_idx) · 2 triggers activés · 0 ligne. Le fondateur pose dans Neon ; rien n'est posé depuis le code.

## 5. Questions pour GPT

1. **`CaseFileSource_snapshotId_fkey` est `ON DELETE SET NULL`.** Une pièce sans journal peut être supprimée, et la projection perd son observation en silence. Sous la décision 5 (divergence = FAIL CLOSED), faut-il durcir cette FK en RESTRICT ? Ce serait un ALTER sur `CaseFileSource`, hors de cette fenêtre, et un « nouveau fait bloquant » au sens de la règle du troisième DDL.
2. **8 sources sur 10 sont hors de portée du journal** (aucun EvidenceSnapshot, aucun sha256, aucun pont). Les 8 claims BOTIFY C1…C8 sont donc UNKNOWN dérivé dès que le journal devient l'autorité. Cette non-fondabilité est-elle acceptée en l'état jusqu'au vertical slice, ou faut-il un chemin d'intake (octets → EvidenceSnapshot → snapshotId) avant la bascule de `readProvenanceKind` ?
3. **Le lecteur devra passer par `CaseFileSource.snapshotId`**, seule colonne de jointure, alors que le registre temporaire est clé par sha256. Confirmer que la bascule lit par identité (`evidence_snapshot_id`) et traite « source sans snapshotId » comme UNKNOWN dérivé, sans repli sur sha256.
4. **`source_url` NOT NULL admet un localisateur non-URL pour DOCUMENT** (clé R2, chemin gouverné). Est-ce conforme, ou GPT veut-il une forme `http(s)://` stricte, auquel cas un DOCUMENT sans URL publique ne serait pas journalisable ?

## Non fait, à dessein

- `readProvenanceKind` non basculé : journal vide à la pose, toute pièce y serait UNKNOWN dérivé, tout le corpus tomberait.
- `CaseFileSource` non touchée ; aucune ligne de provenance inscrite ; pas de déploiement.
- Garde S24 : pas d'entrée d'inventaire tant que le journal n'a ni lecteur ni écrivain de production.
