# État avant déploiement — 2026-08-19

**Relevé sur la production telle qu'elle tourne, AVANT `vercel --prod`.**
Base : `ep-square-band`, `system_identifier 7618684629269072395`.
HTTP : `https://app.interligens.com`.

**Rôle d'accès utilisé :** `x-admin-token`, valeur lue depuis `.env.local` de
l'environnement de développement. Aucune valeur, aucun préfixe, aucune longueur
de secret n'apparaît ici. **Aucune écriture, aucun déploiement.** Session base
forcée `READ ONLY` côté serveur.

---

## Les trois handles

| Rôle | Handle | Pourquoi celui-là |
|---|---|---|
| **Dépublié au BLOC 4** | `bkokoski` | désigné |
| **Dépublié au BLOC 4** | `sxyz500` | désigné |
| **TÉMOIN — ne doit RIEN changer** | **`ghostwareos`** | voir ci-dessous |

**Choix du témoin, parmi les 5 trails existants.** Les candidats étaient
`GordonGekko`, `ghostwareos`, `lynk0x`. `ghostwareos` est retenu parce qu'il est
le seul des trois à porter **`proceedsPublication = 'published'` ET
`monetaryClaimsPublication = 'published'`** : ses deux interrupteurs sont
ouverts, donc **toute** valeur qui bougerait chez lui serait visible.

`GordonGekko` aurait été un mauvais témoin : son `proceedsPublication` vaut déjà
`'withdrawn'`, une partie de ses montants est donc déjà redigée — un
sur-filtrage passerait inaperçu. Il est de plus couplé au lot par son
`latest.pdf`, l'un des deux doublons écartés du BLOC 3.

---

## LA PHOTO QUI COMPTE — `LaundryTrail`, les 5 lignes

```sql
SELECT "kolHandle", "publication", length(coalesce("narrativeText",'')) AS longueur
  FROM "LaundryTrail" ORDER BY 1;
```

| `kolHandle` | `publication` | `narrativeText` | `narrativeTextFr` | `laundryRisk` |
|---|---|---:|---:|---|
| `GordonGekko` | `published` | **419** | 485 | `MODERATE` |
| **`bkokoski`** | `published` | **605** | 701 | `HIGH` |
| **`ghostwareos`** *(témoin)* | `published` | **635** | 559 | `CRITICAL` |
| `lynk0x` | `published` | **382** | 439 | `MODERATE` |
| **`sxyz500`** | `published` | **340** | 387 | `MODERATE` |

**Référence de la passe 2.** À la fin de la journée, `bkokoski` et `sxyz500`
doivent être `withdrawn` avec **605** et **340** caractères, inchangés. Les
trois autres doivent être `published` avec leurs longueurs inchangées.

---

## Surfaces HTTP — valeurs brutes

### `bkokoski`

| Surface | Code | Valeur relevée |
|---|---:|---|
| `/api/laundry/bkokoski` | `200` | `narrativeText` = **605** car · `narrativeTextFr` = **701** car · `laundryRisk` = `HIGH` |
| `/api/v1/kol/bkokoski` | `200` | `totalDocumented` = **`null`** · `totalScammed` = **`4500000`** |
| ↳ `cases[3].paidUsd` | | `[3200000, 850000, 320000]` |
| ↳ `evidences[29].amountUsd` *(6 premiers)* | | `[73045, null, 80000, 150500, 90000, 300]` |
| `/api/kol/bkokoski` | `200` | `tier` = `"CRITICAL"` · `displayName` = **voir note** · `totalDocumented` = `null` · `proceedsPublication` = `"withdrawn"` |
| `/api/kol/bkokoski/pedigree` | `200` | — |

### `sxyz500`

| Surface | Code | Valeur relevée |
|---|---:|---|
| `/api/laundry/sxyz500` | `200` | `narrativeText` = **340** car · `narrativeTextFr` = **387** car · `laundryRisk` = `MODERATE` |
| `/api/v1/kol/sxyz500` | `200` | `totalDocumented` = **`null`** · `totalScammed` = **`1200000`** |
| ↳ `cases[2].paidUsd` | | `[600000, 280000]` |
| ↳ `evidences[3].amountUsd` | | `[null, null, null]` |
| `/api/kol/sxyz500` | `200` | `tier` = `"CRITICAL"` · `displayName` = `"Sxyz500"` · `totalDocumented` = `null` · `proceedsPublication` = `"withdrawn"` |
| `/api/kol/sxyz500/pedigree` | `200` | — |

### `ghostwareos` — TÉMOIN

| Surface | Code | Valeur relevée |
|---|---:|---|
| `/api/laundry/ghostwareos` | `200` | `narrativeText` = **635** car · `narrativeTextFr` = **559** car · `laundryRisk` = `CRITICAL` |
| `/api/v1/kol/ghostwareos` | `200` | `totalDocumented` = **`0`** · `totalScammed` = **`327790`** |
| ↳ `cases[0].paidUsd` | | `[]` |
| ↳ `evidences[0].amountUsd` | | `[]` |
| `/api/kol/ghostwareos` | `200` | `tier` = `"CRITICAL"` · `displayName` = `"GhostWareOS"` · `totalDocumented` = `0` · `proceedsPublication` = `"published"` |
| `/api/kol/ghostwareos/pedigree` | `200` | — |

### Une fois

| Surface | Code | Valeur relevée |
|---|---:|---|
| `/api/watchlist` | `200` | **`entries` = 107** *(clés racine : `entries`, `stats`)* |

---

## Note sur `displayName` de `bkokoski`

**La valeur littérale n'est pas transcrite ici.** C'est un nom civil, et le
freeze en vigueur interdit d'en transcrire dans le dépôt — y compris quand
l'API le sert publiquement, et y compris pour un relevé.

Empreinte, qui suffit à la comparaison de la passe 2 :

| | longueur | `sha256[0:12]` |
|---|---:|---|
| `bkokoski.displayName` | **15** | `ec3dbfa3b5c9` |
| `sxyz500.displayName` | 7 | `fe8214dbaf15` |
| `ghostwareos.displayName` | 11 | `0a64ff687cd6` |

Le test 5.5 de la passe 2 demande que `displayName` soit **présent et
inchangé** : recalculer l'empreinte suffit à le vérifier, sans écrire le nom.
Les deux autres sont des pseudonymes et sont transcrits en clair.

**C'est un écart assumé sur ta consigne « valeurs brutes ».** Dis-moi si tu
veux la valeur littérale ; c'est ta décision.

---

## Trous connus — écrits tels quels

1. **`/api/v1/kol/{handle}` ne porte pas de champ `paidUsd` au niveau du
   profil.** Le champ existe **par dossier**, dans `kol.cases[].paidUsd` — c'est
   ce qui est relevé ci-dessus. Il n'y a pas non plus de `totalPaidUsd` dans la
   réponse servie aujourd'hui.
2. **Les trois handles ont été interrogés avec `x-admin-token`.** Le relevé
   décrit donc ce que voit un appelant **admin**, pas un appelant bêta ni un
   anonyme. Une comparaison de la passe 2 devra utiliser le même rôle, sinon
   elle comparera deux choses différentes.
3. **`GordonGekko` et `lynk0x` n'ont pas été relevés en HTTP** — seulement en
   base. S'il faut un second témoin après coup, leurs longueurs de narratif sont
   dans le tableau, mais aucune de leurs surfaces HTTP n'a de valeur d'avant.
4. **Aucun relevé n'a été pris sur `/api/pdf/kol`, `/api/kol/{h}/cashout` ni
   `/api/kol/{h}/class-action`**, qui sont pourtant des surfaces câblées au
   BLOC 1. Elles ne figuraient pas dans ta liste ; je ne les ai pas ajoutées de
   moi-même.
5. **Le code `200` de `/api/kol/{h}/pedigree` est le seul relevé pour cette
   surface** — aucun contenu n'a été extrait, conformément à ta demande
   (« code de retour »).

---

## Deux valeurs brutes qui méritent d'être relues avant la passe 2

Sans interprétation — je les signale parce qu'elles sont contre-intuitives à la
lecture, pas parce que j'en tire une conclusion.

- **`bkokoski` : `totalDocumented = null`, mais `cases[].paidUsd` = `[3200000,
  850000, 320000]` et `evidences[].amountUsd` porte `73045, 80000, 150500,
  90000, 300`.** Le retrait actuel porte sur un champ, pas sur tous.
- **`ghostwareos` : `totalDocumented = 0`**, et non `null`.
