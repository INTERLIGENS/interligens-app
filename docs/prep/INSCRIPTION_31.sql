-- ═══════════════════════════════════════════════════════════════════════════
-- INSCRIPTION DES LIGNES VERIFIED_BY_HEAD — PRÊT À COLLER, NON APPLIQUÉ
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ⚠️ ÉCRITURE DE PRODUCTION. Elle attend l'autorisation explicite du fondateur.
--
--   « Finding an evidence object in one compartment establishes presence there;
--     it establishes authoritative location only when competing governed
--     compartments have also been measurably excluded. »
--
-- Chaque ligne ci-dessous correspond à une pièce dont la localisation a été
-- DISCRIMINÉE : présente dans un compartiment, et TOUS les concurrents gouvernés
-- MESURABLEMENT EXCLUS — 404, jamais 403. Les pièces AMBIGUOUS, ABSENT_DES_DEUX
-- et NON_MESURABLE n'ont PAS de ligne ici, et c'est tout le sujet.
--
-- ─── LES DEUX IDENTITÉS, ET ELLES NE SE CONFONDENT PAS ────────────────────
--
--   « Machine-observed facts should identify the instrument that produced the
--     observation; substituting a human operator as observer creates authority
--     that did not perform the measurement. »
--
--   declared_by  src/scripts/evidence-chain/mesure-localisation.ts@93d08a1
--                ce qui INSCRIT l'événement gouverné.
--   observed_by  src/scripts/evidence-chain/mesure-localisation.ts@93d08a1
--                ce qui a EFFECTUÉ l'observation établissant le VERIFIED_BY_HEAD.
--
-- Ici les deux désignent le MÊME instrument, et c'est cohérent : l'outil qui a
-- sondé est aussi celui qui rend l'inscription. Les colonnes restent DEUX parce
-- que ce ne sera pas toujours le cas — une réinscription ultérieure, une reprise
-- par un autre chemin gouverné les feraient diverger, et il faudra alors pouvoir
-- dire qui a mesuré sans le confondre avec qui a écrit.
--
-- ⛔ AUCUN OPÉRATEUR HUMAIN ICI. Un 404 sur un compartiment R2 a été constaté
--    par un programme ; inscrire une personne comme observateur créerait une
--    autorité qui n'a pas fait la mesure.
--
-- ─── L'HORODATAGE, ET SA PRÉCISION RÉELLE ─────────────────────────────────
--
--   « Observation timestamps express captured temporal precision, never
--     reconstructed precision. »
--
--   HORODATAGE DE CAMPAGNE — instant de CLÔTURE de la passe d'observation du
--   2026-09-15, lu une seule fois après les 62 sondes. Ce n'est PAS
--   l'instant de chaque HEAD : l'instrument ne les a pas capturés, et on ne
--   les reconstruit pas.
--
-- `observed_at` est l'instant de la MESURE, pas celui de l'écriture : c'est ce
-- qui fait la valeur d'un VERIFIED_BY_HEAD, et un DEFAULT l'aurait fabriqué.
--
-- ⚠️ La colonne `id` ne commencera PAS à 1 : les répétitions à blanc en
--    transaction annulée ont consommé des valeurs d'IDENTITY, qu'un ROLLBACK
--    ne rend pas. Les trous sont normaux — `id` garantit un ORDRE, jamais une
--    continuité.

BEGIN;

INSERT INTO evidence_storage_location_journal
  (evidence_item_id, bucket, storage_key, establishment_mode, declared_by, declared_at, observed_by, observed_at)
VALUES
  ('evi_rep_615f749a1d56e9abf5fc2b07', 'interligens-reports', 'reports/deployer_pool/CASE_deployer_pool_2026-07-30T04-49-57.pdf', 'VERIFIED_BY_HEAD', 'src/scripts/evidence-chain/mesure-localisation.ts@93d08a1', '2026-09-15T09:32:32.725Z', 'src/scripts/evidence-chain/mesure-localisation.ts@93d08a1', '2026-09-15T09:32:32.725Z'),
  ('evi_rep_a3bc2b4a02ea4efd231e2b3d', 'interligens-reports', 'reports/deployer_pool/CASE_deployer_pool_2026-07-31T04-50-05.pdf', 'VERIFIED_BY_HEAD', 'src/scripts/evidence-chain/mesure-localisation.ts@93d08a1', '2026-09-15T09:32:32.725Z', 'src/scripts/evidence-chain/mesure-localisation.ts@93d08a1', '2026-09-15T09:32:32.725Z'),
  ('evi_rep_659bd95089cb927c37e25fed', 'interligens-reports', 'reports/deployer_pool/CASE_deployer_pool_2026-08-12T04-49-46.pdf', 'VERIFIED_BY_HEAD', 'src/scripts/evidence-chain/mesure-localisation.ts@93d08a1', '2026-09-15T09:32:32.725Z', 'src/scripts/evidence-chain/mesure-localisation.ts@93d08a1', '2026-09-15T09:32:32.725Z'),
  ('evi_rep_4c21b0afe21112a9cb7cffd6', 'interligens-reports', 'reports/deployer_pool/CASE_deployer_pool_2026-08-13T04-49-47.pdf', 'VERIFIED_BY_HEAD', 'src/scripts/evidence-chain/mesure-localisation.ts@93d08a1', '2026-09-15T09:32:32.725Z', 'src/scripts/evidence-chain/mesure-localisation.ts@93d08a1', '2026-09-15T09:32:32.725Z'),
  ('evi_rep_8c4183839506284476fd9be6', 'interligens-reports', 'reports/GordonGekko/CASE_GordonGekko_2026-07-21T04-38-57.pdf', 'VERIFIED_BY_HEAD', 'src/scripts/evidence-chain/mesure-localisation.ts@93d08a1', '2026-09-15T09:32:32.725Z', 'src/scripts/evidence-chain/mesure-localisation.ts@93d08a1', '2026-09-15T09:32:32.725Z'),
  ('evi_rep_db8903e7d04d67bbaeb13e5c', 'interligens-reports', 'reports/GordonGekko/CASE_GordonGekko_2026-07-22T04-38-56.pdf', 'VERIFIED_BY_HEAD', 'src/scripts/evidence-chain/mesure-localisation.ts@93d08a1', '2026-09-15T09:32:32.725Z', 'src/scripts/evidence-chain/mesure-localisation.ts@93d08a1', '2026-09-15T09:32:32.725Z'),
  ('evi_rep_4a9020d9fb351c09a48b4ec7', 'interligens-reports', 'reports/GordonGekko/CASE_GordonGekko_2026-07-23T04-39-00.pdf', 'VERIFIED_BY_HEAD', 'src/scripts/evidence-chain/mesure-localisation.ts@93d08a1', '2026-09-15T09:32:32.725Z', 'src/scripts/evidence-chain/mesure-localisation.ts@93d08a1', '2026-09-15T09:32:32.725Z'),
  ('evi_rep_dfce826c85edf4abe8d6819a', 'interligens-reports', 'reports/GordonGekko/CASE_GordonGekko_2026-07-24T04-38-56.pdf', 'VERIFIED_BY_HEAD', 'src/scripts/evidence-chain/mesure-localisation.ts@93d08a1', '2026-09-15T09:32:32.725Z', 'src/scripts/evidence-chain/mesure-localisation.ts@93d08a1', '2026-09-15T09:32:32.725Z'),
  ('evi_rep_ffec12ea6f67b8b0b2e32189', 'interligens-reports', 'reports/GordonGekko/CASE_GordonGekko_2026-07-25T04-38-57.pdf', 'VERIFIED_BY_HEAD', 'src/scripts/evidence-chain/mesure-localisation.ts@93d08a1', '2026-09-15T09:32:32.725Z', 'src/scripts/evidence-chain/mesure-localisation.ts@93d08a1', '2026-09-15T09:32:32.725Z'),
  ('evi_rep_ea70992eeb591480a1550ec0', 'interligens-reports', 'reports/GordonGekko/CASE_GordonGekko_2026-07-26T04-38-56.pdf', 'VERIFIED_BY_HEAD', 'src/scripts/evidence-chain/mesure-localisation.ts@93d08a1', '2026-09-15T09:32:32.725Z', 'src/scripts/evidence-chain/mesure-localisation.ts@93d08a1', '2026-09-15T09:32:32.725Z'),
  ('evi_rep_d0f885cf12a4dbed39e158fa', 'interligens-reports', 'reports/GordonGekko/CASE_GordonGekko_2026-07-27T04-38-57.pdf', 'VERIFIED_BY_HEAD', 'src/scripts/evidence-chain/mesure-localisation.ts@93d08a1', '2026-09-15T09:32:32.725Z', 'src/scripts/evidence-chain/mesure-localisation.ts@93d08a1', '2026-09-15T09:32:32.725Z'),
  ('evi_rep_dd624a8211dfc507b115397f', 'interligens-reports', 'reports/GordonGekko/CASE_GordonGekko_2026-07-28T04-38-56.pdf', 'VERIFIED_BY_HEAD', 'src/scripts/evidence-chain/mesure-localisation.ts@93d08a1', '2026-09-15T09:32:32.725Z', 'src/scripts/evidence-chain/mesure-localisation.ts@93d08a1', '2026-09-15T09:32:32.725Z'),
  ('evi_rep_67a0c365c01c5e7145ef0d69', 'interligens-reports', 'reports/GordonGekko/CASE_GordonGekko_2026-07-29T04-38-57.pdf', 'VERIFIED_BY_HEAD', 'src/scripts/evidence-chain/mesure-localisation.ts@93d08a1', '2026-09-15T09:32:32.725Z', 'src/scripts/evidence-chain/mesure-localisation.ts@93d08a1', '2026-09-15T09:32:32.725Z'),
  ('evi_rep_2871a9bbab2d5e2523520921', 'interligens-reports', 'reports/GordonGekko/CASE_GordonGekko_2026-07-30T04-47-10.pdf', 'VERIFIED_BY_HEAD', 'src/scripts/evidence-chain/mesure-localisation.ts@93d08a1', '2026-09-15T09:32:32.725Z', 'src/scripts/evidence-chain/mesure-localisation.ts@93d08a1', '2026-09-15T09:32:32.725Z'),
  ('evi_rep_36f6fdeec224377ce9e37ebc', 'interligens-reports', 'reports/GordonGekko/CASE_GordonGekko_2026-07-31T04-47-11.pdf', 'VERIFIED_BY_HEAD', 'src/scripts/evidence-chain/mesure-localisation.ts@93d08a1', '2026-09-15T09:32:32.725Z', 'src/scripts/evidence-chain/mesure-localisation.ts@93d08a1', '2026-09-15T09:32:32.725Z'),
  ('evi_rep_074408cdee7e11251b8f3fc7', 'interligens-reports', 'reports/GordonGekko/CASE_GordonGekko_2026-08-01T04-47-08.pdf', 'VERIFIED_BY_HEAD', 'src/scripts/evidence-chain/mesure-localisation.ts@93d08a1', '2026-09-15T09:32:32.725Z', 'src/scripts/evidence-chain/mesure-localisation.ts@93d08a1', '2026-09-15T09:32:32.725Z'),
  ('evi_rep_fdf88984a506f06d0c8b2272', 'interligens-reports', 'reports/GordonGekko/CASE_GordonGekko_2026-08-02T04-47-08.pdf', 'VERIFIED_BY_HEAD', 'src/scripts/evidence-chain/mesure-localisation.ts@93d08a1', '2026-09-15T09:32:32.725Z', 'src/scripts/evidence-chain/mesure-localisation.ts@93d08a1', '2026-09-15T09:32:32.725Z'),
  ('evi_rep_78d32fc700067ee7aa05c4e8', 'interligens-reports', 'reports/GordonGekko/CASE_GordonGekko_2026-08-03T04-47-07.pdf', 'VERIFIED_BY_HEAD', 'src/scripts/evidence-chain/mesure-localisation.ts@93d08a1', '2026-09-15T09:32:32.725Z', 'src/scripts/evidence-chain/mesure-localisation.ts@93d08a1', '2026-09-15T09:32:32.725Z'),
  ('evi_rep_c0db0f791bad071d97c67d05', 'interligens-reports', 'reports/GordonGekko/CASE_GordonGekko_2026-08-04T04-47-09.pdf', 'VERIFIED_BY_HEAD', 'src/scripts/evidence-chain/mesure-localisation.ts@93d08a1', '2026-09-15T09:32:32.725Z', 'src/scripts/evidence-chain/mesure-localisation.ts@93d08a1', '2026-09-15T09:32:32.725Z'),
  ('evi_rep_628a4612997a097729ffc4c1', 'interligens-reports', 'reports/GordonGekko/CASE_GordonGekko_2026-08-05T04-47-10.pdf', 'VERIFIED_BY_HEAD', 'src/scripts/evidence-chain/mesure-localisation.ts@93d08a1', '2026-09-15T09:32:32.725Z', 'src/scripts/evidence-chain/mesure-localisation.ts@93d08a1', '2026-09-15T09:32:32.725Z'),
  ('evi_rep_64fed1d1c32dae0817d93957', 'interligens-reports', 'reports/GordonGekko/CASE_GordonGekko_2026-08-06T04-47-12.pdf', 'VERIFIED_BY_HEAD', 'src/scripts/evidence-chain/mesure-localisation.ts@93d08a1', '2026-09-15T09:32:32.725Z', 'src/scripts/evidence-chain/mesure-localisation.ts@93d08a1', '2026-09-15T09:32:32.725Z'),
  ('evi_rep_745cce2d03a422fbc5df1321', 'interligens-reports', 'reports/GordonGekko/CASE_GordonGekko_2026-08-07T04-47-11.pdf', 'VERIFIED_BY_HEAD', 'src/scripts/evidence-chain/mesure-localisation.ts@93d08a1', '2026-09-15T09:32:32.725Z', 'src/scripts/evidence-chain/mesure-localisation.ts@93d08a1', '2026-09-15T09:32:32.725Z'),
  ('evi_rep_8fd00fd52243bc15e2f6bd1a', 'interligens-reports', 'reports/GordonGekko/CASE_GordonGekko_2026-08-08T04-47-11.pdf', 'VERIFIED_BY_HEAD', 'src/scripts/evidence-chain/mesure-localisation.ts@93d08a1', '2026-09-15T09:32:32.725Z', 'src/scripts/evidence-chain/mesure-localisation.ts@93d08a1', '2026-09-15T09:32:32.725Z'),
  ('evi_rep_a6d52194580af683f70d9e2f', 'interligens-reports', 'reports/GordonGekko/CASE_GordonGekko_2026-08-09T04-47-12.pdf', 'VERIFIED_BY_HEAD', 'src/scripts/evidence-chain/mesure-localisation.ts@93d08a1', '2026-09-15T09:32:32.725Z', 'src/scripts/evidence-chain/mesure-localisation.ts@93d08a1', '2026-09-15T09:32:32.725Z'),
  ('evi_rep_1bb457669d0a68927f135342', 'interligens-reports', 'reports/GordonGekko/CASE_GordonGekko_2026-08-10T04-47-10.pdf', 'VERIFIED_BY_HEAD', 'src/scripts/evidence-chain/mesure-localisation.ts@93d08a1', '2026-09-15T09:32:32.725Z', 'src/scripts/evidence-chain/mesure-localisation.ts@93d08a1', '2026-09-15T09:32:32.725Z'),
  ('evi_rep_6c6e77a50ee7df33399ebaf8', 'interligens-reports', 'reports/GordonGekko/CASE_GordonGekko_2026-08-11T04-47-11.pdf', 'VERIFIED_BY_HEAD', 'src/scripts/evidence-chain/mesure-localisation.ts@93d08a1', '2026-09-15T09:32:32.725Z', 'src/scripts/evidence-chain/mesure-localisation.ts@93d08a1', '2026-09-15T09:32:32.725Z'),
  ('evi_rep_a59d67786963d7810e82485d', 'interligens-reports', 'reports/GordonGekko/CASE_GordonGekko_2026-08-12T04-47-10.pdf', 'VERIFIED_BY_HEAD', 'src/scripts/evidence-chain/mesure-localisation.ts@93d08a1', '2026-09-15T09:32:32.725Z', 'src/scripts/evidence-chain/mesure-localisation.ts@93d08a1', '2026-09-15T09:32:32.725Z'),
  ('evi_rep_669649c1dddcde26860cb02f', 'interligens-reports', 'reports/GordonGekko/CASE_GordonGekko_2026-08-13T04-47-12.pdf', 'VERIFIED_BY_HEAD', 'src/scripts/evidence-chain/mesure-localisation.ts@93d08a1', '2026-09-15T09:32:32.725Z', 'src/scripts/evidence-chain/mesure-localisation.ts@93d08a1', '2026-09-15T09:32:32.725Z'),
  ('evi_rep_e1396c4caf3d037ca3286420', 'interligens-reports', 'reports/GordonGekko/CASE_GordonGekko_2026-08-14T04-47-12.pdf', 'VERIFIED_BY_HEAD', 'src/scripts/evidence-chain/mesure-localisation.ts@93d08a1', '2026-09-15T09:32:32.725Z', 'src/scripts/evidence-chain/mesure-localisation.ts@93d08a1', '2026-09-15T09:32:32.725Z'),
  ('evi_rep_4bcbee4a1d170a067bd3d03a', 'interligens-reports', 'reports/GordonGekko/CASE_GordonGekko_2026-08-15T04-29-13.pdf', 'VERIFIED_BY_HEAD', 'src/scripts/evidence-chain/mesure-localisation.ts@93d08a1', '2026-09-15T09:32:32.725Z', 'src/scripts/evidence-chain/mesure-localisation.ts@93d08a1', '2026-09-15T09:32:32.725Z'),
  ('evi_rep_6ffc5f5af8ba17acf5e69d1f', 'interligens-reports', 'reports/GordonGekko/CASE_GordonGekko_2026-08-16T04-22-56.pdf', 'VERIFIED_BY_HEAD', 'src/scripts/evidence-chain/mesure-localisation.ts@93d08a1', '2026-09-15T09:32:32.725Z', 'src/scripts/evidence-chain/mesure-localisation.ts@93d08a1', '2026-09-15T09:32:32.725Z');

COMMIT;

-- ─── POST-CHECK, LECTURE SEULE — coller APRÈS le COMMIT ───────────────────
--   · une ligne par pièce, toutes VERIFIED_BY_HEAD, toutes avec observation
--   · aucune pièce en double
--   · 31 ligne(s) attendue(s)

SELECT
  count(*)::int                                                                   AS lignes,
  count(DISTINCT evidence_item_id)::int                                           AS pieces,
  count(*) FILTER (WHERE establishment_mode = 'VERIFIED_BY_HEAD')::int            AS verified_by_head,
  count(*) FILTER (WHERE observed_by IS NOT NULL AND observed_at IS NOT NULL)::int AS avec_observation,
  count(DISTINCT bucket)::int                                                     AS compartiments,
  (count(*) = 31
   AND count(DISTINCT evidence_item_id) = 31
   AND count(*) FILTER (WHERE establishment_mode = 'VERIFIED_BY_HEAD') = 31
   AND count(*) FILTER (WHERE observed_by IS NOT NULL AND observed_at IS NOT NULL) = 31) AS ok
FROM evidence_storage_location_journal;
