-- ════════════════════════════════════════════════════════════════════
-- MIGRATION: OSINT Review Audit — piste d'audit de la revue (Sprint B, ADDITIF)
-- ════════════════════════════════════════════════════════════════════
-- STATUT : *** NON APPLIQUÉE *** — fichier de référence uniquement.
--          À lancer manuellement par David dans le Neon SQL Editor
--          (ep-square-band). JAMAIS via prisma db push.
--
-- Pourquoi : le Sprint B ajoute des actions de revue 1-clic (RESOLVE / REJECT /
-- ESCALATE) sur le backlog OSINT. Chaque action DOIT écrire une trace non
-- répudiable : qui, quoi, quand, état AVANT, état APRÈS. Aucune table existante
-- ne porte ce journal (CandidateStatusLog est spécifique aux social_post_
-- candidates ; JobRunLog aux runs de cron). Cette table additive comble le trou.
--
-- Elle sert AUSSI de marqueur d'escalade : un item ayant une ligne
-- action='ESCALATE' est exclu de la file de revue standard (loadReviewQueue).
-- C'est ce qui permet à ESCALATE de « sortir un item de la file » SANS
-- introduire le moindre nouveau statut (doctrine : ne réinvente AUCUN statut).
--
-- Ne touche, ne supprime, ne renomme RIEN de l'existant.
-- Tant que NON appliquée : NE PAS l'ajouter à prisma/schema.prod.prisma
-- (anti-drift). Les routes /api/admin/osint/review/* font un préflight 412 si
-- la table est absente.
--
-- Baseline (contrôle post-apply) : table absente avant migration.
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "OsintReviewAudit" (
  "id"         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,

  -- Item ciblé (cf. ReviewItemType : 'submission' | 'link' | 'signal')
  "itemType"   TEXT NOT NULL,
  "itemId"     TEXT NOT NULL,

  -- Action (cf. ReviewAction : 'RESOLVE' | 'REJECT' | 'ESCALATE')
  "action"     TEXT NOT NULL,

  -- Qui / pourquoi
  "actor"      TEXT NOT NULL DEFAULT 'admin',
  "reason"     TEXT,

  -- Avant / après (snapshots JSON sérialisables, pour l'audit non répudiable)
  "beforeJson" JSONB,
  "afterJson"  JSONB,

  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Lookup par item (état/escalade) et par action (file standard, dashboard).
CREATE INDEX IF NOT EXISTS "OsintReviewAudit_item_idx"   ON "OsintReviewAudit" ("itemType", "itemId");
CREATE INDEX IF NOT EXISTS "OsintReviewAudit_action_idx" ON "OsintReviewAudit" ("action");
CREATE INDEX IF NOT EXISTS "OsintReviewAudit_created_idx" ON "OsintReviewAudit" ("createdAt");

-- ════════════════════════════════════════════════════════════════════
-- FIN — une seule table additive, aucune colonne sur l'existant, aucune
-- suppression. La revue ne publie RIEN : isPublic / visibility='public' /
-- reviewStatus='approved_public' ne sont jamais écrits par ce sprint.
-- ════════════════════════════════════════════════════════════════════
