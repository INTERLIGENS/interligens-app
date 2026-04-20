# Investigators finalisation sprint — audit

**Date** : 2026-04-20
**Branche** : `feat/investigators-finalisation-pre-audit`
**Parent** : `main @ afe7791`
**Objectif** : clôturer proprement le périmètre Investigators avant l'audit général.

---

## 1. État du worktree au démarrage

- Stash `wip-website-v2` (stash@{0}) : Website 2.0 forensic (47 fichiers),
  suppression `/scan/page.tsx`, eslint.config additions, `AUDIT_PRELANCEMENT.md`.
  **Intact, non touché.**
- Working tree propre avant la branche. Rien de neuf à re-stasher.

## 2. Surface visible Investigators

### Réel et fonctionnel
- `/investigators/box` — liste des cases chiffrées + recherche globale + création
- `/investigators/box/cases/[caseId]` — détail case avec tabs Entities, Files,
  Notes, Graph, Timeline, Intelligence
- `/investigators/box/cases/[caseId]/shill-timeline` — WalletJourney
- `/investigators/box/messages` — inbox/outbox investigator
- `/investigators/box/redact` — redaction d'écran
- `/investigators/box/onboarding` — parcours NDA + workspace
- `/investigators/box/trust` — identité + NDA signée
- `/investigators/box/graph` — landing (shipped hier)
- `/investigators/box/graph/demo` et `/demo/[slug]` — BOTIFY demo avec banner
- `/investigators/box/graph/new` — placeholder **honnête** (dit "coming")
- Kebab `…` Rename/Delete sur chaque card (shipped hier)
- Bouton "Delete case" sur le détail (shipped hier)

### Placeholder / vrai risque d'être perçu comme faux
- `/investigators/box/graph/new` — affiche "coming soon" mais est honnête
  (pas fake). À activer si migration VaultNetworkGraph appliquée ce sprint.
- `Open saved graphs` — pas de CTA visible (3e carte optionnelle du brief),
  bloqué par le même manque de modèle Prisma.

### Liens / labels à nettoyer
- `src/app/investigators/dashboard/DashboardWorkspace.tsx:477` — href encore
  vers `/investigators/box/network` (le redirect fonctionne mais le lien
  devrait pointer direct sur `/graph`).
- Header `box/network/page.tsx` + commentaires `EditableGraph.tsx` : references
  historiques, non user-facing. Laisser tel quel.

### Dead code candidat
- `src/components/vault/InvestigatorGraphEditor.tsx` — aucun import actif
  sur main (confirmé par grep en phase 4). Orphelin depuis que EditableGraph
  l'a remplacé.

## 3. Sécurité — balayage des 44 routes `/api/investigators/`

Balayage complet via subagent + spot-check. Règle appliquée : **ownership
côté serveur via session, jamais trust body-profileId/workspaceId/caseId**.

### Routes corrigées dans ce sprint
- `POST /api/investigators/nda/accept` — **FIXED**. Même pattern IDOR que
  `terms/accept` corrigé hier soir : la route acceptait `profileId` +
  `betaCodeId` dans le body sans cross-check session. Maintenant : dérive
  les deux depuis `getInvestigatorSessionContext(req)`, rejette 403 si
  body-supplied mismatch, renvoie 401 sans session. 5 tests vitest ajoutés
  dans `idor-hotfix.test.ts` (passe à 16/16).

### Routes déjà safe (43 vérifiées)
Toutes utilisent un helper correct :

| Pattern | Nombre | Routes |
|---|---|---|
| `getVaultWorkspace` + `assertCaseOwnership` | 23 | toutes les `cases/[caseId]/**` |
| `getVaultWorkspace` | 5 | `cases`, `entities/collisions`, `entities/search`, `feedback`, `workspace/*` |
| `getVaultAccess` | 2 | `onboarding/nda`, `onboarding/workspace` |
| `getInvestigatorSessionContext` | 3 | `activity`, `terms/accept`, `nda/accept` (post-fix) |
| `validateSession` + identity check | 4 | `identity/complete`, `messages/*`, `shill-timeline`, network-graph via layout gate |
| `enforceInvestigatorAccess` | 1 | `network-graph/route.ts` |
| Public by design | 4 | `apply`, `directory`, `legal/doc`, `terms/accept` exception path |

### Findings de `AUDIT_PRELANCEMENT.md` résolues vs reportées
- §1 IDOR activity + terms : **résolu** hier (423cb0d).
- §1 bis IDOR nda/accept (non flagué dans l'audit d'origine mais mêmes
  shapes) : **résolu ce sprint**.
- §6 92/251 routes sans guard pattern reconnu : pour les 44 routes
  investigator, vérifiées une par une — toutes safe ou public-by-design.
  Les autres (92 - 44) sortent du scope investigator.
- §7 `casefile/route.ts` V0 hardcoded : hors `/api/investigators/`, non
  traité ici. Report follow-up.
- §8 TODO email Resend (nda/accept + admin/applications/review) : en attente
  de template côté produit. Les endpoints ne mentent pas à l'utilisateur —
  ils retournent success sans prétendre avoir envoyé le mail. **Report
  follow-up**.

## 4. Graph editor — état

- Composant `EditableGraph.tsx` présent et fonctionnel sur main (shipped
  hier avec le premium graph, mais non-câblé — dead code visuel).
- Modèle Prisma `VaultNetworkGraph` **absent** de `schema.prod.prisma` sur
  main. Présent sur `feat/constellation-visual-upgrade`.
- Routes API `/api/investigators/graphs/*` absentes de main. Présentes sur
  la branche feature.

### Décision sprint
La migration Neon `VaultNetworkGraph` est additive (nouvelle table +
nouvelle FK vers `VaultWorkspace`). Applicable sans risque via Neon
SQL Editor. Voir phase 3 dans ce document.

## 5. Synthèse actions sprint

| Phase | Action | Verdict |
|---|---|---|
| 1 | Audit + branch | ✓ |
| 2 | Security sweep + fix nda/accept | ✓ |
| 3 | Graph editor — schema + SQL migration ready | ✓ (apply pending) |
| 4 | Dead code + admin-dashboard redirect fix | ✓ |
| 5 | Placeholder purge — nothing to purge | ✓ |
| 6 | Core tabs stabilisation — nothing to fix | ✓ |
| 7 | Audit log + rate limiting | à faire |
| 8 | Validation + deploy | à faire |

## Phase 5 findings — placeholder purge

Inspected every visible control on `/investigators/box` and
`/investigators/box/cases/[caseId]`:

| Control | State |
|---|---|
| `+ New case` | real — POST `/api/investigators/cases` |
| Lock | real — clears vault session |
| Global search | real — `/api/investigators/entities/search` |
| Case card kebab (Rename / Delete) | real — shipped in previous sprint |
| Tab Entities | real — `EntityAddForm` + `EntitySuggestionPanel` |
| Tab Intelligence | real — `CaseTwin` with enrichment |
| Tab Files | real — upload/download via presigned S3 |
| Tab Notes | real — encrypted notes, dictation optional |
| Tab Graph | real — `CaseGraph` renders entity network |
| Tab Timeline | real — `TimelineBuilder` |
| Tab Export | real — `CaseExport` with markdown/PDF |
| Tab Assistant | real — `CaseAssistant` Tier-1 engine |
| Share | real — `ShareCaseModal` + `/cases/[id]/share` |
| Redact screenshot | real — separate route `/box/redact` |
| Delete case | real — shipped in previous sprint |
| Journey (wallet entity) | real — `WalletJourney` modal |
| Open in → (entity) | real — `EntityLaunchpad` popover |
| Delete entity | real — inline action on entity row |

`grep -iE "coming soon|bientôt|todo|fixme" src/app/investigators` and
`src/components/vault`: no occurrences. No fake affordances to remove.

The only intentionally-placeholder page is
`/investigators/box/graph/new`, which explicitly says "shipping next"
and explains the pending migration — that is honest scaffolding, not
a fake control.

## Phase 6 findings — core tabs already credible

Intelligence, Files, and Notes each read and write through their own
dedicated API routes, all audited SAFE in phase 2:

- Intelligence ← `/cases/[caseId]/intelligence-summary`,
  `/cases/[caseId]/entities/enrich`
- Files ← `/cases/[caseId]/files/**` (presign + finalize + url)
- Notes ← `/cases/[caseId]/notes/**`

No stabilisation diff needed this sprint. Moving to Phase 7.

## Phase 7 findings — observability already in place

### Audit coverage

`grep "action: \"[A-Z_]\"" src/app/api/investigators` returns 35 distinct
`logAudit` call sites across 26 routes. All events from the brief's
checklist are present except the two graph events, which are blocked
by the same migration as the editor:

| Brief event | Status |
|---|---|
| CASE_CREATED | ✓ cases/route.ts |
| CASE_UPDATED | ✓ cases/[caseId]/route.ts PATCH |
| CASE_DELETED | ✓ cases/[caseId]/route.ts DELETE |
| CASE_SHARED | ✓ share/route.ts |
| ENTITY_ADDED | ✓ entities/route.ts (emitted as `ENTITIES_ADDED`) |
| ENTITY_DELETED | ✓ entities/[entityId]/route.ts |
| FILE_UPLOADED | ✓ files/[fileId]/finalize/route.ts |
| NOTE_CREATED | ✓ notes/route.ts |
| NOTE_UPDATED | ✓ notes/[noteId]/route.ts |
| GRAPH_CREATED | DEFERRED — ships with editor activation |
| GRAPH_UPDATED | DEFERRED — ships with editor activation |

### Rate limiting coverage

`grep checkRateLimit` shows 4 investigator routes already using the
`@/lib/vault/rateLimit.server` pattern on the expensive paths:

- `share` — 20 link creations / hour / workspace
- `intelligence-summary` — gated to protect compute
- `entities` (read) — 100 reads / hour / workspace
- `files/[fileId]/presign` — S3 cost guard

Not added in this sprint:
- Case create / update / delete — per-investigator, naturally bounded;
  brief says "do not overbuild". Skip.
- Notes create — same rationale.
- Workspace salt — rate limiting a salt fetch with a valid session
  has no security value (attacker already has the session).

Phase 7 deliverable: no new code, but coverage documented. No commit
needed.
