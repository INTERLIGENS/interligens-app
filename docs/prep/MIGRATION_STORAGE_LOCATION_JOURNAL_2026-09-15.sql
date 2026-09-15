-- ═══════════════════════════════════════════════════════════════════════════
-- T1-REGISTRE-DE-LOCALISATION — OÙ SONT LES OCTETS D'UNE PIÈCE — DDL ADDITIF
-- Fichier : docs/prep/MIGRATION_STORAGE_LOCATION_JOURNAL_2026-09-15.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ⚠️ NON APPLIQUÉ. À coller dans l'ÉDITEUR SQL NEON (ep-square-band), après
--    snapshot de branche. JAMAIS `prisma db push`, JAMAIS `prisma migrate` —
--    les deux schemas portent le verrou A9 et s'arrêtent sur P1012.
--
-- ─── LE RULING QUI COMMANDE CE FICHIER ──────────────────────────────────────
--
--   « An evidence object's storage key does not establish its storage
--     compartment. Storage location requires its own governed authority. »
--
-- Et le motif qui écarte la colonne mutable :
--   « La localisation d'un objet probatoire est un fait SUSCEPTIBLE D'ÉVOLUER
--     lors d'une migration ; elle doit donc avoir son historique et son
--     fondement. UNE COLONNE MUTABLE r2Bucket ÉCRASERAIT PRÉCISÉMENT CETTE
--     HISTOIRE. »
--
-- La mesure qui justifie le DDL (fenêtre T1-RESOLUTION-DE-STOCKAGE, 2026-09-15) :
--   31 pièces sur 31 de l'univers d'horodatage sont STORAGE_LOCATION_UNRESOLVED.
--   « Nous avons maintenant démontré qu'un EvidenceItem ne porte pas
--     suffisamment d'information pour retrouver ses propres bytes SANS
--     DEVINER. » (GPT, 2026-09-15.)
--
-- ⛔ AUCUN BACKFILL PAR DATE, PRÉFIXE OU CONVENTION. NO-GO EXPLICITE.
--    Les 31 clés commencent TOUTES par `reports/`. C'est précisément le piège :
--    un préfixe décrit un CHEMIN DANS un compartiment, jamais le compartiment.
--    Aucune ligne de ce fichier ne lit `reports/` pour en déduire quoi que ce
--    soit, et aucune ligne n'est insérée ici. La table naît VIDE.
--
-- ADDITIF ET SEULEMENT ADDITIF : aucune table existante n'est touchée.
-- "EvidenceItem" n'est que RÉFÉRENCÉE.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- PRÉREQUIS MESURÉS le 2026-09-15 (information_schema / pg_catalog, ep-square-band)
-- ═══════════════════════════════════════════════════════════════════════════
--   · PostgreSQL 17.11
--   · public."EvidenceItem" — camelCase, guillemets obligatoires
--     id text NOT NULL · PRIMARY KEY (id) = "EvidenceItem_pkey"
--     → l'identité gouvernée de la pièce EXISTE et est posable en FK.
--   · elle l'est DÉJÀ, deux fois : "EvidenceLink_evidenceItemId_fkey" et
--     "EvidenceAccessLog_evidenceItemId_fkey" → "EvidenceItem"(id). La cible
--     n'est pas supposée : elle est éprouvée en production.
--   · "r2Key" text NULL · "sha256" text NOT NULL · index UNIQUE
--     "EvidenceItem_sha256_key" (un INDEX, pas une contrainte — invisible dans
--     pg_constraint, même piège que sur "EvidenceSnapshot").
--   · 1104 pièces · 1103 portent un "r2Key" · 1070 sont déjà horodatées.
--   · 0 trigger sur "EvidenceItem".
--   · le nom evidence_storage_location_journal est LIBRE (les seules tables
--     gouvernées existantes sont evidence_provenance_journal et governed_objects).
--   · casefile_claim_publication_decisions_append_only() et
--     evidence_provenance_journal_append_only() existent : le motif append-only
--     est ÉPROUVÉ deux fois en production. On le REPRODUIT, on ne le partage
--     pas — une fonction par table, dont le message nomme la table, et retirer
--     l'une ne désarme pas les autres.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- POINT DE CONCEPTION 1 — LA FK : VERS QUOI, EXACTEMENT ?  → "EvidenceItem"(id)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- TROIS cibles étaient concevables. Elles ont été MESURÉES, pas supposées.
--
--   (i) "EvidenceItem"(id)                                      ← RETENUE
--       C'est l'objet dont on cherche les octets. C'est lui qui porte "r2Key",
--       lui qui porte "tsaToken", lui que `tsaPendingUniverseSql()` sélectionne,
--       lui que `resoudreLocalisation` reçoit. Journaliser la localisation
--       ailleurs que sur l'objet qui porte la clé créerait un saut d'identité
--       au milieu du chemin.
--       Mesure : id text NOT NULL, PK, déjà cible de deux FK. Posable.
--
--  (ii) governed_objects(id) — ÉCARTÉE, et la mesure est sans appel.
--       Cette table porte DÉJÀ (bucket, storage_key) avec un index unique
--       governed_objects_bucket_key_uniq. Elle avait donc l'air d'être
--       l'autorité cherchée. Elle ne l'est pas :
--         · elle contient UNE ligne (object_nature = CASEFILE_RENDER,
--           bucket = interligens-reports). Les 1103 pièces n'y sont pas.
--         · AUCUNE colonne, AUCUNE FK ne la relie à "EvidenceItem". Il n'existe
--           aucun pont mesurable entre les deux.
--         · l'y rattacher exigerait d'abord d'y INSCRIRE 1103 objets — c'est-à-
--           dire un backfill, fabriqué depuis "r2Key" et un compartiment
--           DEVINÉ. Exactement le NO-GO.
--         · et surtout : governed_objects.bucket est une colonne MUTABLE, sans
--           trigger append-only. Elle retomberait sous l'objection même qui
--           écarte l'option A : « une colonne mutable écraserait précisément
--           cette histoire ».
--       governed_objects gouverne l'ALLOCATION d'objets R2. Elle ne répond pas
--       à « où sont les octets de CETTE pièce », et on ne la tord pas pour ça.
--
-- (iii) "EvidenceSnapshot"(id) — ÉCARTÉE. C'est la cible du journal de
--       PROVENANCE, et c'est une AUTRE identité : l'observation, pas l'objet
--       stocké. "EvidenceSnapshot" ne porte pas "r2Key" ; une localisation
--       inscrite là ne dirait pas où sont les octets de la pièce qui, elle,
--       porte la clé.
--
--  (iv) le sha256 comme clé — ÉCARTÉE, même argument que pour le journal de
--       provenance, et il est ici PLUS fort encore : le sha256 identifie des
--       OCTETS. Or la question posée est « ces octets sont dans QUEL
--       compartiment ». Des octets identiques peuvent exister dans deux
--       compartiments — c'est même le cas PRESENT_AUX_DEUX que la mesure doit
--       savoir rapporter. Une clé qui ne sait pas distinguer deux
--       emplacements des mêmes octets ne peut pas être la clé d'un registre de
--       localisation. Le sha256 n'apparaît donc pas dans cette table, même
--       comme attribut : il est déjà sur "EvidenceItem", NOT NULL et unique.
--
-- ON UPDATE RESTRICT ON DELETE RESTRICT : une pièce dont la localisation est
-- journalisée ne se supprime ni ne se renumérote. L'historique tient à la pièce.
-- ⚠️ Volontairement PLUS DUR que les deux FK existantes vers "EvidenceItem",
-- qui sont en CASCADE/CASCADE (EvidenceLink, EvidenceAccessLog). Un lien de
-- dossier ou une ligne d'accès peut disparaître avec la pièce ; l'historique de
-- l'endroit où vivaient ses octets, non — c'est ce qu'on consulterait
-- justement pour savoir ce qui a été supprimé.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- POINT DE CONCEPTION 2 — VERIFIED_BY_HEAD DOIT PORTER PLUS. ET IL LE PORTE.
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Les deux modes n'ont pas la même force probatoire, et la table le dit par
-- STRUCTURE — pas par convention, pas en prose.
--
--   DECLARED_AT_WRITE   « j'ai écrit ces octets là ». C'est une assertion
--                       CONTEMPORAINE de l'écriture, par celui qui écrit. Son
--                       auteur et sa date sont declared_by / declared_at, et
--                       ils suffisent : l'acte et sa déclaration sont le même
--                       événement.
--
--   VERIFIED_BY_HEAD    « j'ai INTERROGÉ le compartiment, et il a répondu que
--                       l'objet y est ». C'est une MESURE, et une mesure a
--                       trois propriétés que la déclaration n'a pas :
--                         · elle est faite par quelqu'un qui n'est pas
--                           forcément l'écrivain,
--                         · elle est faite à un instant qui n'est PAS celui de
--                           l'écriture,
--                         · elle PÉRIME. Un objet peut disparaître après. Une
--                           mesure sans date de mesure est invérifiable :
--                           on ne saurait pas de quand date la dernière fois
--                           qu'on a vu l'objet.
--                       Replier la mesure sur declared_at ferait passer une
--                       observation pour une déclaration et PERDRAIT la seule
--                       chose qui fait sa valeur : QUAND on a regardé.
--
--   → observed_by et observed_at sont NON NULS SI ET SEULEMENT SI
--     establishment_mode = 'VERIFIED_BY_HEAD'. Un CHECK, dans les DEUX SENS.
--
--   L'autre sens compte autant : une ligne DECLARED_AT_WRITE qui porterait une
--   observation ne serait pas « une déclaration renforcée », ce serait une
--   ligne INCOHÉRENTE — quelqu'un aurait mesuré sans le déclarer comme tel. Le
--   lecteur la refuse aussi. C'est exactement le motif
--   evidence_provenance_journal_verified_iff_verification_check, éprouvé.
--
-- ⛔ CE QUE LA TABLE N'ENREGISTRE PAS, ET C'EST DÉLIBÉRÉ : le code HTTP observé.
--    Une colonne `observed_status` inviterait à inscrire des 404 et des 403
--    comme des « événements de localisation ». Or un 404 n'établit aucune
--    localisation, et un 403 n'établit RIEN DU TOUT — c'est un refus
--    d'intermédiaire, pas une absence. Ce registre n'enregistre que des
--    localisations ÉTABLIES. Une sonde qui n'a pas rendu 200 ne produit
--    AUCUNE LIGNE. Même discipline que « UNKNOWN n'est pas une valeur
--    stockée » : l'absence de ligne est l'absence d'établissement, et elle se
--    lit STORAGE_LOCATION_UNRESOLVED.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- POINT DE CONCEPTION 3 — DEUX ÉVÉNEMENTS DU MÊME INSTANT, DEUX COMPARTIMENTS
-- ═══════════════════════════════════════════════════════════════════════════
--
-- La question de GPT, posée exactement : « que se passe-t-il si deux événements
-- du même instant désignent deux compartiments différents ? »
--
-- LA RÉPONSE STRUCTURELLE, et elle est la raison d'être de la colonne id :
--
--   L'AUTORITÉ D'ORDRE DE CETTE TABLE N'EST AUCUNE HORLOGE. C'est id, BIGINT
--   GENERATED ALWAYS AS IDENTITY. Deux horodatages peuvent être ÉGAUX ; deux
--   valeurs d'IDENTITY ne le peuvent pas. Deux événements « du même instant »
--   ont donc un ordre TOTAL et non ambigu, et le dernier est max(id).
--
--   Il serait facile de faire semblant de traiter une ambiguïté qui n'existe
--   pas à ce niveau. On ne le fait pas : le même instant N'EST PAS une
--   ambiguïté ici, PARCE QU'ON A CHOISI de ne jamais ordonner par le temps.
--   C'est la garantie, et elle est posée par le DDL.
--
-- MAIS L'AMBIGUÏTÉ EXISTE AILLEURS, ET ELLE EST RÉELLE — côté LECTEUR :
--   le lecteur reçoit un TABLEAU de lignes. Si ce tableau contient deux lignes
--   portant le MÊME id maximal et désignant des compartiments DIFFÉRENTS, la
--   base ne peut pas l'avoir produit (id est PK) : le jeu de résultats est
--   malformé. Prendre la première serait ARBITRER. Le lecteur REFUSE, cause
--   AMBIGUOUS_LATEST. Et un id non ordonnable rend l'ordre lui-même ambigu :
--   ROW_OUT_OF_DOMAIN, jamais une remontée vers une ligne précédente plus
--   pratique.
--
-- ET LA SECONDE MOITIÉ DE LA RÈGLE — « INCOHÉRENCE = FAIL CLOSED » :
--   si le dernier événement gouverné désigne une clé différente de celle que
--   la pièce porte ("EvidenceItem"."r2Key"), deux autorités se contredisent sur
--   l'endroit où regarder. Le lecteur REFUSE, cause KEY_DIVERGENCE. Il ne
--   « préfère » ni le registre ni la colonne : préférer, c'est arbitrer.
--
--   ⚠️ C'est aussi POURQUOI storage_key est dans la table, et pourquoi il n'est
--   PAS contraint à égaler "r2Key" par un CHECK ou un trigger : une migration
--   qui DÉPLACE un objet change sa clé, et un registre qui ne saurait pas
--   l'enregistrer ne serait pas un registre d'historique. La divergence est
--   donc LÉGITIME à écrire, et REFUSÉE à lire tant qu'une autorité n'a pas
--   aussi mis "r2Key" à jour. Le refus est le bon endroit pour cette tension ;
--   un CHECK l'aurait rendue inexprimable, un silence l'aurait rendue invisible.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- CE QUE LA TABLE GARANTIT PAR STRUCTURE
-- ═══════════════════════════════════════════════════════════════════════════
--   1. une ligne vise une pièce qui EXISTE               → FK RESTRICT/RESTRICT
--   2. le vocabulaire des modes est CLOS                 → CHECK énuméré
--   3. VERIFIED_BY_HEAD ⇔ (qui a mesuré, quand)          → CHECK, deux sens
--   4. un compartiment est un nom de bucket VALIDE       → CHECK de forme
--   5. une clé est adressable et non fabriquée           → CHECK de forme
--   6. toute ligne est un acte SIGNÉ et DATÉ             → NOT NULL, sans DEFAULT
--   7. le dernier événement est NON AMBIGU               → id IDENTITY, ordre total
--   8. on n'écrase jamais une ligne                      → triggers (section marquée)

BEGIN;

CREATE TABLE IF NOT EXISTS evidence_storage_location_journal (
  -- L'ORDRE des événements, et la SEULE autorité d'ordre de cette table.
  -- IDENTITY : monotone, jamais réutilisé, jamais fourni par l'appelant.
  -- « La localisation courante » = max(id) par pièce. Les TROUS sont normaux
  -- (un INSERT refusé consomme sa valeur) ; seul l'ORDRE compte.
  -- ⚠️ Aucune horloge n'ordonne cette table. Voir POINT DE CONCEPTION 3.
  id                    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  -- ── La CIBLE : l'identité gouvernée de la PIÈCE, celle qui porte la clé.
  evidence_item_id      TEXT NOT NULL,

  -- ── LE COMPARTIMENT. C'est le fait que cette table existe pour porter, et
  -- qu'aucune colonne de "EvidenceItem" ne porte aujourd'hui.
  -- Forme : règles de nommage R2/S3 — 3 à 63 caractères, minuscules, chiffres,
  -- tirets, ni tiret au début ni à la fin. Le même motif que le CHECK
  -- r2://<bucket>/… du journal de provenance : un seul vocabulaire de bucket
  -- dans le dépôt, pas deux qui divergeront.
  bucket                TEXT NOT NULL
                        CONSTRAINT evidence_storage_location_journal_bucket_check
                        CHECK (bucket ~ '^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$'),

  -- ── LA CLÉ, telle qu'établie PAR CET ÉVÉNEMENT. Pas forcément celle que la
  -- pièce porte aujourd'hui (une migration la change) — voir POINT 3.
  -- Refusés : le vide, un blanc de bord, un caractère de contrôle (jamais
  -- intentionnel, et invisible à la relecture), un `/` initial (une clé S3 qui
  -- commence par `/` est une AUTRE clé que la même sans, et la confusion est
  -- silencieuse).
  -- ADMIS, à dessein : une espace INTERNE. S3 et R2 l'autorisent dans une clé ;
  -- la refuser rendrait certaines pièces réelles injournalisables, et on
  -- n'invente pas une contrainte de stockage qui n'existe pas.
  storage_key           TEXT NOT NULL
                        CONSTRAINT evidence_storage_location_journal_storage_key_check
                        CHECK (
                          storage_key <> ''
                          AND btrim(storage_key) = storage_key
                          AND storage_key !~ '[[:cntrl:]]'
                          AND storage_key !~ '^/'
                        ),

  -- ── COMMENT la localisation a été ÉTABLIE. VOCABULAIRE CLOS — deux valeurs,
  -- et il n'y en aura pas une troisième sans un nouveau DDL.
  --   DECLARED_AT_WRITE : assertion contemporaine de l'écriture, par l'écrivain.
  --   VERIFIED_BY_HEAD  : mesure — le compartiment a été interrogé et a répondu
  --                       que l'objet y est. Exige observed_by + observed_at.
  -- ⛔ Aucune valeur « UNKNOWN », aucune valeur « INFERRED », aucune valeur
  --    « BY_CONVENTION ». Une localisation non établie n'a PAS DE LIGNE : elle
  --    se lit STORAGE_LOCATION_UNRESOLVED à l'absence, exactement comme UNKNOWN
  --    se dérive de l'absence dans le journal de provenance.
  establishment_mode    TEXT NOT NULL
                        CONSTRAINT evidence_storage_location_journal_establishment_mode_check
                        CHECK (establishment_mode IN ('DECLARED_AT_WRITE', 'VERIFIED_BY_HEAD')),

  -- ── QUI établit, et QUAND selon lui. L'AUTORITÉ de l'événement. Toute ligne
  -- est un acte signé. Non vide, sans blanc de bord.
  declared_by           TEXT NOT NULL
                        CONSTRAINT evidence_storage_location_journal_declared_by_check
                        CHECK (declared_by <> '' AND btrim(declared_by) = declared_by),
  -- PAS de DEFAULT, à dessein : un défaut fabriquerait une déclaration
  -- « maintenant » que personne n'a datée.
  declared_at           TIMESTAMPTZ NOT NULL,

  -- ── QUI a MESURÉ, et QUAND. Les deux ensemble, ou aucun. Voir POINT 2.
  observed_by           TEXT
                        CONSTRAINT evidence_storage_location_journal_observed_by_check
                        CHECK (observed_by <> '' AND btrim(observed_by) = observed_by),
  observed_at           TIMESTAMPTZ,

  -- ── L'horloge de la base : quand la ligne a été ÉCRITE. Elle DOCUMENTE,
  -- elle n'ORDONNE PAS (c'est id qui ordonne). Même rôle que dans les deux
  -- tables gouvernées existantes.
  recorded_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- ── COHÉRENCE : VERIFIED_BY_HEAD ⇔ (observed_by, observed_at) tous deux NON
  -- NULS ; sinon tous deux NULS. Les DEUX SENS, et le second n'est pas
  -- décoratif : une DECLARED_AT_WRITE portant une observation serait une ligne
  -- incohérente, pas une déclaration renforcée.
  --
  -- ⚠️ LE NOM EST COURT À DESSEIN. `…_verified_iff_observation_check` faisait
  -- 64 octets et Postgres l'aurait TRONQUÉ silencieusement à 63 — la contrainte
  -- aurait été posée sous un autre nom que celui écrit ici, et le post-check
  -- l'aurait signalée à la fois « ABSENTE » et « INATTENDUE ». Mesuré en rejeu
  -- PGlite le 2026-09-15 ; les dix autres identifiants de ce fichier ont été
  -- vérifiés un par un et tiennent tous sous la limite.
  CONSTRAINT evidence_storage_location_journal_head_iff_observation_check
    CHECK (
      (establishment_mode = 'VERIFIED_BY_HEAD') = (observed_by IS NOT NULL)
      AND (establishment_mode = 'VERIFIED_BY_HEAD') = (observed_at IS NOT NULL)
    ),

  -- ── LA CONTRAINTE : aucune ligne ne vise une pièce qui n'existe pas.
  -- RESTRICT des deux côtés — plus dur que les FK CASCADE existantes vers
  -- "EvidenceItem", et le POINT DE CONCEPTION 1 dit pourquoi.
  CONSTRAINT evidence_storage_location_journal_item_fkey
    FOREIGN KEY (evidence_item_id)
    REFERENCES "EvidenceItem" (id)
    ON UPDATE RESTRICT ON DELETE RESTRICT
);

-- La RELECTURE : « la localisation courante de cette pièce ». Égalité sur la
-- pièce, puis id décroissant. Le même index sert les vérifications de la FK.
CREATE INDEX IF NOT EXISTS evidence_storage_location_journal_item_idx
  ON evidence_storage_location_journal (evidence_item_id, id DESC);

COMMENT ON TABLE evidence_storage_location_journal IS
  'T1-REGISTRE-DE-LOCALISATION (2026-09-15). Registre APPEND-ONLY de la LOCALISATION des octets '
  'd''une piece ("EvidenceItem") et SEULE autorite sur cette localisation. DERNIER EVENEMENT '
  'GOUVERNE = LOCALISATION COURANTE, c''est-a-dire max(id) par evidence_item_id ; aucune horloge '
  'n''ordonne cette table. Un deplacement est une NOUVELLE ligne, jamais un UPDATE. L''absence de '
  'ligne VAUT STORAGE_LOCATION_UNRESOLVED, derive a la lecture — jamais un compartiment par defaut. '
  'AMBIGUITE OU INCOHERENCE = FAIL CLOSED. Vocabulaire CLOS : DECLARED_AT_WRITE | VERIFIED_BY_HEAD, '
  'le second exigeant observed_by + observed_at. Aucun backfill par date, prefixe ou convention : '
  'une cle de stockage decrit un CHEMIN, jamais un COMPARTIMENT.';

COMMENT ON COLUMN evidence_storage_location_journal.storage_key IS
  'La cle TELLE QU''ETABLIE PAR CET EVENEMENT — pas necessairement "EvidenceItem"."r2Key" '
  'd''aujourd''hui : une migration change la cle, et le registre doit pouvoir l''enregistrer. '
  'Une divergence entre les deux est LEGITIME a ecrire et REFUSEE a lire (cause KEY_DIVERGENCE) : '
  'deux autorites qui se contredisent sur l''endroit ou regarder ne se departagent pas, elles '
  'font refuser.';

-- ═══════════════════════════════════════════════════════════════════════════
-- ⚠️ APPEND-ONLY PAR TRIGGER — le motif éprouvé deux fois en production
-- ═══════════════════════════════════════════════════════════════════════════
-- TRIGGER qui LÈVE restrict_violation (23001), ni RULE (échoue en silence) ni
-- REVOKE (l'application est propriétaire de la table). Barrière contre le code
-- et l'erreur ; pas contre le propriétaire, qui peut faire DROP TRIGGER — le
-- post-check rougit alors.
--
-- Une fonction PROPRE à cette table, et non un partage avec les deux autres :
-- le message NOMME la table, et retirer l'une ne désarme pas les autres.

CREATE OR REPLACE FUNCTION evidence_storage_location_journal_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION
    'evidence_storage_location_journal est APPEND-ONLY : % refusé. Une localisation ne se corrige pas, elle est suivie d''un nouvel événement.',
    TG_OP
    USING ERRCODE = 'restrict_violation';
END
$$;

CREATE OR REPLACE TRIGGER evidence_storage_location_journal_no_rewrite
  BEFORE UPDATE OR DELETE ON evidence_storage_location_journal
  FOR EACH ROW EXECUTE FUNCTION evidence_storage_location_journal_append_only();

-- TRUNCATE ne passe pas par les triggers de ligne.
CREATE OR REPLACE TRIGGER evidence_storage_location_journal_no_truncate
  BEFORE TRUNCATE ON evidence_storage_location_journal
  FOR EACH STATEMENT EXECUTE FUNCTION evidence_storage_location_journal_append_only();

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════
-- LA LECTURE CANONIQUE — « la localisation courante »
-- ═══════════════════════════════════════════════════════════════════════════
--
--   SELECT bucket, storage_key, establishment_mode,
--          declared_by, declared_at, observed_by, observed_at, recorded_at
--     FROM evidence_storage_location_journal
--    WHERE evidence_item_id = $1
--    ORDER BY id DESC
--    LIMIT 1;
--   → 0 ligne = STORAGE_LOCATION_UNRESOLVED. Le lecteur ne consulte JAMAIS
--     "EvidenceItem"."r2Key" pour DEVINER un compartiment, ne lit jamais le
--     préfixe de la clé, et ne se rabat jamais sur R2_BUCKET_NAME.
--
-- Un déplacement = INSERT d'une nouvelle ligne (même evidence_item_id, id
-- supérieur, bucket et/ou storage_key nouveaux). L'ancienne reste lisible :
-- ORDER BY id pour l'historique complet. « Retirer une localisation » n'existe
-- pas — on n'efface pas l'endroit où les octets ONT ÉTÉ.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION APRÈS POSE
-- ═══════════════════════════════════════════════════════════════════════════
-- Le POST-CHECK est le SECOND BLOC à coller après le COMMIT ci-dessus :
--   docs/prep/POSTCHECK_STORAGE_LOCATION_JOURNAL_2026-09-15.sql
-- Une ligne par point vérifié, colonne ok = true partout ou la pose n'est pas
-- conforme. Lecture seule.
-- Attendu : 10 colonnes · 1 PK · 6 CHECK · 1 FK · 1 index cible · 2 triggers
-- activés (tgenabled = 'O') · 0 ligne.
-- Le filtre contype <> 'n' est INDISPENSABLE : PG18 expose les NOT NULL dans
-- pg_constraint, PG 17.11 (la production) non — sans lui, le compte de
-- contraintes dépendrait de la version.
