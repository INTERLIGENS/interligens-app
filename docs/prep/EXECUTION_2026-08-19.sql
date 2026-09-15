-- ═══════════════════════════════════════════════════════════════════════════
-- EXECUTION_2026-08-19.sql — LES CINQ BLOCS, DANS L'ORDRE
-- ═══════════════════════════════════════════════════════════════════════════
--
-- STATUS GLOBAL : **NON EXÉCUTÉ**. Aucun de ces blocs n'a été lancé.
-- Aucune connexion à ep-square-band n'a été ouverte pour produire ce fichier.
--
-- CIBLE : Neon `ep-square-band` UNIQUEMENT, via le Neon SQL Editor.
--         `prisma migrate` est verrouillé depuis le 2026-08-18 (PR #104) : les
--         deux schemas pointent `directUrl` sur une variable inexistante, et
--         toute tentative s'arrête sur P1012 avant tout accès réseau. Il
--         n'existe plus d'autre voie que celle-ci, et c'est voulu.
--
-- USAGE : un bloc à la fois, dans l'ordre. Relire le verdict du bloc de
--         vérification AVANT de passer au suivant. Ne jamais lancer le fichier
--         entier d'un coup.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- L'ORDRE, ET CE QU'IL PROTÈGE
-- ═══════════════════════════════════════════════════════════════════════════
--
--   BLOC 0   contrôles préalables           LECTURE SEULE   confirme la cible
--   BLOC 1a  migration A12                  ÉCRITURE        additif
--   BLOC 1b  migration A14                  ÉCRITURE        additif + 1 DROP gardé
--   BLOC 2   vérifications post-migration   LECTURE SEULE   verdict
--   ──────   ⟶ DÉPLOIEMENT ⟵   (hors SQL — docs/prep/SMOKE_TESTS_2026-08-19.md)
--   BLOC 3   versement de 32 archives / 34  ÉCRITURE        IRRÉVERSIBLE
--   BLOC 4   dépublication conservatoire    ÉCRITURE        réversible
--   BLOC 5   entrée de registre             ÉCRITURE        IRRÉVERSIBLE
--
-- POURQUOI LE DÉPLOIEMENT EST *ENTRE* 2 ET 3, ET PAS AILLEURS
--
--   Avant lui — le code servi ignore `LaundryTrail.publication` et
--   `KolProfile.monetaryClaimsPublication`. Une dépublication écrite maintenant
--   serait une décision ENREGISTRÉE MAIS NON APPLIQUÉE : le narratif
--   continuerait d'être servi. C'est la pire des deux moitiés — la trace d'un
--   retrait, sans le retrait.
--
--   Après lui — les colonnes existent (BLOC 1) et valent 'published' par
--   défaut : le déploiement ne change donc rien de visible. Puis le BLOC 4
--   prend effet à la seconde où il est exécuté.
--
--   Déployer AVANT le BLOC 1 casse les surfaces KOL : le code déployé
--   interroge des colonnes absentes. C'est le seul ordre qui casse quelque
--   chose, et il n'a aucune raison d'arriver — sauf inattention.
--
-- CE QUI EST IRRÉVERSIBLE, ET EN QUEL SENS
--
--   BLOC 1   rien. Additif, ré-exécutable (IF NOT EXISTS partout). SAUF le §2
--            d'A14 : le seul DROP CONSTRAINT du lot, encadré d'un contrôle qui
--            FAIT ÉCHOUER la transaction si une ligne existante sortait de la
--            nouvelle liste. La nouvelle liste CONTIENT l'ancienne — elle
--            ajoute quatre portées, n'en retire aucune.
--
--   BLOC 3   *l'ouverture de la chaîne de conservation.* `provenanceType`,
--            `capturedAt` et `timestampMode` font foi ensuite. Un versement mal
--            qualifié ne se corrige qu'en s'ajoutant à lui-même : on ne réécrit
--            pas une chaîne de conservation, on l'allonge.
--
--   BLOC 4   réversible, par une seconde décision tracée comme la première.
--            C'est le seul bloc conçu pour être défait.
--
--   BLOC 5   *journal append-only.* Écrite avant le déploiement, l'entrée
--            consignerait une décision non appliquée ; écrite longtemps après,
--            elle daterait faux. S'en défaire exige une seconde décision.
--
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════════
-- BLOC 0 — CONTRÔLES PRÉALABLES                              LECTURE SEULE
-- ═══════════════════════════════════════════════════════════════════════════
--
-- STATUS : **EXÉCUTÉ le 2026-08-19**, Neon SQL Editor, ep-square-band
--          (projet plain-hill-77595267, branche br-square-dawn). Vert.
-- IRRÉVERSIBLE : rien, aucune écriture.
-- ORDRE  : avant tout. Si un seul contrôle ne rend pas la valeur attendue,
--          ARRÊT — la session n'est pas sur la bonne base.
--
-- `current_database()` ne discrimine RIEN : les deux projets Neon s'appellent
-- `neondb`. Le seul discriminant fiable est `system_identifier`, propre au
-- cluster. À défaut, compter les tables : 177 en production, 124 sur
-- ep-bold-sky.

SELECT
  current_database()                                   AS base,
  current_user                                         AS utilisateur,
  (SELECT system_identifier FROM pg_control_system())  AS system_identifier,
  (SELECT count(*) FROM information_schema.tables
    WHERE table_schema = 'public')                     AS nb_tables,
  now()                                                AS horodatage_session;

-- Les quatre tables que les blocs suivants supposent. Une seule absente = ARRÊT.
SELECT
  to_regclass('public."LaundryTrail"')              AS laundrytrail,
  to_regclass('public."KolProfile"')                AS kolprofile,
  to_regclass('public."KolProceedsPublicationLog"') AS proceeds_log,
  to_regclass('public."EvidenceItem"')              AS evidenceitem;

-- État AVANT, à relever et à conserver : c'est la seule photo d'avant.
SELECT
  (SELECT count(*) FROM "EvidenceItem" WHERE "r2Key" LIKE 'reports/%')   AS archives_deja_versees,
  (SELECT count(*) FROM "LaundryTrail")                                   AS trails_total,
  (SELECT count(*) FROM "KolProceedsPublicationLog")                      AS decisions_proceeds,
  (SELECT count(*) FROM information_schema.columns
    WHERE table_name = 'LaundryTrail' AND column_name = 'publication')    AS col_publication_existe,
  (SELECT count(*) FROM information_schema.columns
    WHERE table_name = 'KolProfile'
      AND column_name = 'monetaryClaimsPublication')                      AS col_monetaire_existe;

-- ATTENDU : archives_deja_versees = 0 · col_publication_existe = 0 ·
--           col_monetaire_existe = 0. Sinon, quelqu'un est passé avant : ARRÊT.


-- ═══════════════════════════════════════════════════════════════════════════
-- BLOC 1a — MIGRATION A12 · publication du narratif LaundryTrail   ÉCRITURE
-- ═══════════════════════════════════════════════════════════════════════════
--
-- STATUS : **EXÉCUTÉ le 2026-08-19**, vert. Vérifié par le BLOC 2 rejoué.
-- IRRÉVERSIBLE : rien. Additif, ré-exécutable.
-- ORDRE  : après le BLOC 0. Indépendant d'A14 — mais les deux avant le
--          déploiement, et le déploiement avant toute dépublication.
-- AJOUTE : 1 colonne `publication` (DEFAULT 'published'), 1 table de registre,
--          4 index. Aucune ligne existante n'est modifiée : le DEFAULT rend
--          tous les trails 'published', c'est-à-dire l'état actuel rendu
--          explicite. Après exécution, le comportement du produit est INCHANGÉ.

BEGIN;

CREATE TABLE IF NOT EXISTS "LaundryTrailPublicationLog" (
  "id"                  TEXT         PRIMARY KEY DEFAULT gen_random_uuid()::text,

  -- Objet de la décision. Pas de FK : voir « dénormalisation volontaire ».
  -- Les DEUX sont enregistrés : trailId identifie la ligne, kolHandle permet
  -- de lire l'historique d'une personne sans jointure sur une table qui peut
  -- avoir disparu.
  "trailId"             TEXT         NOT NULL,
  "kolHandle"           TEXT         NOT NULL,

  -- Sur quoi porte la décision. 'trail_full' retire tout de la ligne ; les deux
  -- portées étroites existent pour qu'une décision partielle reste exprimable
  -- — retirer la phrase en conservant la qualification de risque, ou l'inverse.
  "scope"               TEXT         NOT NULL,

  -- Transition. Les deux bornes : « depuis quel état ».
  "fromStatus"          TEXT         NOT NULL,
  "toStatus"            TEXT         NOT NULL,

  -- Photo au moment de la décision. Voir « ce qu'on fige ».
  -- narrativeSha256 est OBLIGATOIRE : sans lui, on saurait qu'un retrait a eu
  -- lieu, pas sur quelle version du texte.
  "narrativeSha256"     TEXT         NOT NULL,
  "assertedValueUsd"    NUMERIC,
  "primaryEvidenceUsd"  NUMERIC,
  "laundryRiskAtDecision" TEXT,

  -- Motif. reasonCode contraint (CHECK) pour rester agrégeable ;
  -- reason est le texte libre obligatoire, non vide.
  "reasonCode"          TEXT         NOT NULL,
  "reason"              TEXT         NOT NULL,

  -- Qui, quand. actorId doit désigner une personne réelle ou un acteur machine
  -- nommé — jamais 'admin', qui n'est attribuable à personne.
  "actorId"             TEXT         NOT NULL,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT now(),

  -- Quand le retrait honore une contestation, sa référence. Nullable.
  "contestationRef"     TEXT,

  CONSTRAINT "LaundryTrailPublicationLog_reason_not_blank"
    CHECK (length(btrim("reason")) > 0),
  CONSTRAINT "LaundryTrailPublicationLog_actorId_not_blank"
    CHECK (length(btrim("actorId")) > 0),
  CONSTRAINT "LaundryTrailPublicationLog_actorId_not_admin"
    CHECK (lower(btrim("actorId")) <> 'admin'),
  CONSTRAINT "LaundryTrailPublicationLog_sha_is_sha256"
    CHECK ("narrativeSha256" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "LaundryTrailPublicationLog_scope_allowed"
    CHECK ("scope" IN (
      'trail_full',       -- la ligne entière cesse d'être servie
      'trail_narrative',  -- narrativeText / narrativeTextFr seuls
      'trail_risk'        -- laundryRisk seul (badge, drapeau, ancrage du modèle)
    )),
  CONSTRAINT "LaundryTrailPublicationLog_status_allowed"
    CHECK ("fromStatus" IN ('published','withdrawn')
       AND "toStatus"   IN ('published','withdrawn')),
  CONSTRAINT "LaundryTrailPublicationLog_transition_is_real"
    CHECK ("fromStatus" <> "toStatus"),
  -- Liste FERMÉE, alignée mot pour mot sur celle de
  -- KolProceedsPublicationLog_reasonCode_allowed. Deux registres qui parlent de
  -- publication nominative doivent s'agréger ensemble.
  CONSTRAINT "LaundryTrailPublicationLog_reasonCode_allowed"
    CHECK ("reasonCode" IN (
      'approved',             -- remise en publication
      'rejected',
      'contested',            -- contestation reçue et honorée
      'erratum',              -- assertion chiffrée matériellement incorrecte
      'evidence_withdrawn',   -- la preuve qui fondait l'affirmation ne tient plus
      'legal',
      'duplicate',
      'other'
    ))
);

-- Historique complet d'un trail, du plus récent au plus ancien.
CREATE INDEX IF NOT EXISTS "LaundryTrailPublicationLog_trailId_createdAt_idx"
  ON "LaundryTrailPublicationLog" ("trailId", "createdAt" DESC);

-- Historique complet d'une personne, tous trails confondus.
CREATE INDEX IF NOT EXISTS "LaundryTrailPublicationLog_kolHandle_createdAt_idx"
  ON "LaundryTrailPublicationLog" ("kolHandle", "createdAt" DESC);

-- Agrégation par motif — combien de retraits pour erratum, pour preuve
-- insuffisante. Matière de la démonstration de contrôle éditorial, et
-- agrégeable avec KolProceedsPublicationLog puisque la liste est la même.
CREATE INDEX IF NOT EXISTS "LaundryTrailPublicationLog_reasonCode_idx"
  ON "LaundryTrailPublicationLog" ("reasonCode");

-- Retrouver le dossier de contestation.
CREATE INDEX IF NOT EXISTS "LaundryTrailPublicationLog_contestationRef_idx"
  ON "LaundryTrailPublicationLog" ("contestationRef")
  WHERE "contestationRef" IS NOT NULL;

-- ══════════════════════════════════════════════════════════════════════════
-- 2. L'ÉTAT COURANT
-- ══════════════════════════════════════════════════════════════════════════
--
-- Une colonne additive. narrativeText, narrativeTextFr, laundryRisk et les
-- signaux ne sont JAMAIS touchés : le texte reste lisible en base, en admin, et
-- par toute réinvestigation. Seule sa PUBLICATION bascule. C'est ce qui rend le
-- retrait réversible sans perte — et c'est le point de toute la migration.
--
-- DEFAULT 'published' : les 5 lignes existantes gardent leur comportement
-- actuel. AUCUN état n'est basculé par cette migration.

ALTER TABLE "LaundryTrail"
  ADD COLUMN IF NOT EXISTS "publication" TEXT NOT NULL DEFAULT 'published';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'LaundryTrail_publication_allowed'
  ) THEN
    ALTER TABLE "LaundryTrail"
      ADD CONSTRAINT "LaundryTrail_publication_allowed"
      CHECK ("publication" IN ('published','withdrawn'));
  END IF;
END $$;

-- Les six surfaces filtrent sur cette colonne à chaque lecture de trail.
CREATE INDEX IF NOT EXISTS "LaundryTrail_publication_idx"
  ON "LaundryTrail" ("publication");

-- Lecture publique la plus fréquente : le trail d'un handle, s'il est publié.
CREATE INDEX IF NOT EXISTS "LaundryTrail_kolHandle_publication_idx"
  ON "LaundryTrail" ("kolHandle", "publication");

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════
-- BLOC 1b — MIGRATION A14 · publication des revendications monétaires ÉCRITURE
-- ═══════════════════════════════════════════════════════════════════════════
--
-- STATUS : **EXÉCUTÉ le 2026-08-19**, vert. Le DROP/ADD a bien remis les
--          HUIT portées — vérifié en base, portée par portée.
-- IRRÉVERSIBLE : rien, SAUF le §2 — le seul DROP CONSTRAINT de tout le lot. Il
--          est encadré d'un contrôle qui FAIT ÉCHOUER la transaction si une
--          ligne existante sortait de la nouvelle liste de portées. Et la
--          nouvelle liste CONTIENT l'ancienne : elle ajoute quatre portées,
--          n'en retire aucune.
-- ORDRE  : après 1a. Les deux avant le déploiement.
-- AJOUTE : 1 colonne `monetaryClaimsPublication` (DEFAULT 'published'),
--          2 index, +4 portées au CHECK de KolProceedsPublicationLog.

BEGIN;

-- ══════════════════════════════════════════════════════════════════════════
-- 0. CONTRÔLE PRÉALABLE — la transaction échoue si l'état n'est pas l'attendu
-- ══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE bad INTEGER;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                  WHERE table_name = 'KolProceedsPublicationLog') THEN
    RAISE EXCEPTION 'KolProceedsPublicationLog absente — MIGRATION_proceeds_containment_v1 non appliquée';
  END IF;

  -- Aucune ligne existante ne doit sortir de la NOUVELLE liste. Si celle-ci
  -- ne contenait pas l'ancienne, la migration s'arrêterait ici.
  SELECT count(*) INTO bad FROM "KolProceedsPublicationLog"
   WHERE "scope" NOT IN (
     'profile_total','summary','event','involvement',
     'scammed_total','case_paid','evidence_amount','monetary_all');
  IF bad > 0 THEN
    RAISE EXCEPTION 'La nouvelle liste de scope exclut % ligne(s) existante(s). Arrêt.', bad;
  END IF;
END $$;

-- ══════════════════════════════════════════════════════════════════════════
-- 1. L'ÉTAT COURANT — nouvel interrupteur, famille « ampleur du préjudice »
-- ══════════════════════════════════════════════════════════════════════════
--
-- Additif. `totalScammed`, `paidUsd`, `amountUsd`, `proceedsUsd` ne sont
-- JAMAIS touchés : les valeurs restent lisibles en base, en admin, et par
-- toute réinvestigation. Seule leur PUBLICATION bascule.

ALTER TABLE "KolProfile"
  ADD COLUMN IF NOT EXISTS "monetaryClaimsPublication" TEXT NOT NULL DEFAULT 'published';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'KolProfile_monetaryClaimsPublication_allowed') THEN
    ALTER TABLE "KolProfile"
      ADD CONSTRAINT "KolProfile_monetaryClaimsPublication_allowed"
      CHECK ("monetaryClaimsPublication" IN ('published','withdrawn'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "KolProfile_monetaryClaimsPublication_idx"
  ON "KolProfile" ("monetaryClaimsPublication");

-- Lecture publique la plus fréquente : les deux interrupteurs ensemble.
CREATE INDEX IF NOT EXISTS "KolProfile_publication_pair_idx"
  ON "KolProfile" ("proceedsPublication", "monetaryClaimsPublication");

-- ══════════════════════════════════════════════════════════════════════════
-- 2. LE REGISTRE — quatre portées de plus, aucune retirée
-- ══════════════════════════════════════════════════════════════════════════
--
-- ⚠️ SEULE OPÉRATION NON ADDITIVE DU LOT. Voir l'exposé en tête de fichier.
-- La nouvelle liste contient l'ancienne mot pour mot ; le §0 le prouve sur les
-- données réelles avant d'arriver ici.

ALTER TABLE "KolProceedsPublicationLog"
  DROP CONSTRAINT IF EXISTS "KolProceedsPublicationLog_scope_allowed";

ALTER TABLE "KolProceedsPublicationLog"
  ADD CONSTRAINT "KolProceedsPublicationLog_scope_allowed"
  CHECK ("scope" IN (
    -- ── les quatre portées d'origine, inchangées ───────────────────────────
    'profile_total',    -- KolProfile.totalDocumented — la surface publique
    'summary',          -- KolProceedsSummary.totalProceedsUsd
    'event',            -- une ligne KolProceedsEvent
    'involvement',      -- KolTokenInvolvement.proceedsUsd  (prévue, jamais utilisée)
    -- ── les quatre nouvelles ───────────────────────────────────────────────
    'scammed_total',    -- KolProfile.totalScammed        (jusqu'à 17,8 M$)
    'case_paid',        -- KolCase.paidUsd                (jusqu'à 48,3 M$)
    'evidence_amount',  -- KolEvidence.amountUsd          (jusqu'à 42 M$)
    'monetary_all'      -- « plus aucun chiffre sur cette personne »
  ));

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════
-- BLOC 2 — VÉRIFICATIONS POST-MIGRATION                      LECTURE SEULE
-- ═══════════════════════════════════════════════════════════════════════════
--
-- STATUS : **EXÉCUTÉ le 2026-08-19**, puis REJOUÉ en lecture seule et
--          confronté ligne à ligne — docs/prep/VERIF_BLOC2_2026-08-19.md.
-- IRRÉVERSIBLE : rien, aucune écriture.
-- ORDRE  : immédiatement après le BLOC 1, AVANT le déploiement.
--
-- Ces requêtes ne demandent pas « la migration a-t-elle rendu succès ». Elles
-- demandent « l'objet est-il là, avec la bonne contrainte, et les lignes
-- existantes sont-elles cohérentes ». Un COMMIT sans exception n'est pas une
-- preuve : c'est exactement ce qu'un message de commit du 16 août affirmait,
-- à tort, sur une autre migration.

-- 2.1 — Les deux colonnes existent, bon défaut, bon NOT NULL.
SELECT table_name, column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
 WHERE (table_name = 'LaundryTrail' AND column_name = 'publication')
    OR (table_name = 'KolProfile'   AND column_name = 'monetaryClaimsPublication')
 ORDER BY table_name;
-- ATTENDU : 2 lignes · is_nullable = NO · column_default = 'published'::text

-- 2.2 — Les CHECK sont posés, et leur définition est celle attendue.
SELECT conname, pg_get_constraintdef(oid) AS definition
  FROM pg_constraint
 WHERE conname IN (
   'LaundryTrail_publication_allowed',
   'KolProfile_monetaryClaimsPublication_allowed',
   'KolProceedsPublicationLog_scope_allowed')
 ORDER BY conname;
-- ATTENDU : 3 lignes. La 3e doit contenir les HUIT portées, dont
--           'monetary_all' — c'est le seul DROP/ADD du lot.

-- 2.3 — La table de registre du narratif existe, avec ses contraintes.
SELECT count(*) FILTER (WHERE contype = 'c') AS nb_check,
       count(*) FILTER (WHERE contype = 'p') AS nb_pk
  FROM pg_constraint
 WHERE conrelid = 'public."LaundryTrailPublicationLog"'::regclass;
-- ATTENDU : nb_pk = 1 · nb_check >= 7

-- 2.4 — Les index annoncés sont là.
SELECT indexname FROM pg_indexes
 WHERE schemaname = 'public'
   AND (indexname LIKE 'LaundryTrail%publication%'
     OR indexname LIKE 'LaundryTrailPublicationLog%'
     OR indexname LIKE 'KolProfile%onetary%'
     OR indexname = 'KolProfile_publication_pair_idx')
 ORDER BY indexname;
-- ATTENDU : 9 index. Vérifié en base le 2026-08-19 — l'annotation « 6 » qui
--           vivait ici était FAUSSE, et c'est elle qui a créé l'écart, pas la
--           migration. Le compte se décompose ainsi :
--
--             1a · LaundryTrailPublicationLog_trailId_createdAt_idx
--             1a · LaundryTrailPublicationLog_kolHandle_createdAt_idx
--             1a · LaundryTrailPublicationLog_reasonCode_idx
--             1a · LaundryTrailPublicationLog_contestationRef_idx
--             1a · LaundryTrail_publication_idx
--             1a · LaundryTrail_kolHandle_publication_idx
--             1b · KolProfile_monetaryClaimsPublication_idx
--             1b · KolProfile_publication_pair_idx
--             -- · LaundryTrailPublicationLog_pkey
--
--           Les huit premiers sont les huit `CREATE INDEX` des BLOCS 1a et 1b,
--           nom pour nom. Le neuvième n'est créé par aucun bloc : Postgres le
--           fabrique tout seul pour la PRIMARY KEY du CREATE TABLE. Il se
--           reconnaît à ce qu'il est le SEUL de la liste à porter une
--           contrainte associée (pg_constraint.contype = 'p') et à être UNIQUE.
--
--           Un dixième index, ou un neuvième qui ne serait pas le pkey,
--           signifierait qu'un objet est arrivé par une voie non tracée : ARRÊT.

-- 2.5 — LE CONTRÔLE QUI COMPTE : aucune ligne existante n'a changé d'état.
--       Le DEFAULT ne doit avoir produit aucune valeur hors liste, et aucune
--       ligne ne doit être 'withdrawn' — rien n'a encore été décidé.
SELECT 'LaundryTrail' AS table_, "publication" AS valeur, count(*)
  FROM "LaundryTrail" GROUP BY 2
UNION ALL
SELECT 'KolProfile', "monetaryClaimsPublication", count(*)
  FROM "KolProfile" GROUP BY 2
 ORDER BY 1, 2;
-- ATTENDU : 'published' uniquement, des deux côtés, et les totaux doivent
--           correspondre à trails_total / au nombre de profils du BLOC 0.
--           Toute autre valeur = ARRÊT.

-- 2.6 — Le registre des proceeds n'a perdu aucune ligne au changement de
--       contrainte, et toutes ses portées restent dans la nouvelle liste.
SELECT "scope", count(*) FROM "KolProceedsPublicationLog"
 GROUP BY 1 ORDER BY 1;
-- ATTENDU : somme identique à `decisions_proceeds` relevé au BLOC 0.

-- 2.7 — NON-RÉGRESSION DU VERROU A9 (à exécuter côté dépôt, pas ici).
--         npx prisma validate --schema prisma/schema.prod.prisma
--       ATTENDU : code de sortie 1, erreur P1012. Ce bloc SQL est la seule
--       voie de migration restante ; si `directUrl` redevenait résolvable,
--       une seconde voie rouvrirait en silence.


-- ═══════════════════════════════════════════════════════════════════════════
-- ⟶ DÉPLOIEMENT ⟵                                              (hors SQL)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- `npx vercel --prod` — expédie l'ARBRE DE TRAVAIL, pas le commit. S'assurer
-- que l'arbre est sur `main`, à jour, et propre.
--
-- Puis docs/prep/SMOKE_TESTS_2026-08-19.md, dans l'ordre indiqué.
-- NE PAS poursuivre vers le BLOC 3 si un smoke test rouge est resté rouge.


-- ═══════════════════════════════════════════════════════════════════════════
-- BLOC 3 — VERSEMENT DE 32 ARCHIVES SUR 34 · legacy / importé    ÉCRITURE
-- ═══════════════════════════════════════════════════════════════════════════
--
-- STATUS : NON EXÉCUTÉ. 32 INSERT (34 objets inventoriés, 2 écartés — voir §4).
-- IRRÉVERSIBLE : **l'ouverture de la chaîne de conservation.** `provenanceType`,
--          `capturedAt` et `timestampMode` font foi ensuite. Un versement mal
--          qualifié ne se corrige qu'en s'ajoutant à lui-même.
-- ORDRE  : après le déploiement. Et surtout AVANT toute décision de retrait sur
--          ces archives : on ne retire pas proprement un document dont on n'a
--          pas d'abord établi l'existence. `EvidenceAccessLog` est en écriture
--          seule et personne ne le lit — il n'existe aucune trace de qui a
--          téléchargé ces documents. Retirer avant d'inscrire effacerait la
--          preuve de ce qui a été affirmé, et quand.
--
-- ── TROIS QUALIFICATIONS, ET UNE CORRECTION ─────────────────────────────────
--
-- 1. `provenanceType = 'MIGRATED_BACKFILL'` — legacy / importé.
--
--    CORRECTION du fichier A16 d'origine, qui posait 'SYSTEM_GENERATED'.
--    Cette valeur N'EXISTE PAS dans le vocabulaire du dépôt :
--    src/lib/evidence-chain/types.ts:21 déclare une union FERMÉE de trois
--    valeurs — FIRST_PARTY_CAPTURE, THIRD_PARTY_SUBMISSION, MIGRATED_BACKFILL
--    — et 'SYSTEM_GENERATED' apparaît ZÉRO fois dans src/. La colonne étant un
--    TEXT sans CHECK, l'INSERT aurait réussi et créé 34 pièces portant une
--    catégorie qu'aucun vérificateur ne sait lire ; manifest.ts:107 l'aurait
--    laissée passer telle quelle dans un champ typé par l'union.
--    MIGRATED_BACKFILL est la valeur prévue pour exactement ce cas.
--
-- 2. `capturedAt` = LastModified de l'objet R2 — LA DATE OBJECTIVEMENT
--    VÉRIFIABLE. Attribut du stockage, relisible par quiconque a accès au
--    bucket, indépendant de toute affirmation de ce dépôt. Ce n'est PAS la date
--    du versement : `ingestedAt` la porte, séparément.
--
-- 3. PROVENANCE HISTORIQUE : **DÉCLARÉE INCONNUE.**
--    `capturedBy`, `captureHost`, `captureTool`, `captureToolVersion` sont NULL
--    à dessein. Le fichier d'origine y inscrivait un moteur PDF, un hôte Vercel
--    et une chaîne Producer — toutes des INFÉRENCES tirées du nom de fichier et
--    des métadonnées du PDF, aucune un fait établi. Une chaîne de conservation
--    qui inscrit une inférence comme un fait est fausse dès sa première ligne.
--
-- ── 4. DEUX OBJETS ÉCARTÉS, NOMMÉMENT ──────────────────────────────────────
--
-- L'inventaire compte 34 objets et 32 empreintes : deux paires d'objets
-- portent les MÊMES octets. Le versement en compte donc 32.
--
--   ÉCARTÉ  reports/deployer_pool/latest.pdf
--   sha256  71bef305d762edb57dbb2cc8c78d3ce7489dbb8c2360080c7fa4a760930effca
--   copie de  reports/deployer_pool/CASE_deployer_pool_2026-08-13T04-49-47.pdf
--
--   ÉCARTÉ  reports/GordonGekko/latest.pdf
--   sha256  b5598a394948450d6c18ceb287737d0864395427c8d2d50b900e3b53a0a928cf
--   copie de  reports/GordonGekko/CASE_GordonGekko_2026-08-16T04-22-56.pdf
--
-- MOTIF : le sha256 est l'IDENTITÉ de la preuve, et il est `@unique` sur
-- EvidenceItem. Deux clés R2 pointant les mêmes octets sont UNE pièce à deux
-- emplacements, pas deux pièces. Les verser aurait fait échouer la transaction
-- entière sur violation d'unicité — le `ON CONFLICT (id) DO NOTHING` d'origine
-- ne protégeait pas : le conflit est sur `sha256`, pas sur `id`.
--
-- POURQUOI PAS `ON CONFLICT ("sha256") DO NOTHING` : la clause aurait fait
-- disparaître les deux lignes EN SILENCE, et le compte serait tombé à 32 sans
-- que rien ne l'explique. On veut l'inverse — une exclusion explicite, écrite,
-- et relisible dix ans plus tard. Un trou de chaîne de conservation se
-- documente ; il ne se maquille pas, y compris quand c'est nous qui retirons
-- les lignes.
--
-- La trace durable ne vit pas dans ce commentaire : le champ `notes` des DEUX
-- pièces conservées nomme la clé écartée. Le registre du BLOC 5 la nomme aussi.
--
-- `timestampMode = 'retroactive'` : l'existence est établie le 2026-08-19 pour
-- des objets créés entre le 2026-07-20 et le 2026-08-16. Une chaîne ouverte
-- après coup doit le dire ; 'at-ingestion' serait un mensonge.
-- `immutableStored = false` : R2 n'est pas configuré en WORM — le champ dit
-- l'état réel du stockage, pas l'intention.
-- `tsaToken` NULL : aucune TSA depuis le 2026-07-30, et TSA_URL_FALLBACK ne
-- doit PAS être posée — un horodatage sur une pièce sans octets la rendrait
-- indiscernable d'une pièce complète.

BEGIN;

DO $$
DECLARE n INTEGER;
BEGIN
  SELECT count(*) INTO n FROM "EvidenceItem" WHERE "r2Key" LIKE 'reports/%';
  IF n <> 0 THEN
    RAISE EXCEPTION 'EvidenceItem contient deja % ligne(s) sous reports/. Arret.', n;
  END IF;
END $$;

INSERT INTO "EvidenceItem" (
  "id", "casefileId", "r2Key", "filePath", "mimeType", "byteSize", "sha256",
  "capturedAt", "capturedBy", "captureHost", "captureTool", "captureToolVersion",
  "sourceUrl", "sourceType", "ingestedAt", "immutableStored",
  "notes", "provenanceType", "timestampMode"
) VALUES
  ('evi_rep_615f749a1d56e9abf5fc2b07', NULL, 'reports/deployer_pool/CASE_deployer_pool_2026-07-30T04-49-57.pdf', NULL, 'application/pdf', 130927, '7829a0be7f295c8122e8ed3de6dda56f99f10b9e611951c3fd2a89e8bb14b90d', '2026-07-30T04:49:57.394Z'::timestamp, NULL, NULL, NULL, NULL, NULL, 'GENERATED_CASE_PDF', now(), false, 'VERSEMENT LEGACY / IMPORTÉ. Objet R2 inscrit dans la chaine de conservation le 2026-08-19, pour un objet anterieur. DATE OBJECTIVEMENT VERIFIABLE : capturedAt = LastModified de l''objet R2 — un attribut du stockage, relisible par quiconque a acces au bucket, independant de toute affirmation de ce depot. PROVENANCE HISTORIQUE : DECLAREE INCONNUE. capturedBy, captureHost, captureTool et captureToolVersion sont NULL a dessein — les valeurs candidates (moteur PDF presume, hote presume, chaine Producer du fichier) sont des INFERENCES tirees du nom de fichier et des metadonnees du PDF, non des faits etablis. Une chaine de conservation qui inscrit une inference comme un fait est fausse des sa premiere ligne. Ce qui est etabli et inscrit : la cle, la taille, l''empreinte sha256 calculee en flux sur le contenu, et la date de derniere modification R2. Inventaire signe sha256=283ff8852878afbc1efc85f40451ba3d59c6f71ed50ceb7d9a6f3c26cf817d63. immutableStored=false : R2 n''est pas configure en WORM. tsaToken NULL : aucune TSA depuis le 2026-07-30. Aucun contenu transcrit, aucun nom civil.', 'MIGRATED_BACKFILL', 'retroactive'),
  ('evi_rep_a3bc2b4a02ea4efd231e2b3d', NULL, 'reports/deployer_pool/CASE_deployer_pool_2026-07-31T04-50-05.pdf', NULL, 'application/pdf', 124784, '281816da1b7978c62fb7906e0a57963ca7f3c4f2d895d2cfe96bc4174e3fd9d6', '2026-07-31T04:50:05.777Z'::timestamp, NULL, NULL, NULL, NULL, NULL, 'GENERATED_CASE_PDF', now(), false, 'VERSEMENT LEGACY / IMPORTÉ. Objet R2 inscrit dans la chaine de conservation le 2026-08-19, pour un objet anterieur. DATE OBJECTIVEMENT VERIFIABLE : capturedAt = LastModified de l''objet R2 — un attribut du stockage, relisible par quiconque a acces au bucket, independant de toute affirmation de ce depot. PROVENANCE HISTORIQUE : DECLAREE INCONNUE. capturedBy, captureHost, captureTool et captureToolVersion sont NULL a dessein — les valeurs candidates (moteur PDF presume, hote presume, chaine Producer du fichier) sont des INFERENCES tirees du nom de fichier et des metadonnees du PDF, non des faits etablis. Une chaine de conservation qui inscrit une inference comme un fait est fausse des sa premiere ligne. Ce qui est etabli et inscrit : la cle, la taille, l''empreinte sha256 calculee en flux sur le contenu, et la date de derniere modification R2. Inventaire signe sha256=283ff8852878afbc1efc85f40451ba3d59c6f71ed50ceb7d9a6f3c26cf817d63. immutableStored=false : R2 n''est pas configure en WORM. tsaToken NULL : aucune TSA depuis le 2026-07-30. Aucun contenu transcrit, aucun nom civil.', 'MIGRATED_BACKFILL', 'retroactive'),
  ('evi_rep_659bd95089cb927c37e25fed', NULL, 'reports/deployer_pool/CASE_deployer_pool_2026-08-12T04-49-46.pdf', NULL, 'application/pdf', 129465, 'ee5e2a4d591978c9a16180444ae1c1af1eed5718d1a1bfef4f760cc6db1072e9', '2026-08-12T04:49:46.852Z'::timestamp, NULL, NULL, NULL, NULL, NULL, 'GENERATED_CASE_PDF', now(), false, 'VERSEMENT LEGACY / IMPORTÉ. Objet R2 inscrit dans la chaine de conservation le 2026-08-19, pour un objet anterieur. DATE OBJECTIVEMENT VERIFIABLE : capturedAt = LastModified de l''objet R2 — un attribut du stockage, relisible par quiconque a acces au bucket, independant de toute affirmation de ce depot. PROVENANCE HISTORIQUE : DECLAREE INCONNUE. capturedBy, captureHost, captureTool et captureToolVersion sont NULL a dessein — les valeurs candidates (moteur PDF presume, hote presume, chaine Producer du fichier) sont des INFERENCES tirees du nom de fichier et des metadonnees du PDF, non des faits etablis. Une chaine de conservation qui inscrit une inference comme un fait est fausse des sa premiere ligne. Ce qui est etabli et inscrit : la cle, la taille, l''empreinte sha256 calculee en flux sur le contenu, et la date de derniere modification R2. Inventaire signe sha256=283ff8852878afbc1efc85f40451ba3d59c6f71ed50ceb7d9a6f3c26cf817d63. immutableStored=false : R2 n''est pas configure en WORM. tsaToken NULL : aucune TSA depuis le 2026-07-30. Aucun contenu transcrit, aucun nom civil.', 'MIGRATED_BACKFILL', 'retroactive'),
  ('evi_rep_4c21b0afe21112a9cb7cffd6', NULL, 'reports/deployer_pool/CASE_deployer_pool_2026-08-13T04-49-47.pdf', NULL, 'application/pdf', 125190, '71bef305d762edb57dbb2cc8c78d3ce7489dbb8c2360080c7fa4a760930effca', '2026-08-13T04:49:48.535Z'::timestamp, NULL, NULL, NULL, NULL, NULL, 'GENERATED_CASE_PDF', now(), false, 'VERSEMENT LEGACY / IMPORTÉ. Objet R2 inscrit dans la chaine de conservation le 2026-08-19, pour un objet anterieur. DATE OBJECTIVEMENT VERIFIABLE : capturedAt = LastModified de l''objet R2 — un attribut du stockage, relisible par quiconque a acces au bucket, independant de toute affirmation de ce depot. PROVENANCE HISTORIQUE : DECLAREE INCONNUE. capturedBy, captureHost, captureTool et captureToolVersion sont NULL a dessein — les valeurs candidates (moteur PDF presume, hote presume, chaine Producer du fichier) sont des INFERENCES tirees du nom de fichier et des metadonnees du PDF, non des faits etablis. Une chaine de conservation qui inscrit une inference comme un fait est fausse des sa premiere ligne. Ce qui est etabli et inscrit : la cle, la taille, l''empreinte sha256 calculee en flux sur le contenu, et la date de derniere modification R2. Inventaire signe sha256=283ff8852878afbc1efc85f40451ba3d59c6f71ed50ceb7d9a6f3c26cf817d63. immutableStored=false : R2 n''est pas configure en WORM. tsaToken NULL : aucune TSA depuis le 2026-07-30. Aucun contenu transcrit, aucun nom civil. DOUBLON ECARTE : la cle R2 ''reports/deployer_pool/latest.pdf'' porte les MEMES octets et le MEME sha256 que cette piece. Elle n''a PAS ete versee : le sha256 est l''identite de la preuve, deux cles pointant les memes octets sont une piece a deux emplacements, pas deux pieces. Exclusion ecrite, jamais silencieuse.', 'MIGRATED_BACKFILL', 'retroactive'),
  ('evi_rep_bd69380a45529aebeba7bc52', NULL, 'reports/GordonGekko/CASE_GordonGekko_2026-07-20T04-38-57.pdf', NULL, 'application/pdf', 182296, '0467e0c8ae5597b7b9cfca6afe5d0216097747c0415492cf03356006a2f3b06f', '2026-07-20T04:38:58.270Z'::timestamp, NULL, NULL, NULL, NULL, NULL, 'GENERATED_CASE_PDF', now(), false, 'VERSEMENT LEGACY / IMPORTÉ. Objet R2 inscrit dans la chaine de conservation le 2026-08-19, pour un objet anterieur. DATE OBJECTIVEMENT VERIFIABLE : capturedAt = LastModified de l''objet R2 — un attribut du stockage, relisible par quiconque a acces au bucket, independant de toute affirmation de ce depot. PROVENANCE HISTORIQUE : DECLAREE INCONNUE. capturedBy, captureHost, captureTool et captureToolVersion sont NULL a dessein — les valeurs candidates (moteur PDF presume, hote presume, chaine Producer du fichier) sont des INFERENCES tirees du nom de fichier et des metadonnees du PDF, non des faits etablis. Une chaine de conservation qui inscrit une inference comme un fait est fausse des sa premiere ligne. Ce qui est etabli et inscrit : la cle, la taille, l''empreinte sha256 calculee en flux sur le contenu, et la date de derniere modification R2. Inventaire signe sha256=283ff8852878afbc1efc85f40451ba3d59c6f71ed50ceb7d9a6f3c26cf817d63. immutableStored=false : R2 n''est pas configure en WORM. tsaToken NULL : aucune TSA depuis le 2026-07-30. Aucun contenu transcrit, aucun nom civil.', 'MIGRATED_BACKFILL', 'retroactive'),
  ('evi_rep_8c4183839506284476fd9be6', NULL, 'reports/GordonGekko/CASE_GordonGekko_2026-07-21T04-38-57.pdf', NULL, 'application/pdf', 182444, '7d144a52d803ae516657dab7dc980a2e5d776c9a2cc83f3512ba188a60e0722e', '2026-07-21T04:38:57.668Z'::timestamp, NULL, NULL, NULL, NULL, NULL, 'GENERATED_CASE_PDF', now(), false, 'VERSEMENT LEGACY / IMPORTÉ. Objet R2 inscrit dans la chaine de conservation le 2026-08-19, pour un objet anterieur. DATE OBJECTIVEMENT VERIFIABLE : capturedAt = LastModified de l''objet R2 — un attribut du stockage, relisible par quiconque a acces au bucket, independant de toute affirmation de ce depot. PROVENANCE HISTORIQUE : DECLAREE INCONNUE. capturedBy, captureHost, captureTool et captureToolVersion sont NULL a dessein — les valeurs candidates (moteur PDF presume, hote presume, chaine Producer du fichier) sont des INFERENCES tirees du nom de fichier et des metadonnees du PDF, non des faits etablis. Une chaine de conservation qui inscrit une inference comme un fait est fausse des sa premiere ligne. Ce qui est etabli et inscrit : la cle, la taille, l''empreinte sha256 calculee en flux sur le contenu, et la date de derniere modification R2. Inventaire signe sha256=283ff8852878afbc1efc85f40451ba3d59c6f71ed50ceb7d9a6f3c26cf817d63. immutableStored=false : R2 n''est pas configure en WORM. tsaToken NULL : aucune TSA depuis le 2026-07-30. Aucun contenu transcrit, aucun nom civil.', 'MIGRATED_BACKFILL', 'retroactive'),
  ('evi_rep_db8903e7d04d67bbaeb13e5c', NULL, 'reports/GordonGekko/CASE_GordonGekko_2026-07-22T04-38-56.pdf', NULL, 'application/pdf', 182102, '597878d27d22ae63528f13439fe17bc51766a653171ac1b4fc5bab10be890eea', '2026-07-22T04:38:57.249Z'::timestamp, NULL, NULL, NULL, NULL, NULL, 'GENERATED_CASE_PDF', now(), false, 'VERSEMENT LEGACY / IMPORTÉ. Objet R2 inscrit dans la chaine de conservation le 2026-08-19, pour un objet anterieur. DATE OBJECTIVEMENT VERIFIABLE : capturedAt = LastModified de l''objet R2 — un attribut du stockage, relisible par quiconque a acces au bucket, independant de toute affirmation de ce depot. PROVENANCE HISTORIQUE : DECLAREE INCONNUE. capturedBy, captureHost, captureTool et captureToolVersion sont NULL a dessein — les valeurs candidates (moteur PDF presume, hote presume, chaine Producer du fichier) sont des INFERENCES tirees du nom de fichier et des metadonnees du PDF, non des faits etablis. Une chaine de conservation qui inscrit une inference comme un fait est fausse des sa premiere ligne. Ce qui est etabli et inscrit : la cle, la taille, l''empreinte sha256 calculee en flux sur le contenu, et la date de derniere modification R2. Inventaire signe sha256=283ff8852878afbc1efc85f40451ba3d59c6f71ed50ceb7d9a6f3c26cf817d63. immutableStored=false : R2 n''est pas configure en WORM. tsaToken NULL : aucune TSA depuis le 2026-07-30. Aucun contenu transcrit, aucun nom civil.', 'MIGRATED_BACKFILL', 'retroactive'),
  ('evi_rep_4a9020d9fb351c09a48b4ec7', NULL, 'reports/GordonGekko/CASE_GordonGekko_2026-07-23T04-39-00.pdf', NULL, 'application/pdf', 182371, 'ee39e120bea52c77a51c695a1f7dcf915ff9e9a26d9816002927ebb9d376ff6a', '2026-07-23T04:39:01.105Z'::timestamp, NULL, NULL, NULL, NULL, NULL, 'GENERATED_CASE_PDF', now(), false, 'VERSEMENT LEGACY / IMPORTÉ. Objet R2 inscrit dans la chaine de conservation le 2026-08-19, pour un objet anterieur. DATE OBJECTIVEMENT VERIFIABLE : capturedAt = LastModified de l''objet R2 — un attribut du stockage, relisible par quiconque a acces au bucket, independant de toute affirmation de ce depot. PROVENANCE HISTORIQUE : DECLAREE INCONNUE. capturedBy, captureHost, captureTool et captureToolVersion sont NULL a dessein — les valeurs candidates (moteur PDF presume, hote presume, chaine Producer du fichier) sont des INFERENCES tirees du nom de fichier et des metadonnees du PDF, non des faits etablis. Une chaine de conservation qui inscrit une inference comme un fait est fausse des sa premiere ligne. Ce qui est etabli et inscrit : la cle, la taille, l''empreinte sha256 calculee en flux sur le contenu, et la date de derniere modification R2. Inventaire signe sha256=283ff8852878afbc1efc85f40451ba3d59c6f71ed50ceb7d9a6f3c26cf817d63. immutableStored=false : R2 n''est pas configure en WORM. tsaToken NULL : aucune TSA depuis le 2026-07-30. Aucun contenu transcrit, aucun nom civil.', 'MIGRATED_BACKFILL', 'retroactive'),
  ('evi_rep_dfce826c85edf4abe8d6819a', NULL, 'reports/GordonGekko/CASE_GordonGekko_2026-07-24T04-38-56.pdf', NULL, 'application/pdf', 182213, 'e537f4b8780fc40492addaf17e61b29e62a71b3485c953a546d746c414def45f', '2026-07-24T04:38:56.521Z'::timestamp, NULL, NULL, NULL, NULL, NULL, 'GENERATED_CASE_PDF', now(), false, 'VERSEMENT LEGACY / IMPORTÉ. Objet R2 inscrit dans la chaine de conservation le 2026-08-19, pour un objet anterieur. DATE OBJECTIVEMENT VERIFIABLE : capturedAt = LastModified de l''objet R2 — un attribut du stockage, relisible par quiconque a acces au bucket, independant de toute affirmation de ce depot. PROVENANCE HISTORIQUE : DECLAREE INCONNUE. capturedBy, captureHost, captureTool et captureToolVersion sont NULL a dessein — les valeurs candidates (moteur PDF presume, hote presume, chaine Producer du fichier) sont des INFERENCES tirees du nom de fichier et des metadonnees du PDF, non des faits etablis. Une chaine de conservation qui inscrit une inference comme un fait est fausse des sa premiere ligne. Ce qui est etabli et inscrit : la cle, la taille, l''empreinte sha256 calculee en flux sur le contenu, et la date de derniere modification R2. Inventaire signe sha256=283ff8852878afbc1efc85f40451ba3d59c6f71ed50ceb7d9a6f3c26cf817d63. immutableStored=false : R2 n''est pas configure en WORM. tsaToken NULL : aucune TSA depuis le 2026-07-30. Aucun contenu transcrit, aucun nom civil.', 'MIGRATED_BACKFILL', 'retroactive'),
  ('evi_rep_ffec12ea6f67b8b0b2e32189', NULL, 'reports/GordonGekko/CASE_GordonGekko_2026-07-25T04-38-57.pdf', NULL, 'application/pdf', 182367, '3fec02b25c4b842eb48fce63b4c640d3b37c40eed5bc2663ab6718eb860d00a8', '2026-07-25T04:38:57.737Z'::timestamp, NULL, NULL, NULL, NULL, NULL, 'GENERATED_CASE_PDF', now(), false, 'VERSEMENT LEGACY / IMPORTÉ. Objet R2 inscrit dans la chaine de conservation le 2026-08-19, pour un objet anterieur. DATE OBJECTIVEMENT VERIFIABLE : capturedAt = LastModified de l''objet R2 — un attribut du stockage, relisible par quiconque a acces au bucket, independant de toute affirmation de ce depot. PROVENANCE HISTORIQUE : DECLAREE INCONNUE. capturedBy, captureHost, captureTool et captureToolVersion sont NULL a dessein — les valeurs candidates (moteur PDF presume, hote presume, chaine Producer du fichier) sont des INFERENCES tirees du nom de fichier et des metadonnees du PDF, non des faits etablis. Une chaine de conservation qui inscrit une inference comme un fait est fausse des sa premiere ligne. Ce qui est etabli et inscrit : la cle, la taille, l''empreinte sha256 calculee en flux sur le contenu, et la date de derniere modification R2. Inventaire signe sha256=283ff8852878afbc1efc85f40451ba3d59c6f71ed50ceb7d9a6f3c26cf817d63. immutableStored=false : R2 n''est pas configure en WORM. tsaToken NULL : aucune TSA depuis le 2026-07-30. Aucun contenu transcrit, aucun nom civil.', 'MIGRATED_BACKFILL', 'retroactive'),
  ('evi_rep_ea70992eeb591480a1550ec0', NULL, 'reports/GordonGekko/CASE_GordonGekko_2026-07-26T04-38-56.pdf', NULL, 'application/pdf', 182216, 'a8c1359a721a3af5ce528782a7d68dcac3a6453863fe029070c7960f34a8342c', '2026-07-26T04:38:57.310Z'::timestamp, NULL, NULL, NULL, NULL, NULL, 'GENERATED_CASE_PDF', now(), false, 'VERSEMENT LEGACY / IMPORTÉ. Objet R2 inscrit dans la chaine de conservation le 2026-08-19, pour un objet anterieur. DATE OBJECTIVEMENT VERIFIABLE : capturedAt = LastModified de l''objet R2 — un attribut du stockage, relisible par quiconque a acces au bucket, independant de toute affirmation de ce depot. PROVENANCE HISTORIQUE : DECLAREE INCONNUE. capturedBy, captureHost, captureTool et captureToolVersion sont NULL a dessein — les valeurs candidates (moteur PDF presume, hote presume, chaine Producer du fichier) sont des INFERENCES tirees du nom de fichier et des metadonnees du PDF, non des faits etablis. Une chaine de conservation qui inscrit une inference comme un fait est fausse des sa premiere ligne. Ce qui est etabli et inscrit : la cle, la taille, l''empreinte sha256 calculee en flux sur le contenu, et la date de derniere modification R2. Inventaire signe sha256=283ff8852878afbc1efc85f40451ba3d59c6f71ed50ceb7d9a6f3c26cf817d63. immutableStored=false : R2 n''est pas configure en WORM. tsaToken NULL : aucune TSA depuis le 2026-07-30. Aucun contenu transcrit, aucun nom civil.', 'MIGRATED_BACKFILL', 'retroactive'),
  ('evi_rep_d0f885cf12a4dbed39e158fa', NULL, 'reports/GordonGekko/CASE_GordonGekko_2026-07-27T04-38-57.pdf', NULL, 'application/pdf', 182103, '044d6a374bfaccffefa1402ccf027c068ab2853d7a3ff80d1baa9c467e4e772a', '2026-07-27T04:38:57.655Z'::timestamp, NULL, NULL, NULL, NULL, NULL, 'GENERATED_CASE_PDF', now(), false, 'VERSEMENT LEGACY / IMPORTÉ. Objet R2 inscrit dans la chaine de conservation le 2026-08-19, pour un objet anterieur. DATE OBJECTIVEMENT VERIFIABLE : capturedAt = LastModified de l''objet R2 — un attribut du stockage, relisible par quiconque a acces au bucket, independant de toute affirmation de ce depot. PROVENANCE HISTORIQUE : DECLAREE INCONNUE. capturedBy, captureHost, captureTool et captureToolVersion sont NULL a dessein — les valeurs candidates (moteur PDF presume, hote presume, chaine Producer du fichier) sont des INFERENCES tirees du nom de fichier et des metadonnees du PDF, non des faits etablis. Une chaine de conservation qui inscrit une inference comme un fait est fausse des sa premiere ligne. Ce qui est etabli et inscrit : la cle, la taille, l''empreinte sha256 calculee en flux sur le contenu, et la date de derniere modification R2. Inventaire signe sha256=283ff8852878afbc1efc85f40451ba3d59c6f71ed50ceb7d9a6f3c26cf817d63. immutableStored=false : R2 n''est pas configure en WORM. tsaToken NULL : aucune TSA depuis le 2026-07-30. Aucun contenu transcrit, aucun nom civil.', 'MIGRATED_BACKFILL', 'retroactive'),
  ('evi_rep_dd624a8211dfc507b115397f', NULL, 'reports/GordonGekko/CASE_GordonGekko_2026-07-28T04-38-56.pdf', NULL, 'application/pdf', 182442, '26ae8764825c05e0caacca7f5f69c2bf60ce7b55c19ecdefffad0b916b9fcea7', '2026-07-28T04:38:56.647Z'::timestamp, NULL, NULL, NULL, NULL, NULL, 'GENERATED_CASE_PDF', now(), false, 'VERSEMENT LEGACY / IMPORTÉ. Objet R2 inscrit dans la chaine de conservation le 2026-08-19, pour un objet anterieur. DATE OBJECTIVEMENT VERIFIABLE : capturedAt = LastModified de l''objet R2 — un attribut du stockage, relisible par quiconque a acces au bucket, independant de toute affirmation de ce depot. PROVENANCE HISTORIQUE : DECLAREE INCONNUE. capturedBy, captureHost, captureTool et captureToolVersion sont NULL a dessein — les valeurs candidates (moteur PDF presume, hote presume, chaine Producer du fichier) sont des INFERENCES tirees du nom de fichier et des metadonnees du PDF, non des faits etablis. Une chaine de conservation qui inscrit une inference comme un fait est fausse des sa premiere ligne. Ce qui est etabli et inscrit : la cle, la taille, l''empreinte sha256 calculee en flux sur le contenu, et la date de derniere modification R2. Inventaire signe sha256=283ff8852878afbc1efc85f40451ba3d59c6f71ed50ceb7d9a6f3c26cf817d63. immutableStored=false : R2 n''est pas configure en WORM. tsaToken NULL : aucune TSA depuis le 2026-07-30. Aucun contenu transcrit, aucun nom civil.', 'MIGRATED_BACKFILL', 'retroactive'),
  ('evi_rep_67a0c365c01c5e7145ef0d69', NULL, 'reports/GordonGekko/CASE_GordonGekko_2026-07-29T04-38-57.pdf', NULL, 'application/pdf', 182105, '9bccbc6c8951db2c906d4cd8ccc40db6dc9ecc7fc52263b730d23b389c984698', '2026-07-29T04:38:57.689Z'::timestamp, NULL, NULL, NULL, NULL, NULL, 'GENERATED_CASE_PDF', now(), false, 'VERSEMENT LEGACY / IMPORTÉ. Objet R2 inscrit dans la chaine de conservation le 2026-08-19, pour un objet anterieur. DATE OBJECTIVEMENT VERIFIABLE : capturedAt = LastModified de l''objet R2 — un attribut du stockage, relisible par quiconque a acces au bucket, independant de toute affirmation de ce depot. PROVENANCE HISTORIQUE : DECLAREE INCONNUE. capturedBy, captureHost, captureTool et captureToolVersion sont NULL a dessein — les valeurs candidates (moteur PDF presume, hote presume, chaine Producer du fichier) sont des INFERENCES tirees du nom de fichier et des metadonnees du PDF, non des faits etablis. Une chaine de conservation qui inscrit une inference comme un fait est fausse des sa premiere ligne. Ce qui est etabli et inscrit : la cle, la taille, l''empreinte sha256 calculee en flux sur le contenu, et la date de derniere modification R2. Inventaire signe sha256=283ff8852878afbc1efc85f40451ba3d59c6f71ed50ceb7d9a6f3c26cf817d63. immutableStored=false : R2 n''est pas configure en WORM. tsaToken NULL : aucune TSA depuis le 2026-07-30. Aucun contenu transcrit, aucun nom civil.', 'MIGRATED_BACKFILL', 'retroactive'),
  ('evi_rep_2871a9bbab2d5e2523520921', NULL, 'reports/GordonGekko/CASE_GordonGekko_2026-07-30T04-47-10.pdf', NULL, 'application/pdf', 182699, '3dd0368ddfa6b8b0a974b6e76f4246c667305d08e37fc72e5a507b2316d4641e', '2026-07-30T04:47:11.265Z'::timestamp, NULL, NULL, NULL, NULL, NULL, 'GENERATED_CASE_PDF', now(), false, 'VERSEMENT LEGACY / IMPORTÉ. Objet R2 inscrit dans la chaine de conservation le 2026-08-19, pour un objet anterieur. DATE OBJECTIVEMENT VERIFIABLE : capturedAt = LastModified de l''objet R2 — un attribut du stockage, relisible par quiconque a acces au bucket, independant de toute affirmation de ce depot. PROVENANCE HISTORIQUE : DECLAREE INCONNUE. capturedBy, captureHost, captureTool et captureToolVersion sont NULL a dessein — les valeurs candidates (moteur PDF presume, hote presume, chaine Producer du fichier) sont des INFERENCES tirees du nom de fichier et des metadonnees du PDF, non des faits etablis. Une chaine de conservation qui inscrit une inference comme un fait est fausse des sa premiere ligne. Ce qui est etabli et inscrit : la cle, la taille, l''empreinte sha256 calculee en flux sur le contenu, et la date de derniere modification R2. Inventaire signe sha256=283ff8852878afbc1efc85f40451ba3d59c6f71ed50ceb7d9a6f3c26cf817d63. immutableStored=false : R2 n''est pas configure en WORM. tsaToken NULL : aucune TSA depuis le 2026-07-30. Aucun contenu transcrit, aucun nom civil.', 'MIGRATED_BACKFILL', 'retroactive'),
  ('evi_rep_36f6fdeec224377ce9e37ebc', NULL, 'reports/GordonGekko/CASE_GordonGekko_2026-07-31T04-47-11.pdf', NULL, 'application/pdf', 182372, 'c1450a0eb208e1b778559271e0e681de8329ba4e2fe67fd0d627fa36dc5c93d2', '2026-07-31T04:47:12.399Z'::timestamp, NULL, NULL, NULL, NULL, NULL, 'GENERATED_CASE_PDF', now(), false, 'VERSEMENT LEGACY / IMPORTÉ. Objet R2 inscrit dans la chaine de conservation le 2026-08-19, pour un objet anterieur. DATE OBJECTIVEMENT VERIFIABLE : capturedAt = LastModified de l''objet R2 — un attribut du stockage, relisible par quiconque a acces au bucket, independant de toute affirmation de ce depot. PROVENANCE HISTORIQUE : DECLAREE INCONNUE. capturedBy, captureHost, captureTool et captureToolVersion sont NULL a dessein — les valeurs candidates (moteur PDF presume, hote presume, chaine Producer du fichier) sont des INFERENCES tirees du nom de fichier et des metadonnees du PDF, non des faits etablis. Une chaine de conservation qui inscrit une inference comme un fait est fausse des sa premiere ligne. Ce qui est etabli et inscrit : la cle, la taille, l''empreinte sha256 calculee en flux sur le contenu, et la date de derniere modification R2. Inventaire signe sha256=283ff8852878afbc1efc85f40451ba3d59c6f71ed50ceb7d9a6f3c26cf817d63. immutableStored=false : R2 n''est pas configure en WORM. tsaToken NULL : aucune TSA depuis le 2026-07-30. Aucun contenu transcrit, aucun nom civil.', 'MIGRATED_BACKFILL', 'retroactive'),
  ('evi_rep_074408cdee7e11251b8f3fc7', NULL, 'reports/GordonGekko/CASE_GordonGekko_2026-08-01T04-47-08.pdf', NULL, 'application/pdf', 182298, 'fa5a85733cab3774d5696091eebd8f0f752c2d73883542fc78fd25ad8f0f468c', '2026-08-01T04:47:09.182Z'::timestamp, NULL, NULL, NULL, NULL, NULL, 'GENERATED_CASE_PDF', now(), false, 'VERSEMENT LEGACY / IMPORTÉ. Objet R2 inscrit dans la chaine de conservation le 2026-08-19, pour un objet anterieur. DATE OBJECTIVEMENT VERIFIABLE : capturedAt = LastModified de l''objet R2 — un attribut du stockage, relisible par quiconque a acces au bucket, independant de toute affirmation de ce depot. PROVENANCE HISTORIQUE : DECLAREE INCONNUE. capturedBy, captureHost, captureTool et captureToolVersion sont NULL a dessein — les valeurs candidates (moteur PDF presume, hote presume, chaine Producer du fichier) sont des INFERENCES tirees du nom de fichier et des metadonnees du PDF, non des faits etablis. Une chaine de conservation qui inscrit une inference comme un fait est fausse des sa premiere ligne. Ce qui est etabli et inscrit : la cle, la taille, l''empreinte sha256 calculee en flux sur le contenu, et la date de derniere modification R2. Inventaire signe sha256=283ff8852878afbc1efc85f40451ba3d59c6f71ed50ceb7d9a6f3c26cf817d63. immutableStored=false : R2 n''est pas configure en WORM. tsaToken NULL : aucune TSA depuis le 2026-07-30. Aucun contenu transcrit, aucun nom civil.', 'MIGRATED_BACKFILL', 'retroactive'),
  ('evi_rep_fdf88984a506f06d0c8b2272', NULL, 'reports/GordonGekko/CASE_GordonGekko_2026-08-02T04-47-08.pdf', NULL, 'application/pdf', 182301, '466f7ec524a29c51ea46ab5fe0c206268368cdff173e68fe637cc81a81109ca0', '2026-08-02T04:47:09.136Z'::timestamp, NULL, NULL, NULL, NULL, NULL, 'GENERATED_CASE_PDF', now(), false, 'VERSEMENT LEGACY / IMPORTÉ. Objet R2 inscrit dans la chaine de conservation le 2026-08-19, pour un objet anterieur. DATE OBJECTIVEMENT VERIFIABLE : capturedAt = LastModified de l''objet R2 — un attribut du stockage, relisible par quiconque a acces au bucket, independant de toute affirmation de ce depot. PROVENANCE HISTORIQUE : DECLAREE INCONNUE. capturedBy, captureHost, captureTool et captureToolVersion sont NULL a dessein — les valeurs candidates (moteur PDF presume, hote presume, chaine Producer du fichier) sont des INFERENCES tirees du nom de fichier et des metadonnees du PDF, non des faits etablis. Une chaine de conservation qui inscrit une inference comme un fait est fausse des sa premiere ligne. Ce qui est etabli et inscrit : la cle, la taille, l''empreinte sha256 calculee en flux sur le contenu, et la date de derniere modification R2. Inventaire signe sha256=283ff8852878afbc1efc85f40451ba3d59c6f71ed50ceb7d9a6f3c26cf817d63. immutableStored=false : R2 n''est pas configure en WORM. tsaToken NULL : aucune TSA depuis le 2026-07-30. Aucun contenu transcrit, aucun nom civil.', 'MIGRATED_BACKFILL', 'retroactive'),
  ('evi_rep_78d32fc700067ee7aa05c4e8', NULL, 'reports/GordonGekko/CASE_GordonGekko_2026-08-03T04-47-07.pdf', NULL, 'application/pdf', 182559, 'aa07b8636aaeb0cc78485ba89d161716f6bd76b6272f42ba3bd4fa4e5bf9e7a1', '2026-08-03T04:47:08.342Z'::timestamp, NULL, NULL, NULL, NULL, NULL, 'GENERATED_CASE_PDF', now(), false, 'VERSEMENT LEGACY / IMPORTÉ. Objet R2 inscrit dans la chaine de conservation le 2026-08-19, pour un objet anterieur. DATE OBJECTIVEMENT VERIFIABLE : capturedAt = LastModified de l''objet R2 — un attribut du stockage, relisible par quiconque a acces au bucket, independant de toute affirmation de ce depot. PROVENANCE HISTORIQUE : DECLAREE INCONNUE. capturedBy, captureHost, captureTool et captureToolVersion sont NULL a dessein — les valeurs candidates (moteur PDF presume, hote presume, chaine Producer du fichier) sont des INFERENCES tirees du nom de fichier et des metadonnees du PDF, non des faits etablis. Une chaine de conservation qui inscrit une inference comme un fait est fausse des sa premiere ligne. Ce qui est etabli et inscrit : la cle, la taille, l''empreinte sha256 calculee en flux sur le contenu, et la date de derniere modification R2. Inventaire signe sha256=283ff8852878afbc1efc85f40451ba3d59c6f71ed50ceb7d9a6f3c26cf817d63. immutableStored=false : R2 n''est pas configure en WORM. tsaToken NULL : aucune TSA depuis le 2026-07-30. Aucun contenu transcrit, aucun nom civil.', 'MIGRATED_BACKFILL', 'retroactive'),
  ('evi_rep_c0db0f791bad071d97c67d05', NULL, 'reports/GordonGekko/CASE_GordonGekko_2026-08-04T04-47-09.pdf', NULL, 'application/pdf', 182656, '9603c450f4e92ae3efc2070720c6a0102bd18a2718388c6e9eda89acae55b1e0', '2026-08-04T04:47:10.406Z'::timestamp, NULL, NULL, NULL, NULL, NULL, 'GENERATED_CASE_PDF', now(), false, 'VERSEMENT LEGACY / IMPORTÉ. Objet R2 inscrit dans la chaine de conservation le 2026-08-19, pour un objet anterieur. DATE OBJECTIVEMENT VERIFIABLE : capturedAt = LastModified de l''objet R2 — un attribut du stockage, relisible par quiconque a acces au bucket, independant de toute affirmation de ce depot. PROVENANCE HISTORIQUE : DECLAREE INCONNUE. capturedBy, captureHost, captureTool et captureToolVersion sont NULL a dessein — les valeurs candidates (moteur PDF presume, hote presume, chaine Producer du fichier) sont des INFERENCES tirees du nom de fichier et des metadonnees du PDF, non des faits etablis. Une chaine de conservation qui inscrit une inference comme un fait est fausse des sa premiere ligne. Ce qui est etabli et inscrit : la cle, la taille, l''empreinte sha256 calculee en flux sur le contenu, et la date de derniere modification R2. Inventaire signe sha256=283ff8852878afbc1efc85f40451ba3d59c6f71ed50ceb7d9a6f3c26cf817d63. immutableStored=false : R2 n''est pas configure en WORM. tsaToken NULL : aucune TSA depuis le 2026-07-30. Aucun contenu transcrit, aucun nom civil.', 'MIGRATED_BACKFILL', 'retroactive'),
  ('evi_rep_628a4612997a097729ffc4c1', NULL, 'reports/GordonGekko/CASE_GordonGekko_2026-08-05T04-47-10.pdf', NULL, 'application/pdf', 182409, '4982b347dff3cf4be845892d69afcc5e4ed1f2eefacdcfa6d36bc09329313639', '2026-08-05T04:47:11.173Z'::timestamp, NULL, NULL, NULL, NULL, NULL, 'GENERATED_CASE_PDF', now(), false, 'VERSEMENT LEGACY / IMPORTÉ. Objet R2 inscrit dans la chaine de conservation le 2026-08-19, pour un objet anterieur. DATE OBJECTIVEMENT VERIFIABLE : capturedAt = LastModified de l''objet R2 — un attribut du stockage, relisible par quiconque a acces au bucket, independant de toute affirmation de ce depot. PROVENANCE HISTORIQUE : DECLAREE INCONNUE. capturedBy, captureHost, captureTool et captureToolVersion sont NULL a dessein — les valeurs candidates (moteur PDF presume, hote presume, chaine Producer du fichier) sont des INFERENCES tirees du nom de fichier et des metadonnees du PDF, non des faits etablis. Une chaine de conservation qui inscrit une inference comme un fait est fausse des sa premiere ligne. Ce qui est etabli et inscrit : la cle, la taille, l''empreinte sha256 calculee en flux sur le contenu, et la date de derniere modification R2. Inventaire signe sha256=283ff8852878afbc1efc85f40451ba3d59c6f71ed50ceb7d9a6f3c26cf817d63. immutableStored=false : R2 n''est pas configure en WORM. tsaToken NULL : aucune TSA depuis le 2026-07-30. Aucun contenu transcrit, aucun nom civil.', 'MIGRATED_BACKFILL', 'retroactive'),
  ('evi_rep_64fed1d1c32dae0817d93957', NULL, 'reports/GordonGekko/CASE_GordonGekko_2026-08-06T04-47-12.pdf', NULL, 'application/pdf', 182298, 'a40e74bf38b7b3df537da18b30f0ebca5f3cea17653d21300b46d09cca4db824', '2026-08-06T04:47:12.860Z'::timestamp, NULL, NULL, NULL, NULL, NULL, 'GENERATED_CASE_PDF', now(), false, 'VERSEMENT LEGACY / IMPORTÉ. Objet R2 inscrit dans la chaine de conservation le 2026-08-19, pour un objet anterieur. DATE OBJECTIVEMENT VERIFIABLE : capturedAt = LastModified de l''objet R2 — un attribut du stockage, relisible par quiconque a acces au bucket, independant de toute affirmation de ce depot. PROVENANCE HISTORIQUE : DECLAREE INCONNUE. capturedBy, captureHost, captureTool et captureToolVersion sont NULL a dessein — les valeurs candidates (moteur PDF presume, hote presume, chaine Producer du fichier) sont des INFERENCES tirees du nom de fichier et des metadonnees du PDF, non des faits etablis. Une chaine de conservation qui inscrit une inference comme un fait est fausse des sa premiere ligne. Ce qui est etabli et inscrit : la cle, la taille, l''empreinte sha256 calculee en flux sur le contenu, et la date de derniere modification R2. Inventaire signe sha256=283ff8852878afbc1efc85f40451ba3d59c6f71ed50ceb7d9a6f3c26cf817d63. immutableStored=false : R2 n''est pas configure en WORM. tsaToken NULL : aucune TSA depuis le 2026-07-30. Aucun contenu transcrit, aucun nom civil.', 'MIGRATED_BACKFILL', 'retroactive'),
  ('evi_rep_745cce2d03a422fbc5df1321', NULL, 'reports/GordonGekko/CASE_GordonGekko_2026-08-07T04-47-11.pdf', NULL, 'application/pdf', 182301, '3b808dc816c1d0932548a67eb87be39df40fdcd8307c5f8ba75035360c7d0378', '2026-08-07T04:47:11.871Z'::timestamp, NULL, NULL, NULL, NULL, NULL, 'GENERATED_CASE_PDF', now(), false, 'VERSEMENT LEGACY / IMPORTÉ. Objet R2 inscrit dans la chaine de conservation le 2026-08-19, pour un objet anterieur. DATE OBJECTIVEMENT VERIFIABLE : capturedAt = LastModified de l''objet R2 — un attribut du stockage, relisible par quiconque a acces au bucket, independant de toute affirmation de ce depot. PROVENANCE HISTORIQUE : DECLAREE INCONNUE. capturedBy, captureHost, captureTool et captureToolVersion sont NULL a dessein — les valeurs candidates (moteur PDF presume, hote presume, chaine Producer du fichier) sont des INFERENCES tirees du nom de fichier et des metadonnees du PDF, non des faits etablis. Une chaine de conservation qui inscrit une inference comme un fait est fausse des sa premiere ligne. Ce qui est etabli et inscrit : la cle, la taille, l''empreinte sha256 calculee en flux sur le contenu, et la date de derniere modification R2. Inventaire signe sha256=283ff8852878afbc1efc85f40451ba3d59c6f71ed50ceb7d9a6f3c26cf817d63. immutableStored=false : R2 n''est pas configure en WORM. tsaToken NULL : aucune TSA depuis le 2026-07-30. Aucun contenu transcrit, aucun nom civil.', 'MIGRATED_BACKFILL', 'retroactive'),
  ('evi_rep_8fd00fd52243bc15e2f6bd1a', NULL, 'reports/GordonGekko/CASE_GordonGekko_2026-08-08T04-47-11.pdf', NULL, 'application/pdf', 182298, '3744a82e667d19811cd45752fc79ace94375dd5dd3239a18f9f02256b188fccf', '2026-08-08T04:47:11.991Z'::timestamp, NULL, NULL, NULL, NULL, NULL, 'GENERATED_CASE_PDF', now(), false, 'VERSEMENT LEGACY / IMPORTÉ. Objet R2 inscrit dans la chaine de conservation le 2026-08-19, pour un objet anterieur. DATE OBJECTIVEMENT VERIFIABLE : capturedAt = LastModified de l''objet R2 — un attribut du stockage, relisible par quiconque a acces au bucket, independant de toute affirmation de ce depot. PROVENANCE HISTORIQUE : DECLAREE INCONNUE. capturedBy, captureHost, captureTool et captureToolVersion sont NULL a dessein — les valeurs candidates (moteur PDF presume, hote presume, chaine Producer du fichier) sont des INFERENCES tirees du nom de fichier et des metadonnees du PDF, non des faits etablis. Une chaine de conservation qui inscrit une inference comme un fait est fausse des sa premiere ligne. Ce qui est etabli et inscrit : la cle, la taille, l''empreinte sha256 calculee en flux sur le contenu, et la date de derniere modification R2. Inventaire signe sha256=283ff8852878afbc1efc85f40451ba3d59c6f71ed50ceb7d9a6f3c26cf817d63. immutableStored=false : R2 n''est pas configure en WORM. tsaToken NULL : aucune TSA depuis le 2026-07-30. Aucun contenu transcrit, aucun nom civil.', 'MIGRATED_BACKFILL', 'retroactive'),
  ('evi_rep_a6d52194580af683f70d9e2f', NULL, 'reports/GordonGekko/CASE_GordonGekko_2026-08-09T04-47-12.pdf', NULL, 'application/pdf', 182439, '4986ee19c23de5e6b51484667edfd5125d05419a249447ef1e29f14b6adfb6d3', '2026-08-09T04:47:12.947Z'::timestamp, NULL, NULL, NULL, NULL, NULL, 'GENERATED_CASE_PDF', now(), false, 'VERSEMENT LEGACY / IMPORTÉ. Objet R2 inscrit dans la chaine de conservation le 2026-08-19, pour un objet anterieur. DATE OBJECTIVEMENT VERIFIABLE : capturedAt = LastModified de l''objet R2 — un attribut du stockage, relisible par quiconque a acces au bucket, independant de toute affirmation de ce depot. PROVENANCE HISTORIQUE : DECLAREE INCONNUE. capturedBy, captureHost, captureTool et captureToolVersion sont NULL a dessein — les valeurs candidates (moteur PDF presume, hote presume, chaine Producer du fichier) sont des INFERENCES tirees du nom de fichier et des metadonnees du PDF, non des faits etablis. Une chaine de conservation qui inscrit une inference comme un fait est fausse des sa premiere ligne. Ce qui est etabli et inscrit : la cle, la taille, l''empreinte sha256 calculee en flux sur le contenu, et la date de derniere modification R2. Inventaire signe sha256=283ff8852878afbc1efc85f40451ba3d59c6f71ed50ceb7d9a6f3c26cf817d63. immutableStored=false : R2 n''est pas configure en WORM. tsaToken NULL : aucune TSA depuis le 2026-07-30. Aucun contenu transcrit, aucun nom civil.', 'MIGRATED_BACKFILL', 'retroactive'),
  ('evi_rep_1bb457669d0a68927f135342', NULL, 'reports/GordonGekko/CASE_GordonGekko_2026-08-10T04-47-10.pdf', NULL, 'application/pdf', 182438, 'a6647a46707ad238a98be8403a7129473596c5a340f9831f2660ef358ab48904', '2026-08-10T04:47:11.026Z'::timestamp, NULL, NULL, NULL, NULL, NULL, 'GENERATED_CASE_PDF', now(), false, 'VERSEMENT LEGACY / IMPORTÉ. Objet R2 inscrit dans la chaine de conservation le 2026-08-19, pour un objet anterieur. DATE OBJECTIVEMENT VERIFIABLE : capturedAt = LastModified de l''objet R2 — un attribut du stockage, relisible par quiconque a acces au bucket, independant de toute affirmation de ce depot. PROVENANCE HISTORIQUE : DECLAREE INCONNUE. capturedBy, captureHost, captureTool et captureToolVersion sont NULL a dessein — les valeurs candidates (moteur PDF presume, hote presume, chaine Producer du fichier) sont des INFERENCES tirees du nom de fichier et des metadonnees du PDF, non des faits etablis. Une chaine de conservation qui inscrit une inference comme un fait est fausse des sa premiere ligne. Ce qui est etabli et inscrit : la cle, la taille, l''empreinte sha256 calculee en flux sur le contenu, et la date de derniere modification R2. Inventaire signe sha256=283ff8852878afbc1efc85f40451ba3d59c6f71ed50ceb7d9a6f3c26cf817d63. immutableStored=false : R2 n''est pas configure en WORM. tsaToken NULL : aucune TSA depuis le 2026-07-30. Aucun contenu transcrit, aucun nom civil.', 'MIGRATED_BACKFILL', 'retroactive'),
  ('evi_rep_6c6e77a50ee7df33399ebaf8', NULL, 'reports/GordonGekko/CASE_GordonGekko_2026-08-11T04-47-11.pdf', NULL, 'application/pdf', 182304, '80b267b97d4ae4b634072a1ef1c9024e4519481e100cafe22557aab438c7fe08', '2026-08-11T04:47:11.665Z'::timestamp, NULL, NULL, NULL, NULL, NULL, 'GENERATED_CASE_PDF', now(), false, 'VERSEMENT LEGACY / IMPORTÉ. Objet R2 inscrit dans la chaine de conservation le 2026-08-19, pour un objet anterieur. DATE OBJECTIVEMENT VERIFIABLE : capturedAt = LastModified de l''objet R2 — un attribut du stockage, relisible par quiconque a acces au bucket, independant de toute affirmation de ce depot. PROVENANCE HISTORIQUE : DECLAREE INCONNUE. capturedBy, captureHost, captureTool et captureToolVersion sont NULL a dessein — les valeurs candidates (moteur PDF presume, hote presume, chaine Producer du fichier) sont des INFERENCES tirees du nom de fichier et des metadonnees du PDF, non des faits etablis. Une chaine de conservation qui inscrit une inference comme un fait est fausse des sa premiere ligne. Ce qui est etabli et inscrit : la cle, la taille, l''empreinte sha256 calculee en flux sur le contenu, et la date de derniere modification R2. Inventaire signe sha256=283ff8852878afbc1efc85f40451ba3d59c6f71ed50ceb7d9a6f3c26cf817d63. immutableStored=false : R2 n''est pas configure en WORM. tsaToken NULL : aucune TSA depuis le 2026-07-30. Aucun contenu transcrit, aucun nom civil.', 'MIGRATED_BACKFILL', 'retroactive'),
  ('evi_rep_a59d67786963d7810e82485d', NULL, 'reports/GordonGekko/CASE_GordonGekko_2026-08-12T04-47-10.pdf', NULL, 'application/pdf', 182304, 'd01aa3e5396f7b5c122f2dc1129a9418a0893499e867428c74529f0f63aec486', '2026-08-12T04:47:10.534Z'::timestamp, NULL, NULL, NULL, NULL, NULL, 'GENERATED_CASE_PDF', now(), false, 'VERSEMENT LEGACY / IMPORTÉ. Objet R2 inscrit dans la chaine de conservation le 2026-08-19, pour un objet anterieur. DATE OBJECTIVEMENT VERIFIABLE : capturedAt = LastModified de l''objet R2 — un attribut du stockage, relisible par quiconque a acces au bucket, independant de toute affirmation de ce depot. PROVENANCE HISTORIQUE : DECLAREE INCONNUE. capturedBy, captureHost, captureTool et captureToolVersion sont NULL a dessein — les valeurs candidates (moteur PDF presume, hote presume, chaine Producer du fichier) sont des INFERENCES tirees du nom de fichier et des metadonnees du PDF, non des faits etablis. Une chaine de conservation qui inscrit une inference comme un fait est fausse des sa premiere ligne. Ce qui est etabli et inscrit : la cle, la taille, l''empreinte sha256 calculee en flux sur le contenu, et la date de derniere modification R2. Inventaire signe sha256=283ff8852878afbc1efc85f40451ba3d59c6f71ed50ceb7d9a6f3c26cf817d63. immutableStored=false : R2 n''est pas configure en WORM. tsaToken NULL : aucune TSA depuis le 2026-07-30. Aucun contenu transcrit, aucun nom civil.', 'MIGRATED_BACKFILL', 'retroactive'),
  ('evi_rep_669649c1dddcde26860cb02f', NULL, 'reports/GordonGekko/CASE_GordonGekko_2026-08-13T04-47-12.pdf', NULL, 'application/pdf', 182563, '362c756e1ee8288362c58b88f58f7e65efaead309afd391035b9fbe508fa017e', '2026-08-13T04:47:12.700Z'::timestamp, NULL, NULL, NULL, NULL, NULL, 'GENERATED_CASE_PDF', now(), false, 'VERSEMENT LEGACY / IMPORTÉ. Objet R2 inscrit dans la chaine de conservation le 2026-08-19, pour un objet anterieur. DATE OBJECTIVEMENT VERIFIABLE : capturedAt = LastModified de l''objet R2 — un attribut du stockage, relisible par quiconque a acces au bucket, independant de toute affirmation de ce depot. PROVENANCE HISTORIQUE : DECLAREE INCONNUE. capturedBy, captureHost, captureTool et captureToolVersion sont NULL a dessein — les valeurs candidates (moteur PDF presume, hote presume, chaine Producer du fichier) sont des INFERENCES tirees du nom de fichier et des metadonnees du PDF, non des faits etablis. Une chaine de conservation qui inscrit une inference comme un fait est fausse des sa premiere ligne. Ce qui est etabli et inscrit : la cle, la taille, l''empreinte sha256 calculee en flux sur le contenu, et la date de derniere modification R2. Inventaire signe sha256=283ff8852878afbc1efc85f40451ba3d59c6f71ed50ceb7d9a6f3c26cf817d63. immutableStored=false : R2 n''est pas configure en WORM. tsaToken NULL : aucune TSA depuis le 2026-07-30. Aucun contenu transcrit, aucun nom civil.', 'MIGRATED_BACKFILL', 'retroactive'),
  ('evi_rep_e1396c4caf3d037ca3286420', NULL, 'reports/GordonGekko/CASE_GordonGekko_2026-08-14T04-47-12.pdf', NULL, 'application/pdf', 182659, '54141794c37fa2b229a7fcb996732ecbcd4493974f733d1bc1a03f16fc839214', '2026-08-14T04:47:12.787Z'::timestamp, NULL, NULL, NULL, NULL, NULL, 'GENERATED_CASE_PDF', now(), false, 'VERSEMENT LEGACY / IMPORTÉ. Objet R2 inscrit dans la chaine de conservation le 2026-08-19, pour un objet anterieur. DATE OBJECTIVEMENT VERIFIABLE : capturedAt = LastModified de l''objet R2 — un attribut du stockage, relisible par quiconque a acces au bucket, independant de toute affirmation de ce depot. PROVENANCE HISTORIQUE : DECLAREE INCONNUE. capturedBy, captureHost, captureTool et captureToolVersion sont NULL a dessein — les valeurs candidates (moteur PDF presume, hote presume, chaine Producer du fichier) sont des INFERENCES tirees du nom de fichier et des metadonnees du PDF, non des faits etablis. Une chaine de conservation qui inscrit une inference comme un fait est fausse des sa premiere ligne. Ce qui est etabli et inscrit : la cle, la taille, l''empreinte sha256 calculee en flux sur le contenu, et la date de derniere modification R2. Inventaire signe sha256=283ff8852878afbc1efc85f40451ba3d59c6f71ed50ceb7d9a6f3c26cf817d63. immutableStored=false : R2 n''est pas configure en WORM. tsaToken NULL : aucune TSA depuis le 2026-07-30. Aucun contenu transcrit, aucun nom civil.', 'MIGRATED_BACKFILL', 'retroactive'),
  ('evi_rep_4bcbee4a1d170a067bd3d03a', NULL, 'reports/GordonGekko/CASE_GordonGekko_2026-08-15T04-29-13.pdf', NULL, 'application/pdf', 182415, 'fb15de362388a62916bad530e16a6ba5da4ab9676ce804fb8837204a42b3c5c7', '2026-08-15T04:29:13.845Z'::timestamp, NULL, NULL, NULL, NULL, NULL, 'GENERATED_CASE_PDF', now(), false, 'VERSEMENT LEGACY / IMPORTÉ. Objet R2 inscrit dans la chaine de conservation le 2026-08-19, pour un objet anterieur. DATE OBJECTIVEMENT VERIFIABLE : capturedAt = LastModified de l''objet R2 — un attribut du stockage, relisible par quiconque a acces au bucket, independant de toute affirmation de ce depot. PROVENANCE HISTORIQUE : DECLAREE INCONNUE. capturedBy, captureHost, captureTool et captureToolVersion sont NULL a dessein — les valeurs candidates (moteur PDF presume, hote presume, chaine Producer du fichier) sont des INFERENCES tirees du nom de fichier et des metadonnees du PDF, non des faits etablis. Une chaine de conservation qui inscrit une inference comme un fait est fausse des sa premiere ligne. Ce qui est etabli et inscrit : la cle, la taille, l''empreinte sha256 calculee en flux sur le contenu, et la date de derniere modification R2. Inventaire signe sha256=283ff8852878afbc1efc85f40451ba3d59c6f71ed50ceb7d9a6f3c26cf817d63. immutableStored=false : R2 n''est pas configure en WORM. tsaToken NULL : aucune TSA depuis le 2026-07-30. Aucun contenu transcrit, aucun nom civil.', 'MIGRATED_BACKFILL', 'retroactive'),
  ('evi_rep_6ffc5f5af8ba17acf5e69d1f', NULL, 'reports/GordonGekko/CASE_GordonGekko_2026-08-16T04-22-56.pdf', NULL, 'application/pdf', 182301, 'b5598a394948450d6c18ceb287737d0864395427c8d2d50b900e3b53a0a928cf', '2026-08-16T04:22:56.407Z'::timestamp, NULL, NULL, NULL, NULL, NULL, 'GENERATED_CASE_PDF', now(), false, 'VERSEMENT LEGACY / IMPORTÉ. Objet R2 inscrit dans la chaine de conservation le 2026-08-19, pour un objet anterieur. DATE OBJECTIVEMENT VERIFIABLE : capturedAt = LastModified de l''objet R2 — un attribut du stockage, relisible par quiconque a acces au bucket, independant de toute affirmation de ce depot. PROVENANCE HISTORIQUE : DECLAREE INCONNUE. capturedBy, captureHost, captureTool et captureToolVersion sont NULL a dessein — les valeurs candidates (moteur PDF presume, hote presume, chaine Producer du fichier) sont des INFERENCES tirees du nom de fichier et des metadonnees du PDF, non des faits etablis. Une chaine de conservation qui inscrit une inference comme un fait est fausse des sa premiere ligne. Ce qui est etabli et inscrit : la cle, la taille, l''empreinte sha256 calculee en flux sur le contenu, et la date de derniere modification R2. Inventaire signe sha256=283ff8852878afbc1efc85f40451ba3d59c6f71ed50ceb7d9a6f3c26cf817d63. immutableStored=false : R2 n''est pas configure en WORM. tsaToken NULL : aucune TSA depuis le 2026-07-30. Aucun contenu transcrit, aucun nom civil. DOUBLON ECARTE : la cle R2 ''reports/GordonGekko/latest.pdf'' porte les MEMES octets et le MEME sha256 que cette piece. Elle n''a PAS ete versee : le sha256 est l''identite de la preuve, deux cles pointant les memes octets sont une piece a deux emplacements, pas deux pieces. Exclusion ecrite, jamais silencieuse.', 'MIGRATED_BACKFILL', 'retroactive')
ON CONFLICT (id) DO NOTHING;

-- Contrôle DANS LA MÊME TRANSACTION : 32 pièces, 32 legacy, 0 provenance
-- inférée, et aucune des deux clés écartées. Si l'un des quatre ne tient pas,
-- la transaction échoue.
DO $$
DECLARE n INTEGER; m INTEGER; k INTEGER;
BEGIN
  SELECT count(*) INTO n FROM "EvidenceItem" WHERE "r2Key" LIKE 'reports/%';
  IF n <> 32 THEN RAISE EXCEPTION 'Attendu 32 pieces, trouve %.', n; END IF;

  SELECT count(*) INTO m FROM "EvidenceItem"
   WHERE "r2Key" LIKE 'reports/%' AND "provenanceType" <> 'MIGRATED_BACKFILL';
  IF m <> 0 THEN RAISE EXCEPTION '% piece(s) hors MIGRATED_BACKFILL.', m; END IF;

  SELECT count(*) INTO k FROM "EvidenceItem"
   WHERE "r2Key" LIKE 'reports/%'
     AND ("capturedBy" IS NOT NULL OR "captureHost" IS NOT NULL
       OR "captureTool" IS NOT NULL OR "captureToolVersion" IS NOT NULL);
  IF k <> 0 THEN
    RAISE EXCEPTION '% piece(s) portent une provenance inferee. Arret.', k;
  END IF;

  -- Les deux doublons écartés ne doivent apparaître sous AUCUNE forme.
  SELECT count(*) INTO k FROM "EvidenceItem"
   WHERE "r2Key" IN ('reports/deployer_pool/latest.pdf',
                     'reports/GordonGekko/latest.pdf');
  IF k <> 0 THEN
    RAISE EXCEPTION 'Une cle ecartee a ete versee (% ligne(s)). Arret.', k;
  END IF;
END $$;

COMMIT;

-- Relecture APRÈS commit, pour le dossier.
SELECT "provenanceType", "timestampMode", count(*) AS pieces,
       min("capturedAt") AS plus_ancienne, max("capturedAt") AS plus_recente,
       count(DISTINCT "sha256") AS empreintes_distinctes
  FROM "EvidenceItem" WHERE "r2Key" LIKE 'reports/%'
 GROUP BY 1, 2;
-- ATTENDU : 1 ligne · MIGRATED_BACKFILL · retroactive · 32 pièces ·
--           32 empreintes distinctes — une pièce, une empreinte, sans exception.
--           Un écart ici signifierait qu'un doublon est repassé.


-- ═══════════════════════════════════════════════════════════════════════════
-- BLOC 4 — DÉPUBLICATION CONSERVATOIRE · 2 narratifs LaundryTrail  ÉCRITURE
-- ═══════════════════════════════════════════════════════════════════════════
--
-- STATUS : NON EXÉCUTÉ.
-- IRRÉVERSIBLE : NON. Seul bloc conçu pour être défait — par une seconde
--          décision, tracée comme la première.
-- ORDRE  : après le déploiement (sans lui, la décision serait enregistrée mais
--          NON APPLIQUÉE) et après le BLOC 3 (établir avant de retirer).
--
-- ── ON RETIRE. ON NE RÉÉCRIT PAS. ───────────────────────────────────────────
--
-- Aucun UPDATE ne touche `narrativeText` ni `narrativeTextFr`. Le texte reste
-- en base, intact, tel qu'il a été publié. Ce qui change est son ÉTAT DE
-- PUBLICATION — et le code déployé cesse de le servir.
--
-- Réécrire la prose avec une « nouvelle vérité » ferait deux dégâts : on
-- perdrait la seule version dont on puisse dire qu'elle a été publiée, et on
-- publierait une seconde affirmation à la place de la première sans qu'aucune
-- décision ne porte la seconde. Le registre enregistre un RETRAIT ; il n'a
-- aucune forme pour enregistrer une réécriture, et c'est délibéré.
--
-- `narrativeSha256` est calculé EN SQL depuis la ligne vivante. Il n'est ni
-- fourni ni deviné : la photo doit être celle du texte réellement présent à
-- l'instant de la décision. Sans lui on saurait qu'un retrait a eu lieu, pas
-- sur quelle version du texte.
--
-- PORTÉE `trail_full` : la ligne entière cesse d'être servie. Les portées
-- étroites ('trail_narrative', 'trail_risk') existent pour une décision
-- partielle ; ce n'en est pas une.
--
-- ⚠ AVANT D'EXÉCUTER : remplacer `REMPLACER_PAR_IDENTITE_REELLE` par une
--   identité attribuable. Le CHECK de la table refuse 'admin' ; le garde-fou
--   ci-dessous refuse aussi le marqueur laissé tel quel. Une décision de
--   publication nominative appartient à une personne, pas à un rôle.

BEGIN;

DO $$
DECLARE
  v_actor  TEXT := 'REMPLACER_PAR_IDENTITE_REELLE';
  v_reason TEXT := 'Depublication conservatoire. Le narratif affirme un fait '
                || 'monetaire et nominatif dont la part adossee a une '
                || 'observation primaire n''a pas ete etablie a ce jour. '
                || 'Retrait dans l''attente d''une requalification ; le texte '
                || 'est conserve intact en base, non reecrit.';
  r RECORD;
  n INTEGER := 0;
BEGIN
  IF v_actor = 'REMPLACER_PAR_IDENTITE_REELLE' THEN
    RAISE EXCEPTION 'actorId non renseigne. Une decision doit etre attribuable.';
  END IF;

  FOR r IN
    SELECT "id", "kolHandle", "laundryRisk", "publication",
           encode(sha256(convert_to(
             coalesce("narrativeText", '') || E'\n---\n' ||
             coalesce("narrativeTextFr", ''), 'UTF8')), 'hex') AS sha
      FROM "LaundryTrail"
     WHERE lower("kolHandle") IN ('bkokoski', 'sxyz500')
  LOOP
    IF r."publication" = 'withdrawn' THEN
      RAISE NOTICE 'Trail % (%) deja retire — ignore.', r."id", r."kolHandle";
      CONTINUE;
    END IF;

    INSERT INTO "LaundryTrailPublicationLog" (
      "trailId", "kolHandle", "scope", "fromStatus", "toStatus",
      "narrativeSha256", "laundryRiskAtDecision",
      "reasonCode", "reason", "actorId"
    ) VALUES (
      r."id", r."kolHandle", 'trail_full', 'published', 'withdrawn',
      r.sha, r."laundryRisk",
      'evidence_withdrawn', v_reason, v_actor
    );

    UPDATE "LaundryTrail" SET "publication" = 'withdrawn' WHERE "id" = r."id";
    n := n + 1;
  END LOOP;

  IF n = 0 THEN
    RAISE EXCEPTION 'Aucun trail retire. Verifier les handles avant de committer.';
  END IF;
  RAISE NOTICE '% trail(s) retire(s), % entree(s) de registre.', n, n;
END $$;

-- Contrôle DANS LA MÊME TRANSACTION : le texte n'a pas bougé.
DO $$
DECLARE n INTEGER;
BEGIN
  SELECT count(*) INTO n FROM "LaundryTrail"
   WHERE lower("kolHandle") IN ('bkokoski', 'sxyz500')
     AND coalesce("narrativeText", '') = ''
     AND coalesce("narrativeTextFr", '') = '';
  IF n > 0 THEN
    RAISE EXCEPTION '% narratif(s) vide(s) — on retire, on n''efface pas.', n;
  END IF;
END $$;

COMMIT;

-- Relecture : l'état a changé, le texte non.
SELECT "kolHandle", "publication",
       length(coalesce("narrativeText", ''))   AS longueur_texte_en,
       length(coalesce("narrativeTextFr", '')) AS longueur_texte_fr
  FROM "LaundryTrail"
 WHERE lower("kolHandle") IN ('bkokoski', 'sxyz500')
 ORDER BY "kolHandle";
-- ATTENDU : publication = 'withdrawn' · longueurs INCHANGÉES et non nulles.
--           Une longueur à 0 signifierait qu'on a effacé au lieu de retirer.

SELECT "kolHandle", "scope", "fromStatus", "toStatus", "reasonCode",
       "actorId", "createdAt", left("narrativeSha256", 12) AS sha_court
  FROM "LaundryTrailPublicationLog"
 ORDER BY "createdAt" DESC LIMIT 10;


-- ═══════════════════════════════════════════════════════════════════════════
-- BLOC 5 — ENTRÉE DE REGISTRE · élargissement de portée          ÉCRITURE
-- ═══════════════════════════════════════════════════════════════════════════
--
-- STATUS : NON EXÉCUTÉ.
-- IRRÉVERSIBLE : **journal append-only.** Écrite avant le déploiement, elle
--          consignerait une décision non appliquée ; écrite longtemps après,
--          elle daterait faux. S'en défaire exige une seconde décision.
-- ORDRE  : LE MÊME JOUR que le déploiement, et après lui. Dernier bloc.
--
-- CE QU'ELLE ENREGISTRE, ET POURQUOI ELLE EXISTE : les six décisions du 16 août
-- portaient la portée `profile_total`. Servies par le code désormais déployé,
-- elles couvrent ONZE PORTEURS DE PLUS. C'est le défaut mesuré, donc l'effet
-- voulu — mais c'est un ÉLARGISSEMENT EFFECTIF DE DÉCISIONS DÉJÀ PRISES. Un
-- élargissement non consigné serait une décision prise par personne.
--
-- ── CE QUE CE REGISTRE CONSIGNE AUSSI : DEUX PIÈCES NON VERSÉES ────────────
--
-- Le BLOC 3 a versé 32 pièces sur 34 objets inventoriés. Deux objets ont été
-- écartés parce qu'ils portent des octets déjà versés sous une autre clé :
--
--   reports/deployer_pool/latest.pdf
--     sha256   71bef305d762edb57dbb2cc8c78d3ce7489dbb8c2360080c7fa4a760930effca
--     copie de reports/deployer_pool/CASE_deployer_pool_2026-08-13T04-49-47.pdf
--
--   reports/GordonGekko/latest.pdf
--     sha256   b5598a394948450d6c18ceb287737d0864395427c8d2d50b900e3b53a0a928cf
--     copie de reports/GordonGekko/CASE_GordonGekko_2026-08-16T04-22-56.pdf
--
-- Ces deux clés EXISTENT toujours dans R2. Ce qui n'existe pas, c'est une
-- seconde entrée de chaîne de conservation pour les mêmes octets. Quiconque
-- retrouvera `latest.pdf` sans ligne correspondante doit pouvoir lire ICI
-- pourquoi — et vérifier lui-même, en recalculant le sha256, qu'il tient la
-- copie d'une pièce versée et non une pièce manquante.
--
-- La mention n'est PAS insérée dans les six lignes de KolProceedsPublicationLog
-- ci-dessous : ce sont des décisions MONÉTAIRES, et y écrire une information
-- d'archive corromprait six enregistrements pour documenter un fait qui ne les
-- concerne pas. Le `RAISE NOTICE` ci-dessous la fait apparaître à l'exécution,
-- et le champ `notes` des deux pièces conservées la porte durablement en base.

DO $$
BEGIN
  RAISE NOTICE 'BLOC 3 : 32 pieces versees sur 34 objets inventories.';
  RAISE NOTICE 'ECARTE reports/deployer_pool/latest.pdf sha256=71bef305... copie de CASE_deployer_pool_2026-08-13T04-49-47.pdf';
  RAISE NOTICE 'ECARTE reports/GordonGekko/latest.pdf sha256=b5598a39... copie de CASE_GordonGekko_2026-08-16T04-22-56.pdf';
END $$;

-- ⚠ Ce registre décrit DOUZE surfaces. Si `/api/kol/{handle}/shill-to-exit`
--   était versé au lot — lacune inscrite dans LACUNES_AMONT du test de
--   couverture — il y en aurait TREIZE. Les deux doivent bouger ensemble, ou
--   ce journal datera faux le jour même où il est écrit.

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

-- ═══════════════════════════════════════════════════════════════════════════
-- FIN — RÉCAPITULATIF DES ÉTATS
-- ═══════════════════════════════════════════════════════════════════════════
--
--   BLOC 0   EXÉCUTÉ 2026-08-19   lecture seule · vert
--   BLOC 1a  EXÉCUTÉ 2026-08-19   écriture · additif · vert
--   BLOC 1b  EXÉCUTÉ 2026-08-19   écriture · DROP CONSTRAINT gardé · vert
--   BLOC 2   EXÉCUTÉ + REJOUÉ     lecture seule · 6/6 conformes
--   DÉPLOI.  NON FAIT      hors SQL
--   BLOC 3   NON EXÉCUTÉ   écriture · IRRÉVERSIBLE — ouvre la chaîne · 32 pièces
--   BLOC 4   NON EXÉCUTÉ   écriture · réversible par seconde décision
--   BLOC 5   NON EXÉCUTÉ   écriture · IRRÉVERSIBLE — append-only
--
-- Aucune connexion à ep-square-band n'a été ouverte pour produire ce fichier.
