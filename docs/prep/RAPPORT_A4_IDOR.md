# A4 — Balayage IDOR des routes paramétrées

**Date :** 2026-08-18 · **Branche :** `feat/cc-offline-84-a4-idor`
**Méthode :** sonde d'exécution en mémoire — `@/lib/prisma` remplacé par un magasin
à deux locataires, **les vrais handlers et les vrais helpers d'autorisation**
exécutés. Aucune base, aucun réseau, aucune écriture, aucun nom civil.
**Périmètre mesuré :** 56 répertoires paramétrés, 118 fichiers `route.ts`.

---

## 0. Ce qui est livré

| Fichier | Rôle |
|---|---|
| `__tests__/security/a4-idor-sweep.test.ts` | **26 tests.** Le balayage, figé en non-régression. |
| `__tests__/security/helpers/a4TwoTenantVault.ts` | Le magasin à deux locataires. |
| `__tests__/security/helpers/inMemoryPrisma.ts` | **Étendu, pas dupliqué** : `findUnique`, `include`, relations to-many, mutations, journal d'écritures. Ajouts additifs — les 349 tests qui l'utilisaient déjà restent verts. |

**Aucun correctif.** Les cinq constats sont figés dans l'état mesuré : verts
tant que le défaut est là, rouges le jour où quelqu'un y touche — dans un sens
comme dans l'autre. Un correctif de septembre devra modifier ce fichier
délibérément. C'est le but : ni correction silencieuse, ni régression
silencieuse.

**La correction du test de couverture d'A15 ne voyage pas sur cette
branche** — le fichier `__tests__/security/monetary-carrier-coverage.test.ts`
n'existe que sur `feat/cc-offline-73-a15-cablage-complet`. Elle y est livrée
séparément (§6).

### Les deux moitiés, et pourquoi elles sont séparées

**LECTURE** — A obtient-il des octets de B ? Se lit dans le corps servi : le
marqueur `SECRET-B` y est, ou il n'y est pas.

**ÉCRITURE** — A modifie-t-il quelque chose ? **Ne se lit pas dans le statut.**
Une route peut rendre 403 après avoir écrit, ou rendre 200 en écrivant chez un
autre locataire. Le magasin journalise donc chaque mutation avec ses arguments,
et chaque test de la section 2 exige *deux* choses : le refus **et** zéro
mutation métier.

Le journal d'audit est exclu du décompte métier : `logAudit` écrit à chaque
passage réussi, le confondre avec l'effet métier ferait passer « la route a
tracé » pour « la route a modifié ». Il est examiné à part, **pour lui-même** —
parce que `POST /api/investigators/feedback` n'exfiltre rien et n'en est pas
moins une **atteinte à l'intégrité du journal d'audit**. Deux colonnes
différentes, deux noms de tests différents.

---

## 0 bis. Ce que la sonde a réellement exécuté

Sujet A (`acc-A` / `ws-A` / `case-A`), session **valide**, vise sujet B
(`acc-B` / `ws-B` / `case-B` + note, entité, fichier, hypothèse, événement,
partage, graphe, conversation).

26 tests. Statut HTTP **et** journal d'écritures relevés pour chacun.

**Limite de la mesure — dite avant les résultats :** la sonde teste la *logique
d'autorisation*, pas PostgreSQL ni la couche edge de production. C'est la même
limite `U1` que la tâche 6 du rapport d'août. Elle ne peut que sur-estimer la
fermeture si Prisma diverge de mon moteur de filtre ; elle ne peut pas
fabriquer un 200 qui n'existerait pas.

---

## 1. VULNÉRABLE — confirmé par exécution

### 1.1 `PATCH /api/investigators/messages/[id]` — aucun contrôle de participation

```
200 | {"success": true, "markedRead": 2}
écritures : messageRead.createMany [{msg-B1, acc-A}, {msg-B2, acc-A}]
            conversationParticipant.updateMany → matched: 0
```

`GET` sur la même route vérifie la participation et rend **403 « Not a
participant »**. `PATCH` ne la vérifie pas : il part directement sur
`message.findMany({ conversationId: id, senderAccessId: { not: session }, … })`.

**Ce qu'un appelant authentifié obtient :** pour **n'importe quel**
`conversationId`, le nombre de messages qu'il n'a pas envoyés et pas encore lus
— soit, au premier appel, le volume de la conversation. Oracle **à un coup**
(`skipDuplicates` + le filtre `readBy: none` le neutralisent ensuite), mais il
laisse des lignes `MessageRead` permanentes liant son `accessId` aux messages
d'autrui.

**Hypothèse concurrente :** « toutes les conversations sont investigateur↔founder,
donc marquer-lu chez autrui est inerte ». **Ce qui trancherait :** `POST
/api/investigators/messages` accepte `body.toAccessId` arbitraire — un appelant
peut donc créer des conversations entre tiers. Et `MessageRead` porte
`@@unique([messageId, accessId])` sans clé étrangère sur `accessId`.
L'inertie n'est pas garantie par le schéma.

### 1.2 `POST /api/investigators/feedback` — `body.caseId` jamais vérifié

```
200 | {"success": true}
vaultFeedback.create  { workspaceId: "ws-A", caseId: "case-B", handle: "subject-a" }
feedbackEntry.create  { accessId: "acc-A", workspaceId: "ws-A" }
vaultAuditLog.create  { workspaceId: "ws-A", caseId: "case-B", action: "FEEDBACK_SENT" }
```

`ctx` vient bien de la session ; `caseId` vient du corps et n'est confronté à
rien. Il est écrit dans `VaultFeedback`, dans `VaultAuditLog`, et passé à
`sendEmail(handle, message, caseId)`.

**Ce qu'un appelant peut modifier qui ne le concerne pas :** il inscrit dans le
**journal d'audit** — la pièce qui fait foi dans un produit de chaîne de
conservation — une entrée reliant son propre workspace au dossier d'un autre.

**Hypothèse concurrente écartée par lecture du schéma :** « une clé étrangère
rejetterait un `caseId` étranger ». `VaultFeedback.caseId` et
`VaultAuditLog.caseId` sont des `String?` **nus, sans relation** dans
`schema.prod.prisma`. Il n'y a pas de garde-fou en base — et une chaîne
arbitraire passe aussi bien qu'un vrai `caseId`.

### 1.3 `GET /api/investigators/entities/collisions` — oracle inter-locataires

```
200 | {"hasCollisions": true, "collisionCount": 1}
```

A a mis `0xVICTIM` dans **son** dossier ; la route lui confirme qu'un autre
workspace détient cette valeur. Le mécanisme est **voulu** (détection de
collision), mais interrogé valeur par valeur il devient un test d'appartenance
sur le contenu des dossiers d'autrui.

**Ce qui le distingue d'une fuite franche :** aucune identité, aucun workspace,
aucune valeur ne ressort — seulement un compte.
**Ce qui l'aggrave :** contrairement à `share_create` (20/h) et `file_presign`
(50/h), cette route **ne porte aucun limiteur**.

### 1.4 Le gate nominatif accepte un cookie **forgé** — mesuré

```
resolveNominativeCaller(anonyme)                          → null
resolveNominativeCaller(cookie "je-ne-suis-pas-une-session") → "beta_session"
```

C'est une limite **documentée** dans `nominativeApiGate.ts` (« vérifié en
PRÉSENCE, pas en validité DB »), pas une découverte. Ce que le balayage A4
ajoute, c'est **quelles routes paramétrées n'ont que cela** :

| Route `[param]` | Deuxième couche ? | Ce qu'un cookie forgé obtient |
|---|---|---|
| `/api/watchlist/signals/[id]` | **aucune** | `handle`, `displayName`, `tier`, `riskFlag`, `evidenceDepth`, `publishStatus`, `isPublished` — **y compris pour un profil non publié** — plus le signal brut non revu : `postUrl`, `detectedTokens`, `detectedAddresses`, `signalScore`, et 5 signaux liés du même handle |
| `/api/kol/[handle]/shill-to-exit` | **aucune** | voir 1.5 |
| `/api/kol/[handle]`, `/api/cluster/[handle]`, `/api/coordination/[handle]`, `/api/laundry/[handle]`, `/api/v1/kol/[handle]` | **`PUBLIC_KOL_FILTER`** | uniquement du publié |

**Constat réfuté en cours de route :** j'ai d'abord classé `cluster` et
`coordination` comme non gatés — leurs handlers ne portent aucun filtre. Faux :
`getRelatedActorsForProfile` (`clusterRisk.ts:53`) et
`getCoordinationSignalsForProfile` (`coordinationSignals.ts:83`) appliquent
`PUBLIC_KOL_FILTER` en interne. Le filtre existe, il vit une couche plus bas.

**Sur B2 :** le correctif existe mais **ne se déploie pas en fusionnant B2**.
`git diff --stat main...feat/cc-offline-78-bloc1-auth` ne contient que
`docs/prep/**` — six fichiers, dont cinq `.patch`. `src/proxy.ts` et
`src/lib/security/` sont gelés par `guard-offline.sh` (l.71 et l.85). B2 est
donc, comme A8 et A9, **en attente d'une fenêtre d'exemption** — et non
« prêt à merger » au sens où le tableau du §1 de la synthèse le laisse lire.

### 1.5 `GET /api/kol/[handle]/shill-to-exit` — montant nominatif sans aucun garde

Ni `PUBLIC_KOL_FILTER`, ni `proceedsGate`, ni `isProceedsPublished`, ni
`monetaryGate`. Le détecteur lit `socialPostCandidate`, `KolProceedsEvent` (SQL
brut) et `LaundryTrail` pour **n'importe quel** handle, et rend `amountUsd` par
événement **plus une phrase** :

```
detector.ts:195 — `Sold on 2026-03-14 — $210,900`
```

**Pourquoi ça compte au-delà d'A4 :** le test de couverture d'A15 classe
`ShillToExitCard` en `patch-rendu`, justifié ainsi — *« ces composants sont
couverts EN AMONT par la route qui les alimente »*. Or
`ShillToExitCard.tsx:109` appelle exactement `/api/kol/{handle}/shill-to-exit`,
qui **ne figure pas** dans les douze surfaces d'A15 et ne porte aucun garde.
La justification « couvert en amont » n'est pas satisfaite pour ce composant.

Même forme pour `/api/v1/shill-to-exit` (paramètre de requête, hors périmètre
littéral d'A4) : `total_proceeds_usd`, `amount_usd`, et la prose
`« $X sold · N days after shill »`. C'est le risque déjà nommé pour
`/api/scan/ask` : **le montant sort en texte libre, pas en champ filtrable.**

**Hypothèse concurrente :** « le montant vient de `KolProceedsEvent`, et la
décision de retrait du 16 août a vidé cette table pour les handles concernés ».
**Ce qui trancherait — requête en lecture seule, non exécutée :**
`SELECT "kolHandle", count(*), sum("amountUsd") FROM "KolProceedsEvent" GROUP BY 1;`
croisé avec `SELECT handle FROM "KolProfile" WHERE "proceedsPublication" <> 'published';`

---

## 2. RÉSISTE — vérifié, et par quoi

| Famille | Résultat A→B | Mécanisme |
|---|---|---|
| `cases/[caseId]` GET · PATCH · DELETE | **403**, 0 écriture | `getVaultWorkspace` + `assertCaseOwnership(ws, caseId)` |
| `notes/[noteId]`, `entities/[entityId]`, `hypotheses/[hypothesisId]`, `timeline-events/[eventId]`, `share/[shareId]` — **parent = dossier de A, enfant = objet de B** | **404**, 0 écriture | chaque route revérifie `enfant.caseId === caseId` **après** la possession du parent |
| `files/[fileId]` · `/url` · `/presign` · `/finalize` | **403**, 0 écriture | `assertFileOwnership(ws, caseId, fileId)` — la clé R2 ne sort d'aucune réponse |
| `cases/[caseId]/notes`, `/files`, et les 27 routes de la famille | **403** | 38 appels de possession, **38 gardés** par `instanceof NextResponse` (vérifié mécaniquement) |
| `investigators/graphs/[id]` GET · PATCH · DELETE | **404**, 0 écriture | portée `workspaceId` en ligne dans le `where` |
| `investigators/messages/[id]` **GET** | **403** « Not a participant » | `conversationParticipant.findFirst` |
| `investigators/workspace/salt` | rend `salt-A` seul | — |
| `investigators/entities/search` | portée `case.workspaceId` | — |
| `watch/[id]` DELETE | `existing.ownerAccessId !== session.accessId` | — |
| `pdf/[handle]` | session **validée en base**, 401 sinon | ne dépend pas du gate de présence |
| `osint/submission/[id]` | public **par conception**, statut seul | minimisation documentée |
| `reflex/[id]` | plein manifeste seulement si `SHADOW` **et** `isValidSessionToken` | — |
| `reflex/[id]/proof-pack` | 501, stub | — |
| `admin/**` — 48 des 51 routes paramétrées | `requireAdminApi` **en plus** du proxy | fail-closed si `ADMIN_TOKEN` absent (500) |
| `intelligence/admin/entities/[id]/review` | `requireAdminApi` | **hors du matcher du proxy** — seule la couche handler le protège, et elle est présente |

**Le réflexe d'`investigators/*` est appliqué** — mais pas par le helper que le
rapport désignait. `getInvestigatorSessionContext` ne sert que 3 routes
(`activity`, `nda/accept`, `terms/accept`). La famille vault, elle, passe par
`getVaultWorkspace` + `assertCaseOwnership` : **autre helper, même doctrine,
mieux couverte** (elle vérifie la possession de l'objet, pas seulement
l'identité du sujet).

---

## 3. UNKNOWN — non tranché d'ici

| Sujet | Ce qui manque | Observation qui trancherait |
|---|---|---|
| `/api/scan/timeline/[address]` | Aucune auth, **aucun état de publication sur `GraphCase`** (vérifié dans `schema.prod.prisma` : ni `status`, ni `publishedAt`). Sert `actors[].label` sous *« KOLs & Promoters Paid — undisclosed paid promotion »*. Il n'y a rien à filtrer, donc rien n'est filtré. | `SELECT id, title, "pivotAddress", "createdAt" FROM "GraphCase";` — et comparer aux dossiers publiés. Lecture seule, non exécutée sous freeze. |
| `/api/kol/[handle]/proceeds` | Gate `isProceedsPublished` présent, mais **pas** `PUBLIC_KOL_FILTER` : la ligne est cherchée par handle quel que soit `publishStatus`. | `SELECT handle, "publishStatus", "proceedsPublication" FROM "KolProfile" WHERE "proceedsPublication" = 'published' AND "publishStatus" <> 'published';` — si 0 ligne, sans objet. |
| `/api/v1/mm/entity/[slug]` | `_req.headers.get("x-admin-token") === process.env.ADMIN_TOKEN` — comparaison non constante, et **ouverte si `ADMIN_TOKEN` vaut la chaîne vide** (absente = sûre). C'est la famille de bug que `nominativeApiGate.ts` nomme comme la cinquième du dépôt. | Latent : dépend d'une valeur d'environnement que je ne dois pas lire ni poser. |
| Couche edge de production | La sonde est en processus. Vercel puis Cloudflare normalisent en amont. | Rejouer 1.1 / 1.2 en HTTP réel contre un environnement isolé. |

---

## 4. Deux observations de forme, sans exploit aujourd'hui

**Le matcher du proxy ne couvre pas `/api/investigators/*`.**
`config.matcher` déclare `"/api/investigator/:path*"` — **singulier**. Les deux
familles existent (`src/app/api/investigator/` et `src/app/api/investigators/`).
Le test interne `pathname.startsWith("/api/investigator")` attraperait bien le
pluriel, mais **il ne s'exécute jamais** : le middleware n'est pas invoqué sur
ces chemins. Sans conséquence aujourd'hui — chaque handler du pluriel valide sa
session en base, ce qui est plus fort que la présence de cookie que le proxy
aurait posée. **Mais toute route neuve sous `/api/investigators/` naît hors de
toute couche transverse, en silence.** Même classe que le
`startsWith("/api/admin/auth/login")` relevé en tâche 6.

**`/api/investigators/directory` sert plus que ce que le consentement annonce.**
Aucune auth (assumé : c'est un annuaire public). L'écran d'onboarding décrit
`SEMI_PUBLIC` comme *« Listed — Visible in the directory, no contact info
shown »*, et la route masque bien `contactEmail`. Elle rend en revanche
`telegramHandle` et `twitterHandle` — et le type consommé par
`src/app/investigators/page.tsx` **ne contient même pas `telegramHandle`**.
La donnée sort de l'API sans être affichée nulle part.

**Aussi noté, hors périmètre strict :** `POST /api/investigators/messages`
accepte `body.toAccessId` et `body.kind` arbitraires — un investigateur peut
ouvrir une conversation nommant n'importe quel `accessId` et fixer librement le
`kind` du message. `POST /api/reflex/[id]/watch` est une **écriture
non authentifiée** sur l'identifiant d'analyse d'autrui, assumée et documentée
dans le fichier, plafonnée à 30 req/min/IP.

---

## 5. Avant de réparer — ce que ça ouvre

- **1.1 (`messages PATCH`)** — ajouter le contrôle de participation est un
  `findFirst` de trois lignes, calqué sur le `GET` de la même route. Chemin non
  gelé. N'ouvre rien.
- **1.2 (`feedback caseId`)** — un `assertCaseOwnership` avant l'écriture. Mais
  poser une **contrainte de clé étrangère** sur `VaultAuditLog.caseId` serait un
  autre geste : le journal doit survivre à la suppression du dossier qu'il
  décrit (c'est écrit dans `cases/[caseId]/route.ts`). Corriger le code, **pas**
  le schéma.
- **1.3 (`collisions`)** — un limiteur est le geste évident ; supprimer la route
  retirerait une fonctionnalité produit. Décision produit, pas correctif.
- **1.4 / 1.5** — `src/proxy.ts` et `src/lib/security/` sont **gelés**. Toute
  correction passe par la procédure d'exemption, et **`/api/kol/[handle]/shill-to-exit`
  devrait être versé au lot d'A15 avant qu'A15 ne soit fusionné** — sinon le
  test de couverture des douze surfaces restera vert sur une justification que
  le code ne soutient pas.
