-- BUILD 9 / ÉTAPE 6 — scellement des claims de IL-SHILL-BOTIFY-001
-- RÉDIGÉ, NON EXÉCUTÉ. Cible ep-square-band, éditeur SQL Neon.
-- révisions lues : 8 · déjà scellées : 0
-- à sceller       : 8
--
-- Le sceau couvre le CONTENU seul : ni state, ni version, ni horodatage.
-- Promouvoir un claim ne doit jamais casser son empreinte.

BEGIN;
UPDATE "CaseFileClaim" SET "contentHash" = '0d2a01ba5a5e69bffbbe9eb3df43e1b99e4953307f87528ed98bd97f88ce11d9', "updatedAt" = now()
 WHERE "casefileRef" = 'IL-SHILL-BOTIFY-001' AND "claimId" = 'C1'
   AND version = 1 AND "contentHash" IS NULL;
UPDATE "CaseFileClaim" SET "contentHash" = 'c3f0e805d53d7451380d313ec8c8546a945176f6ab5b517c06e4ea2e59648522', "updatedAt" = now()
 WHERE "casefileRef" = 'IL-SHILL-BOTIFY-001' AND "claimId" = 'C2'
   AND version = 1 AND "contentHash" IS NULL;
UPDATE "CaseFileClaim" SET "contentHash" = '34ee37ce44f3cc995310c72bcd2a56b651dac44c5542afd701ed8ed81e77d426', "updatedAt" = now()
 WHERE "casefileRef" = 'IL-SHILL-BOTIFY-001' AND "claimId" = 'C3'
   AND version = 1 AND "contentHash" IS NULL;
UPDATE "CaseFileClaim" SET "contentHash" = 'ae69f1979976f0e9f1582c4fd10bfbcd231640e6c60b33ee44c012b065775cc4', "updatedAt" = now()
 WHERE "casefileRef" = 'IL-SHILL-BOTIFY-001' AND "claimId" = 'C4'
   AND version = 1 AND "contentHash" IS NULL;
UPDATE "CaseFileClaim" SET "contentHash" = 'b7a1911e63b1228453766953fdc92157f7c6d54d27f7483facc0c9df7db165dd', "updatedAt" = now()
 WHERE "casefileRef" = 'IL-SHILL-BOTIFY-001' AND "claimId" = 'C5'
   AND version = 1 AND "contentHash" IS NULL;
UPDATE "CaseFileClaim" SET "contentHash" = '3592f00e767540fb6fc9f765fdf1f22e65f7a2e494d17382aef58937e1282fdf', "updatedAt" = now()
 WHERE "casefileRef" = 'IL-SHILL-BOTIFY-001' AND "claimId" = 'C6'
   AND version = 1 AND "contentHash" IS NULL;
UPDATE "CaseFileClaim" SET "contentHash" = '502aa802044d179a74092477c916a98f612bb4e9f080f556af3efd25ec482f7f', "updatedAt" = now()
 WHERE "casefileRef" = 'IL-SHILL-BOTIFY-001' AND "claimId" = 'C7'
   AND version = 1 AND "contentHash" IS NULL;
UPDATE "CaseFileClaim" SET "contentHash" = '7f262a2950a30a9c41b97a21b28c07a05135d40c836853b851d6a0d4eab085d9', "updatedAt" = now()
 WHERE "casefileRef" = 'IL-SHILL-BOTIFY-001' AND "claimId" = 'C8'
   AND version = 1 AND "contentHash" IS NULL;
COMMIT;

-- ─── POST-CHECKS ────────────────────────────────────────────────────
-- 6.1 · plus aucun claim non scellé. ATTENDU : 0
SELECT count(*) AS non_scelles FROM "CaseFileClaim"
 WHERE "casefileRef" = 'IL-SHILL-BOTIFY-001' AND "contentHash" IS NULL;

-- 6.2 · aucune VERSION qui ne change rien.
--       Deux empreintes identiques ne sont pas une collision : le claimId
--       est scellé, donc seules deux versions du MÊME claim peuvent
--       coïncider — et cela veut dire qu'une révision a été créée sans
--       modifier quoi que ce soit. ATTENDU : 0
SELECT count(*) AS versions_sans_changement FROM (
  SELECT "claimId" FROM "CaseFileClaim" WHERE "casefileRef" = 'IL-SHILL-BOTIFY-001'
   GROUP BY "claimId", "contentHash" HAVING count(*) > 1) x;

-- 6.3 · relancer l'audit applicatif : CONTENT_MUTATED doit valoir 0.
--       auditCaseFileIntegrity(ref) — src/lib/casefile/integrityAudit.ts
