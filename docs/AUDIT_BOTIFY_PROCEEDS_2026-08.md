# AUDIT BOTIFY — CHIFFRES DE PROCEEDS DANS LES DOCUMENTS PRODUITS

**Date de l'audit :** 2026-08-16
**Objet :** déterminer si un chiffre issu du pipeline « proceeds » d'INTERLIGENS figure dans un document, un export ou un casefile déjà produit, dans le cadre du dossier BOTIFY suivi avec un procureur français.
**Mode :** lecture seule stricte. Aucune donnée modifiée, aucun document réécrit, aucun objet supprimé. Les versions historiques sont intactes.
**Destinataire :** conseil juridique.
**Code audité :** `main` = `5bed649`, identique au code de production `1178ab8` (`git diff --stat` = 1 fichier de documentation).

---

## 0. Réponse en une ligne

**OUI.** Un chiffre issu du pipeline proceeds figure dans **31 documents PDF archivés**, datés du 2026-07-18 au 2026-08-16, portant la mention **« CONFIDENTIEL — usage judiciaire »**, et dans **un générateur de plainte** qui contient des montants différents. **Aucune trace de transmission n'existe dans le système** — l'audit établit ce que les documents contiennent, pas à qui ils ont été remis.

---

## 1. Le document principal : le dossier PDF @GordonGekko

### 1.1 Existence et inventaire

Le moteur `src/lib/pdf/engine.ts` génère un dossier PDF par profil KOL et écrit **deux objets** dans le bucket R2 `interligens-reports` (`src/lib/pdf/engine.ts:459-471`) :

- `reports/{handle}/latest.pdf` — écrasé à chaque génération ;
- `reports/{handle}/CASE_{handle}_{horodatage-ISO}.pdf` — **copie d'archive horodatée, jamais écrasée, jamais supprimée**.

Inventaire complet du préfixe `reports/` au 2026-08-16 (`ListObjectsV2`, lecture seule) :

| Handle | Objets | Période couverte |
|---|---:|---|
| **GordonGekko** | **31** | 2026-07-18 04:38:57 → 2026-08-16 04:22:56 |
| deployer_pool | 5 | 2026-07-30 → 2026-08-13 |
| **Total** | **36** | — |

29 profils portent un `pdfUrl` en base ; **seuls 2 ont des objets réellement présents en R2**. La génération est déclenchée par le cron quotidien `/api/cron/helius-scan` (`vercel.json` : `0 4 * * *`) lorsque le nombre d'événements de proceeds du handle a changé (`src/app/api/cron/helius-scan/route.ts:87-95`).

### 1.2 Contenu exact du document le plus récent

Document analysé : `reports/GordonGekko/CASE_GordonGekko_2026-08-16T04-22-56.pdf`
Taille : 182 301 octets · `LastModified` R2 : 2026-08-16T04:22:56Z
**SHA-256 de la copie extraite pour cet audit : `b5598a394948450d6c18ceb287737d0864395427c8d2d50b900e3b53a0a928cf`**

Extraits littéraux (extraction texte, `pdftotext -layout`) :

**En-tête :**
```
INTERLIGENS — INTELLIGENCE DOSSIER
@GORDONGEKKO                                                    70
                                                       DOSSIER COMPLET
X•  CRITICAL                                        Généré le : 2026-08-16
                                                           Version : 115
                                                       TX on-chain : 125
                                                            Wallets : 14
```

**Bandeau de chiffres :**
```
   $580K                    125                    14                  4
   CASHOUTS DOCUMENTÉS      TRANSACTIONS TRACÉES   WALLETS IDENTIFIÉS  PREUVES OFF-CHAIN
```

**Tableau des cashouts — titre et première ligne :**
```
CASHOUTS ON-CHAIN — TOP 30 / 125 TX — TOTAL $579 645

 DATE          TOKEN     USD         TX HASH                     TYPE             SOURCE PRIX
 2024-11-04    BOTIFY    $485 000    ARKHAM-SUMMARY-GordonG…     SUMMARY_ARKHAM   ARKHAM_CSV
 2025-05-19    BOTIFY    $2 057      5UAGnT9jy1YQTGmrBAZJCW…     dex_sell         binance_historical
 2025-05-21    BOTIFY    $1 976      3DviDhofEotvWn6LFWrQKg…     dex_sell         binance_historical
 …
 + 95 transactions supplémentaires en DB (non affichées)
```

**Note de méthodologie (bas de page) :**
```
INTERLIGENS — MÉTHODOLOGIE : Les montants USD sont estimés sur la base du prix SOL au moment de
la transaction (source : Binance klines via PriceCache, ou estimation de repli si non disponible
±25%). Les wallets verified_onchain ont été vérifiés via Arkham Intelligence ou preuves on-chain
directes. Ce document est généré automatiquement et constitue un premier niveau d'analyse — il ne
remplace pas une investigation judiciaire complète. Score 70/100 — DOSSIER COMPLET.
```

**Pied de page :**
```
INTERLIGENS — app.interligens.com — 2026-08-16
@GordonGekko — v115 — 125 TX — Score 70/100
CONFIDENTIEL — usage judiciaire
```

### 1.3 Les quatre difficultés du document, énoncées factuellement

**(a) Une ligne d'import CSV figure dans un tableau intitulé « CASHOUTS ON-CHAIN ».**
La ligne `2024-11-04 | BOTIFY | $485 000` occupe la colonne « TX HASH » avec la valeur `ARKHAM-SUMMARY-GordonG…`. Cette valeur n'est pas une signature de transaction Solana : c'est la chaîne synthétique `ARKHAM-SUMMARY-GordonGekko-BOTIFY-2026`. La ligne correspondante en base porte `walletAddress = "ARKHAM-SUMMARY"`, `caseId = NULL`, `eventDate = 2024-11-04 00:00:00` (valeur de remplissage identique pour les 6 lignes de ce type) et la note `"Arkham CSV analysis — BEFTI dossier 2026"`. Elle a été créée le 2026-04-22 à 18:06:22.

Les colonnes « TYPE » (`SUMMARY_ARKHAM`) et « SOURCE PRIX » (`ARKHAM_CSV`) signalent la nature de la ligne — l'information n'est donc pas dissimulée. Mais **le titre du tableau, le total qu'il affiche et le compteur « TRANSACTIONS TRACÉES : 125 » l'intègrent sans distinction** aux observations on-chain.

**(b) 83,7 % du chiffre affiché provient de cette seule ligne.**

| Composante | Montant | Nb de lignes | Nature |
|---|---:|---:|---|
| Import CSV Arkham | **485 000 $** | 1 | tierce, non sourcée dans le système |
| Observations on-chain (Helius + prix Binance/repli) | **94 645 $** | 126 | transactions Solana référençables |
| **Total affiché** | **579 645 $** | 127 | — |

**(c) La note de méthodologie décrit une catégorie de wallets absente du document.**
Elle affirme que « les wallets `verified_onchain` ont été vérifiés via Arkham Intelligence ou preuves on-chain directes ». Or les **14 wallets** listés dans ce même document portent tous le statut **`source_attributed`** — aucun n'est `verified_onchain`. La phrase décrit une catégorie vide dans ce dossier.

**(d) La marge annoncée est inférieure à la marge constatée.**
La note annonce « ±25 % » pour l'estimation de repli. La table de repli est une constante codée en dur (`src/lib/kol/pricing.ts:21-24`) : SOL = 145 $ pour 2025, 185 $ pour 2026. Sur la même période, les prix réellement relevés via Binance et stockés dans `PriceCache` s'échelonnent de **117,17 $ à 257,36 $**. L'écart maximal du repli par rapport au prix réel atteint donc **environ ±40 %**, et non ±25 %. Trois lignes visibles du tableau (`2025-05-11`, `2025-05-10`, `2025-05-08`, 997 $ chacune) portent la mention `yearly_fallback`.

### 1.4 Stabilité du chiffre dans le temps

Document le plus ancien conservé : `CASE_GordonGekko_2026-07-18T04-38-56.pdf`
Taille : 182 303 octets · **SHA-256 de la copie extraite : `02e2cebabde88795040f55de4287fddcef1e0a3b947aa4112f9b4b2edae0d274`**

```
Généré le : 2026-07-18                          Version : 86
$580K   CASHOUTS DOCUMENTÉS
CASHOUTS ON-CHAIN — TOP 30 / 125 TX — TOTAL $579 645
2024-11-04   BOTIFY   $485 000   ARKHAM-SUMMARY-GordonG…   SUMMARY_ARKHAM   ARKHAM_CSV
```

**Le chiffre `579 645 $` et la ligne `485 000 $` sont identiques dans les deux versions.** Ils sont donc stables sur au moins les 31 documents archivés, du 2026-07-18 au 2026-08-16. Le numéro de version passe de 86 à 115 : le document a été régénéré 29 fois sur la période sans que le montant change.

Les 29 documents intermédiaires n'ont pas été extraits un par un. Leurs tailles (182 102 à 182 699 octets) sont homogènes, ce qui est cohérent avec un contenu stable, mais **ce n'est pas une preuve de contenu identique** — seuls les deux documents ci-dessus ont été lus.

---

## 2. Le second artefact : le générateur de plainte, préréglage `botify`

`src/lib/plainte/data.ts` contient un jeu de données `BOTIFY_DATA` utilisé par la route admin `POST /api/admin/plainte/generate` (préréglage `botify`) pour produire un dossier PDF de plainte à en-tête INTERLIGENS.

Contenu exact des éléments chiffrés (`src/lib/plainte/data.ts:183-224`) :

```
nom            : "BOTIFY — KOL Pump & Dump coordonné"
mint           : BYZ9CcZGKAXmN2uDsKcQMM9UnZacija4vWcns9Th69xb
datesFaits     : "Janvier 2025 — Mars 2026"
prejudiceEUR   : 557 000
prejudiceUSD   : 604 489
juridiction    : FR
plaignantNom   : "David DOUVILLE"
plaignantQualite: "Victime directe — fondateur INTERLIGENS"

suspects (extrait) :
  { handle: "GordonGekko", wallet: "0xa5B0eDF…01D41", cashout: 40627,  certitude: "ETABLI" }
  { handle: "EduRio",      cashout: 347237, cex: "MEXC",  certitude: "ETABLI" }
  { handle: "MoneyLord",   cashout: 85484,  cex: "Bybit", certitude: "ETABLI" }
  { handle: "ElonTrades",  cashout: 53313,  cex: "MEXC",  certitude: "ETABLI" }

preuvesCles :
  D-002 | statut: "CONSTATE" | force: "HAUTE"
        | nature: "Rapport scan INTERLIGENS"
        | description: "41 KOLs scannés — 295 événements cashout — $604 489 documentés
                        — 28 KOLs avec activité"
```

### 2.1 Confrontation à la base de production, au 2026-08-16

| Assertion du préréglage | Valeur affirmée | État de `ep-square-band` aujourd'hui | Reproductible ? |
|---|---:|---|---|
| GordonGekko `cashout` | **40 627 $** | `KolTokenInvolvement` (BOTIFY) = 40 627 $, `lastComputedAt` = **2026-04-11** | Oui, mais figé depuis 127 jours |
| EduRio `cashout` | **347 237 $** | `KolProceedsEvent` : **0 ligne** · `KolProfile.totalDocumented` = **0** | **Non** |
| MoneyLord `cashout` | **85 484 $** | `KolProceedsEvent` : **0 ligne** · `totalDocumented` = **0** | **Non** |
| ElonTrades `cashout` | **53 313 $** | `KolProceedsEvent` : **0 ligne** · `totalDocumented` = **0** | **Non** |
| D-002 « 41 KOLs scannés » | 41 | 31 handles présents dans `KolProceedsEvent` | **Non** |
| D-002 « 295 événements cashout » | 295 | 5 602 lignes (dont 5 526 non ambiguës) | **Non** |
| D-002 « **604 489 $ documentés** » | **604 489 $** | somme non ambiguë, tous handles : **17 489 927 $** | **Non** |
| D-002 « 28 KOLs avec activité » | 28 | 26 handles avec somme non ambiguë > 0 | **Non** |
| `prejudiceUSD` | 604 489 $ | égal au total D-002, donc même origine | **Non** |

**Cinq des huit assertions chiffrées de la pièce D-002 et des suspects ne sont pas reproductibles à partir de la base actuelle.**

### 2.2 Pourquoi elles ne le sont pas — cause technique établie

`src/lib/kol/proceeds.ts:231-234` :

```sql
DELETE FROM "KolProceedsEvent" WHERE "kolHandle" = $1 AND "eventType" != 'SUMMARY_ARKHAM'
```

À chaque recalcul, la fonction `computeProceedsForHandle` **supprime l'intégralité des événements on-chain du handle** avant de réinterroger l'API Helius et de réécrire. Il n'existe ni transaction englobante, ni sauvegarde, ni conservation des réponses brutes du fournisseur.

Conséquence directe : **l'état du scan qui a produit « 295 événements — 604 489 $ » n'existe plus et ne peut pas être reconstitué.** Les événements des handles EduRio, MoneyLord et ElonTrades ont disparu de la base à l'occasion d'un recalcul ultérieur ; les chiffres qui leur sont attribués dans le préréglage subsistent uniquement comme littéraux dans le code source.

### 2.3 Aucune persistance, aucune trace

La route `/api/admin/plainte/generate` (lue intégralement) **ne persiste rien** : pas d'écriture en base, pas d'objet R2, pas de ligne d'audit. Elle rend le PDF en `Content-Disposition: attachment`. Le système ne conserve donc **aucun enregistrement** indiquant qu'un dossier de plainte a été généré, quand, par qui, ni avec quelles valeurs.

---

## 3. Divergence entre les artefacts

Trois artefacts produits par INTERLIGENS, portant tous sur @GordonGekko et le dossier BOTIFY, énoncent trois montants différents :

| Artefact | Montant @GordonGekko | Qualification portée par le document |
|---|---:|---|
| Dossier PDF R2 (31 versions, 2026-07-18 → 2026-08-16) | **579 645 $** | « CASHOUTS DOCUMENTÉS », « CASHOUTS ON-CHAIN », « CONFIDENTIEL — usage judiciaire » |
| API `/api/kol/GordonGekko/proceeds` (production, ce jour) | **579 645 $** en total, **94 644,79 $** dans sa propre ventilation annuelle | `pricingQuality: "high"`, `coverageStatus: "partial"` |
| Générateur de plainte, préréglage `botify` | **40 627 $** | `certitude: "ETABLI"` |

Le rapport entre le plus élevé et le plus bas est de **14,3**.

Réponse littérale de l'API en production le 2026-08-16 (capture) :

```json
{"found":true,"handle":"GordonGekko",
 "totalProceedsUsd":579645,
 "proceedsByYear":{"2025":94644.79000000005},
 "topTokenSymbol":"BOTIFY","topTokenProceedsUsd":40627.03999999999,
 "eventCount":128,"walletCount":14,"confidence":"medium",
 "computedAt":"2026-08-16T04:22:49.940Z",
 "coverageStatus":"partial","pricingQuality":"high"}
```

Les trois montants coexistent dans cette unique réponse : 579 645 en total, 94 644,79 en ventilation, 40 627,04 en `topTokenProceedsUsd`.

Le même phénomène est vérifié en production sur `/api/watchlist` (capture du 2026-08-16), qui rend pour chaque personne deux champs contradictoires dans le même objet :

| handle | `totalProceeds` | `cashout.total` | rapport |
|---|---:|---:|---:|
| GordonGekko | 579 645 | 40 627,04 | ×14,3 |
| bkokoski | 210 900 | 1 076,62 | ×195,9 |
| sxyz500 | 141 594 | 4 356,49 | ×32,5 |
| orbitape | 817 000 | 0 | — |

---

## 4. Traces de transmission : ce que le système sait et ne sait pas

### 4.1 Aucune trace de remise

Recherche exhaustive des enregistrements susceptibles d'attester une transmission :

| Piste | Résultat |
|---|---|
| `/api/pdf/{handle}` (accès au dossier PDF) | **aucune journalisation** dans le code de la route |
| `/api/pdf/kol` (dossier admin à la demande) | **aucune journalisation** |
| `/api/admin/plainte/generate` | **aucune journalisation, aucune persistance** |
| `EvidenceAccessLog` (2 191 lignes) | actions `INGEST` (1 071), `VERIFY` (1 070), `READ` (50) — porte sur les pièces `EvidenceItem`, pas sur les dossiers PDF. Dernier `READ` : 2026-07-30 15:08 |
| `InvestigatorAuditLog` (274 lignes) | `login_success`, `nda_accepted`, `logout`, événements de facturation. **Aucun événement d'export ou de téléchargement** |
| `AuditLog` | **0 ligne** |
| `CaseExport` | **1 ligne** — voir §4.2 |
| Envois d'e-mail | `WatcherDigest` (4 lignes, dernier envoi 2026-06-29) : digests de veille, sans montant de proceeds |

**Conclusion : le système ne conserve aucun enregistrement de transmission de document.** L'absence de trace n'est pas une preuve de non-transmission — c'est une absence de dispositif.

### 4.2 Le seul export enregistré du système

```
id            : cmoou507r000hit4meg8vazf1
caseId        : cmoou09tq0001110a4tbmktez
exportFormat  : POLICE_ANNEX_PDF
exportedBy    : dood-test
includedCounts: {"DOMAIN": 1, "WALLET": 1, "X_HANDLE": 2}
iocCount      : 4
snapshotCount : 0
contentHash   : e22835fa4f8d98a2e8dc45fb22aa45b97ee02e3212d359a1d549d103d4c6300d
createdAt     : 2026-05-02 21:09:56
```

Le dossier exporté contient **4 entités**, toutes créées le 2026-05-02 :

| type | valeur | tigerScore | enrichedAt |
|---|---|---|---|
| WALLET | `4LeQ2gYL7rv4GBhAJu2kwetbQjbZ3cHPsEwJYwE3CGE4` | NULL | NULL |
| HANDLE | `@bkokoski` | NULL | NULL |
| HANDLE | `@GordonGekko` | NULL | NULL |
| DOMAIN | `botify-claim.com` | NULL | NULL |

**Cet export porte bien sur le dossier BOTIFY.** Il ne contient toutefois **aucun montant** :

1. le générateur `src/lib/vault/iocExportPdf.ts` (589 lignes, lu intégralement) rend un tableau d'indicateurs — type, valeur, chaîne, date de première observation, confiance, publiabilité, notes — et **n'imprime aucune valeur monétaire** ;
2. les 4 entités ont `enrichedAt = NULL` : le chemin d'enrichissement `/api/investigators/cases/[caseId]/entities/enrich`, qui est le seul à injecter `totalDocumented` dans une entité de dossier, **n'a jamais été exécuté sur elles**.

**Le seul export tracé du système ne véhicule donc aucun chiffre de proceeds.**

### 4.3 Portée de l'exposition des 31 PDF

| Voie d'accès | État vérifié |
|---|---|
| `https://pub-interligens.r2.dev/reports/GordonGekko/latest.pdf` | **HTTP 401** — le domaine public R2 n'est pas activé sur le bucket. La variable `R2_PUBLIC_BASE_URL` est absente de l'environnement de production ; l'`archiveUrl` construit par le moteur (`engine.ts:475`) est un lien mort |
| `GET /api/pdf/GordonGekko` sans authentification | **HTTP 401** |
| `GET /api/pdf/GordonGekko` avec un cookie beta arbitraire | **HTTP 401** — cette route valide la session en base (`validateSession`), contrairement au reste du périmètre nominatif |
| Accès direct au bucket | requiert les identifiants R2 |
| Portée du proxy | `latest.pdf` uniquement — les 30 archives horodatées ne sont exposées par aucune route |

**Les 31 documents ne sont pas accessibles publiquement.** Leur diffusion, si elle a eu lieu, s'est faite hors du système.

---

## 5. Ce qui est établi, ce qui ne l'est pas

### Établi par preuve directe

1. 31 dossiers PDF @GordonGekko existent en R2, du 2026-07-18 au 2026-08-16, chacun horodaté et conservé. *(inventaire `ListObjectsV2`)*
2. Le plus récent et le plus ancien affichent le montant **579 645 $** sous le libellé « CASHOUTS DOCUMENTÉS » / « CASHOUTS ON-CHAIN », et portent la mention **« CONFIDENTIEL — usage judiciaire »**. *(extraction texte, SHA-256 des copies consignés au §1.2 et §1.4)*
3. **485 000 $ de ce montant, soit 83,7 %, proviennent d'une unique ligne d'import CSV Arkham** dont la « TX HASH » est une chaîne synthétique et le « wallet » la valeur littérale `ARKHAM-SUMMARY`. *(requête sur `KolProceedsEvent`, `eventType = 'SUMMARY_ARKHAM'`)*
4. Le montant est stable sur toute la période et le document a été régénéré 29 fois (versions 86 → 115) sans qu'il change.
5. Le préréglage de plainte `botify` porte un montant différent pour la même personne (**40 627 $**, `certitude: "ETABLI"`) et une pièce D-002 affirmant **604 489 $** avec le statut `CONSTATE`.
6. **Cinq des assertions chiffrées de ce préréglage ne sont pas reproductibles** à partir de la base de production actuelle, dont les cashouts attribués à EduRio, MoneyLord et ElonTrades, qui n'ont aujourd'hui **aucun événement en base**.
7. La cause est identifiée : `computeProceedsForHandle` supprime les événements avant de les réécrire, sans transaction ni conservation des données brutes.
8. Le seul export tracé du système (POLICE_ANNEX_PDF, 2026-05-02) porte sur le dossier BOTIFY mais **ne contient aucun montant**.
9. Les 31 PDF ne sont accessibles ni publiquement, ni via un cookie beta forgé.

### Non établi — limites de l'audit

1. **Transmission.** Le système ne journalise aucun téléchargement, aucun envoi, aucune remise de dossier PDF ou de plainte. Il est **techniquement impossible**, depuis les données du système, de dire si l'un de ces documents a été transmis à un tiers, y compris à un magistrat. Seul l'auteur des envois peut le dire.
2. **Contenu des 29 PDF intermédiaires.** Seuls les documents du 2026-07-18 et du 2026-08-16 ont été extraits et lus. L'homogénéité des tailles (182 102–182 699 octets) est cohérente avec un contenu stable, mais n'en constitue pas la preuve.
3. **Documents antérieurs au 2026-07-18.** Aucune archive ne remonte au-delà. Les versions 1 à 85 du dossier @GordonGekko ne sont pas conservées : `pdfVersion` vaut 115 aujourd'hui et seules les versions 86+ ont laissé un objet. Ce qu'affichaient les versions antérieures est **irrécupérable**.
4. **Documents produits hors du système.** Captures d'écran, copies, exports manuels, pièces jointes d'e-mail : hors de portée de cet audit.
5. **Un dossier de plainte a-t-il été généré ?** Sans persistance ni journal, la question n'a pas de réponse dans le système. L'audit établit uniquement **ce que le générateur produirait aujourd'hui**.
6. **Vérification indépendante des montants.** Cet audit **ne se prononce pas** sur l'exactitude matérielle des 579 645 $, 604 489 $ ou 40 627 $. Il établit qu'ils divergent entre eux, que 83,7 % du premier repose sur un import non sourcé, et que la majorité des composantes du deuxième ne sont pas reproductibles. Établir le montant réel suppose une réinvestigation on-chain, hors périmètre.

---

## 6. Conservation

Conformément à la doctrine du chantier, **rien n'a été supprimé, modifié ni réécrit** :

- les 31 objets R2 sont intacts ;
- `KolProceedsEvent`, `KolProceedsSummary`, `KolProfile.totalDocumented` et `KolTokenInvolvement` sont inchangés ;
- `src/lib/plainte/data.ts` est inchangé ;
- les copies extraites pour l'analyse sont hors du dépôt, dans le répertoire de travail temporaire de la session, avec leurs empreintes SHA-256 consignées au §1.2 et §1.4.

Toute mesure de retrait décidée ultérieurement devra préserver ces versions historiques : elles constituent la seule trace de ce qui a été affirmé et à quelle date.

---

*Audit réalisé le 2026-08-16 en lecture seule contre la base de production `ep-square-band` (`SET default_transaction_read_only = on`) et le bucket R2 `interligens-reports` (`ListObjectsV2` et `GetObject` uniquement). Sondes de production limitées à des requêtes `GET`.*
