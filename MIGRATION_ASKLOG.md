# AskLog — Audit Trail natif ASK INTERLIGENS

Branch: `feat/case-intelligence-beta`
Date: 2026-04-10

## Objectif

Journaliser chaque interaction ASK INTERLIGENS de façon exploitable en interne pour : crédibilité produit, review investigateur/BA, debugging, traçabilité, base future pour UI de provenance / confidence / mode.

Aucun changement de comportement côté user : le write path est isolé (`void` async + try/catch), non-bloquant.

---

## Fichiers créés / modifiés

### Créés
- `src/lib/ask/askLog.ts` — helper de write + classification (answerType / mode / confidenceTier) + capture sources.
- `src/app/admin/ask-logs/page.tsx` — surface admin minimale (100 derniers logs, server component).
- `MIGRATION_ASKLOG.md` — ce fichier.

### Modifiés
- `prisma/schema.prod.prisma` — ajout du modèle `AskLog` (mapped `ask_logs`).
- `src/app/api/scan/ask/route.ts` — branchement write path après la réponse Claude, capture du grounding context + latency.

### NON modifié — justification
- `src/app/api/mobile/v1/ask/route.ts` : ce fichier **n'existe pas** sur la branche `feat/case-intelligence-beta`. Il a été introduit sur `main` au commit `4c18a5a` (beta: progress 09/04/2026) mais n'est pas encore mergé sur la branche de travail. Quand la branche sera rebasée/mergée, il faudra appliquer le même patch à ce fichier (voir section "Port mobile route" ci-dessous).
- `src/app/api/scan/ask/route.ts` — **logique ASK existante intouchée** : prompt, classifier implicite, rate limiting, KOL grounding, streaming — tout est conservé à l'identique. Le seul ajout est un `writeAskLog()` détaché après `stripMarkdown(text)`.

---

## Décisions d'implémentation (ASKLOG)

### 1. Payload entrant ≠ brief

Le brief mentionnait `{ sessionId, message, scanId }` comme payload entrant de `src/app/api/beta/ask/route.ts`. **Réalité du repo** :
- La route ASK vit à `src/app/api/scan/ask/route.ts` (pas `beta/ask`).
- Le payload est `{ summary, question, locale, history, offeredBranch, activeTopic }`.
- Il n'y a **ni sessionId ni scanId explicites**.

**Décision** : j'ai adapté à la réalité :
- `sessionId` → SHA-256(ip)[0..24] comme proxy stable, nullable si IP inconnue. À remplacer par `InvestigatorSession.id` quand ASK sera ouvert aux investigateurs authentifiés.
- `scanId` → `summary.address` (l'adresse scannée identifie le contexte scan).
- Ajout d'un champ `source` ("web" | "mobile") pour distinguer les origines sans casser l'existant.

### 2. Classifier — brief vs réalité

Le brief mentionnait un classifier 3-buckets actuel (`deterministic | constrained_generation | refusal`). **Réalité** : aucun classifier n'existe dans la route ASK — elle appelle Claude et retourne la réponse, point.

**Décision** : dériver `answerType` en aval par heuristiques simples et explicites dans `askLog.ts` :
- `refusal` : match de patterns connus (price prediction refusal, "je n'ai pas ça ici", "this scan doesn't cover", etc.).
- `deterministic` : réponse contient un chiffre dur lié aux données de scan (%, $, K, M, jours, wallets, tx).
- `constrained_generation` : défaut (Claude a généré depuis le grounding context sans chiffre dur ni refus).

Heuristiques codées, explicables, zéro pseudo-IA floue. Si plus tard un classifier déterministe est branché en amont de Claude, `classifyAnswer()` pourra être remplacé par un lookup direct.

### 3. Mode (deterministic | exploratory)

- `deterministic` : answerType === "deterministic", ou absence de marqueurs exploratoires.
- `exploratory` : présence de marqueurs linguistiques d'incertitude (`probablement`, `peut-être`, `semble`, `probably`, `might`, `appears to`, etc.).

### 4. confidenceTier (high | medium | low)

Logique en cascade :
- `refusal` → `low`.
- `deterministic` + ≥ 2 sources → `high`.
- `exploratory` → `low`.
- ≥ 2 sources → `medium`.
- ≥ 1 source → `medium`.
- 0 source → `low`.

### 5. sourcesUsed — format exploitable

Stocké en `Json` comme array de `{ type, key, present, count? }`. Types capturés :
- `analysis_summary` (toujours si `summary` présent)
- `signal_cards` (si `summary.topReasons` non vide)
- `evidence_items` (si `summary.evidence` non vide)
- `timeline_events` (si `summary.timeline` non vide)
- `kol_reference` (si `kolContext` présent)
- `linked_actors` (si cluster ou coordination signals détectés dans kolContext)
- `laundry_trail_signals` (si "Laundry trail" dans kolContext)
- `case_references` (si `relatedCases` non vide ou "Proceeds:" dans kolContext)
- `intel_vault_hits` (si `relatedLaunches` non vide)

But : pouvoir dire *"cette réponse s'appuie sur ces blocs-là"*. Extensible sans migration (Json).

### 6. Fail soft — non-négociable

`writeAskLog()` est **void, détaché, try/catch isolé**. Jamais `await`. Le retour user est envoyé *avant* que le log ne commence à s'écrire. Si la DB est down, si Prisma throw, si Json est mal formé : la réponse ASK n'est **jamais** impactée. L'erreur est `console.error`-ée et c'est tout.

### 7. Surface admin

Route `/admin/ask-logs` — server component, protégée par le middleware `/admin/*` existant (HTTP Basic + `requireAdmin()`). 100 dernières entrées, triées par date décroissante. Colonnes : timestamp, scan (truncated), question, answer (truncated), answerType, mode, confidenceTier, sourceCount, latency, locale.

Pas de filtre, pas de pagination, pas de search : c'est une inspection brute pour review interne, pas un dashboard analytics. Si besoin plus tard, ajouter une API route dédiée.

### 8. Extensibilité sans migration

- `sourcesUsed` et `metadata` sont `Json` → n'importe quelle structure peut y être ajoutée sans `ALTER TABLE`.
- `source` défaut `"web"` → permet de distinguer mobile/web/future-voice sans rupture.
- Index sur `createdAt`, `scanId`, `sessionId`, `answerType` → queries typiques (recent, par scan, par session, par type) restent rapides.

---

## SQL de migration (à appliquer manuellement sur Neon ep-square-band via SQL Editor)

```sql
-- ASK INTERLIGENS — Audit Trail
-- Target: Neon ep-square-band (Frankfurt, pgbouncer 6543)
-- Apply via Neon SQL Editor ONLY. No prisma db push.

CREATE TABLE IF NOT EXISTS "ask_logs" (
  "id"              TEXT PRIMARY KEY,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sessionId"       TEXT,
  "scanId"          TEXT,
  "locale"          TEXT NOT NULL DEFAULT 'en',
  "source"          TEXT NOT NULL DEFAULT 'web',
  "userQuestion"    TEXT NOT NULL,
  "assistantAnswer" TEXT NOT NULL,
  "answerType"      TEXT NOT NULL DEFAULT 'constrained_generation',
  "mode"            TEXT NOT NULL DEFAULT 'deterministic',
  "confidenceTier"  TEXT NOT NULL DEFAULT 'medium',
  "sourcesUsed"     JSONB NOT NULL DEFAULT '[]'::jsonb,
  "sourceCount"     INTEGER NOT NULL DEFAULT 0,
  "modelName"       TEXT,
  "latencyMs"       INTEGER,
  "metadata"        JSONB
);

CREATE INDEX IF NOT EXISTS "ask_logs_createdAt_idx"  ON "ask_logs" ("createdAt");
CREATE INDEX IF NOT EXISTS "ask_logs_scanId_idx"     ON "ask_logs" ("scanId");
CREATE INDEX IF NOT EXISTS "ask_logs_sessionId_idx"  ON "ask_logs" ("sessionId");
CREATE INDEX IF NOT EXISTS "ask_logs_answerType_idx" ON "ask_logs" ("answerType");
```

### Rollback (si jamais)

```sql
DROP INDEX IF EXISTS "ask_logs_answerType_idx";
DROP INDEX IF EXISTS "ask_logs_sessionId_idx";
DROP INDEX IF EXISTS "ask_logs_scanId_idx";
DROP INDEX IF EXISTS "ask_logs_createdAt_idx";
DROP TABLE IF EXISTS "ask_logs";
```

---

## Ordre d'opérations pour la mise en prod

1. Mergez / rebasez `feat/case-intelligence-beta` selon votre workflow habituel.
2. Ouvrez Neon SQL Editor sur la base `ep-square-band` (Frankfurt).
3. Copiez-collez le bloc `CREATE TABLE` + `CREATE INDEX` ci-dessus. Exécutez.
4. Vérifiez : `SELECT COUNT(*) FROM ask_logs;` → doit retourner `0`.
5. Déployez le code : `npx vercel --prod`.
6. Faites un scan + une interaction ASK sur prod.
7. Allez sur `/admin/ask-logs` → la ligne doit apparaître.
8. Vérifiez `answerType`, `confidenceTier`, `sourceCount`, `latencyMs` sont cohérents.

---

## Port mobile route (quand `main` sera mergé dans `feat/case-intelligence-beta`)

Le fichier `src/app/api/mobile/v1/ask/route.ts` existe sur `main`. Pour appliquer le même log path quand il arrivera sur cette branche :

1. Ajouter en haut du fichier :
   ```ts
   import { buildGroundingContext, type ScanGroundingContext } from "@/lib/ask/groundingContext";
   import { writeAskLog } from "@/lib/ask/askLog";
   import { createHash } from "crypto";
   ```
2. Stocker le `gCtx` dans une variable `groundingCtx: ScanGroundingContext | null`.
3. Mesurer la latency autour de `client.messages.create()` avec `Date.now()`.
4. Après `stripMarkdown(text)`, appeler :
   ```ts
   writeAskLog({
     sessionId: ip !== "unknown" ? createHash("sha256").update(ip).digest("hex").slice(0, 24) : null,
     scanId: address ?? null,
     locale,
     source: "mobile",
     userQuestion: sanitized,
     assistantAnswer: finalAnswer,
     summary,
     kolContext,
     groundingContext: groundingCtx,
     modelName: "claude-sonnet-4-5",
     latencyMs,
     metadata: { scanContext: ctx, historyLength: cleanHistory.length },
   });
   ```

---

## Comment lire les logs sans UI

```sql
-- Derniers logs
SELECT "createdAt", "scanId", "answerType", "mode", "confidenceTier",
       "sourceCount", "latencyMs", LEFT("userQuestion", 80) AS q
FROM "ask_logs"
ORDER BY "createdAt" DESC
LIMIT 50;

-- Distribution des answerType sur 24h
SELECT "answerType", COUNT(*)
FROM "ask_logs"
WHERE "createdAt" > NOW() - INTERVAL '24 hours'
GROUP BY "answerType";

-- Latency p50 / p95 sur 24h
SELECT
  PERCENTILE_CONT(0.5)  WITHIN GROUP (ORDER BY "latencyMs") AS p50,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY "latencyMs") AS p95
FROM "ask_logs"
WHERE "createdAt" > NOW() - INTERVAL '24 hours'
  AND "latencyMs" IS NOT NULL;

-- Sessions avec le plus de questions
SELECT "sessionId", COUNT(*) AS n
FROM "ask_logs"
WHERE "sessionId" IS NOT NULL
GROUP BY "sessionId"
ORDER BY n DESC
LIMIT 20;

-- Scans ayant généré le plus d'interactions ASK
SELECT "scanId", COUNT(*) AS n
FROM "ask_logs"
WHERE "scanId" IS NOT NULL
GROUP BY "scanId"
ORDER BY n DESC
LIMIT 20;

-- Refusals récents (pour affiner le prompt si besoin)
SELECT "createdAt", "locale", "userQuestion", LEFT("assistantAnswer", 200)
FROM "ask_logs"
WHERE "answerType" = 'refusal'
ORDER BY "createdAt" DESC
LIMIT 30;
```

---

## Garanties

- **Zéro régression** sur la logique ASK : prompt, rate limit, grounding context, historique, streaming — tout est intact.
- **Zéro blocage** sur la réponse user : write path détaché, try/catch isolé, aucun `await` en chemin critique.
- **Zéro dépendance nouvelle** : Prisma + crypto (stdlib) seulement.
- **Extensible** : `sourcesUsed` et `metadata` en Json → évolutions sans migration.
- **Schéma propre** : types stricts, mapped `ask_logs`, index sur colonnes de query typiques.
- **Admin viewer** sous `/admin/ask-logs`, protégé par le middleware existant.
