-- ═══════════════════════════════════════════════════════════════════════════
-- S3 · ÉTAPE 0 — le type. À EXÉCUTER EN PREMIER, une seule fois.
--
-- Neon SQL Editor UNIQUEMENT. Jamais `prisma migrate` : les deux schemas
-- portent le verrou A9 et s'arrêtent sur P1012 avant tout accès réseau.
--
-- Les 5 valeurs canoniques viennent de src/lib/data-nature/nature.ts et ne
-- doivent PAS diverger de lui. UNCLASSIFIED est le transitoire : le code le
-- tient à part du type canonique pour qu'il ne puisse pas être produit par
-- inadvertance, mais la BASE doit pouvoir le porter — sans lui, il faudrait
-- classer 1 070 EvidenceItem à la main AVANT de poser la moindre colonne.
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DataNature') THEN
    CREATE TYPE "DataNature" AS ENUM (
      'PRIMARY_OBSERVATION',
      'THIRD_PARTY_DATA',
      'INFERENCE',
      'ESTIMATE',
      'EDITORIAL_ASSERTION',
      'UNCLASSIFIED'
    );
  END IF;
END $$;

-- ─── VÉRIFICATION — doit rendre 6 lignes, dans cet ordre ───────────────────
SELECT e.enumsortorder AS ordre, e.enumlabel AS valeur
  FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
 WHERE t.typname = 'DataNature'
 ORDER BY e.enumsortorder;

-- ─── ROLLBACK (seulement si AUCUNE colonne ne l'utilise encore) ────────────
-- DROP TYPE "DataNature";
