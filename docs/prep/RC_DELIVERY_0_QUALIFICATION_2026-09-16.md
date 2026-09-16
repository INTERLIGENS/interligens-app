# RC-DELIVERY-0 — QUALIFICATION DE LA REMISE COUNSEL

**2026-09-16 · mesure seule · aucun build, aucun déploiement, aucun DDL, aucune lease, aucun artefact produit**

> **NOUS SAVONS PRODUIRE LE DOSSIER. SAVONS-NOUS LE REMETTRE ?**

---

## LA RÉPONSE, EN UNE LIGNE

**MET** — un destinataire counsel/investisseur autorisé **reçoit** le CaseFile VINE gouverné
existant par le chemin de remise prévu : autorité applicative exercée, capability émise, objet
récupéré, **107 576 octets et `e70bff15…` recalculés côté client**. Un **GAP** subsiste, et il ne
porte **pas** sur la remise : la surface **document** du domaine canonique est refusée **au bord**,
avant Vercel. Deux conclusions, jamais une :

```
OBJECT DELIVERY   = MET
CANONICAL DOMAIN  = GAP · couche liante établie · cause NOT_ESTABLISHED
```

Artefact de référence : `registry id 7cfc5bbd61af4165b5cd6ffe1302759b` · 107 576 o ·
`e70bff15f2797bb4f74890568dba3e4f6c101c7317fea0d06541dd263758a5ae`.

---

## A · AUTORITÉ DE DÉLIVRANCE APPLICATIVE — **MET**

### registry state → object identity → delivery eligibility

```
ligne de registre     PRESENTE · id 7cfc5bbd61af4165b5cd6ffe1302759b
état d'autorité       REGISTERED
état d'invalidation   NONE
nature · provenance   CASEFILE_RENDER · GOVERNED_PIPELINE
rétention             EVIDENTIARY_INDEFINITE
taille enregistrée    107 576            ≡ attendue   MATCH
digest enregistré     e70bff15f279…      ≡ attendu    MATCH
éligibilité dérivée   DÉLIVRABLE
```

### Le contrôle négatif — une fonction qui signe tout n'est pas une autorité

Exercé **en vif**, sur la base de production :

| appel | résultat |
|---|---|
| clé gouvernée **sans** ligne de registre | **REFUSED · `AUCUNE_LIGNE_DE_REGISTRE`** |
| autre environnement, sans ligne | **REFUSED · `AUCUNE_LIGNE_DE_REGISTRE`** |
| clé **hors** périmètre gouverné (`pointers/…`) | ÉMIS, **et compté** — trou de phase 1, documenté dans le code |

`delivrerUrlSignee` **relit** donc l'autorité avant d'émettre ; elle ne se contente pas de signer.

⚠️ **Borne honnête de ce contrôle en vif.** Le registre de production ne contient aujourd'hui que
**2 lignes, toutes deux `REGISTERED / NONE`** : il n'existe aucune ligne vivante `INTENDED` ou
invalidée à opposer à la fonction, et **aucune n'a été créée** — la mission interdit toute écriture.
Le refus en vif est donc démontré sur **l'absence de ligne**, et le différentiel des quatre états de
registre reste tenu par le témoin T3 de `src/lib/storage/__tests__/pdfStorage.test.ts`, qui exerce
**la vraie primitive** : `REGISTERED+NONE` → autorisée · **invalidée → refus nommé** · aucune ligne
→ refus · registre injoignable → refus. C'est un témoin unitaire, pas une mesure en production, et
il est cité comme tel.

### L'émission

```
issued                  yes
authorization result    ACCEPTED
target object identity  interligens-reports/reports/production/2026/09/7cfc5bbd…pdf
expiry                  900 s après émission (plafond dur 3600 s)
```

⛔ La capability est un secret : elle n'a été ni journalisée, ni écrite, ni rendue, ni tronquée dans
ce dossier.

---

## B · REMISE DE L'OBJET — **MET**

Récupération **réelle**, comme le ferait un destinataire muni de la capability, puis mesure **sur les
octets reçus** :

```
résultat HTTP         200 OK
content-type          application/pdf
octets reçus          107 576              ≡ taille enregistrée      MATCH
en-tête de fichier    %PDF-
SHA-256 côté client   e70bff15f279…        ≡ digest enregistré       MATCH
                                           ≡ artefact de référence   MATCH
```

> **Le document REMIS est le document ENREGISTRÉ** — pas seulement une URL qui a été générée.

---

## C · DOMAINE CANONIQUE — **GAP**, couche liante établie, cause **NOT_ESTABLISHED**

> **UN 403 N'EST PAS UNE CAUSE. C'EST UN SYMPTÔME.**

### Ce que la mesure sépare

`app.interligens.com` résout vers **Cloudflare** (`104.26.11.142 · 104.26.10.142 · 172.67.71.211`).

| chemin | code | `x-vercel-id` | couche qui décide |
|---|---|---|---|
| `/` | **403** | **absent** | **Cloudflare**, avant Vercel |
| `/methodology` | **403** | absent | Cloudflare |
| `/robots.txt` | **403** | absent | Cloudflare |
| `/.well-known/source-set.json` | **403** | absent | Cloudflare |
| `/api/health` | **200** | — | l'application répond |
| `/api/casefile/pdf` *(anonyme)* | **401** | **présent** + `x-matched-path` | **l'application**, pas le bord |
| `/api/casefile/pdf` *(principal machine)* | **400** `handle, mint or preset required` | **présent** | **l'application** |

Le corps du 403 est **`Sorry, you have been blocked`** — un **blocage** Cloudflare, pas un défi
JavaScript — et il **persiste** avec en-têtes de navigateur complets (`User-Agent`, `Accept`,
`Accept-Language`).

### Les trois appelants

| appelant | résultat | lecture |
|---|---|---|
| **UNAUTHORIZED CALLER** | 403 au bord sur la surface document · 401 de l'application sur l'API | refus, dont une partie est une **propriété correcte** |
| **AUTHORIZED MACHINE / ADMIN PRINCIPAL** | **400 applicatif**, en-têtes Vercel présents | **traverse le bord et atteint l'application** — aucun bypass gouverné n'a été nécessaire |
| **SIGNED ARTIFACT RECIPIENT** | 200, objet exact | **autre frontière**, autre hôte (R2) : Cloudflare-app n'y intervient pas |

> **PERIMETER PROTECTION IS NOT ADMISSIBLE IF IT BLOCKS THE LEGITIMATE MACHINE PRINCIPAL ABSENT
> GOVERNED BYPASS.**
> **Mesuré : l'invariant n'est PAS violé.** Le principal légitime n'est pas bloqué — il reçoit
> une réponse applicative (400 puis, avec ses paramètres, la remise). Le sondage sans paramètre a
> été choisi précisément pour **ne produire aucun artefact**.

### Ce qui reste GAP

**EXPECTED** la surface document du domaine canonique est atteignable par un lecteur légitime.
**OBSERVED** `403` Cloudflare sur `/`, `/methodology`, `/robots.txt`, `/.well-known/*`, depuis ce
client, avec ou sans en-têtes de navigateur.
**BINDING LAYER** **Cloudflare**, en amont de Vercel — établi par l'absence de `x-vercel-id` sur les
403 et sa présence sur les 401/400.
**CAUSE** **NOT_ESTABLISHED.** Distinguer une règle de bord visant **ce client** (IP, ASN,
réputation) d'une règle visant **tout le monde** demanderait soit un autre point de vue réseau, soit
la console Cloudflare — donc une mutation ou un audit, **tous deux interdits ici**. Un contrôle par
navigateur réel a été proposé et **refusé par l'opérateur** ; il reste donc non exercé, et la
distinction reste ouverte. **NOT_ESTABLISHED est la réponse valide.**
**MINIMUM CORRECTION SURFACE** une règle de bord Cloudflare sur le domaine, **hors dépôt**.
**REQUIRES DEPLOY?** **no.**
**REQUIRES EXTERNAL CONFIG CHANGE?** **yes** — Cloudflare, pas Vercel, pas le code.

### L'arbitrage que cela tranche

**L'objet est délivrable.** Le problème n'est donc **pas** `DELIVERY AUTHORITY` : c'est
**EXPERIENCE / ROUTING**, borné à la surface document du domaine canonique, et hors du dépôt.

---

## LES SEPT CRITÈRES DE MET

| | critère | verdict |
|---|---|---|
| 1 | artefact `REGISTERED` / délivrable selon son autorité | ✅ |
| 2 | `delivrerUrlSignee` **refuse** sans autorité adéquate | ✅ en vif sur l'absence de ligne · différentiel des quatre états tenu par le témoin T3 (déclaré comme unitaire) |
| 3 | capability temporaire réellement émise pour l'objet gouverné | ✅ `issued=yes`, 900 s |
| 4 | le destinataire récupère réellement l'objet | ✅ HTTP 200, `application/pdf` |
| 5 | octets reçus = 107 576 | ✅ |
| 6 | SHA-256 côté client == digest enregistré | ✅ MATCH |
| 7 | aucun contournement de frontière publication/accès | ✅ aucun |

---

## DÉCLARATION D'ÉCART

| Autorisé | Exercé |
|---|---|
| mesure seule, aucun build/WAF/deploy/DDL/lease/artefact | **tenu** — aucune écriture métier, aucun artefact produit, aucun état d'artefact modifié |
| exercer `delivrerUrlSignee` sans write | **exercé** — quatre appels, dont trois contrôles négatifs |
| witness de destinataire, mesure côté client | **exercé** — octets et SHA-256 recalculés sur ce qui est reçu |
| qualifier la couche qui refuse | **exercé** — Cloudflare établi par l'absence/présence de `x-vercel-id`, jamais déduit du seul code HTTP |
| contrôle légitime borné sur le domaine | **exercé** — quatre chemins, deux jeux d'en-têtes, trois appelants. **Rien d'autre** |
| ne pas déduire la cause du seul code HTTP | **tenu** — et la cause exacte est rendue **NOT_ESTABLISHED** plutôt que devinée |
| contrôle par navigateur réel | **non exercé — refusé par l'opérateur.** La distinction « ce client » vs « tout client » reste ouverte, et c'est dit |
| ligne de registre non-`REGISTERED` en vif | **non exercé** — il n'en existe aucune, et en créer une serait une écriture. Borne déclarée |
| audit WAF · inventaire de règles · scan d'endpoints · historique · revue de sécurité | **non exercés** |
| second dossier · UX counsel · remédiation WAF · audit Cloudflare · BOTIFY · X · résiduels sécurité · 91 runtimes · réconciliateur · `MINT_TO_CASE` | **non ouverts** |
| corriger quoi que ce soit | **non exercé** — `TU NE CORRIGES RIEN` |

Aucune valeur de capability n'apparaît dans ce dossier, ni dans un fichier du dépôt, ni dans un
journal. Vocabulaire de preuve : `PRESENT/ABSENT · MATCH/NO_MATCH · ACCEPTED/REFUSED`, empreintes
tronquées.
