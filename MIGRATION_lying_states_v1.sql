-- =============================================================================
-- INTERLIGENS — MIGRATION_lying_states_v1.sql
-- À exécuter dans le SQL Editor Neon sur ep-square-band. ADDITIF uniquement.
-- Aucun DROP, aucune suppression de ligne, aucune colonne retirée.
-- =============================================================================
--
-- Contexte : trois états annonçaient une chose et en faisaient une autre.
-- Le code corrigé est dans la PR « fix(states) ». Ce fichier porte les deux
-- gestes DB que le code ne peut pas faire seul.
--
-- =============================================================================
-- 1. OsintSubmission.processingAttempts — reprise bornée du retail
-- =============================================================================
--
-- ERROR_RETRYABLE était posé par process-queue sur toute erreur non-JSON
-- (timeout, 429, coupure réseau) mais listQueuedRetail ne relisait que QUEUED :
-- aucune reprise n'existait. Le statut annonçait une reprise que rien
-- n'implémentait.
--
-- Le compteur borne cette reprise à 3 tentatives. Sans plafond, une image qui
-- fait systématiquement échouer la vision serait re-soumise à chaque passage du
-- cron et brûlerait le budget vision quotidien en boucle.
--
-- Le code REFUSE de traiter tant que cette colonne n'existe pas : preflightRetail
-- renvoie « processingAttempts missing » et la route répond 412. Aucun risque de
-- boucle si la migration n'est pas appliquée.
--
-- Impact : table à 0 ligne au 2026-08-14 (la porte publique retail n'a jamais
-- été ouverte). DEFAULT 0 + NOT NULL, donc pas de réécriture de tuples.

ALTER TABLE "OsintSubmission"
  ADD COLUMN IF NOT EXISTS "processingAttempts" INTEGER NOT NULL DEFAULT 0;

-- Vérification :
--   SELECT column_name, data_type, column_default, is_nullable
--     FROM information_schema.columns
--    WHERE table_name = 'OsintSubmission' AND column_name = 'processingAttempts';
--   -- attendu : integer | 0 | NO


-- =============================================================================
-- 2. Réparation de la file de revue d'identité
-- =============================================================================
--
-- processEvent traitait `identity.review_required` dans un `case` vide, puis
-- l'update de fin de switch le passait `processed` — sans qu'aucune décision
-- n'ait été prise. Or /api/admin/identity/queue ne liste que les `pending` :
-- le cron quotidien vidait la file avant qu'un humain puisse la voir.
--
-- État au 2026-08-14 : 160 événements, du 2026-04-25 au 2026-07-22, TOUS
-- `processed`, AUCUN `pending`. Le compteur alertIdentityBacklog (seuil 20)
-- surveillait un chiffre structurellement bloqué à zéro.
--
-- COMBIEN ONT ÉTÉ RÉELLEMENT ARBITRÉS ? Zéro.
-- /api/admin/identity/resolve écrit lui aussi `processed`, donc le statut seul
-- ne distingue pas « arbitré par un humain » de « drainé par le cron ». On
-- tranche par la trace matérielle : l'action `confirm_link` crée un KolWallet.
--
--   SELECT count(*) FILTER (WHERE EXISTS (
--            SELECT 1 FROM "KolWallet" w WHERE w.address = e.payload->>'address'))
--     FROM "DomainEvent" e WHERE e.type = 'identity.review_required';
--   -- résultat mesuré le 2026-08-14 : 0 sur 160.
--
-- Aucun de ces 160 événements n'a produit de lien wallet↔KOL. Les remettre en
-- `pending` restitue donc une file de revue, ça n'en réanime pas une déjà traitée.
--
-- RELANCE ce compte AVANT d'exécuter : si le résultat n'est plus 0, ne lance pas
-- l'UPDATE tel quel — ajoute la clause NOT EXISTS pour épargner les arbitrés.
--
-- Réversible : la valeur d'origine est ('processed', processedAt non nul).

UPDATE "DomainEvent"
   SET status = 'pending',
       "processedAt" = NULL
 WHERE type = 'identity.review_required'
   AND status = 'processed'
   AND NOT EXISTS (
         SELECT 1 FROM "KolWallet" w WHERE w.address = "DomainEvent".payload->>'address'
       );

-- Vérification :
--   SELECT status, count(*) FROM "DomainEvent"
--    WHERE type = 'identity.review_required' GROUP BY 1;
--   -- attendu : pending | 160
--
-- Après application, /api/admin/identity/queue affichera 160 lignes et
-- alertIdentityBacklog franchira son seuil de 20 — c'est le comportement
-- correct : le backlog existait, il était seulement invisible.
--
-- Le cron process-events ne les re-videra plus : il exclut désormais
-- HUMAN_REVIEW_TYPES de son batch (sinon 160 lignes affameraient un batch de 50).

-- =============================================================================
-- DETTE CONNUE, NON TRAITÉE ICI
-- =============================================================================
-- /api/admin/identity/resolve écrit `processed`, le même statut que le
-- traitement automatique. Après arbitrage humain, l'information « qui a
-- tranché » n'existe nulle part. Un statut distinct ('resolved_by_human') ou une
-- ligne d'audit rendrait le prochain diagnostic immédiat au lieu de dépendre
-- d'une jointure sur KolWallet. Hors périmètre : la route n'est pas dans les
-- exemptions guard de ce chantier.
