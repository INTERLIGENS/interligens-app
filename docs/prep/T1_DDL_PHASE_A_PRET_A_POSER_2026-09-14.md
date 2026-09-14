# T1-DDL-PHASE-A-PRET-A-POSER — rapport de fenêtre, 2026-09-14

Branche `feat/cc-offline-188-ddl-phase-a`, depuis `origin/main` = 153f455. Aucun DDL posé, aucune écriture de production, `readProvenanceKind` non basculé, BOTIFY non touché, rien déployé. État réel connu : la colonne `cause` est déjà posée et les trois REVOKE sont déjà inscrits (37/38/39). Il reste **deux** DDL de Phase A à poser, dans cet ordre : le journal (blocs 1 et 2), puis la FK (bloc 3).

## 1. Le CHECK conditionnel — ce qui est tranché, ce qui est refusé

Contrainte `evidence_provenance_journal_source_url_form_by_kind_check`, un `CASE reference_kind … ELSE false END`, aucun `^https?://` global.

| reference_kind | Forme exigée (regex Postgres, `~`) | Tranché |
|---|---|---|
| PUBLICATION, PROFILE, QUERY_CONTEXT | `^https?://<hôte avec un point, sans / ni blanc>(/<reste sans blanc>)?$` | schéma en minuscules (valeur canonique, pas ce qu'on a tapé), aucun blanc nulle part (RFC 3986), hôte avec un point (refuse `localhost` et un nom nu) |
| DOCUMENT | `^r2://[a-z0-9][a-z0-9-]{1,61}[a-z0-9]/<clé sans blanc>$` | une forme et une seule : le couple `(bucket, storage_key)` du registre `governed_objects` rendu en URI. Bucket aux règles de nommage R2/S3. Refusés : chemin local, URL publique `pub-….r2.dev`, URN nu, prose |
| OTHER | `^[a-z][a-z0-9+.-]*:[^[:space:]]+$` | un URI à schéma (RFC 3986). Refuse « voir le dossier ». Sur-ensemble des autres formes à dessein : OTHER avoue la nature, il ne renseigne pas la forme |

**Ce que j'ai refusé d'exprimer en CHECK.** « Individuelle » pour PUBLICATION n'est pas structurellement exprimable. Une URL de post individuel n'a pas de forme universelle (x.com/<u>/status/<id>, t.me/<c>/<id>, permalien Discord, article). Un motif positif serait faux (il exclurait les autres plateformes) ou vide (il accepterait tout). Un motif négatif du type « pas `/search?` » ferait semblant : une page de fil filtré n'a pas `/search?` et n'est pas un post. L'individualité est établie par la vérification, c'est exactement ce que `verification_method = URL_MATCHES_CAPTURED_POST` atteste. Avant vérification, le `reference_kind` déclaré engage son auteur. Cette règle vit dans le code gouverné du vertical slice et sera prouvée par test, pas commentée dans le SQL. De même QUERY_CONTEXT n'exige pas `?q=` : un fil filtré ou une page de hashtag sont des contextes de découverte sans query string. Le motif HTTP est le même pour les trois kinds ; ce qui les sépare est la nature déclarée, et 4b.

**Fait mesuré qui compte pour samedi.** La valeur réelle de `sourceUrl` des deux pièces VINE, `https://x.com/search?q=from:0xSweep VINE`, contient une espace non encodée et **échoue** la forme HTTP (prouvé en écriture réelle sur PGlite, 23514). Une ligne de journal pour VINE devra porter l'URL encodée (`%20`, prouvée acceptée). Rien n'est réécrit : `CaseFileSource.sourceUrl` n'est plus une preuve, et ce n'est pas un backfill.

**Sémantique documentée, pas renommée.** `source_url` est un SOURCE LOCATOR ; le commentaire de colonne le dit, le `COMMENT ON TABLE` aussi. Renommage en `source_locator` envisageable après le RC.

Le rendu `pg_get_constraintdef` d'un CASE est multi-ligne : le post-check et le vérificateur normalisent les blancs (`regexp_replace(…, '\s+', ' ')`) et comparent en égalité stricte. Les autres contraintes sont mono-ligne, la normalisation ne les affaiblit pas.

## 2. La FK — état réel mesuré, lignes qui la violeraient

Lecture seule, `pg_constraint`, ep-square-band, PG 17.11 :

| Attribut | Valeur réelle |
|---|---|
| conname | `CaseFileSource_snapshotId_fkey` |
| pg_get_constraintdef | `FOREIGN KEY ("snapshotId") REFERENCES "EvidenceSnapshot"(id) ON DELETE SET NULL` |
| confdeltype | `n` (SET NULL) |
| confupdtype | `a` (NO ACTION, le défaut, non rendu par pg_get_constraintdef ; ce n'est pas RESTRICT) |
| condeferrable / convalidated | false / true |
| triggers sur CaseFileSource | 0 |

Lignes qui violeraient RESTRICT (snapshotId non NULL sans EvidenceSnapshot) : **0**. Répartition : 2 sources avec snapshotId, 8 à NULL (hors contrainte). L'ADD CONSTRAINT ne peut pas échouer sur les données existantes. CaseFileSource n'a pas de modèle Prisma : ce DDL ne désynchronise aucun client.

Le bloc 3 (`docs/prep/MIGRATION_FK_SNAPSHOTID_RESTRICT_2026-09-14.sql`) est une transaction avec deux gardes qui lèvent avant tout DROP : garde 1, la contrainte existante a exactement la forme mesurée (sinon 55000 ; « déjà en RESTRICT/RESTRICT » aussi 55000, le bloc ne se rejoue pas) ; garde 2, zéro orpheline mesurée dans la transaction (sinon 23503). Puis DROP / ADD sous le même nom, `ON UPDATE RESTRICT ON DELETE RESTRICT`, COMMIT, et le post-check intégré (définition rendue, confdeltype et confupdtype = `r`, validée non différable, FK casefileRef inchangée, 4 contraintes, 0 orpheline).

## 3. Le harnais : 109 sur 109

```
PGLITE_PATH=…/@electric-sql/pglite/dist/index.js npx tsx scripts/casefile/harnais-provenance-journal-pglite.mts
✅ scénarios KO = 0 / 109
```

| Série | Scénarios | Contenu |
|---|---|---|
| (A) le vérificateur sait échouer | 24 | 22 sabotages exit 3 nommés, dont les 3 nouveaux : CHECK conditionnel retiré → `contrainte ABSENTE`, remplacé par un `^https?://` global → `forme divergente`, forme DOCUMENT élargie au texte libre → `forme divergente` |
| (B) le DDL tient ses règles | 48 | les 12 nouveaux cas Q4 ci-dessous, plus tout l'existant (UNKNOWN → 23514/23502, VERIFIED sur QUERY_CONTEXT → 23514 toujours vert, append-only 23001, FK 23503) |
| (C) le post-check du journal sait rougir | 24 | 35 lignes `ok = true` sur le témoin, au moins une `false` par sabotage |
| (D) le bloc 3 | 13 | voir ci-dessous |

Cas Q4 en écriture réelle : PUBLICATION non-HTTP (hôte nu) → 23514 ; schéma en majuscules → 23514 ; PUBLICATION avec `r2://` → 23514 ; PROFILE non-HTTP → 23514 ; QUERY_CONTEXT `ftp://` → 23514 ; QUERY_CONTEXT avec la valeur réelle de prod VINE (espace) → 23514 ; QUERY_CONTEXT encodée `%20` → PASSE ; DOCUMENT chemin local → 23514 ; DOCUMENT URL publique r2.dev → 23514 ; DOCUMENT bucket en majuscule → 23514 ; DOCUMENT `r2://` sans clé → 23514 ; DOCUMENT `r2://<bucket>/<clé>` → PASSE ; OTHER prose → 23514 ; OTHER `urn:` → PASSE ; espace intérieure → 23514.

Série D : avant le bloc 3, supprimer un EvidenceSnapshot référencé passe et SRC-0xS-09 perd son observation en silence (`snapshotId = NULL`, mesuré). Le bloc 3 collé d'un coup passe, post-check 8 lignes `ok = true`. Après : DELETE → 23503, UPDATE de l'id → 23503, les 2 sources gardent leur snapshotId, une source à NULL reste insérable, rejouer le bloc → 55000. Gardes : une orpheline fabriquée sous `session_replication_role = replica` → le bloc lève 23503 et la contrainte SET NULL est encore là ; forme inattendue (CASCADE) → 55000 ; contrainte absente → 55000.

**Le harnais s'est rougi lui-même, une fois.** Premier passage de la série D : quand la garde lève dans le `BEGIN` du bloc 3, la session PGlite reste en transaction avortée et la requête suivante plante en 25P02. Le helper fait maintenant `ROLLBACK` après tout échec. Dans Neon, le même échec laisse la transaction avortée et l'éditeur affiche l'erreur : rien n'est posé. Second point corrigé avant la PR : le typecheck rejetait les génériques `db.query<T>` sur le module PGlite importé dynamiquement ; typé par cast.

Contre la production : vérificateur exit 2, table absente, prérequis PK présent. Lint 0, typecheck 0 erreur sur les scripts.

## 4. Les trois blocs, dans l'ordre

1. **BLOC 1** `docs/prep/MIGRATION_PROVENANCE_JOURNAL_2026-09-14.sql`, section `BEGIN; … COMMIT;` : CREATE TABLE (12 colonnes, 10 CHECK dont le conditionnel, FK RESTRICT/RESTRICT), index, COMMENT, fonction, 2 triggers.
2. **BLOC 2** `docs/prep/POSTCHECK_PROVENANCE_JOURNAL_2026-09-14.sql` : une requête, 35 lignes, `ok = true` partout attendu. Attendu : 12 colonnes · id GENERATED ALWAYS · aucun DEFAULT sur declared_at et verified_at · 12 contraintes (1 PK + 10 CHECK + 1 FK) par `pg_get_constraintdef` · 2 index · 2 triggers `tgenabled = 'O'` · table vide.
3. **BLOC 3** `docs/prep/MIGRATION_FK_SNAPSHOTID_RESTRICT_2026-09-14.sql` : gardes, DROP/ADD, COMMIT, post-check intégré, 8 lignes `ok = true` attendu.

Filtre `contype <> 'n'` dans les trois. Le fondateur pose dans Neon ; rien n'est posé depuis le code.

## Non fait, à dessein

- `readProvenanceKind` non basculé (Phase A : le journal vide ferait passer 1171 observations à UNKNOWN sans vertical slice).
- BOTIFY non reconstruit ; ses 8 sources restent UNKNOWN dérivé.
- Aucun repli sha256 nulle part.
- Aucune ligne de provenance inscrite ; pas de déploiement ; garde S24 inchangée.
