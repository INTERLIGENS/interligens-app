-- BUILD 9 / ÉTAPE 6 — scellement des claims de IL-SHILL-VINE-001
-- RÉDIGÉ, NON EXÉCUTÉ. Cible ep-square-band, éditeur SQL Neon.
-- révisions lues : 8 · déjà scellées : 0
-- à sceller       : 8
--
-- Le sceau couvre le CONTENU seul : ni state, ni version, ni horodatage.
-- Promouvoir un claim ne doit jamais casser son empreinte.

BEGIN;
UPDATE "CaseFileClaim" SET "contentHash" = 'b3d7d834c63f4d527a5de916c92368d730bb7ab51435eed0c2731a172d7ef036', "updatedAt" = now()
 WHERE "casefileRef" = 'IL-SHILL-VINE-001' AND "claimId" = 'C10'
   AND version = 1 AND "contentHash" IS NULL;
UPDATE "CaseFileClaim" SET "contentHash" = '602b9d6c1042612b6a55febf7dd5b51d7152c78a1fa79f6bddfb9440497a59c6', "updatedAt" = now()
 WHERE "casefileRef" = 'IL-SHILL-VINE-001' AND "claimId" = 'C11'
   AND version = 1 AND "contentHash" IS NULL;
UPDATE "CaseFileClaim" SET "contentHash" = 'cd6121e630e4320250de833e310a051a9934779032ec7f5e2ca9c6fe53a70967', "updatedAt" = now()
 WHERE "casefileRef" = 'IL-SHILL-VINE-001' AND "claimId" = 'C12'
   AND version = 1 AND "contentHash" IS NULL;
UPDATE "CaseFileClaim" SET "contentHash" = 'd7e30ff5aedfe5102305893aaa13f00e6bcafdb676d1e308287135d3481efd87', "updatedAt" = now()
 WHERE "casefileRef" = 'IL-SHILL-VINE-001' AND "claimId" = 'C14'
   AND version = 1 AND "contentHash" IS NULL;
UPDATE "CaseFileClaim" SET "contentHash" = 'd01b483ab8ca5eba51d66d655e0ac0f1304f72fa6e1cac44abca2b356cfb9925', "updatedAt" = now()
 WHERE "casefileRef" = 'IL-SHILL-VINE-001' AND "claimId" = 'C15'
   AND version = 1 AND "contentHash" IS NULL;
UPDATE "CaseFileClaim" SET "contentHash" = '07924d3f761c82e4d854ac3d8ae2ec4e6291dca5a0f5bdfe966e87759e13058c', "updatedAt" = now()
 WHERE "casefileRef" = 'IL-SHILL-VINE-001' AND "claimId" = 'C16'
   AND version = 1 AND "contentHash" IS NULL;
UPDATE "CaseFileClaim" SET "contentHash" = '093f7a254ff11ed370216024ea606e933ccb34005c1b0d7ad37a31c0a6ba02b7', "updatedAt" = now()
 WHERE "casefileRef" = 'IL-SHILL-VINE-001' AND "claimId" = 'C17'
   AND version = 1 AND "contentHash" IS NULL;
UPDATE "CaseFileClaim" SET "contentHash" = '33e20c096311d34eab1c18b17d77df607031552c6ce533d6aac76e7a5ce34cb6', "updatedAt" = now()
 WHERE "casefileRef" = 'IL-SHILL-VINE-001' AND "claimId" = 'C9'
   AND version = 1 AND "contentHash" IS NULL;
COMMIT;

-- ─── POST-CHECKS ────────────────────────────────────────────────────
-- 6.1 · plus aucun claim non scellé. ATTENDU : 0
SELECT count(*) AS non_scelles FROM "CaseFileClaim"
 WHERE "casefileRef" = 'IL-SHILL-VINE-001' AND "contentHash" IS NULL;

-- 6.2 · aucune VERSION qui ne change rien.
--       Deux empreintes identiques ne sont pas une collision : le claimId
--       est scellé, donc seules deux versions du MÊME claim peuvent
--       coïncider — et cela veut dire qu'une révision a été créée sans
--       modifier quoi que ce soit. ATTENDU : 0
SELECT count(*) AS versions_sans_changement FROM (
  SELECT "claimId" FROM "CaseFileClaim" WHERE "casefileRef" = 'IL-SHILL-VINE-001'
   GROUP BY "claimId", "contentHash" HAVING count(*) > 1) x;

-- 6.3 · relancer l'audit applicatif : CONTENT_MUTATED doit valoir 0.
--       auditCaseFileIntegrity(ref) — src/lib/casefile/integrityAudit.ts
