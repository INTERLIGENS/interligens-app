# CLAUDE.md — OFFLINE MODE v2
# Période : 1er juin 2026 → 27 juillet 2026
# Validé par GPT (architecte) le 20 mai 2026

## CONTEXTE

INTERLIGENS est en beta privée avec enquêteurs en cours de test sur `main`.
Toute modification visible sur la surface enquêteur = risque de rupture de confiance.
Tu (Claude Code) travailles en autonomie pendant l'absence de David, mais sous contrat strict.

Validation humaine temps réel = indisponible.

---

## LES 18 INTERDITS ABSOLUS

### Deploy / Merge / Branches
1. ❌ JAMAIS `npx vercel --prod` ni aucun deploy production
2. ❌ JAMAIS merge sur `main` (PR draft uniquement, branch protection active)
3. ❌ JAMAIS ouvrir plus de 2 PR draft offline actives en parallèle

### Surfaces prod intouchables
4. ❌ JAMAIS toucher aux fichiers/routes des casefiles publiés :
   BOTIFY, RAVE, GHOST, VINE, SOLAXY (mints, claims, routes, pages, 8 claims CONFIRMED BOTIFY)
5. ❌ JAMAIS modifier ces modules core :
   - `src/lib/scoring/`
   - `src/lib/tigerscore/`
   - `src/app/api/partner/` (Partner API v1)
   - `src/app/api/mobile/v1/` (iOS endpoints)
   - `src/lib/watcher/` (Watcher V2 prod)
   - `src/lib/partner/`
   - `src/lib/mobile/`
   - `src/lib/pdf/`
   - `src/lib/evidence/`
   - `src/lib/kol/`
   - `RetailVerdictBanner` (composant)
   - `src/lib/auth/`, `src/lib/rate-limit/`, `src/lib/security/`, `src/lib/turnstile/`
   - `src/middleware/`, `middleware.ts`, `instrumentation.ts`

### Composants partagés
6. ❌ JAMAIS modifier `src/components/**` partagés. Les composants offline vivent dans `src/offline/components/`
7. ❌ JAMAIS modifier `src/lib/**` partagé sauf dossier explicitement autorisé dans `.cc-allowed-paths`

### Config / Build / Deps
8. ❌ JAMAIS modifier `package.json`, lockfiles, configs build/TS/test/lint sans validation humaine
9. ❌ JAMAIS ajouter de dépendance npm
10. ❌ JAMAIS modifier `.github/**`, Vercel config (`vercel.json`, `.vercel/`)
11. ❌ JAMAIS modifier `.gitignore`

### Feature flags / DB / Env
12. ❌ JAMAIS activer un feature flag (tous restent OFF, David active au retour)
13. ❌ JAMAIS toucher à la DB prod (pas de migration, pas de `prisma db push`, pas de SQL prod)
14. ❌ JAMAIS modifier `prisma/`, `migrations/`, `src/lib/db/`, `src/server/db/`
15. ❌ JAMAIS toucher aux env vars, secrets, clés API
16. ❌ JAMAIS utiliser une clé API réelle dans un test, script, exemple ou fixture

### Runtime / Side effects
17. ❌ JAMAIS lancer de test avec réseau réel ou API payante (mocks obligatoires, `OFFLINE_MODE=1`)
18. ❌ JAMAIS créer ou modifier cron job, webhook actif, worker, scheduler

---

## LES 12 OBLIGATIONS

1. ✅ Une branche dédiée par feature, format : `feat/cc-offline-XX-[nom-court]`
   (numérotée pour ordre : 01, 02, 03...)
2. ✅ Commits atomiques, format : `feat(offline): ...` ou `chore(offline): ...`
3. ✅ `npm run typecheck` + `npm run test` verts AVANT push
4. ✅ `npm run guard:offline` doit passer AVANT push (équivalent local : `bash scripts/guard-offline.sh`)
5. ✅ PR draft avec checklist OFFLINE MODE complète (template ci-dessous)
6. ✅ Toute PR doit inclure `git diff --stat` et liste des fichiers modifiés
7. ✅ Toute PR doit déclarer explicitement :
   - No prod route touched
   - No DB touched
   - No env touched
   - No dependency added
8. ✅ Toute feature offline doit fonctionner avec mocks et `OFFLINE_MODE=1`
9. ✅ Toute nouvelle page doit être non référencée par la nav prod
10. ✅ **Rollback simple** : suppression du dossier de la feature = retour état initial
11. ✅ PR reste **Draft** jusqu'à validation David au retour
12. ✅ Si doute → STOP. PR avec status `BLOQUÉ - DAVID URGENT` et tu attends.

---

## PROTOCOLE BUG SUR BRANCHE

- Si tu casses quelque chose sur ta branche :
  1. `git reset --hard HEAD~1` ou retour à un commit propre
  2. Note dans le PR draft : "Tentative X abandonnée car [raison]"
  3. Tu passes à la feature suivante

- Si tu casses quelque chose sur `main` : impossible par design (branch protection + Vercel disconnect).
  Si malgré tout ça arrive : écris dans PR `CRITIQUE - DAVID URGENT` et n'agis plus.

---

## ZONE DE TRAVAIL AUTORISÉE

Voir `.cc-allowed-paths` pour la liste exhaustive whitelistée.
Voir `.cc-forbidden-paths` pour la liste explicite des interdits.

En cas de doute entre les deux : **l'interdit gagne**.

---

## TEMPLATE PR DRAFT OBLIGATOIRE

```
## OFFLINE MODE CHECKLIST
- [ ] Feature isolée (route/composant/dossier dédié dans paths autorisés)
- [ ] Aucun impact sur surfaces beta enquêteur
- [ ] Aucun feature flag activé
- [ ] Aucune modif scoring/Partner API/Mobile API/casefiles publiés
- [ ] Aucune modif `src/components/**` partagé
- [ ] Aucune modif `package.json`, lockfile, config
- [ ] Aucune nouvelle dépendance npm
- [ ] Aucune modif Prisma, DB, env vars
- [ ] Tests Vitest verts (`npm run test`)
- [ ] TSC clean (`npm run typecheck`)
- [ ] Guard offline passe (`npm run guard:offline`)
- [ ] Rollback simple : `rm -rf <dossier>` suffit

## CE QUI A ÉTÉ FAIT
[résumé concis]

## FICHIERS MODIFIÉS
[git diff --stat]

## CE QUI EST INTENTIONNELLEMENT OFF
[liste feature flags OFF, surfaces non montées]

## RISQUES IDENTIFIÉS
[honnêteté brutale, même "aucun"]

## DÉCLARATIONS EXPLICITES
- No prod route touched: yes/no
- No DB touched: yes/no
- No env touched: yes/no
- No dependency added: yes/no
- Tests pass with OFFLINE_MODE=1 and mocks only: yes/no
```

---

## RÈGLE D'OR

> Mieux vaut zéro feature livrée et une beta intacte
> qu'une feature livrée et un enquêteur qui voit un bug.

L'enquêteur est plus précieux que toute la wishlist.
