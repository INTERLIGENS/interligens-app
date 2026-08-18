# Smoke tests — déploiement du 2026-08-19

**STATUS : NON EXÉCUTÉS.** Rien n'a été déployé, rien n'a été appelé.

**Quand :** entre le BLOC 2 et le BLOC 3 de `docs/prep/EXECUTION_2026-08-19.sql`,
puis une seconde passe après le BLOC 4.

**Ce que ce déploiement change, et donc ce qu'on surveille :** le code servi
lit désormais deux colonnes qui viennent d'être créées — `LaundryTrail.publication`
et `KolProfile.monetaryClaimsPublication`. Elles valent `'published'` partout.
**Le comportement visible doit donc être identique à celui d'avant.**

> **La règle de lecture de toute cette page : à cette étape, un changement
> visible est un défaut.** Le déploiement n'est pas censé retirer quoi que ce
> soit — c'est le BLOC 4 qui décide, plus tard. Si quelque chose disparaît
> maintenant, le filtre est trop large.

---

## PASSE 1 — juste après le déploiement, avant le BLOC 3

### 0. AVANT DE DÉPLOYER — le contrôle hors réseau, hors base

**Le seul test de cette page qui s'exécute AVANT le déploiement, et le seul qui
évite la panne au lieu de la constater.**

Le code servi interroge `LaundryTrail.publication` et
`KolProfile.monetaryClaimsPublication`. La migration les crée **en base** ; le
client Prisma, lui, ne les connaît que si le **schéma** les déclare. Le
2026-08-18, il ne les déclarait pas : le déploiement aurait cassé six familles
de routes malgré une migration réussie.

```bash
D=$(ls -d node_modules/.pnpm/@prisma+client@*/node_modules/.prisma/client)
grep -c "monetaryClaimsPublication" "$D/index.d.ts"      # ATTENDU : > 0
grep -c "LaundryTrailPublicationLog" "$D/index.d.ts"     # ATTENDU : > 0
grep -A18 "LaundryTrailScalarFieldEnum: {" "$D/index.d.ts" | grep -c "publication: 'publication'"   # ATTENDU : 1
```

**Témoin :** `grep -c "proceedsPublication"` doit rendre le même ordre de
grandeur. C'est la colonne équivalente posée en août, et elle prouve que la
convention du dépôt est bien de déclarer la colonne dans le schéma.

**N'EXÉCUTE PAS `vercel --prod` si l'un des trois rend 0.** La migration peut
être passée, la production tombera quand même.

> **Attention à ce que ce contrôle mesure.** Il lit le client **local**.
> `node_modules` n'est pas versionné : la production utilise le client que
> **Vercel régénère** au build, via `vercel-build` →
> `prisma generate --schema prisma/schema.prod.prisma`. Le contrôle local est
> donc un proxy — il est valide parce qu'il lit le **même schéma**, à condition
> que l'arbre déployé soit celui-ci. Vérifier `git status` propre et la branche
> avant de déployer fait partie du test.

### 1. La brique de base — 30 secondes

| # | Quoi | Attendu |
|---|---|---|
| 1.1 | `GET /api/health` | `200`, `db: "ok"` |
| 1.2 | La page d'accueil répond | `200` ou `307 → /access` (gate bêta) |

**ANNULE SI :** `db` n'est pas `ok`. Le reste de la page n'a plus de sens —
inutile de continuer à mesurer sur une base injoignable.

### 2. Le vrai risque — les colonnes existent-elles vraiment côté servi

C'est **le** contrôle de ce déploiement. Le code interroge deux colonnes créées
il y a quelques minutes. Si le BLOC 1 n'a pas porté, Prisma lève sur une colonne
inconnue et la route rend `500`.

| # | Surface | Attendu |
|---|---|---|
| 2.1 | `GET /api/laundry/{handle_publié}` *(cookie bêta)* | `200`, corps non vide |
| 2.2 | `GET /api/v1/kol/{handle_publié}` | `200` |
| 2.3 | `GET /api/kol/{handle_publié}/cashout` | `200` |
| 2.4 | `GET /api/kol/{handle_publié}/class-action` | `200` |
| 2.5 | `GET /api/watchlist` | `200` |
| 2.6 | `GET /api/pdf/kol?handle=…&format=html` *(x-admin-token)* | `200` |
| 2.7 | `GET /api/kol/{handle_publié}/pedigree` | `200` |

**ANNULE SI :** un seul `500`, ou un message mentionnant une colonne inconnue.

> **Comment annuler :** redéployer la version précédente. **Ne pas défaire la
> migration** — elle est additive, ses colonnes valent `'published'`, et l'ancien
> code les ignore. Une migration additive laissée en place ne casse rien ; c'est
> précisément pourquoi elle passe en premier.

### 3. Rien n'a disparu

Le déploiement ne doit **retirer** aucun contenu. Comparer aux relevés d'avant.

| # | Quoi | Attendu |
|---|---|---|
| 3.1 | `/api/laundry/{handle_publié}` porte toujours son narratif | corps **non nul**, longueur du même ordre |
| 3.2 | `/api/v1/kol/{handle_publié}` porte toujours ses montants | `totalDocumented`, `paidUsd` **non `null`** |
| 3.3 | Nombre d'entrées de `/api/watchlist` | **identique** à avant |
| 3.4 | `/api/kol/{handle_publié}` — tier, displayName | inchangés |

**ANNULE SI :** un montant passe à `null`, un narratif se vide, ou le nombre
d'entrées baisse. Cela signifierait que le filtre lit `'published'` comme un
retrait — le gate est inversé, ou la colonne est lue au mauvais endroit.

> **Le piège à connaître :** un porteur qui rendrait `0` au lieu de `null` ne
> se verrait pas ici. `0 $` n'est pas l'absence d'un chiffre, c'est un chiffre,
> et il est faux. La suite de tests couvre ce cas (`aucun porteur ne rend 0 à la
> place de null`) ; en production, vérifier à l'œil qu'aucun montant affiché
> n'est tombé à zéro.

### 4. Les fermetures d'hier tiennent toujours

| # | Quoi | Attendu |
|---|---|---|
| 4.1 | `curl` **anonyme** sur `/api/kol/{handle}` | `401`, code `NOMINATIVE_ACCESS_REQUIRED` |
| 4.2 | `curl` **anonyme** sur `/api/admin/kol/publishability` | `401` |
| 4.3 | `PATCH /api/investigators/messages/{conversation_d_un_autre}` | `403` « Not a participant » |
| 4.4 | `POST /api/investigators/feedback` avec un `caseId` étranger | `403` |
| 4.5 | Côté dépôt : `npx prisma validate --schema prisma/schema.prod.prisma` | code `1`, `P1012` |

**ANNULE SI :** 4.1 ou 4.2 rend autre chose que `401` — une régression du gate
est plus grave que tout ce que ce déploiement apporte.

**N'ANNULE PAS mais À CONSIGNER :** 4.3 / 4.4 en échec. Ce sont les correctifs
d'hier ; s'ils ne tiennent pas en production alors qu'ils tiennent en test,
c'est un écart d'environnement à investiguer, pas un motif de rollback — aucun
des deux n'expose de données.

---

## PASSE 2 — après le BLOC 4 (dépublication conservatoire)

**Maintenant, et seulement maintenant, un changement visible est attendu.**

| # | Quoi | Attendu |
|---|---|---|
| 5.1 | `GET /api/laundry/bkokoski` | plus de narratif — `404` ou corps nul |
| 5.2 | `GET /api/laundry/sxyz500` | idem |
| 5.3 | `GET /api/laundry/{un_TROISIÈME_handle_publié}` | **inchangé** — le narratif est toujours là |
| 5.4 | `/api/pdf/kol?handle=bkokoski&mode=lawyer&format=html` | le narratif de blanchiment **absent** du document |
| 5.5 | `/api/kol/bkokoski` — tier, displayName, evidence | **présents** — seul le narratif est retiré |
| 5.6 | `/api/v1/kol/bkokoski` — `totalDocumented` | **inchangé** — la décision porte le narratif, pas le chiffre |

**ANNULE SI :**

- **5.3 change.** Un retrait qui touche un tiers non visé est le pire résultat
  possible : la décision aurait une portée qu'elle n'a pas.
- **5.1 / 5.2 ne changent pas.** La décision est écrite mais pas appliquée —
  une trace de retrait sans le retrait. Ne pas re-décider : chercher *quelle
  surface* ne lit pas le gate, et la corriger.
- **5.5 ou 5.6 changent.** La portée `trail_full` retire la ligne de trail,
  pas le profil ni le chiffre. Si autre chose tombe, le filtre déborde.

**Vérifier aussi, en base (lecture seule) :** le texte est toujours là.

```sql
SELECT "kolHandle", "publication",
       length(coalesce("narrativeText", '')) AS longueur
  FROM "LaundryTrail"
 WHERE lower("kolHandle") IN ('bkokoski', 'sxyz500');
-- ATTENDU : withdrawn, et longueur INCHANGÉE.
--           Une longueur à 0 voudrait dire qu'on a effacé au lieu de retirer.
```

---

## Ce que ces smoke tests NE couvrent pas

Il faut le dire, sinon leur vert se lira plus large qu'il ne l'est.

- **Les 34 archives R2.** Le BLOC 3 inscrit leur existence en base ; il ne
  ferme aucune route et ne touche aucun objet. Rien n'est donc observable côté
  produit, et il n'y a rien à tester ici.
- **`/api/kol/{handle}/shill-to-exit`.** Cette surface ne porte **aucun garde**
  monétaire — lacune inscrite au registre `LACUNES_AMONT`. Elle continuera de
  servir `amountUsd` après le déploiement. Ce n'est pas une régression : c'est
  un défaut connu, non corrigé, et une décision de septembre.
- **La couche edge de production.** Vercel puis Cloudflare normalisent les URL
  en amont ; ces tests passent par elles sans les isoler.
- **Le comportement d'un retrait monétaire.** Aucun n'est décidé aujourd'hui :
  `monetaryClaimsPublication` vaut `'published'` partout. L'interrupteur est
  posé, jamais actionné — c'est intentionnel, et donc non mesurable ce jour.
