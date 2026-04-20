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
| 3 | Graph editor activation | voir phase 3 |
| 4 | Dead code + dashboard link | à faire |
| 5 | Placeholder purge sur case tabs | à faire |
| 6 | Core tabs stabilisation | à faire |
| 7 | Audit log + rate limiting | à faire |
| 8 | Validation + deploy | à faire |
