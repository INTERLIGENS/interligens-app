# Hotfix D — KolCrossLink Schema Bug
**Date :** 2026-05-02  
**Branche :** hotfix/kol-crosslink-schema  
**Auteur :** INTERLIGENS / Claude Code

---

## 1. Verdict

**CAS B — NEEDS MIGRATION** → **FIXED**

La table `KolCrossLink` était absente de Neon et du schema Prisma. La fonctionnalité est active en production depuis le lancement de l'event `casefile.ingested`. Tous les appels à `persistCrossLinks()` échouaient silencieusement (le `try/catch` dans `processor.ts` absorbait l'erreur sans bloquer le flux principal).

---

## 2. Cause racine

`crossCaseLinker.ts` ligne 3 contenait le commentaire explicite :  
> `"Persists results in KolCrossLink via raw SQL (table not yet in Prisma schema)."`

La table a été développée sans migration associée. Le code est arrivé en production avant la DB.

**Chemins d'appel actifs :**
- `processor.ts:118` → `findCrossLinks(handle)` + `persistCrossLinks(links)` sur event `casefile.ingested`
- `GET /api/admin/intelligence/cross-links` → `getCrossLinks(handle?)`

**Impact :** aucune erreur visible côté user ou investigateur (le try/catch absorbe). Les cross-links n'étaient jamais persistés. L'endpoint admin renvoyait une 500 si appelé.

---

## 3. Fichiers modifiés

| Fichier | Action |
|---|---|
| `prisma/schema.prod.prisma` | Ajout modèle `KolCrossLink` (12 lignes) |
| `prisma/migrations/20260502_kol_crosslink/migration.sql` | Migration SQL additive (CREATE TABLE IF NOT EXISTS) |
| `src/lib/intelligence/crossCaseLinker.ts` | Mise à jour des commentaires (suppression "not yet in Prisma schema") |
| `src/lib/intelligence/__tests__/crossCaseLinker.test.ts` | Nouveau — 7 tests unitaires |

---

## 4. Migration

**Nécessaire : OUI**

Fichier : `prisma/migrations/20260502_kol_crosslink/migration.sql`

**À appliquer dans Neon SQL Editor (ep-square-band) — ne pas auto-appliquer.**

Contenu :
```sql
CREATE TABLE IF NOT EXISTS "KolCrossLink" (
  "id"           TEXT        NOT NULL,
  "sourceHandle" TEXT        NOT NULL,
  "targetHandle" TEXT        NOT NULL,
  "linkType"     TEXT        NOT NULL,
  "confidence"   TEXT        NOT NULL,
  "evidence"     JSONB       NOT NULL,
  "detectedAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "KolCrossLink_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "KolCrossLink_source_target_type_key"
    UNIQUE ("sourceHandle", "targetHandle", "linkType")
);
CREATE INDEX IF NOT EXISTS "KolCrossLink_sourceHandle_idx" ON "KolCrossLink" ("sourceHandle");
CREATE INDEX IF NOT EXISTS "KolCrossLink_targetHandle_idx" ON "KolCrossLink" ("targetHandle");
```

Migration idempotente (`IF NOT EXISTS`) — sans risque si relancée.

---

## 5. Tests

```
pnpm test src/lib/intelligence/__tests__/crossCaseLinker.test.ts
→ 7 tests passed

pnpm test (suite complète)
→ 175 test files, 1486 tests passed (baseline was 1141, delta = nouveaux tests ajoutés sur d'autres branches)
→ Aucune régression
```

Tests couverts :
- `findCrossLinks("")` → retourne `[]` sans requête DB
- Aucun wallet, aucun token → retourne `[]`
- Wallet partagé → lien `shared_wallet` exact
- Token partagé → lien `shared_token` probable
- Déduplication des liens `shared_token` sur même target
- `persistCrossLinks([])` → no-op, pas d'appel DB
- `persistCrossLinks([l1, l2])` → `$executeRaw` appelé 2 fois

---

## 6. Risques restants

1. **Données historiques perdues** : tous les `casefile.ingested` traités avant la migration n'ont pas de cross-links persistés. Les liens existent potentiellement dans `KolWallet` / `KolTokenInvolvement` mais n'ont jamais été écrits dans `KolCrossLink`. Un backfill manuel est possible mais hors scope de ce hotfix.

2. **Migration non appliquée** : tant que la migration n'est pas exécutée dans Neon, `persistCrossLinks` continue d'échouer silencieusement. La migration doit être appliquée manuellement dans le Neon SQL Editor.

3. **raw SQL fragile** : `persistCrossLinks` et `getCrossLinks` utilisent toujours du raw SQL. Le modèle Prisma existe maintenant — une migration vers `prisma.kolCrossLink.upsert()` serait plus sûre, mais hors scope de ce hotfix minimal.

---

## 7. Prochaine étape recommandée

**Appliquer la migration dans Neon** (5 minutes, copier-coller dans SQL Editor).

Ensuite : **F — IOC Export complet**, qui est le prochain chantier selon la roadmap. Aucune dépendance bloquante trouvée sur KolCrossLink pour IOC Export.

Option post-hotfix (non urgente) :
- Refactoriser `persistCrossLinks` et `getCrossLinks` vers Prisma client natif (supprimer le raw SQL maintenant que le modèle existe)
- Backfill des cross-links historiques via script one-shot
