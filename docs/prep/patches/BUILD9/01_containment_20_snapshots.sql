-- ═══════════════════════════════════════════════════════════════════════════
-- BUILD 9 · BLOC 1/4 — DÉPUBLICATION DES 20 EVIDENCESNAPSHOT
--
-- ██  RÉDIGÉ, NON EXÉCUTÉ. Cible ep-square-band, éditeur SQL Neon.         ██
--
-- Les 20 lignes `relationType = 'case'` sont les SEULES preuves publiques du
-- produit. Mesuré le 2026-09-07, en lecture seule :
--
--     sha256      0 / 20      ← aucune intégrité
--     sourceUrl   0 / 20      ← aucune origine
--     canonicalMint 0 / 20    ← aucun sujet
--     tokenSymbol 0 / 20      kolHandle 0 / 20
--     observedAt  17 / 20
--
-- Un artefact sans empreinte et sans origine n'est pas vérifiable. Le publier
-- comme preuve à un lecteur Investor/Counsel est une affirmation que rien ne
-- soutient.
--
-- ─── CE QUE CE BLOC NE FAIT PAS ───────────────────────────────────────────
--
--   · il ne SUPPRIME rien — les 20 lignes restent, lisibles en interne ;
--   · il ne FABRIQUE aucun hash ni aucune provenance rétroactive ;
--   · il n'INFÈRE aucun sujet depuis `relationKey` — la mesure a établi que
--     l'intersection avec les tickers de dossier est VIDE et que la forme
--     n'est pas homogène (`GordonGekko` est un handle, `BOTIFY` et
--     `BOTIFY-MAIN` désignent le même sujet sous deux clefs) ;
--   · il ne les rattache PAS au dossier canonique comme preuve active.
--
-- L'absence de provenance n'est pas une preuve de fausseté. Ces artefacts
-- sortent de la publication ; rien n'est conclu sur leur contenu.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- Aucune contrainte CHECK sur "reviewStatus" (vérifié : seule la PK existe),
-- le vocabulaire s'étend donc sans DDL. `notes` porte la raison structurée.
UPDATE "EvidenceSnapshot"
   SET "isPublic"     = false,
       "reviewStatus" = 'excluded',
       notes          = COALESCE(notes || E'\n', '')
                        || 'EXCLUDED_FROM_PUBLICATION/INSUFFICIENT_PROVENANCE'
                        || ' (BUILD 9, 2026-09-07) — champs manquants : sha256, sourceUrl, canonicalMint.'
                        || ' Artefact conservé en interne. Aucune conclusion sur son contenu.',
       "updatedAt"    = now()
 WHERE "relationType" = 'case'
   AND "isPublic" IS TRUE;

COMMIT;

-- ─── POST-CHECKS — les quatre DOIVENT passer ──────────────────────────────

-- 1.1 · plus aucune preuve publique sans provenance. ATTENDU : 0
SELECT count(*) AS publiques_sans_provenance
  FROM "EvidenceSnapshot"
 WHERE "isPublic" IS TRUE
   AND (sha256 IS NULL OR "sourceUrl" IS NULL);

-- 1.2 · les 20 sont dépubliées et motivées. ATTENDU : 20 / 20 / 20
SELECT count(*) AS lignes,
       count(*) FILTER (WHERE "isPublic" IS FALSE)              AS depubliees,
       count(*) FILTER (WHERE "reviewStatus" = 'excluded')      AS motif_lifecycle,
       count(*) FILTER (WHERE notes LIKE '%INSUFFICIENT_PROVENANCE%') AS raison_structuree
  FROM "EvidenceSnapshot"
 WHERE "relationType" = 'case';

-- 1.3 · RIEN n'a été détruit ni fabriqué. ATTENDU : 20 · 0 · 0 · 17
SELECT count(*) AS toujours_presentes,
       count(sha256)          AS hash_fabriques,
       count("canonicalMint") AS sujets_inferes,
       count("observedAt")    AS observedat_intact
  FROM "EvidenceSnapshot"
 WHERE "relationType" = 'case';

-- 1.4 · le corpus public restant est vérifiable. ATTENDU : 0 ligne rendue
SELECT "relationType", count(*) AS publiques
  FROM "EvidenceSnapshot"
 WHERE "isPublic" IS TRUE
 GROUP BY 1;

-- ─── ROLLBACK ─────────────────────────────────────────────────────────────
-- Réversible : aucune donnée d'origine n'est écrasée, seuls deux drapeaux et
-- une note ajoutée changent.
--
--   UPDATE "EvidenceSnapshot"
--      SET "isPublic" = true, "reviewStatus" = 'approved',
--          notes = NULLIF(split_part(notes, E'\nEXCLUDED_FROM_PUBLICATION', 1), '')
--    WHERE "relationType" = 'case' AND "reviewStatus" = 'excluded';
