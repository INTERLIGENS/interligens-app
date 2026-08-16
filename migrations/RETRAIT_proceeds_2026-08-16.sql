-- RETRAIT_proceeds_2026-08-16.sql
-- Chantier: P0 — CONTAINMENT DES PROCEEDS · les six décisions de retrait
-- Target DB: Neon ep-square-band UNIQUEMENT.
--
-- STATUS: NON APPLIQUÉ. À exécuter manuellement par David dans le Neon SQL
-- Editor, APRÈS MIGRATION_proceeds_containment_v1.sql et APRÈS le déploiement
-- du code qui filtre. Claude Code n'exécute aucun UPDATE sur ep-square-band.
--
-- ⚠️ CE FICHIER NE SUPPRIME RIEN.
--    Aucun DELETE. Aucune remise à NULL. totalDocumented, KolProceedsEvent,
--    KolProceedsSummary, KolTokenInvolvement et les 6 lignes SUMMARY_ARKHAM
--    restent intacts et lisibles. Seule la PUBLICATION bascule, et chaque
--    bascule est journalisée avec son motif, son acteur et la valeur figée.
--
-- ACTEUR : person:david-douville
--    Valeur arrêtée par David au STOP 1. Le journal étant append-only, elle
--    n'est plus modifiable après exécution. La chaîne 'admin' est refusée par
--    la contrainte KolProceedsPublicationLog_actorId_not_admin : elle n'est
--    attribuable à personne, et l'attribution d'une rétractation doit être
--    vraie même quand le mécanisme d'authentification est encore faible.
--
-- ─── CRITÈRE DE DÉCISION ──────────────────────────────────────────────────
--
-- Est retiré tout chiffre publié dont la part adossée à une OBSERVATION
-- PRIMAIRE VÉRIFIABLE — une transaction on-chain observée, référençable par sa
-- signature — ne soutient pas le montant affiché.
--
-- Les 6 lignes eventType='SUMMARY_ARKHAM' n'en sont pas : leur « txHash » est
-- une chaîne synthétique (ARKHAM-SUMMARY-<handle>-BOTIFY-2026), leur
-- « walletAddress » vaut le littéral 'ARKHAM-SUMMARY', leur eventDate est une
-- valeur de remplissage identique pour les six (2024-11-04), leur caseId est
-- NULL et aucune pièce EvidenceItem ne leur est liée.
--
-- ─── ÉTAT MESURÉ SUR ep-square-band LE 2026-08-16 ─────────────────────────
--
--   handle       | publié   | primaire  | CSV Arkham | tx  | part non primaire
--   -------------+----------+-----------+------------+-----+------------------
--   OrbitApe     | 817 000  |      0,00 |   817 000  |   0 | 100 %
--   GordonGekko  | 579 645  | 94 644,79 |   485 000  | 124 | 83,7 %
--   James        | 380 000  |      0,00 |   380 000  |   0 | 100 %
--   bkokoski     | 210 900  |    900,06 |   210 000  |   4 | 99,6 %
--   sxyz500      | 141 594  |      0,00 |    85 000  |   0 | 100 %
--   Myrrha       | 127 036  |     36,16 |   127 000  |   1 | 99,97 %
--   -------------+----------+-----------+------------+-----+------------------
--   0xBossman    |   2 932  |  2 931,71 |         0  |   2 | 0 %   → CONSERVÉ
--   Geppetto     |   2 082  |  2 082,14 |         0  |   3 | 0 %   → CONSERVÉ
--
--   Total publié aujourd'hui : 2 261 189 $, dont 2 104 000 $ (95,5 %) reposent
--   sur six lignes d'import CSV.
--
-- ─── DEUX MOTIFS DISTINCTS, ET POURQUOI ───────────────────────────────────
--
-- `evidence_withdrawn` (5 handles) — la preuve qui fondait le chiffre ne tient
-- plus. Le montant a une origine identifiable ; c'est son adossement qui est
-- insuffisant.
--
-- `erratum` (sxyz500, 1 handle) — l'assertion chiffrée est matériellement
-- incorrecte, ce qui est un cran au-dessus. Détail au §6 ci-dessous.

BEGIN;

-- ══════════════════════════════════════════════════════════════════════════
-- GARDE-FOUS — la transaction échoue si l'état n'est pas celui attendu
-- ══════════════════════════════════════════════════════════════════════════

-- 1. La migration doit être passée.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_name = 'KolProfile'
                    AND column_name = 'proceedsPublication') THEN
    RAISE EXCEPTION 'MIGRATION_proceeds_containment_v1.sql non appliquée';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                  WHERE table_name = 'KolProceedsPublicationLog') THEN
    RAISE EXCEPTION 'KolProceedsPublicationLog absente';
  END IF;
END $$;

-- 2. Les 6 handles doivent exister et être encore publiés. Si l'un a déjà été
--    retiré, ou si un recalcul a changé la donne, on s'arrête : un journal
--    doit consigner un état réel, pas un état supposé.
DO $$
DECLARE n INTEGER;
BEGIN
  SELECT count(*) INTO n FROM "KolProfile"
   WHERE handle IN ('OrbitApe','GordonGekko','James','bkokoski','sxyz500','Myrrha')
     AND "proceedsPublication" = 'published';
  IF n <> 6 THEN
    RAISE EXCEPTION 'Attendu 6 profils publiés, trouvé %. Arrêt.', n;
  END IF;
END $$;

-- ══════════════════════════════════════════════════════════════════════════
-- LES SIX DÉCISIONS — le journal D'ABORD
-- ══════════════════════════════════════════════════════════════════════════
--
-- Le journal est écrit AVANT la bascule d'état, pour la même raison que
-- /api/investigators/cases/[caseId] écrit son audit avant le DELETE : si la
-- seconde étape échoue, la décision reste tracée. L'inverse laisserait un
-- retrait sans motif.

INSERT INTO "KolProceedsPublicationLog"
  ("kolHandle", "scope", "fromStatus", "toStatus",
   "publishedValueUsd", "primaryEvidenceUsd",
   "reasonCode", "reason", "actorId")
VALUES

-- ── 1. OrbitApe — 100 % import CSV, aucune transaction ────────────────────
('OrbitApe', 'profile_total', 'published', 'withdrawn',
 817000, 0,
 'evidence_withdrawn',
 'Retrait du montant publié de 817 000 $. La totalité provient d''une unique ligne '
 'eventType=SUMMARY_ARKHAM (pricingSource=ARKHAM_CSV, walletAddress littéral '
 '"ARKHAM-SUMMARY", txHash synthétique "ARKHAM-SUMMARY-OrbitApe-BOTIFY-2026", '
 'eventDate de remplissage 2024-11-04, caseId NULL, aucune pièce EvidenceItem liée). '
 'KolProceedsEvent ne contient AUCUNE transaction on-chain pour ce handle : la part '
 'adossée à une observation primaire vérifiable est de 0,00 $. Le chiffre était publié '
 'par /api/kol/leaderboard, /api/explorer et /api/watchlist. '
 'Donnée conservée en base ; seule la publication est retirée. '
 'Constat : docs/AUDIT_PASSE_B_2026-08.md §C-11, docs/P0_CONTAINMENT_PROCEEDS_STOP1.md §4.',
 'person:david-douville'),

-- ── 2. GordonGekko — 83,7 % import CSV ────────────────────────────────────
('GordonGekko', 'profile_total', 'published', 'withdrawn',
 579645, 94644.79,
 'evidence_withdrawn',
 'Retrait du montant publié de 579 645 $. 485 000 $ (83,7 %) proviennent d''une unique '
 'ligne SUMMARY_ARKHAM / ARKHAM_CSV, non sourcée : txHash synthétique, walletAddress '
 '"ARKHAM-SUMMARY", eventDate de remplissage, caseId NULL, aucune pièce liée. '
 'Seuls 94 644,79 $ sur 124 transactions sont adossés à des observations on-chain. '
 'Le document PDF reports/GordonGekko/*.pdf présente pourtant cette ligne DANS un '
 'tableau intitulé "CASHOUTS ON-CHAIN — TOTAL $579 645", sous la mention '
 '"CONFIDENTIEL — usage judiciaire", en 31 versions archivées du 2026-07-18 au '
 '2026-08-16. Les archives R2 sont CONSERVÉES INTACTES : elles sont la seule trace de '
 'ce qui a été affirmé et à quelle date, et le dossier BOTIFY en dépend. '
 'Le service de reports/GordonGekko/latest.pdf est suspendu (409) et la régénération '
 'nocturne est arrêtée, sans suppression. '
 'Audit dédié : docs/AUDIT_BOTIFY_PROCEEDS_2026-08.md.',
 'person:david-douville'),

-- ── 3. James — 100 % import CSV, aucune transaction ───────────────────────
('James', 'profile_total', 'published', 'withdrawn',
 380000, 0,
 'evidence_withdrawn',
 'Retrait du montant publié de 380 000 $. La totalité provient d''une unique ligne '
 'SUMMARY_ARKHAM / ARKHAM_CSV non sourcée. KolProceedsEvent ne contient AUCUNE '
 'transaction on-chain pour ce handle : part primaire 0,00 $. '
 'Donnée conservée en base ; seule la publication est retirée.',
 'person:david-douville'),

-- ── 4. bkokoski — 99,6 % import CSV, et réponse auto-contradictoire ───────
('bkokoski', 'profile_total', 'published', 'withdrawn',
 210900, 900.06,
 'evidence_withdrawn',
 'Retrait du montant publié de 210 900 $. 210 000 $ (99,6 %) proviennent d''une unique '
 'ligne SUMMARY_ARKHAM / ARKHAM_CSV non sourcée ; seuls 900,06 $ sur 4 transactions '
 'sont adossés à des observations on-chain. '
 'Aggravant : /api/kol/bkokoski/proceeds servait 210 900 $ en totalProceedsUsd ET '
 '{"2025": 900.06} en proceedsByYear dans la MÊME réponse — un facteur 234 — avec '
 'topTokenProceedsUsd 1 076,62 $ supérieur au total de l''unique année déclarée, le '
 'tout estampillé pricingQuality "high". La cause est la composition de la route : le '
 'total venait de KolProfile.totalDocumented, toutes les métadonnées de provenance de '
 'KolProceedsSummary. Le résumé déclare par ailleurs eventCount=50 alors que la base '
 'ne contient que 5 lignes pour ce handle. '
 'Donnée conservée en base ; seule la publication est retirée.',
 'person:david-douville'),

-- ── 5. Myrrha — 99,97 % import CSV, couverture annoncée fausse ────────────
('Myrrha', 'profile_total', 'published', 'withdrawn',
 127036, 36.16,
 'evidence_withdrawn',
 'Retrait du montant publié de 127 036 $. 127 000 $ (99,97 %) proviennent d''une unique '
 'ligne SUMMARY_ARKHAM / ARKHAM_CSV non sourcée ; la part on-chain est de 36,16 $ sur '
 '1 transaction. '
 'Aggravant : le résumé publie walletCount=113 alors que computeProceedsForHandle '
 'plafonne le scan général à 5 portefeuilles (proceeds.ts:258-262, dont le commentaire '
 'annonce d''ailleurs 10) et à 10 signatures par portefeuille — au plus 50 transactions '
 'examinables, sur 113 portefeuilles annoncés comme couverts. '
 'Donnée conservée en base ; seule la publication est retirée.',
 'person:david-douville'),

-- ── 6. sxyz500 — ERRATUM : le chiffre ne correspond à rien ────────────────
('sxyz500', 'profile_total', 'published', 'withdrawn',
 141594, 0,
 'erratum',
 'Retrait du montant publié de 141 594 $, au motif d''ERRATUM et non de preuve '
 'insuffisante : l''assertion chiffrée est matériellement incorrecte, à deux titres '
 'distincts et cumulatifs. '
 'PREMIER TITRE — 85 000 $ proviennent d''une unique ligne SUMMARY_ARKHAM / ARKHAM_CSV '
 'non sourcée (txHash synthétique, walletAddress "ARKHAM-SUMMARY", eventDate de '
 'remplissage, caseId NULL, aucune pièce liée). Cette part n''est PAS davantage '
 'soutenue que les autres : elle relève exactement du même défaut que les cinq retraits '
 'evidence_withdrawn du même lot. Elle n''est pas la partie saine du montant. '
 'SECOND TITRE — les 56 594 $ restants (141 594 − 85 000) ne correspondent à AUCUNE '
 'ligne, d''aucune sorte, nulle part dans la base. KolProceedsEvent contient exactement '
 '1 ligne pour ce handle, la ligne Arkham. Ces 56 594 $ proviennent d''un résumé calculé '
 'le 2026-04-27 déclarant eventCount=151 : ces 151 événements n''ont jamais été persistés, '
 'les INSERT ayant été abandonnés par ON CONFLICT ("txHash") DO NOTHING sur une '
 'contrainte d''unicité GLOBALE, tandis que le total était calculé depuis le tableau en '
 'mémoire. '
 'La part adossée à une observation primaire vérifiable est donc de 0,00 $ pour la '
 'totalité des 141 594 $ — aucune des deux composantes ne tient. Le montant était en '
 'outre servi avec computedAt=2026-04-27 (111 jours) et pricingQuality="high". '
 'Donnée conservée en base ; seule la publication est retirée.',
 'person:david-douville');

-- ══════════════════════════════════════════════════════════════════════════
-- LA BASCULE D'ÉTAT — ensuite seulement
-- ══════════════════════════════════════════════════════════════════════════
--
-- Aucun DELETE, aucune remise à NULL : seule la colonne de publication change.

UPDATE "KolProfile"
   SET "proceedsPublication" = 'withdrawn'
 WHERE handle IN ('OrbitApe','GordonGekko','James','bkokoski','sxyz500','Myrrha')
   AND "proceedsPublication" = 'published';

-- Le résumé porte sa propre décision : /api/kol/{h}/proceeds filtre déjà sur
-- reviewStatus='published', et /api/v1/kol vient d'être aligné. Les deux
-- interrupteurs doivent dire la même chose.
UPDATE "KolProceedsSummary"
   SET "reviewStatus" = 'draft', "updatedAt" = now()
 WHERE "kolHandle" IN ('OrbitApe','GordonGekko','James','bkokoski','sxyz500','Myrrha')
   AND "reviewStatus" = 'published';

-- ══════════════════════════════════════════════════════════════════════════
-- VÉRIFICATIONS — à lire AVANT de valider
-- ══════════════════════════════════════════════════════════════════════════

-- Doit rendre 6 lignes 'withdrawn' et 2 'published' (0xBossman, Geppetto).
SELECT handle, "proceedsPublication", "totalDocumented"
  FROM "KolProfile"
 WHERE "totalDocumented" IS NOT NULL AND "totalDocumented" > 0
   AND ("publishStatus" = 'published' OR (publishable = true AND "publishStatus" = 'draft'))
 ORDER BY "totalDocumented" DESC;

-- Doit rendre 6 lignes, 5 'evidence_withdrawn' + 1 'erratum'.
SELECT "kolHandle", "reasonCode", "publishedValueUsd", "primaryEvidenceUsd", "actorId"
  FROM "KolProceedsPublicationLog"
 ORDER BY "publishedValueUsd" DESC;

-- Total publié restant. Attendu : 5 014 $ (2 932 + 2 082), contre 2 261 189 $.
SELECT COALESCE(SUM("totalDocumented"), 0) AS total_publie_restant
  FROM "KolProfile"
 WHERE "proceedsPublication" = 'published'
   AND "totalDocumented" IS NOT NULL AND "totalDocumented" > 0
   AND ("publishStatus" = 'published' OR (publishable = true AND "publishStatus" = 'draft'));

-- Preuve de non-destruction. Attendu, inchangé : 5 602 événements dont 6
-- SUMMARY_ARKHAM ; GordonGekko conserve ses 127 lignes et son totalDocumented.
SELECT count(*) AS evenements_total,
       count(*) FILTER (WHERE "eventType" = 'SUMMARY_ARKHAM') AS lignes_arkham
  FROM "KolProceedsEvent";
SELECT handle, "totalDocumented" FROM "KolProfile" WHERE handle = 'GordonGekko';

COMMIT;

-- ─── RETOUR ARRIÈRE ───────────────────────────────────────────────────────
--
-- La remise en publication est une SECONDE décision, pas une annulation. Elle
-- s'écrit, elle ne s'efface pas :
--
--   INSERT INTO "KolProceedsPublicationLog"
--     ("kolHandle","scope","fromStatus","toStatus","publishedValueUsd",
--      "primaryEvidenceUsd","reasonCode","reason","actorId")
--   VALUES ('<handle>','profile_total','withdrawn','published',
--           <valeur>, <part primaire>, 'approved',
--           '<pourquoi le chiffre est de nouveau publiable>',
--           'person:david-douville');
--
--   UPDATE "KolProfile" SET "proceedsPublication" = 'published'
--    WHERE handle = '<handle>';
--
-- Le cycle published → withdrawn → published laisse trois lignes au journal.
-- C'est le but : une décision ne s'écrase pas, elle s'empile.
