# RC-BETA-TRUTH-01 — LOT DE CLÔTURE · PROJECTION RETAIL

**Date** : 2026-09-17
**Lot** : CC-OFFLINE-292
**Base** : `main` @ `7aec354`
**État** : témoins de clôture VERTS · **AUCUN DÉPLOIEMENT** · en attente du GO architecte

---

## §0 — CHEMINS GELÉS · LA MESURE AVANT L'ÉCRITURE

Mesuré en mettant une ligne-sonde en index sur chaque chemin requis, puis
`bash scripts/guard-offline.sh`, puis restauration de l'arbre.

| Chemin | État | Lease nécessaire |
|---|---|---|
| `src/app/en/demo/page.tsx` | LIBRE | non |
| `src/app/fr/demo/page.tsx` | LIBRE | non |
| `src/lib/copy/verdictCopy.ts` | LIBRE | non |
| `src/lib/risk/tier.ts` | LIBRE | non (non modifié) |
| `src/components/scan/RetailVerdictBanner.tsx` | **GELÉ** (`^src/components/`) | **non** — voir ci-dessous |
| `src/components/ClusterRiskBadge.tsx` | **GELÉ** (`^src/components/`) | **non** — voir §4 |

**Pourquoi la bannière gelée n'exige AUCUNE lease** : elle porte DÉJÀ la
projection correcte, mergée en CC-OFFLINE-284 — `couvertureInsuffisante` (:114),
`nonVerifie` (:115), `VERDICTS[lang].UNKNOWN` (:41/:47, gris `#6b7280`).
Ouvrir une lease sur un chemin qui n'a rien à changer serait une fiction.

**Guard après implémentation** : `✅ GUARD: aucun chemin interdit modifié.`
(branche=main, mode=staged, fichiers=4, **0 lease**).

---

## §1 — LA CAUSE LIANTE, ET QUI L'A INTRODUITE

La bannière projetait correctement depuis CC-OFFLINE-284, et pourtant VINE et
BOTIFY rendaient un verdict rassurant sur le servi. La cause n'était pas la
bannière : c'était le **TRANSPORT**.

1. `normalizeScanData` ne portait pas `risk`. L'interface `NormalizedScan` ne
   le déclarait pas ; le littéral de retour ne l'assignait pas.
2. Au montage, j'avais écrit
   `(result as { risk?: { coverage?: { sufficient?: boolean } } }).risk?.coverage?.sufficient`.

Le cast **affirmait une forme que l'objet n'avait pas**. TypeScript s'est tu.
La prop valait `undefined`. Le mécanisme était SERVI et INERTE — et 8 048
témoins sont restés verts dessus.

> **UNE FORME AFFIRMÉE N'EST PAS UNE DONNÉE PRÉSENTE.**

C'est mon erreur, introduite dans CC-OFFLINE-284.

---

## §2 — CE QUI A ÉTÉ FAIT · LE CHEMIN ÉTROIT

### A · Le transport (`en/demo/page.tsx`, `fr/demo/page.tsx`)

- `interface ScanCoverage { offChainClaimsMeasured?; sufficient?; legacyAuthorityWithdrawn? }`
  — miroir de lecture de ce que `api/scan/solana` déclare. Aucun champ ajouté.
- `NormalizedScan.risk?: { coverage?: ScanCoverage }` — le champ **existe**.
- Dans le normaliseur :
  `risk: data?.risk?.coverage ? { coverage: data.risk.coverage as ScanCoverage } : undefined`
  — RECOPIE. Aucun défaut permissif : `sufficient` absent reste absent.
- **Le cast a disparu.** La lecture est `result.risk?.coverage?.sufficient`.

Le mécanisme de garde n'est plus un témoin de texte : c'est le **compilateur**.
Sans cast, lire `result.risk` sur un type qui ne le déclare pas ne compile plus.

### B · La sélection (`src/lib/copy/verdictCopy.ts`)

- `export type VerdictPresentation = VerdictTier | "UNVERIFIED"` — une entrée
  de copie de plus, honnête, sans accusation et sans permission.
- `selectVerdictCopy(tier, lang, coverageSufficient?)` :
  `coverageSufficient === false && tier === "GREEN" ? "UNVERIFIED" : tier`.

⛔ **Aucune chaîne historique n'a été réécrite ni supprimée.** `GREEN` dit
toujours « No critical alerts detected. Still verify URLs. » — ce qui change
est qu'elle n'est plus **SÉLECTIONNÉE** quand sa précondition sémantique
(une couverture établie) n'est pas satisfaite.

⛔ **Aucune gravité relâchée.** Seul `GREEN` bascule, et la bascule est mesurée
sur le palier **FINAL**, après l'escalade de récidive — sinon une gravité
escaladée serait diluée par une couverture manquante.

⛔ **`undefined` ≠ `false`.** Une chaîne qui ne produit pas de couverture (les
chaînes EVM) garde son comportement historique intact. `NOT_ESTABLISHED ≠ ABSENT`.

### C · La projection de page

- `_tierProjete: TierOrUnknown = _nonVerifie ? "UNKNOWN" : finalTier` — et il ne
  sert **qu'à** la couleur et au libellé du badge.
- `getTierColorFinal = getTierOrUnknownColor` — `UNKNOWN` est GRIS depuis
  BUILD 10. **Aucune classification neuve.**
- `finalTier` — le produit de la décision canonique — **n'est pas réécrit** et
  part intact vers la bannière, qui fait sa propre projection depuis
  `coverageSufficient`.

---

## §3 — LES MUTANTS

| # | Mutation | Résultat |
|---|---|---|
| M1–M9 | lots antérieurs | verts au global (8 080 tests) |
| **M10** | réintroduire `as { risk?… }` **et** retirer `risk` du type | **ROUGE** — `tsc` : 2 erreurs (`TS2353` sur le littéral, `TS2339` sur `result.risk`) + **3 témoins** |
| **M11** | élargir la bascule au-delà de `GREEN` (`coverageSufficient === false ? "UNVERIFIED" : tier`) | **ROUGE** — **2 témoins**, dont « UNE GRAVITÉ N'EST JAMAIS RELÂCHÉE » |

Les deux mutants ont été **injectés et exécutés**, puis l'arbre restauré depuis
une sauvegarde hors dépôt. Ce ne sont pas des mutants décrits : ce sont des
mutants mesurés.

---

## §4 — DÉCISION ② · `computeScore([])` EST-IL ENCORE ATTEIGNABLE ?

**Question** : après la réparation de la projection, `computeScore([])` peut-il
encore causer une assertion positive visible en RC, ou une permission
consommable par machine ?

**RÉPONSE MESURÉE : NON.** Rien à ouvrir dans ce lot. Le repli n'est pas
supprimé — le corriger appartient à `lib/scoring` et resterait hors périmètre.
Ce qui est fermé est sa CONSÉQUENCE.

| Surface | Chemin | Mesure |
|---|---|---|
| **Machine** `/api/v1/score` | `canonicalPreBuyDecision` → `projectPreBuy` | `expected = 3` (`market`, `scam_lineage`, `off_chain_claims`). Sans assertion gouvernée consommée, `contratSatisfait` est faux ⇒ `NO_CRITICAL_SIGNAL` projette **WARN**, jamais `ALLOW` ; `toPartnerVerdict` rend **WARNING**, jamais `SAFE`. Fermé par CC-OFFLINE-290. |
| **Retail** `/api/scan/solana` | `computeScore(rawClaims)` et `sufficient: rawClaims.length > 0` | Le repli et `sufficient === false` sont **le même événement**. ⇒ `UNVERIFIED`. Fermé par CE lot. |
| `/api/pdf/casefile` | `checkAuth` + `if (!dossierGouverne) return refuserArtefact()` | Non atteignable en anonyme. Pas une surface RC. |
| `/api/report/v2` | `checkAuth` (mesuré 401 anonyme en CC-OFFLINE-274) | Non atteignable en anonyme. Pas une surface RC. |

La frontière reste **conditionnée, pas condamnée** : contrat de mesure satisfait
⇒ `ALLOW` demeure possible. Témoin explicite.

### Badge cluster — mesure bornée, chemin gelé, LECTURE SEULE

`ClusterRiskBadge.tsx` ne rend **rien** sur `UNKNOWN`, `LOW` et `fallback` : il
ne sait produire qu'une **gravité** (`MEDIUM` / `HIGH`). Il ne porte aucune
assertion rassurante — **il n'y a rien à conditionner à la couverture**, et une
gravité cluster doit précisément traverser une couverture insuffisante.

⇒ **AUCUNE LEASE DEMANDÉE. AUCUNE REDÉFINITION DE « CLUSTER RISK ».**
Le fichier gelé n'est pas modifié ; il est **tenu** par trois témoins.

---

## §5 — L'ÉTAT MESURÉ

```
tsc --noEmit                     : 0 erreur
eslint (4 fichiers touchés)      : 0 erreur
vitest run                       : 539 fichiers · 8 080 passés
                                   (baseline 8 048 + 32 nouveaux) · 0 échec
scripts/guard-offline.sh         : aucun chemin interdit modifié · 0 lease
```

## §6 — CE QUI N'A PAS ÉTÉ FAIT

- **Aucun déploiement.** `pnpm deploy:prod` n'a pas été lancé.
- **Aucun push, aucune PR.** Le lot est local.
- Aucun seuil, aucun barème, aucun score n'a été touché (`tier.ts` inchangé).
- Aucune décision canonique dupliquée dans React (témoin explicite).
- Aucun DDL, aucune écriture base, aucune autorité de publication touchée.

## §7 — RÉSIDUEL NOMMÉ

- La bannière affiche toujours le NOMBRE (`20`) à côté de `UNVERIFIED`, en gris,
  sous le libellé `RISK SCORE`. Ce n'est pas une assertion de sécurité, mais
  c'est une figure quantifiée issue d'un repli. La retirer exige une lease sur
  `src/components/scan/RetailVerdictBanner.tsx`. **Non demandée** : le besoin
  n'est pas démontré tant que l'en-tête et le sous-titre disent l'ignorance.
- `api/pdf/casefile` et `api/report/v2` consomment encore le fichier plat legacy
  sans la frontière `autoriteLegacyRetiree` (dette déjà nommée en CC-OFFLINE-286,
  chemins gelés). Hors périmètre de ce lot.
