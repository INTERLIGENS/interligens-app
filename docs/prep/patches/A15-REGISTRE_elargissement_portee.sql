-- A15-REGISTRE_elargissement_portee.sql
-- Chantier: A15 — ENREGISTREMENT DE L'ÉLARGISSEMENT DE PORTÉE
-- Target DB: Neon ep-square-band UNIQUEMENT.
--
-- STATUS: NON EXÉCUTÉ. À exécuter manuellement dans le Neon SQL Editor,
-- **le jour du déploiement d'A14 + A15**, et pas avant. Claude Code n'exécute
-- aucun INSERT sur ep-square-band.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- POURQUOI CE FICHIER EXISTE
-- ═══════════════════════════════════════════════════════════════════════════
--
-- **Le déploiement d'A14 et A15 est lui-même une décision de publication.**
--
-- Le 2026-08-16, six décisions ont retiré `proceedsPublication` pour six
-- handles, avec la portée `'profile_total'` — c'est-à-dire
-- `KolProfile.totalDocumented`, et rien d'autre. C'est ce que le journal dit,
-- et c'est ce que le code faisait.
--
-- Le code d'A14/A15 étend l'effet de ces six décisions à onze porteurs de plus :
-- `KolCase.paidUsd`, `KolEvidence.amountUsd` d'encaissement,
-- `KolTokenInvolvement.proceedsUsd`, les sommes calculées à la volée
-- (`totalPaidUsd`, `totalLoss`), les montants Helius de `/cashout`, la preuve
-- d'encaissement synthétisée du PDF, et les phrases qui les portent.
--
-- **C'est un élargissement effectif de décisions déjà prises.** Il ne s'écrit
-- pas dans un commit : un commit dit ce que le code fait, pas ce que
-- l'éditeur a décidé de ne plus publier. Sans cette entrée, un lecteur du
-- journal dans six mois verrait six retraits de portée `profile_total` et un
-- produit qui en tait bien davantage, sans trace de la décision intermédiaire.
--
-- ⚠️ ORDRE IMPÉRATIF
--    1. MIGRATION_monetary_claims_v1.sql (Neon SQL Editor)
--    2. `pnpm prisma:generate`
--    3. Déploiement du code A14 + A15
--    4. CE FICHIER — immédiatement après, le même jour.
--
--    Exécuté AVANT le déploiement, il consignerait une décision que le produit
--    n'applique pas encore. Exécuté longtemps APRÈS, il daterait faux.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- CE QUI EST ENREGISTRÉ, ET CE QUI NE L'EST PAS
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ENREGISTRÉ : l'élargissement de portée, pour les six handles déjà retirés.
--   scope = 'monetary_all' — la portée la plus large, celle qui dit
--   « plus aucun chiffre d'encaissement sur cette personne, quelle qu'en soit
--   la table ».
--
-- PAS ENREGISTRÉ, parce que PAS DÉCIDÉ :
--   * aucun retrait de `totalScammed`. L'interrupteur `monetaryClaimsPublication`
--     naît à 'published' et le reste. `bkokoski` conserve ses 4 500 000 $
--     publiés, `ravedao` ses 17 800 000 $. Les taire est une AUTRE décision,
--     qui appartient au fondateur ;
--   * aucun retrait pour `lynk0x` ni `ghostwareos`, qui n'étaient pas dans le
--     lot du 16 août ;
--   * aucun retrait de narratif `LaundryTrail` (A12 pose l'interrupteur, il
--     n'est pas actionné).
--
-- ═══════════════════════════════════════════════════════════════════════════
-- POURQUOI LES MONTANTS SONT CALCULÉS ET NON RECOPIÉS
-- ═══════════════════════════════════════════════════════════════════════════
--
-- `publishedValueUsd` est calculé par la requête, au moment de l'exécution,
-- comme la somme des montants NOUVELLEMENT couverts. Le recopier en dur
-- daterait de la rédaction de ce fichier, pas de la décision — et
-- `computeProceedsForHandle` réécrit les événements chaque nuit (cf. A5).
-- Le journal doit figer ce qui était vrai à l'instant de la décision.

BEGIN;

-- ══════════════════════════════════════════════════════════════════════════
-- GARDE-FOUS — la transaction échoue si l'état n'est pas celui attendu
-- ══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE n INTEGER;
BEGIN
  -- 1. La migration d'A14 doit être passée : sans elle, la portée
  --    'monetary_all' est refusée par le CHECK et l'INSERT échouerait à
  --    mi-parcours.
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_name = 'KolProfile'
                    AND column_name = 'monetaryClaimsPublication') THEN
    RAISE EXCEPTION 'MIGRATION_monetary_claims_v1.sql non appliquée';
  END IF;

  -- 2. Les six handles doivent être ENCORE retirés. Si l'un a été remis en
  --    publication entre-temps, l'élargissement ne le concerne plus et
  --    consigner une décision sur lui serait faux.
  SELECT count(*) INTO n FROM "KolProfile"
   WHERE handle IN ('OrbitApe','GordonGekko','James','bkokoski','sxyz500','Myrrha')
     AND "proceedsPublication" = 'withdrawn';
  IF n <> 6 THEN
    RAISE EXCEPTION 'Attendu 6 profils retirés, trouvé %. Arrêt.', n;
  END IF;

  -- 3. L'élargissement ne doit être consigné qu'UNE fois. Le journal est
  --    append-only : une seconde exécution empilerait un doublon indiscernable.
  SELECT count(*) INTO n FROM "KolProceedsPublicationLog"
   WHERE "scope" = 'monetary_all';
  IF n > 0 THEN
    RAISE EXCEPTION 'Élargissement déjà consigné (% ligne(s)). Arrêt.', n;
  END IF;
END $$;

-- ══════════════════════════════════════════════════════════════════════════
-- L'ENTRÉE — six lignes, une par handle déjà retiré
-- ══════════════════════════════════════════════════════════════════════════

INSERT INTO "KolProceedsPublicationLog"
  ("kolHandle", "scope", "fromStatus", "toStatus",
   "publishedValueUsd", "primaryEvidenceUsd",
   "reasonCode", "reason", "actorId")
SELECT
  p.handle,
  'monetary_all',
  'published',   -- ces porteurs-LÀ étaient publiés jusqu'à ce déploiement
  'withdrawn',

  -- Montant NOUVELLEMENT couvert : ce qui était encore servi malgré la
  -- décision du 16 août. Calculé à l'instant de la décision, pas recopié.
  COALESCE((SELECT SUM(c."paidUsd")   FROM "KolCase" c            WHERE c."kolHandle" = p.handle), 0)
  + COALESCE((SELECT SUM(e."amountUsd") FROM "KolEvidence" e      WHERE e."kolHandle" = p.handle
               AND e.type IN ('coordinated_exit','fund_movement','paid_promotion','cashout','evm_wallet','deployer_extraction')), 0)
  + COALESCE((SELECT SUM(i."proceedsUsd") FROM "KolTokenInvolvement" i WHERE i."kolHandle" = p.handle), 0),

  -- Part primaire, reprise de la décision d'origine : elle n'a pas changé,
  -- c'est la portée qui change.
  (SELECT l."primaryEvidenceUsd" FROM "KolProceedsPublicationLog" l
    WHERE l."kolHandle" = p.handle AND l."scope" = 'profile_total'
    ORDER BY l."createdAt" DESC LIMIT 1),

  'evidence_withdrawn',

  'ÉLARGISSEMENT DE PORTÉE, et non nouvelle décision. Le retrait du 2026-08-16 '
  'portait la portée ''profile_total'' — KolProfile.totalDocumented, et rien d''autre. '
  'Le recensement du 2026-08-18 (docs/prep/RAPPORT_A13_RECENSEMENT_CHIFFRES.md) a '
  'établi que le même chiffre, ou des chiffres du même fait, restaient servis par '
  'onze porteurs voisins : KolCase.paidUsd, KolEvidence.amountUsd de type '
  'd''encaissement, KolTokenInvolvement.proceedsUsd, les sommes calculées à la volée '
  '(totalPaidUsd dans /api/v1/kol/{handle}, totalLoss dans /class-action), les montants '
  'calculés en direct par /api/kol/{handle}/cashout, la preuve d''encaissement '
  'synthétisée par /api/pdf/kol, et les phrases de KolNarrative qui les portent. '
  'Cas emblématique : les 210 000 $ de bkokoski existaient sous TROIS formes — une '
  'ligne KolProceedsEvent SUMMARY_ARKHAM (retirée le 16 août), une ligne KolEvidence '
  'de type coordinated_exit (servie), et une phrase LaundryTrail (servie). '
  'Le déploiement d''A14 et A15 fait que la décision du 16 août couvre désormais tous '
  'ces porteurs. Le motif reste celui d''origine — la preuve qui fondait le chiffre ne '
  'tient pas — seule la portée s''étend. Aucune donnée n''est détruite : les montants '
  'restent lisibles en base, en admin, et par toute réinvestigation. '
  'NE SONT PAS COUVERTS par cette entrée et restent publiés : KolProfile.totalScammed '
  '(affirmation d''une autre nature, interrupteur monetaryClaimsPublication laissé '
  'ouvert), les constantes chiffrées compilées dans le code (CASE_DB, cexTargets de '
  '/class-action, les 62%/78% de pdfGeneratorPublic), et les archives PDF déjà écrites '
  'dans R2 sous reports/{handle}/, qu''aucun filtre de génération ne rattrape.',

  'person:david-douville'

FROM "KolProfile" p
WHERE p.handle IN ('OrbitApe','GordonGekko','James','bkokoski','sxyz500','Myrrha')
  AND p."proceedsPublication" = 'withdrawn'
ORDER BY p.handle;

-- ══════════════════════════════════════════════════════════════════════════
-- VÉRIFICATIONS — à lire AVANT de valider
-- ══════════════════════════════════════════════════════════════════════════

-- Doit rendre 6 lignes 'monetary_all', avec le montant nouvellement couvert.
SELECT "kolHandle", "scope", "publishedValueUsd", "primaryEvidenceUsd", "actorId"
  FROM "KolProceedsPublicationLog"
 WHERE "scope" = 'monetary_all'
 ORDER BY "publishedValueUsd" DESC;

-- Doit rendre 12 : les 6 décisions du 16 août, intactes, plus les 6 nouvelles.
SELECT "scope", count(*) FROM "KolProceedsPublicationLog" GROUP BY 1 ORDER BY 1;

-- Preuve de non-destruction : les montants sont toujours là.
SELECT handle, "totalDocumented", "totalScammed", "proceedsPublication",
       "monetaryClaimsPublication"
  FROM "KolProfile"
 WHERE handle IN ('OrbitApe','GordonGekko','James','bkokoski','sxyz500','Myrrha')
 ORDER BY handle;

-- Doit rendre 411 lignes 'published' : AUCUN totalScammed n'a été retiré.
SELECT "monetaryClaimsPublication", count(*) FROM "KolProfile" GROUP BY 1;

COMMIT;

-- ─── RETOUR ARRIÈRE ───────────────────────────────────────────────────────
--
-- Comme pour le retrait d'origine : la remise en publication est une SECONDE
-- décision, pas une annulation. Elle s'écrit, elle ne s'efface pas.
--
--   INSERT INTO "KolProceedsPublicationLog"
--     ("kolHandle","scope","fromStatus","toStatus","publishedValueUsd",
--      "primaryEvidenceUsd","reasonCode","reason","actorId")
--   VALUES ('<handle>','monetary_all','withdrawn','published',
--           <valeur>, <part primaire>, 'approved',
--           '<pourquoi ces porteurs sont de nouveau publiables>',
--           'person:david-douville');
