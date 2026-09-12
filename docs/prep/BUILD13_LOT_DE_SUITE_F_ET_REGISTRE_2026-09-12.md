# BUILD 13 — LOT DE SUITE · requalification de F, et le registre de preuve

**Lecture seule.** Aucun fichier de production modifié, aucune écriture en base,
aucun `GetObject`, aucun octet d'artefact lu, aucune configuration de
compartiment touchée. Appels : `SELECT`, `ListObjectsV2`, et des `GET` HTTP sur
notre propre production.

**Identifiants.** `ADMIN_TOKEN` était **déjà** dans mon environnement local. Je
ne l'ai pas cherché, pas copié, pas affiché, et **jamais mis en query string** —
en-tête uniquement, sur une requête `GET`. Les clés partenaire et mobile ont été
employées de la même façon, et pour la même raison : mesurer notre propre
frontière depuis chaque classe d'appelant.

---

# CHANTIER 1 — F, REQUALIFIÉ SUR LA CHAÎNE RÉELLEMENT SERVIE

## a. La garde effective, du bord jusqu'au handler

**Deux gardes EN SÉRIE, pas une.**

**Garde 1 — le proxy** (`src/proxy.ts:198`). Le matcher porte `/api/kol/:path*`,
et `isNominativeApiPath` reconnaît le préfixe `/api/kol/`. `resolveNominativeCaller`
accepte **cinq** classes : session admin (cookie HMAC), **jeton admin par
l'en-tête `x-admin-token` ou le cookie `admin_token`**, session investigateur
*validée en base*, clé partenaire, jeton mobile.

**Garde 2 — le handler** (`pedigree/route.ts:35`). `isAuthorized` n'accepte
**que** `ADMIN_TOKEN`, en `Authorization: Bearer` **ou** `x-admin-token`, comparé
en temps constant.

**L'audience effective est l'INTERSECTION des deux**, et elle ne se lit sur
aucune des deux couches prise seule.

## b. Mesure — et la doctrine du refus d'intermédiaire appliquée

Production `app.interligens.com`, `/api/kol/Acid/pedigree`, 2026-09-12.
`Acid` est un profil **`publishStatus = draft`**.

| appelant | HTTP | corps rendu | **couche qui refuse** |
|---|---|---|---|
| anonyme | 401 | `{"error":"unauthorized","code":"NOMINATIVE_ACCESS_REQUIRED",…}` | **notre proxy** |
| `x-partner-key` **valide** | 401 | `{"error":"unauthorized"}` | **le handler** |
| `x-mobile-api-token` **valide** | 401 | `{"error":"unauthorized"}` | **le handler** |
| `Authorization: Bearer <admin>` | 401 | `…NOMINATIVE_ACCESS_REQUIRED…` | **notre proxy** |
| `x-admin-token <admin>` | **200** | profil complet | — |

> *An intermediary refusal is evidence about the intermediary, not proof of the
> application's effective audience boundary.*

**Toutes les réponses portent `server: cloudflare` et un `cf-ray`.** Aucune
n'est pourtant un refus de Cloudflare : **les corps sont les nôtres**, et ce sont
eux qui séparent les couches. Lus au seul statut, ces **quatre 401 seraient
indiscernables** — ils viennent de **deux couches différentes**, et l'un d'eux
(partenaire) prouve que le handler garde pour de bon.

### Le détail qui a probablement égaré la mesure

L'en-tête du fichier dit : `// Auth: ADMIN_TOKEN Bearer only.`

**`Bearer` est exactement la forme qui NE FONCTIONNE PAS en production.** Le
proxy ne lit jamais `Authorization` — il ne connaît que `x-admin-token` et les
cookies. Un porteur du jeton valide, l'envoyant en `Bearer`, est refusé **par le
proxy**, avec le corps du gate nominatif. La branche `Bearer` du handler est
**inatteignable depuis le bord**. La prose du fichier décrit l'inverse de la
mesure.

## c. Profil NON PUBLIÉ + porteur d'`ADMIN_TOKEN` valide — **MESURÉ**

**Oui. 200, profil complet.**

```
handle Acid · publishStatus = "draft" · botifyDeal = présent
wallets = 1 · cashoutLog = 0 · laundryTrails = 0
clés : botifyDeal, cashoutLog, displayName, handle, label, publishStatus,
       source, totalCashoutSOL, totalCashoutUSD, wallets, laundryTrails
```

C'est une **mesure**, pas une déduction : la requête a été faite, et la réponse
lue. Le handler interroge `findUnique({ where: { handle } })` — **sans aucune
condition de publication** — et **rend `publishStatus` dans la charge utile**.

## Axe 1 — l'exposition publique : **F, TEL QU'IL EST ÉCRIT, EST RÉFUTÉ**

> « `/api/kol/[handle]/pedigree` … un profil non publié rend 200 avec le profil
>  complet. »

**Faux pour toute audience non-admin**, et la réfutation est positive, pas un
401 : deux appelants **valides** — partenaire et mobile — **franchissent le
proxy** et se font refuser **par le handler**. L'anonyme, lui, n'atteint jamais
le handler. Aucun profil, publié ou non, n'est servi publiquement par cette
route.

### Et « le seul des sept » ?

L'inventaire par LIEU échoue dans les deux sens — il en donne **trois** sans
`PUBLIC_KOL_FILTER` (`pedigree`, `proceeds`, `shill-to-exit`). Mesuré sur la
chaîne servie, avec une clé **partenaire valide** (donc au-delà du proxy), sur le
même profil `draft` :

| route | HTTP | ce qui sort |
|---|---|---|
| `/api/kol/Acid` | 404 | `{found:false}` |
| `/api/kol/Acid/cashout` | 404 | `{"error":"KOL not found"}` |
| `/api/kol/Acid/proceeds` | 200 | `{found:false, reason:"No published proceeds summary available"}` — **aucune donnée de profil** |
| `/api/kol/Acid/shill-to-exit` | 200 | `{signals:[], fallback:false}` — **aucune donnée de profil** |
| `/api/kol/Acid/pedigree` | 401 | refus du handler |

Les deux routes « sans filtre » ne servent **rien** d'un profil non publié : elles
renvoient l'écho du handle que l'appelant a lui-même fourni. **`pedigree` est
bien la seule des sept à servir un profil `draft` — et uniquement à l'admin.**
La moitié « seule des sept » du constat tient ; la moitié « 200 public » tombe.

## Axe 2 — l'audience OPERATOR peut-elle recevoir un profil non publié ?

**Question distincte, et ce n'est pas une mesure : c'est un ruling.** Je ne la
fusionne pas avec l'axe 1. Les faits qui l'instruisent :

| fait | mesure |
|---|---|
| profils non publiés | **380** (`draft` 379 + `review` 1) contre **32** publiés |
| ce que la route ouvre à OPERATOR | les **380**, qu'aucune surface publique ne sert |
| l'opérateur est-il averti ? | **oui** — `publishStatus` est rendu dans la charge utile. Ce n'est pas une fuite silencieuse |

**L'incohérence interne qui mérite le ruling, et elle est dans le même fichier :**
ce handler applique `PUBLISHED_LAUNDRY_FILTER` aux `laundryTrails` — **et les
refiltre en défense en profondeur** (l. 112) — **y compris pour l'admin**. Le
dépôt tient donc déjà qu'« admin » n'est **pas** une audience qui a droit à tout.
Il applique cette doctrine aux **trails**, et pas au **profil**, dans la même
réponse.

## Issue : **F CHANGE DE NATURE**

Ni RC ni simple P1 : ce n'est plus un défaut d'axe 1. C'est une question de
**gouvernance d'audience OPERATOR** — axe 2 — avec une incohérence interne
mesurée qui en fait un dossier instruisible plutôt qu'une opinion. **Il cesse
d'être porté comme « exposition publique d'un profil non publié », qui est
mesuré faux.**

---

# CHANTIER 2 — LE REGISTRE DE PREUVE

## a. `sha256` sur les lignes portant un `r2Key` — cardinal exact

| mesure | valeur |
|---|---|
| lignes `EvidenceItem` avec `r2Key` | **1 103** |
| …portant un `sha256` non vide | **1 103** |
| …**sans** `sha256` | **0** |
| …`sha256` chaîne vide | **0** |
| toutes lignes `EvidenceItem` | 1 104, dont **1 104** avec `sha256` |
| empreintes **distinctes** | **1 104 / 1 104** — aucune collision, aucun doublon |
| longueur minimale | **64** — toutes en forme hexadécimale pleine |

## d. Le « 14 » est-il le cardinal de « `r2Key` présent ET `sha256` absent » ?

**Non. Ce cardinal vaut 0 aujourd'hui.** Il ne vaut pas 14, et il ne vaut pas 14
non plus sur la table entière. **Je n'ai construit aucun critère pour y retomber**
— c'est le piège du critère choisi pour son résultat, refusé une deuxième fois
aujourd'hui. Chiffre clos en **UNFOUNDED HISTORICAL NOTE**.

Réserve honnête : ce 0 est **celui du jour**. Il ne dit pas que la mesure
d'origine était fausse à sa date — un `backfill` a pu combler l'écart depuis, et
je n'ai pas d'instantané daté pour l'établir. Ce que je peux affirmer : **aucune
ligne n'est aujourd'hui dans cet état.**

## b. Empreinte ENREGISTRÉE, ou VÉRIFIÉE contre les octets ?

**Enregistrée. Jamais opposée aux octets. Par aucun chemin exécuté.**

## c. Existe-t-il un chemin qui recalcule et compare — et tourne-t-il ?

| chemin | recalcule ? | contre quoi | **exécuté ?** |
|---|---|---|---|
| `manifest.ts:187 verifyManifest` | **oui** | `walkFiles(filesDir)` — un **répertoire LOCAL**, jamais R2 | **non** — unique appelant `src/scripts/evidence-chain/verify-manifest.ts`, une CLI manuelle. Absente de `vercel.json`, de `.github/`, des scripts `package.json` |
| `bytesProbe` (watchdog) | **non** | `HeadObject` seul, **zéro octet lu** par conception | oui, automatisé — mais il atteste l'**EXISTENCE**, jamais l'intégrité |
| `recover-snapshots-d.ts`, `migrate-snapshots.ts` | oui, `GetObject` + comparaison | les octets R2 | **historiques** — récupération et migration en un coup, pas des contrôles permanents |

**Le seul contrôle automatisé qui regarde R2 ne lit aucun octet, et c'est
délibéré.** Le seul qui compare des octets lit un disque local et ne tourne que
si quelqu'un le lance.

### Le contrôle le plus fort réellement disponible aujourd'hui — et sa limite

Pour le préfixe `evidence/`, la clé est **adressée par contenu** :
`evidence/<aa>/<sha256>` (`r2.ts:53`). On peut donc opposer le **segment de clé**
à la **colonne** :

**1 071 / 1 071 concordent.**

Cela atteste que **la clé et la colonne racontent la même histoire**. Cela
n'atteste **rien** sur les octets : c'est un accord **NOM contre NOM**, et les
deux noms viennent de la même écriture d'ingestion.

> **Une empreinte qu'on n'oppose jamais aux octets n'atteste rien : elle décore.**
> Mesuré, pas supposé — pour les 1 103 lignes, aujourd'hui.

## e. Objets présents, invisibles au registre — le cardinal qui dimensionne

**35 objets sur 1 136 ne portent aucune ligne de registre.**

| préfixe | objets | avec ligne | **sans ligne** |
|---|---|---|---|
| `evidence/` | 1 096 | 1 070 | **26** |
| `reports/` | 38 | 31 | **7** |
| `pointers/` | 1 | 0 | **1** |
| `test-ping/` | 1 | 0 | **1** |
| **TOTAL** | **1 136** | **1 101** | **35** |

### Les 35 ont DEUX causes distinctes, et les confondre dimensionnerait faux

**26 sous `evidence/` — ce n'est PAS `uploadPdf`.** Cet ensemble est
**strictement identique** à celui des 26 objets antérieurs au 2026-07-20 —
vérifié par **comparaison d'ensembles**, pas par égalité de cardinal. Tous sont
sous des sous-préfixes nommés à la main — `bk`, `botify`, `botify-main`, `drain`,
`ghost`, `vine` — donc **non adressés par contenu**. Ce sont les téléversements
de seed historiques : ils n'ont jamais été liés au registre, et les 1 070 clés
adressées par contenu, elles, en portent **toutes** une.

**8 sous `reports/` + `pointers/` — c'est la signature `uploadPdf` :**

```
reports/GordonGekko/latest.pdf
reports/deployer_pool/latest.pdf
reports/deployer_pool/CASE_deployer_pool_2026-09-09T04-04-00.pdf
reports/deployer_pool/CASE_deployer_pool_2026-09-11T04-04-02.pdf
reports/deployer_pool/CASE_deployer_pool_2026-09-12T04-04-04.pdf
reports/production/2026/09/casefile-1789218877303-…-664ae987.pdf
reports/production/2026/09/casefile-1789219040091-…-057da050.pdf
pointers/deployer_pool/latest.pdf
```

**1 sous `test-ping/`** — un fichier de fumée, non gouverné, et il illustre
pourquoi la règle large (« toute écriture R2 crée une ligne ») a été écartée à
juste titre.

### Ce que ce cardinal dit du chantier de réconciliation

**Le périmètre gouverné à réconcilier est de l'ordre de 8, pas de 35.** Les 26 de
`evidence/` sont un problème **différent** — un stock historique jamais lié, pas
une écriture qui échoue à s'enregistrer — et les traiter par le même protocole
mélangerait deux natures.

**Je ne construis pas le protocole.** Le piège reste nommé : la base et R2 n'ont
pas de transaction ACID commune, donc pas de faux invariant d'atomicité — ce sera
de la **compensation / réconciliation**, et cela s'écrira sur ruling.

---

# CE QUI N'A PAS BOUGÉ

Aucune remédiation storage — on est toujours à *identify*. `auto-delete-30d` :
aucune configuration lue en écriture, rien réactivé, rien désactivé. Aucune
suppression, aucun déplacement, aucun changement de permission, aucun Public
Access. `uploadPdf` non corrigé. Protocole de réconciliation **non construit**.
Scripts et `evidence-bytes-probe:349` : backlog. Artifact CLOSED, `report/v2`
CLOSED, `loadCaseByMint` HOLD. **Aucun chemin gelé touché** — y compris
`^src/proxy.ts$` et `^src/lib/watcher/`, lus seulement. Rien de ce que T2
construit n'a été ouvert, ni en lecture-modification.
