# LOMBOK OPS RUNBOOK

**Période** : 1er juin 2026 → fin juillet 2026 (~ 2 mois)
**Lecteur cible** : David Douville (lui-même, sur téléphone, depuis l'Indonésie)
**Format** : checklist + actions concrètes — pas de prose, pas de digression
**Version** : 1.0 — à mettre à jour avant départ si état change.

---

## 1. Vérifications quotidiennes (5 min/jour)

- [ ] **Better Stack** : ouvrir l'app mobile, lire les notifs des dernières 24h. Si tout vert → fermer. Sinon → §3 Niveau 1.
- [ ] **Email pro** : scanner subject lines. Si rien d'urgent (Vercel/Neon/GitHub/Cloudflare/Better Stack alerts, victimes, lawyers, journalistes pressants, NDA breach signalement) → fermer.
- [ ] **Telegram `@dethective`** : ouvrir le canal NDA, lire les nouveaux messages. Répondre dans les 24-48h pour les non bloquants, dans les 12h pour les bloquants.

**Règle** : si tu te surprends à plus de 15 min sur ces 3 vérifications, tu fais pause. Le runbook est là pour t'aider à *ne pas* travailler.

---

## 2. Niveau 1 — Alerte Better Stack (intervention 30 min max)

**Symptômes typiques** :

- Monitor rouge sur Better Stack.
- Page `/api/health` retourne != 200 OK.
- Latence anormale soutenue sur > 5 min.

**Actions** :

1. **Neon dashboard mobile** : ouvrir, vérifier état de l'instance prod (`ep-square-band`). Si état dégradé → attendre 5 min et re-vérifier (Neon récupère souvent seul).
2. **Test `/api/health`** depuis téléphone (Safari ou app mobile). Si OK → fausse alerte Better Stack, ignorer. Si KO → continuer.
3. **Vercel app mobile** : ouvrir, vérifier dernier déploiement, vérifier logs des 30 dernières minutes. Si rien d'évident → §3 Niveau 2.

**Stop net si tu dépasses 30 min sans diagnostic clair** : passer Niveau 2 ou laisser tomber jusqu'à la prochaine fenêtre.

---

## 3. Niveau 2 — Bug critique signalé

**Symptômes** :

- Un utilisateur (Alexandra, `@dethective`, journaliste, victime) signale un comportement cassé qui bloque l'usage.
- L'app retourne 500 sur une route critique (page d'accueil publique, page d'un casefile publié, scan d'adresse, login).

**Actions** :

1. **Diagnostic 15 min max** depuis téléphone : logs Vercel, état Better Stack, dernière modification sur main, état Neon.
2. **Rollback Vercel mobile** : aller dans Vercel app, sélectionner le dernier deploy stable connu (ou le tag `prod-pre-2026-05-31`), promote to production. Délai : ~2-3 min pour effet.
3. Si rollback insuffisant ou si la cause est en DB → §4 Niveau 3.

---

## 4. Niveau 3 — Casse majeure

**Symptômes** :

- Toute la prod est down.
- Données potentiellement corrompues.
- Rollback Vercel inefficace.
- Suspicion de fuite NDA / leak / takedown abusif.

**Actions** :

1. **Ouvrir le laptop** si possible (cybercafé sécurisé, hôtel avec écran de confidentialité, hotspot 4G).
2. **Ping Alexandra** : message ferme et factuel (cf. §6 Contacts).
3. **CC autonome** : si tu peux ouvrir Claude Code sur le laptop, déléguer le diagnostic à CC en mode autonome (suivre `CLAUDE.offline.md` : pas de prod déploiement, pas de DB push, observation uniquement).
4. **Downtime accepté** : si bloqué, accepter quelques heures de downtime. Mieux vaut une prod éteinte propre qu'une prod corrompue.
5. **Communication** : un seul tweet/post court si la situation dure > 24h ; rien sinon.

---

## 5. Accès critiques

> ⚠️ **Pas d'identifiants en clair dans ce document.** Tous les passwords, tokens et clés sont dans le password manager. Ce runbook ne fait que rappeler où ils sont.

| Système | Où trouver l'accès |
|---------|---------------------|
| Vercel | Password manager → `vercel.com` |
| Neon | Password manager → `neon.tech` |
| GitHub (INTERLIGENS) | Password manager → `github.com/INTERLIGENS` + clé hardware 2FA (à apporter en Indonésie ou backup mobile) |
| Cloudflare (DNS + R2) | Password manager → `cloudflare.com` |
| Better Stack | Password manager → `betterstack.com` + app mobile installée avant départ |
| R2 (Cloudflare Object Storage) | Password manager → `cloudflare.com/r2` |
| Resend (emails transactionnels) | Password manager → `resend.com` |

**Avant départ (à faire le 30-31 mai)** :

- [ ] Vérifier que le password manager se sync sur le téléphone.
- [ ] Tester le login GitHub depuis téléphone (incluant 2FA).
- [ ] Vérifier que les apps mobile suivantes sont installées et loguées : Better Stack, Vercel, Neon (web responsive), Telegram.
- [ ] Brancher la clé 2FA YubiKey backup ou exporter codes de récupération dans password manager.

---

## 6. Tag de rollback

**À poser le 31 mai 2026 avant le départ** :

```
git checkout main
git pull origin main
git tag prod-pre-2026-05-31
git push origin prod-pre-2026-05-31
```

**En cas de rollback urgence depuis Vercel UI** :

1. Aller dans Vercel → projet `interligens-web` → tab Deployments.
2. Trouver le déploiement associé au tag `prod-pre-2026-05-31` (date ~ 31 mai).
3. Cliquer « Promote to production ».
4. Vérifier après 2-3 minutes que `app.interligens.com` répond et que `/api/health` est OK.

---

## 7. Contacts d'urgence

| Personne / rôle | Contact | Cadre d'usage |
|------------------|---------|---------------|
| Alexandra (co-éditrice) | [N° à compléter avant départ] | Bug majeur, décision éditoriale urgente, ping Niveau 3. |
| Avocat David Douville | [Nom à compléter] / [N° à compléter] | Suspicion de plainte, mise en demeure, demande de takedown, exposition juridique non triviale. |
| Lawyers outreach (FR) — ORWL | Romain Chilly (cabinet ORWL) | Question juridique crypto/blockchain, conseil ponctuel. Pas d'engagement V2 sans retour. |
| Lawyers outreach (UK) — EMM | Ashley Fairbrother (cabinet EMM) | Question juridique cross-border, conseil UK. Pas d'engagement V2 sans retour. |
| Lawyers outreach (SG) — PDLegal | Gerard Quek — `gquek@` [domaine à compléter] | Question juridique APAC, conseil Singapour. Pas d'engagement V2 sans retour. |
| `@dethective` (bêta-testeur enquêteur NDA) | Telegram canal direct | NDA actif jusqu'au 31 août 2026. Canal de remontée bug/feedback bêta. |

**Règle d'usage** : ces contacts sont là pour les vraies urgences. Un bug front non bloquant n'est pas une vraie urgence.

---

## 8. Ce qui tourne en autonomie

Pendant l'absence, ces composants doivent continuer de tourner sans intervention. Tu ne les touches pas.

- **REFLEX V1 Shadow** : actif, capture les signaux sans surface publique. Vérification Better Stack hebdomadaire suffit.
- **Watcher V1 Host-005** (`krypt@MacBook-Pro-4`, `/Users/krypt/interligens-watcher/`) : launchctl, 2h de cycle, 29 handles. Hors prod, ne fait que loguer. Pas de touche.
- **PDF Engine V2** : cron 72h, génération automatique des PDF de casefiles. Rotation sous contrôle.
- **Better Stack** : 10 monitors actifs, notifications push téléphone.
- **Cron Vercel** : tous les cron jobs déclarés dans `vercel.json` (cap 1/jour sur plan Hobby). Aucun à modifier.

---

## 9. Ce qui ne se touche PAS depuis l'Indo

> 🛑 **Liste binaire. Aucune exception sauf retour anticipé au laptop avec ping Alexandra.**

- ❌ `npx vercel --prod` — sauf rollback urgence via UI mobile (§6).
- ❌ `prisma db push` — aucune migration DB.
- ❌ Migration Neon (SQL Editor) — aucune modification de schéma prod.
- ❌ Merge sur main par CC — branch protection active, CC ne peut pas merger sans intervention humaine.
- ❌ Bascule `REFLEX_PUBLIC_ENABLED` — flag reste OFF.
- ❌ Activation du flag Casefile Engine V1 — reste OFF si pas déjà activé avant départ.
- ❌ Nouvelles features — toutes les branches `feat/cc-offline-*` restent en draft.
- ❌ Nouveaux outreach lawyers — V2 outreach attend le retour.
- ❌ Réponse publique à un troll, à un journaliste hostile, à une mise en demeure non transmise par avocat.

**Règle dérivée** : si tu hésites à toucher quelque chose, tu ne touches pas. Tu notes dans un Apple Note daté et tu reviendras dessus en août.

---

## 10. Règles mentales

> Le runbook protège la prod. Cette section te protège toi.

- **Pas plus de 5h/semaine** de travail INTERLIGENS pendant Lombok. C'est un cap, pas un objectif.
- **Pas de chat marathon** avec Claude / GPT — tu ouvres pour une tâche précise, tu fermes après.
- **Filles + Guillaume + plage > code.** Si tu te surprends à coder pendant que les filles te demandent quelque chose, tu fermes l'ordi.
- **Si doute → ping Claude chat web** (pas Claude Code sur prod). Une question en chat ne coûte rien et clarifie.
- **Pas de scroll Twitter crypto** sous prétexte de "veille". La vraie veille reprend en août.

---

## 11. Jalons calendrier

| Date | Action |
|------|--------|
| **~10 juin 2026** | Envoi manuel du Operating Manual light (v1.0) à `@dethective` par Telegram NDA. Vérifier réception. |
| **~15 juin 2026** | Brief Loom 15 min à `@dethective` (présentation light + Q&A asynchrone). Optionnel si pas de bande passante / réseau. |
| **~30 juin 2026** | Bilan mi-séjour : 30 min seul, relire ce runbook, mettre à jour si nécessaire. |
| **~15 juillet 2026** | Prolonger NDA de `@dethective` jusqu'au 31 août 2026 (échange Telegram + courriel signé scanné). |
| **~25 juillet 2026** | Doc bilan 2 mois : 1 page, ce qui a tourné, ce qui a cassé, feedback `@dethective`, intuitions août. |
| **~31 juillet 2026** | Retour France. Reprise progressive. |

---

## 12. Au retour (août 2026)

Phase de reprise. Ne pas attaquer toutes les actions à la fois.

- [ ] **Compiler feedback `@dethective`** : lire l'historique Telegram, structurer en bugs / features / méthodologique.
- [ ] **Décider modules gelés à reprendre** : Casefile Engine V1 (si flag pas activé), MM_TRACKER, REFLEX publique, Watcher V2 migration cron.
- [ ] **Préparer outreach lawyers V2** : relance ORWL / EMM / PDLegal avec brief mis à jour.
- [ ] **Bascule REFLEX publique** si shadow V1 OK pendant 2 mois (data review obligatoire avant bascule).
- [ ] **Démarrer MM_TRACKER DRAFT → PUBLISHED** si lawyer débloqué (réponse claire de l'un des trois cabinets).
- [ ] **Reprendre merges PRs corpus restantes** (#12 Checklist, #14 Case Studies, #15 Operating Manual core, #17 Course) — conflits additifs `.cc-allowed-paths` à résoudre.

---

## 13. Historique de version

- **V1.0** — 24 mai 2026. Première version, créée pendant la fenêtre de préparation pré-départ. À mettre à jour avant le 31 mai 2026 si l'état change (nouveau monitor Better Stack, nouvelle dépendance critique, nouveau contact d'urgence, modification de la liste « ne pas toucher »).

---

**Note** : ce runbook est un outil personnel, pas un document éditorial. Si tu trouves des sections qui ne servent pas en pratique, tu les supprimes au retour. Si tu identifies des sections manquantes après une vraie urgence, tu les ajoutes.
