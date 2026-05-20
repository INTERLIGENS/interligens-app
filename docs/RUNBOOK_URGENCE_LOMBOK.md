# RUNBOOK URGENCE — INTERLIGENS pendant absence Lombok
# Période : 1er juin 2026 → 27 juillet 2026

Imprime ce document et garde-le offline sur ton téléphone.

---

## CONTACTS UTILES

- Vercel dashboard : https://vercel.com/dashboard
- Neon dashboard : https://console.neon.tech
- Cloudflare : https://dash.cloudflare.com
- Better Stack : https://betterstack.com
- GitHub repo : https://github.com/[user]/interligens-web
- Status page interne : (à créer si besoin)

---

## CAS 1 — Bug mineur enquêteur

**Exemples** : wording, petit bug UX non bloquant, lien cassé non critique.

**Action** : Noter dans backlog GitHub Issues, label `enqueteur-feedback` + `non-bloquant`.
**Pas de fix immédiat.** Le retour de David traite ça au calme.

---

## CAS 2 — Bug critique, prod encore utilisable

**Exemples** : casefile mal affiché, route lente, PDF fail intermittent, scan échoue sur certains tokens.

**Action depuis Lombok (toi seul, jamais CC en autonomie)** :

```bash
# 1. Sync local
git checkout main
git pull

# 2. Créer hotfix
git checkout -b hotfix/[description-courte]

# 3. Modifier UNIQUEMENT le fichier nécessaire
# (CC peut t'aider à diagnostiquer, mais TU écris le commit)

# 4. Test ciblé local
npm run typecheck
npm run test -- [fichier-touché]

# 5. Commit + push
git add [fichier]
git commit -m "fix(prod): [description]"
git push origin hotfix/[description-courte]

# 6. PR → review toi-même → merge
# 7. Deploy manuel
npx vercel --prod
```

**CC peut proposer un patch en texte, mais ne déploie pas, ne merge pas.**

---

## CAS 3 — Prod cassée, enquêteur bloqué

**Exemples** : app down, NDA gate cassé, login impossible, casefiles inaccessibles, API critique cassée.

**Action** : **ROLLBACK Vercel en priorité, diagnostic après.**

```
1. Vercel dashboard → Project interligens-web → Deployments
2. Identifier le dernier déploiement stable (avant la régression)
3. Click "Promote to Production" sur ce déploiement
4. Vérifier app dans 30 secondes
5. Capture screenshot logs Vercel + Better Stack
6. Ouvrir GitHub Issue avec timestamp + symptômes
7. Diagnostic au calme, pas dans la panique
```

**Ne cherche pas à fix pendant 3h depuis Lombok. Rollback d'abord.**

---

## CAS 4 — Fuite secret / clé compromise

**Action immédiate** :

```
1. Vercel dashboard → Settings → Environment Variables
2. Désactiver la clé compromise (Delete ou Override avec valeur invalide)
3. Provider (Helius/Alchemy/Resend/X/Etherscan/Birdeye/etc.) → Rotate API key
4. Réinjecter nouvelle clé dans Vercel env vars
5. Redeploy : git commit --allow-empty -m "chore: rotate keys" + push
6. Vérifier logs Cloudflare WAF pour patterns d'abus
7. Audit git log : git log --all --oneline | head -50
   → vérifier qu'aucun commit récent ne contient la clé en clair
```

**Pas de CC. Pas de patch code avant confinement complet.**

---

## CC EN URGENCE — Périmètre strict

CC peut, en urgence :
- ✅ Diagnostiquer (lire logs, code, DB read-only)
- ✅ Proposer un patch en texte
- ✅ Préparer une branche hotfix (sans push)

CC ne peut PAS, en urgence :
- ❌ Déployer
- ❌ Merger
- ❌ Toucher env vars
- ❌ Toucher DB
- ❌ Rollback Vercel
- ❌ Rotation clés

---

## CHECKLIST QUOTIDIENNE LOMBOK (5 min/jour)

- [ ] Better Stack heartbeat = vert
- [ ] Email digest INTERLIGENS reçu (si lundi)
- [ ] Aucune alerte Vercel critique
- [ ] Aucun enquêteur ticket urgent
- [ ] Watcher V2 cron OK (logs Vercel)

Si tout vert → continue ta vie. Pas besoin de toucher au code.

---

## RETOUR LE 27 JUILLET

Plan retour :
1. Review toutes les PR draft CC offline
2. Tests E2E manuels surfaces principales
3. Merge/reject batch
4. Activation progressive feature flags
5. Communication enquêteurs : "Je suis de retour, voici les nouveautés"
