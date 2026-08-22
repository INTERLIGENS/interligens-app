# PRÉPARATION — LA CONCENTRATION DANS LES CASEFILES

**Date :** 2026-08-16 · **Mode :** LECTURE SEULE. Aucune correction, aucun commit de code.
**Objet :** inventorier ce que les casefiles publiés affirment sur la concentration des
détenteurs, d'où viennent ces chiffres, et quelles claims sont promues en « Corroborated »
par `fetchHolders` aujourd'hui.

**Priorité fixée par David : la promotion live des claims par `/api/casefile`, pas les
constantes du PDF.** Ce document suit cet ordre.

---

# 🛑 AVERTISSEMENT — NE PAS « CORRIGER » LA COQUILLE DU MINT

## `UnZacja4` / `UnZacija4` n'est pas une faute de frappe à nettoyer

Deux chaînes cohabitent dans le dépôt, à une lettre près :

```
UnZacja4    ← clé de routage : CASE_DB, handleToMint.ts:19, presets.ts:150, pdf/route.ts:44
UnZacija4   ← mint réel, on-chain, affiché dans presets.ts:57
```

Cela **ressemble** à une coquille. Un passage de nettoyage, une revue de cohérence, un
linter maison, un « tiens, il y a deux mints BOTIFY » — n'importe lequel de ces gestes
conduit à les aligner.

**Les aligner ARME la promotion des claims. Cela ne la répare pas.**

Aujourd'hui, `CASE_DB` est indexé sur le mint synthétique. La chaîne le refuse
(`Invalid param: not a Token mint`, vérifié). Les 8 claims du dossier BOTIFY et les données
on-chain sont donc indexées sur deux mints différents et **ne se rencontrent jamais**. C'est
la seule raison pour laquelle C5 et C7 ne passent pas en « Corroborated ».

Le jour où quelqu'un met la même valeur des deux côtés :

- `fetchHolders` reçoit un mint qui existe et rend un chiffre ;
- ce chiffre est le rapport **top-10 / top-20**, ≥ 50 % par construction ;
- le seuil de 40 % est franchi ;
- **C5 (« Fake metrics / bots ») et C7 (« Friends & Family insiders ») passent en
  « Corroborated »**, et +10 s'ajoute au score.

Sur une allégation nominative — C7 nomme « Mom », « Dad », « Illya », « SAM insiders » —
c'est un changement de **statut probatoire** déclenché par une correction cosmétique.

## Rien ne doit être touché ici avant que DEUX choses soient tranchées

1. **Le dénominateur.** Voir §1.2. Il n'est pas le supply.
2. **Le seuil de 40 %.** Il a été choisi pour un rapport top-10 / top-20. Il ne veut rien
   dire sur une vraie concentration.

Tant que ces deux points ne sont pas arbitrés, la divergence des mints est la **seule chose
qui empêche** la promotion de se déclencher. Elle tient lieu de garde-fou involontaire. On ne
retire pas un garde-fou parce qu'il a l'air d'être là par erreur.

## Et le fond du problème n'est pas un filtrage

Le lot précédent a corrigé une mesure de concentration qui comptait la courbe de bonding et
les pools comme des détenteurs : c'était une concentration **mal filtrée**.

Ici, ce n'est pas de la même nature. **Le rapport top-10 / top-20 n'est pas une mesure de
concentration du tout.** Il ne dit pas quelle part du supply est détenue par les plus gros ;
il dit quelle part des 20 plus gros comptes est détenue par les 10 premiers d'entre eux —
une quantité qui vaut ≥ 50 % pour n'importe quel token de l'univers, y compris parfaitement
distribué. Mesuré : **TOESCOIN, concentration réelle 19,2 %, produit 62,9 %.**

Aucun filtrage, aucune exclusion de programme, aucun ajustement de seuil ne rend cette
formule correcte. Elle doit être remplacée, pas améliorée.

---

## 0. Verdict en cinq lignes

`/api/casefile` promeut deux claims de « Referenced » à **« Corroborated »** sur un seuil de
40 % appliqué à un chiffre qui **n'est pas une concentration**. Le dénominateur n'est pas le
supply, c'est **la somme des 20 plus gros comptes** — donc le rapport top-10 / top-20 est
mathématiquement ≥ 50 % et vaut en pratique **62,9 % à 100 %** sur tous les tokens mesurés.
Le seuil est **structurellement toujours franchi**. La promotion ne se déclenche pas
aujourd'hui, mais par accident : le RPC public rend 429 et la clé du dossier BOTIFY est un
mint qui n'existe pas sur la chaîne. Les deux accidents peuvent cesser à tout moment.

---

## 1. LE POINT URGENT — la promotion live par `/api/casefile`

### 1.1 Le mécanisme

`src/app/api/casefile/route.ts:137-153`, fonction `linkEvidence` :

```ts
const top10 = parseFloat(onChain?.distribution?.top10_pct ?? "0");
const liq   = Number(onChain?.markets?.liquidity_usd ?? 0);

if ((c.id==="C5"||c.id==="C7") && top10 > 40) {
  checks.push({check:"top10_concentration", result:`Top-10: ${top10}%`});
  status = "Corroborated";                     // ← Referenced -> Corroborated
}
if (c.id==="C1" && liq > 0 && liq < 100000) {
  checks.push({check:"low_liquidity", result:`Liquidity: $${liq.toLocaleString()}`});
  status = "Corroborated";
}
```

Et `computeScore` (`route.ts:172-176`) ajoute en plus :

```ts
const corroborated = linking.filter(l => l.final_status==="Corroborated").length;
score += Math.min(corroborated * 5, 15);
const top10 = parseFloat(onChain?.distribution?.top10_pct ?? "0");
if (top10 > 40) score += 10;
```

**Les claims concernées** (`CASE_DB`, `route.ts:22-77`) :

| id | sujet | promue par |
|---|---|---|
| **C5** | *Fake metrics / bots* | concentration > 40 % |
| **C7** | *Friends & Family insiders* | concentration > 40 % |
| C1 | *Budget marketing* | liquidité entre 0 et 100 000 $ |

C5 et C7 sont des allégations nominatives — C7 nomme « Mom 0,055 %, Dad 0,055 %, Illya
0,05 % + SAM insiders 0,25 % ». Les promouvoir en « Corroborated » fait passer une
affirmation du statut de *référencée* à celui de *corroborée par la chaîne*. C'est un
changement de **statut probatoire**, pas d'affichage.

### 1.2 Le défaut — ce n'est pas une mesure de concentration

`src/app/api/casefile/route.ts:112-133`, fonction `fetchHolders` :

```ts
const holders = d?.result?.value ?? [];              // getTokenLargestAccounts -> 20 comptes
if (!holders.length) return null;
const total = holders.reduce((s,h) => s + Number(h.uiAmount||0), 0);   // ← LES 20 COMPTES
if (!total) return null;
const top10 = holders.slice(0,10).reduce((s,h) => s + Number(h.uiAmount||0), 0);
return { …, top10_pct: ((top10/total)*100).toFixed(1) };
```

`total` est la somme des **20 comptes rendus par l'appel**, pas le supply du token. Le
`top10_pct` publié est donc le rapport **top-10 / top-20**, une quantité qui vaut
mécaniquement ≥ 50 % puisque les 10 premiers sont les plus gros des 20.

**Aucun appel à `getTokenSupply` n'existe dans cette route.**

Il ne s'agit donc pas d'une concentration mal filtrée, comme celle corrigée dans le lot
précédent. **Ce n'est pas une mesure de concentration.** La quantité calculée ne répond pas à
la question « quelle part du supply les plus gros détiennent-ils ? » mais à « quelle part des
20 plus gros comptes les 10 premiers représentent-ils ? » — dont la réponse est ≥ 50 % pour
tout token existant. Elle doit être remplacée, pas ajustée.

### 1.3 Mesure — ce que la route calculerait si le fournisseur répondait

Reproduction exacte de `fetchHolders`, données Helius, 2026-08-16 :

| token | `top10_pct` calculé par la route | concentration réelle (top-10 / supply) | seuil 40 % |
|---|---:|---:|---|
| GHOST | **97,3 %** | 93,5 % | **franchi** |
| ANSEM | **95,8 %** | 62,7 % | **franchi** |
| OLTSESON | **100,0 %** | 100,0 % | **franchi** |
| BOTIFY (mint réel) | **91,9 %** | 53,4 % | **franchi** |
| **TOESCOIN** | **62,9 %** | **19,2 %** | **franchi** |

**TOESCOIN est le cas qui disqualifie la méthode** : un token dont les 10 plus gros comptes
détiennent **19,2 %** du supply — une répartition ordinaire — produit un `top10_pct` de
**62,9 %** et fait passer C5 et C7 en « Corroborated ».

Le seuil de 40 % n'est pas un seuil : c'est une formalité. Sur les cinq tokens mesurés, il
est franchi cinq fois sur cinq.

À cela s'ajoute le défaut déjà traité côté score : **les comptes de programme ne sont pas
exclus** — la courbe de bonding pump.fun et les pools comptent comme des détenteurs. Les
deux défauts sont indépendants et se cumulent.

### 1.4 Pourquoi la promotion ne se déclenche pas aujourd'hui

Deux accidents, aucun n'est une protection.

**Accident 1 — le fournisseur rend 429.** `fetchHolders` interroge
`https://api.mainnet-beta.solana.com`. Mesuré à l'instant, quatre tentatives espacées :

```
HTTP 429  {"jsonrpc":"2.0","error":{"code":429,"message":"Too many requests for a specific RPC call"}}
```

La fonction **ne teste pas `res.ok`**. Elle lit `d?.result?.value`, obtient `undefined`,
applique `?? []`, trouve un tableau vide et rend `null`. Le corps d'erreur est avalé.
Ensuite `parseFloat(null ?? "0")` vaut **0**, donc aucune promotion — et
`distribution.top10_pct` sort à `null` sans qu'aucun marqueur ne dise pourquoi.

C'est exactement la famille de défaut corrigée ailleurs dans le lot précédent
(« NO DATA ≠ NO RISK »), encore présente ici. Une panne du fournisseur y produit
« concentration nulle », pas « concentration inconnue ».

**Accident 2 — la clé du dossier BOTIFY est un mint inexistant.**

```
route.ts:6   const BOTIFY_MINT = "BYZ9CcZGKAXmN2uDsKcQMM9UnZacja4vWcns9Th69xb";   ← UnZacja4
presets.ts:57                    "BYZ9CcZGKAXmN2uDsKcQMM9UnZacija4vWcns9Th69xb"   ← UnZacija4
```

Vérifié sur la chaîne via Helius :

| clé | `getTokenLargestAccounts` |
|---|---|
| `…UnZacja4…` — clé de `CASE_DB`, `handleToMint.ts:19`, `presets.ts:150`, `pdf/route.ts:44` | **`Invalid param: not a Token mint`** |
| `…UnZacija4…` — mint réel, affiché dans le preset | **20 comptes** |

Conséquence sur les deux chemins d'entrée de la route :

| appel | `CASE_DB` | `fetchHolders` | promotion |
|---|---|---|---|
| `?handle=GordonGekko` → `kolHandleToMint` → `UnZacja4` | **8 claims chargées** | mint inexistant → `null` | **non** |
| `?mint=<UnZacija4 réel>` | **aucune claim** (`claims: []`) | 20 comptes → 91,9 % | rien à promouvoir |

Les claims et les données on-chain **ne se rencontrent jamais**, parce qu'elles sont indexées
sur deux mints différents. C'est ce qui neutralise la promotion aujourd'hui.

> ⚠️ Ce n'est pas un bug à corriger à l'aveugle. Le `UnZacja4` synthétique est la clé de
> routage partout (`CASE_DB`, `handleToMint`, `MINT_TO_PRESET`, `pdf/route.ts`) ; seul le
> champ `mint` affiché dans le preset porte le mint réel. Aligner les deux **armerait** la
> promotion au lieu de la corriger.

### 1.5 Qui peut atteindre cette route

`/api/casefile` exige `checkAuth` → **`ADMIN_TOKEN` en Bearer** (`src/lib/security/auth.ts:110-122`),
sans repli. Sonde du 2026-08-16 : `401` en anonyme, `401` avec un cookie beta forgé.

L'exposition est donc **administrateur uniquement**. Elle n'est pas nulle pour autant : c'est
la route qui produit le JSON de dossier, avec `report_hash`, `engine_version` et un
`retail_summary` nominatif — le document qu'un opérateur exporte ou cite.

---

## 2. Les casefiles publiés qui citent une concentration

### 2.1 `/api/casefile/public` — le PDF retail

**Servi en 200.** Capture du 2026-08-16, `?handle=GordonGekko&lang=fr`, 181 705 octets,
SHA-256 `3e9725e6d753dbd932ad9accbfcc87c096d9def2213b3c5cefedeb56366018b6`.

Accès : gate nominatif (cookie beta vérifié **en présence**, pas en validité) + rate-limit
IP `RATE_LIMIT_PRESETS.pdf`.

Extraits littéraux :

```
 33 : La concentration top-3 a atteint 62 % au pic, 78 % en top-10.
178 :   62 %                          78 %                 SCORE DE CONCENTRATION
179 :   CONCENTRATION TOP-3 WALLETS   CONCENTRATION TOP-10
185 :   Score de concentration — ÉLEVÉ (seuil indicateur de risque élevé : top-3 ≥ 40 %).
172 :   Instantané de la distribution on-chain au pic.
        Source : requêtes holders Solscan, recoupées avec rugcheck.xyz.

 89 :   E-0…07   Concentration baleine — Top 3 wallets détiennent 62%
                 tokenomics_risk    2026-08-16    solscan.io    → claim C7
284 :   E-00…    IMG_2245.jpg — Distribution des détenteurs, top-3 wallets détiennent 62 %
                 source « solscan.io holder view »    statut « Referenced »
```

**Origine des chiffres : constantes codées en dur.**
`src/lib/casefile/pdfGeneratorPublic.ts:108-109, 136-138, 184, 211-213, 408`.
L'en-tête du fichier les qualifie de *« documented factual constants »*.

Elles ne sont donc **pas** produites par `fetchHolders`. Elles ont été relevées à la main
depuis une vue holders Solscan, à un « pic » **dont aucune date n'est enregistrée** — ni dans
le code, ni dans le PDF, ni en base.

### 2.2 `src/data/cases/botify.json`

```
161 : "title": "Whale Concentration — Top 3 Wallets Hold 62%"
164 : "At peak, the top 3 holder wallets controlled 62% of circulating supply, indicating
       extreme insider accumulation and the ability to crash price at will."
168 : "thread_url": "https://solscan.io/token/BYZ9CcZGKAXmN2uDsKcQMM9UnZacja4vWcns9Th69xb#holders"
 63 : "caption": "Holder distribution — top 3 wallets hold 62% of supply (insider accumulation)"
```

Même chiffre, même origine. **Le `thread_url` cité comme source pointe sur le mint
synthétique** : le lien mène à une page Solscan qui ne peut rien afficher.

### 2.3 Ce que la base dit du même fait

`TokenLaunchMetric`, ligne BOTIFY, `source: rugcheck`, `computedAt: 2026-04-11 15:23` :

| Source | top-3 | top-10 |
|---|---:|---:|
| **PDF publié** (« au pic ») | **62 %** | **78 %** |
| **`TokenLaunchMetric`** (rugcheck, 2026-04-11) | **33,22 %** | **38,97 %** |
| Mesure du 2026-08-16, programmes exclus | — | 50,3 % |

Le PDF déclare son propre seuil — *« top-3 ≥ 40 % »*. **À 33,22 %, la valeur que vous stockez
ne le franchit pas** ; celle que vous publiez le franchit d'un facteur deux. Aucune des deux
n'est datée quant à son instantané.

Les deux autres lignes de `TokenLaunchMetric` portant une concentration sont à `NULL` ; la
seule renseignée est celle-ci.

### 2.4 Où la concentration n'apparaît PAS

Vérifié par lecture, à titre de délimitation du périmètre :

| Surface | Concentration citée ? |
|---|---|
| Dossier PDF KOL (`src/lib/pdf/engine.ts`, les 31 archives R2) | **non** — wallets, cashouts, preuves off-chain, aucun chiffre de répartition |
| `src/lib/pdf/kol/templateKol.ts` et `templateKolLegal.ts` | **non** |
| Export annexe police (`src/lib/vault/iocExportPdf.ts`) | **non** — IOC seulement, aucun montant, aucune répartition |
| Générateur de plainte (`src/lib/plainte/data.ts`) | **non** — cashouts et préjudice, pas de concentration |
| `/api/casefile/pdf` (admin) | **non** — pas de lecture de `top10` |

Le périmètre « concentration » se limite donc à **`/api/casefile` (live) + le PDF public
BOTIFY + `botify.json` (constantes)**.

### 2.5 Le module qui savait

`src/lib/token/supplyConcentration.ts:12-15`, écrit en V2.3 :

> *« Does NOT filter out LP/CEX/burn accounts — top-N is raw. Can over-report concentration
> for tokens with large pool addresses. Documented as a known limit of V2.3; a future pass
> will apply a known-address mask. »*

Et `src/scripts/seed/tokenLaunchMetric.ts:17` reprend la même réserve en français. **Ce
passage n'a jamais eu lieu.** Le module n'a qu'un appelant, le script de seed ; il n'alimente
pas `/api/casefile`, qui a sa propre implémentation — et celle-ci est pire, puisqu'elle
ajoute le défaut de dénominateur.

---

## 3. Ce qu'il faudra trancher — sans rien décider ici

1. **Le dénominateur.** Passer à `getTokenSupply` change la nature du chiffre. Toute claim
   promue jusqu'ici sur l'ancien calcul l'a été sur une base fausse.
2. **Le seuil de 40 %.** Il a été choisi pour un rapport top-10 / top-20. Sur une vraie
   concentration, sa valeur est à redéfinir — les seuils du moteur de score sont à 60 % et
   80 %.
3. **La promotion elle-même.** Faire dépendre un statut probatoire d'une seule mesure
   automatique, sans relecteur, est la question de fond. `reviewedBy` vaut `"admin"` partout
   ailleurs, et le contrôle éditorial humain n'est démontrable nulle part (Passe B, §E).
4. **Le comportement quand le fournisseur ne répond pas.** Aujourd'hui : concentration = 0,
   silencieusement. La correction faite pour le score (`holders_unavailable` + confiance
   `Low` + motif) est transposable telle quelle.
5. **Les constantes 62 % / 78 %.** Contredites par vos propres 33,22 % / 38,97 %, sans date
   d'instantané, avec une URL source pointant sur un mint inexistant. Décision éditoriale et
   juridique, pas technique.
6. **Les deux mints.** Ne pas aligner sans décider d'abord des points 1 à 4 : aligner
   **armerait** la promotion au lieu de la corriger.

---

## 4. Ce que cette préparation ne couvre pas

- **Aucune correction n'a été faite.** Aucun fichier de code modifié, aucun commit.
- **Les casefiles hors BOTIFY.** `CASE_DB` ne contient qu'une entrée ; le preset VINE existe
  mais n'a pas de template public approuvé. Un second dossier publié changerait le périmètre.
- **L'historique des promotions.** Rien n'est persisté : `/api/casefile` ne stocke pas ses
  sorties (`case_id` aléatoire à chaque appel, aucune écriture en base ni en R2). **Il est
  impossible de savoir combien de fois C5 et C7 ont été servies en « Corroborated », ni à
  qui.** C'est la même absence de trace que celle documentée en Passe B §D-2.
- **Les documents sortis du système.** Captures, copies, exports manuels : hors de portée.
- **La vérification de `/api/casefile` en exécution réelle.** Elle exige `ADMIN_TOKEN` en
  Bearer ; je ne m'en sers pas sans demande explicite. Les chiffres du §1.3 sont une
  reproduction exacte de `fetchHolders` exécutée hors de la route, contre les mêmes données.

---

*Préparation en lecture seule, 2026-08-16. Sondes de production limitées à des `GET`.
Aucune donnée modifiée, aucun document réécrit, aucun objet supprimé.*
