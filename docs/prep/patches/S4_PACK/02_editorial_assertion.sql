-- ═══════════════════════════════════════════════════════════════════════════
-- S4 · FICHIER 2/6 — EDITORIAL_ASSERTION · 11 lignes
--
-- Ces 11 lignes ne sont PAS des captures. Ce sont des documents RÉDIGÉS par
-- INTERLIGENS : des fiches de pièce et des transcriptions. Les 7 fichiers ont
-- été ouverts sur le dépôt local le 2026-08-28 — leur contenu, et non leur
-- sourceType, fonde le classement.
--
-- ⚠️ CE FICHIER CORRIGE UNE ERREUR DE LA PROPOSITION PRÉCÉDENTE. Les 8 fiches
-- « explorateur » y étaient proposées en THIRD_PARTY_DATA, sur l'hypothèse que
-- c'étaient des réponses d'API enregistrées telles quelles. C'est FAUX : ce
-- sont des fiches d'exposition rédigées à la main, qui CITENT une source
-- tierce. La lecture des fichiers a infirmé l'hypothèse.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── LOT 8 — les 8 fiches de pièce « exhibit sheet » ──────────────────────
-- evidence/bkokoski/onchain/ex_02..ex_08.json + evm/ex_09.json
--
-- Contenu réel, vérifié fichier par fichier : exhibit_id, label, classification,
-- confidence, relevance. Exemple de label : « Associated Wallet B (BK cluster)
-- — GHOST/BOTIFY cashout $802 ». Le montant vient de Helius, l'ATTRIBUTION au
-- cluster BK et le jugement « confirmed » viennent de nous.
--
-- R1 : l'acte qui a produit ce fichier est la RÉDACTION d'une fiche, pas la
-- collecte d'un flux. Une fiche qui cite une source tierce ne devient pas
-- elle-même une donnée tierce — sinon toute note d'enquête citant un explorateur
-- se transformerait en donnée d'explorateur.
UPDATE "EvidenceItem" SET "rowNature" = 'EDITORIAL_ASSERTION'
 WHERE "rowNature" = 'UNCLASSIFIED'
   AND "captureTool" = 'backfill'
   AND "sourceType" = 'EXPLORER'
   AND "mimeType" = 'application/json';                             -- attendu : 8

-- ─── LOT 10 — les 2 transcriptions de post social ─────────────────────────
-- evidence/bkokoski/social/ex_01.json et social/exit-post-20260319.json
--
-- Les deux portent le MÊME exhibit_id (EX-01), le même post @kokoski
-- transcrit à la main (« stepping back from Dione, stay tuned BK »), et
-- ex_01.json déclare screenshot_needed: true — AUCUNE capture n'existe.
-- La transcription est donc le seul enregistrement de ce post.
--
-- Ce n'est pas une observation primaire : personne n'a capturé l'écran. C'est
-- notre retranscription, avec notre jugement de pertinence (« Exit statement
-- 520 min before hub activation »).
UPDATE "EvidenceItem" SET "rowNature" = 'EDITORIAL_ASSERTION'
 WHERE "rowNature" = 'UNCLASSIFIED'
   AND "captureTool" = 'backfill'
   AND "sourceType" = 'X_POST'
   AND "mimeType" = 'application/json';                             -- attendu : 2

-- ─── LOT 9a — l'index de dossier ──────────────────────────────────────────
-- evidence/bkokoski/INDEX.json — sommaire du dossier bkokoski : liste des
-- 9 pièces, « total_documented_usd »: 649 669, « screenshots_needed ».
-- Il n'observe rien et ne calcule rien : il récapitule. Identité par sha256,
-- pas par chemin — le sha256 EST l'identité de la preuve.
UPDATE "EvidenceItem" SET "rowNature" = 'EDITORIAL_ASSERTION'
 WHERE "rowNature" = 'UNCLASSIFIED'
   AND "sha256" = '394fdc21e8e9fcf7193f123e85fd05031cc7e26ca0af3391649b2c3ad466ec2f';
                                                                    -- attendu : 1

-- ─── VÉRIFICATION — ligne à ligne, 11 lignes ──────────────────────────────
SELECT "sourceType", "mimeType", "filePath", "rowNature"::text
  FROM "EvidenceItem"
 WHERE "rowNature" = 'EDITORIAL_ASSERTION'
 ORDER BY "sourceType", "filePath";
-- ATTENDU : exactement 11 lignes — 8 ex_0X.json (onchain + evm),
-- 2 social/*.json, 1 INDEX.json. Aucune autre.

-- ─── ROLLBACK ─────────────────────────────────────────────────────────────
-- UPDATE "EvidenceItem" SET "rowNature" = 'UNCLASSIFIED'
--  WHERE "rowNature" = 'EDITORIAL_ASSERTION';
