# Smoke tests — passe 1 · 2026-08-19

## PEUT-ON PASSER AU BLOC 3 — **NON, pas sans ta décision.**

**Un montant est passé à `null` : la condition d'annulation de §3 est déclenchée.**
`cases[].paidUsd` de `bkokoski` et `sxyz500` est passé de `[3200000, 850000,
320000]` et `[600000, 280000]` à `[null, ...]`.

**Mais le diagnostic que cette condition encode est REFUTED par mesure.** Elle
dit : *« cela voudrait dire que le filtre lit `'published'` comme un retrait —
gate inversé, ou colonne lue au mauvais endroit »*. Les profils **publiés**
gardent leurs montants :

| profil | `proceedsPublication` | `cases[].paidUsd` servi |
|---|---|---|
| `planted` | `published` | **`[450000, null]`** |
| `ravedao` | `published` | **`[48300000]`** |
| `ghostwareos` *(témoin)* | `published` | `[]` — inchangé |

Le changement est **strictement confiné aux six profils déjà `withdrawn`**.
C'est l'élargissement voulu d'A14/A15 — *« servies par le nouveau code, elles
couvrent onze porteurs de plus »* — celui-là même que l'entrée de registre du
BLOC 5 existe pour consigner.

**Ce qui a échoué, c'est la prémisse de ma propre page de smoke tests** : j'y ai
écrit *« le déploiement n'est pas censé retirer quoi que ce soit »* sans en
excepter les six décisions du 16 août. C'est faux, et ça l'était en l'écrivant.

**Je ne redéploie rien. La décision t'appartient**, et elle tient en une
question : *l'élargissement des six retraits existants à `KolCase.paidUsd`
est-il l'effet voulu ?* Si oui → BLOC 3. Si non → rollback, et la migration
reste en place.

---

**Déploiement testé :** `dpl_EDPAo9RTk1JcbEdG9rzcad5eXXiW` · `app.interligens.com`
**Rôle :** `x-admin-token` — le même que le relevé d'avant. Aucun secret ici.
**Aucune écriture en base** (session `READ ONLY` côté serveur), aucun déploiement, aucun merge.

---

# §1 — La brique de base · **VERIFIED**

```json
{"ok":true,"db":"ok","redis":"ok","rawdocs":"ok","env":"production",
 "version":"139580d","timestamp":"2026-08-19T14:53:18.238Z","duration_ms":185}
```

`200` · `db: "ok"`. **Et `version: "139580d"`** — exactement le commit de `main`
déployé. L'artefact servi est bien celui qu'on a construit.

---

# §2 — Le vrai risque · **VERIFIED — 7/7 à `200`**

Le contrôle de ce déploiement : le code interroge deux colonnes créées il y a
une heure. **Aucun `500`. Aucun message mentionnant une colonne inconnue.**

| Route | Code |
|---|---:|
| `/api/laundry/{h}` | `200` |
| `/api/v1/kol/{h}` | `200` |
| `/api/kol/{h}/cashout` | `200` |
| `/api/kol/{h}/class-action` | `200` |
| `/api/watchlist` | `200` |
| `/api/pdf/kol?format=html` | `200` |
| `/api/kol/{h}/pedigree` | `200` |

Le contrat de schéma refermé hier (PR #119) tient en production.

---

# §3 — Rien n'a disparu · **VERIFIED sauf `paidUsd` · REFUTED sur le diagnostic**

## `bkokoski`

| | avant | après | |
|---|---|---|---|
| narratif `en` | 605 | **605** | = |
| narratif `fr` | 701 | **701** | = |
| `totalDocumented` | `null` | `null` | = |
| `totalScammed` | `4500000` | `4500000` | = |
| **`cases[].paidUsd`** | `[3200000, 850000, 320000]` | **`[null, null, null]`** | **≠** |
| `tier` | `CRITICAL` | `CRITICAL` | = |
| `pedigree` | `200` | `200` | = |
| `displayName` longueur | 15 | **15** | = |
| `displayName` `sha256[0:12]` | `ec3dbfa3b5c9` | **`ec3dbfa3b5c9`** | = |

## `sxyz500`

| | avant | après | |
|---|---|---|---|
| narratif `en` / `fr` | 340 / 387 | **340 / 387** | = |
| `totalDocumented` | `null` | `null` | = |
| `totalScammed` | `1200000` | `1200000` | = |
| **`cases[].paidUsd`** | `[600000, 280000]` | **`[null, null]`** | **≠** |
| `tier` · `pedigree` | `CRITICAL` · `200` | idem | = |

## `ghostwareos` — TÉMOIN · **inchangé sur toute la ligne**

| | avant | après | |
|---|---|---|---|
| narratif `en` / `fr` | 635 / 559 | **635 / 559** | = |
| `totalDocumented` | `0` | `0` | = |
| `totalScammed` | `327790` | `327790` | = |
| `cases[].paidUsd` | `[]` | `[]` | = |
| `tier` · `pedigree` | `CRITICAL` · `200` | idem | = |

## `/api/watchlist` · **107 → 107** · **VERIFIED**

## Le piège du `0` — vérifié explicitement · **VERIFIED**

`ghostwareos`, `planted` et `ravedao` servent `totalDocumented = 0`. Lecture en
base : **la valeur stockée EST `0`**. Ce n'est pas une redaction déguisée en
chiffre.

Et la réciproque tient : les trois profils retirés portent `totalDocumented`
**non nul en base** — `GordonGekko 579645`, `bkokoski 210900`, `sxyz500 141594`
— et servent `null`. **Le retrait rend `null`, jamais `0`.** C'est exactement ce
que le test « aucun porteur ne rend 0 à la place de null » exige.

*(`GordonGekko.totalScammed` sert `null` : sa valeur est `null` en base. Stocké,
pas filtré.)*

---

# §4 — Les fermetures d'hier

| | Résultat | |
|---|---|---|
| **4.1** anonyme `/api/kol/{h}` | `401` · `NOMINATIVE_ACCESS_REQUIRED` | **VERIFIED** |
| **4.2** anonyme `/api/admin/kol/publishability` | `401` · `Unauthorized` | **VERIFIED** |
| **4.3** `PATCH /api/investigators/messages/{id}` | `401` en anonyme | **UNKNOWN** |
| **4.4** `POST /api/investigators/feedback` | `401` en anonyme | **UNKNOWN** |
| **4.5** `prisma validate` | code **1** · `P1012` | **VERIFIED** |

**4.3 et 4.4 sont UNKNOWN, et je ne peux pas les rendre autrement.** Ils exigent
une **session d'investigateur valide**, que je n'ai pas. En obtenir une écrirait
une ligne `InvestigatorSession` — une écriture, donc interdite. Et la relire en
base ne sert à rien : seul le `sha256` du jeton y est stocké, le jeton brut est
irrécupérable par construction.

Le `401` obtenu prouve seulement que la porte est fermée aux anonymes — **il ne
teste pas le correctif d'hier**, qui vit derrière cette porte. Ces deux tests
restent couverts par `a4-idor-sweep.test.ts`, en local, en session A vs B.

---

# CE QUI RESTE UNKNOWN

1. **4.3 / 4.4 en production** — voir ci-dessus. Non testable en lecture seule.
2. **Les surfaces non relevées avant le déploiement.** `pdf/kol`, `cashout` et
   `class-action` rendent `200`, mais je n'ai **aucune valeur d'avant** pour
   elles : je sais qu'elles répondent, pas qu'elles servent la même chose. Elles
   étaient hors de la liste du relevé.
3. **`GordonGekko` et `lynk0x`** — pas de valeur HTTP d'avant. Si leurs montants
   ont bougé, je ne peux pas le voir. `GordonGekko` est l'un des six retirés,
   donc probablement concerné par le même élargissement.
4. **Les 22 autres carriers.** A15 recense douze surfaces ; j'en ai mesuré
   quatre. Un porteur qui aurait dû se taire et parle encore ne se verrait pas
   ici.
5. **`shill-to-exit`** — lacune connue et inscrite au registre `LACUNES_AMONT`,
   non corrigée, non mesurée aujourd'hui. Elle continue de servir `amountUsd`.

---

# CE QUE JE N'AI PAS FAIT

Aucun rollback, aucun redéploiement, aucune écriture, aucun merge. La condition
d'annulation est déclenchée ; **je te la remonte plutôt que d'y répondre**,
comme convenu.

Si tu décides le rollback : redéployer la version précédente, **et ne pas
défaire la migration** — elle est additive, ses colonnes valent `'published'`,
et l'ancien code les ignore.
