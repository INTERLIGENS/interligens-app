-- ═══════════════════════════════════════════════════════════════════════════
-- BUILD 9 · BLOC 2/4 — RATTACHEMENT DES 50 CAPTURES VINE
--
-- ██  RÉDIGÉ, NON EXÉCUTÉ. Cible ep-square-band, éditeur SQL Neon.         ██
--
-- Symétrie exacte du bloc 1. Mesuré le 2026-09-07 :
--
--                  lignes  sha256  sourceUrl  observedAt  mint  publiques
--     20 'case'        20       0          0          17     0         20
--     50 VINE          50      50         50          50     0          0
--
-- Ce qui est publié n'est pas vérifiable ; ce qui est vérifiable n'est pas
-- publié. Les 50 ont TOUT sauf une identité : un seul champ manque,
-- `canonicalMint`.
--
-- Et il n'est pas à découvrir : le mint VINE est déclaré dans le corpus
-- ratifié (`src/data/vine-osint.json`, `case_meta.mint`). Le rattachement est
-- une DÉCISION, pas une recherche.
--
-- ─── CE QUE LE RATTACHEMENT ÉTABLIT, ET CE QU'IL N'ÉTABLIT PAS ────────────
--
-- Il établit : « cet artefact APPARTIENT AU CORPUS du dossier VINE ».
--
-- Il n'établit NI « cet artefact PROUVE telle assertion », NI « cet artefact
-- est PUBLIABLE ». Les trois états sont distincts et aucun n'implique le
-- suivant — voir src/lib/casefile/publicationState.ts.
--
--     ATTACHED    ← ce bloc, et rien de plus
--     ADMISSIBLE  ← relatif à une assertion précise, hors de ce bloc
--     PUBLIC      ← décision de publication, hors de ce bloc
--
-- `isPublic = false` est donc PRÉSERVÉ sur les 50. Aucune promotion.
--
-- ─── NOTE DE SÉQUENÇAGE ───────────────────────────────────────────────────
--
-- `token_casefiles` ne contient AUCUN dossier VINE à ce jour (seulement
-- BLACKBULL et LAB). Le rattachement par `canonicalMint` ne dépend pas de
-- l'existence de la ligne : il pose l'identité. La jointure vers un dossier ne
-- RÉSOUDRA qu'une fois la ligne VINE créée par le bloc 4. Ce bloc est donc
-- valide seul, et son effet visible est différé.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

UPDATE "EvidenceSnapshot"
   SET "canonicalMint" = '6AJcP7wuLwmRYLBNbi825wgguaPsWzPBEHcHndpRpump',
       notes           = COALESCE(notes || E'\n', '')
                         || 'ATTACHED/BUILD9 (2026-09-07) — rattaché au corpus VINE par identité canonique.'
                         || ' Ne vaut ni admissibilité, ni publication.',
       "updatedAt"     = now()
 WHERE "relationKey" ILIKE '%VINE%'
   AND "canonicalMint" IS NULL;

COMMIT;

-- ─── POST-CHECKS — les cinq DOIVENT passer ────────────────────────────────

-- 2.1 · les 50 sont rattachées. ATTENDU : 50 / 50
SELECT count(*) AS lignes,
       count(*) FILTER (WHERE "canonicalMint" = '6AJcP7wuLwmRYLBNbi825wgguaPsWzPBEHcHndpRpump') AS rattachees
  FROM "EvidenceSnapshot"
 WHERE "relationKey" ILIKE '%VINE%';

-- 2.2 · AUCUNE promotion en public. ATTENDU : 0
SELECT count(*) AS promues_par_erreur
  FROM "EvidenceSnapshot"
 WHERE "canonicalMint" = '6AJcP7wuLwmRYLBNbi825wgguaPsWzPBEHcHndpRpump'
   AND "isPublic" IS TRUE;

-- 2.3 · les invariants de preuve sont INTACTS. ATTENDU : 50 · 50 · 50 · 50
SELECT count(sha256)      AS hash,
       count("observedAt") AS observe,
       count("sourceUrl")  AS origine,
       count(*) FILTER (WHERE "reviewStatus" = 'approved') AS revue_inchangee
  FROM "EvidenceSnapshot"
 WHERE "canonicalMint" = '6AJcP7wuLwmRYLBNbi825wgguaPsWzPBEHcHndpRpump';

-- 2.4 · aucune autre ligne n'a été touchée. ATTENDU : 50
SELECT count(*) AS lignes_portant_le_mint_vine
  FROM "EvidenceSnapshot"
 WHERE "canonicalMint" = '6AJcP7wuLwmRYLBNbi825wgguaPsWzPBEHcHndpRpump';

-- 2.5 · le corpus public global reste vide de non-vérifiable. ATTENDU : 0
SELECT count(*) AS publiques_sans_provenance
  FROM "EvidenceSnapshot"
 WHERE "isPublic" IS TRUE AND (sha256 IS NULL OR "sourceUrl" IS NULL);

-- ─── ROLLBACK ─────────────────────────────────────────────────────────────
--   UPDATE "EvidenceSnapshot"
--      SET "canonicalMint" = NULL
--    WHERE "canonicalMint" = '6AJcP7wuLwmRYLBNbi825wgguaPsWzPBEHcHndpRpump'
--      AND "relationKey" ILIKE '%VINE%';
