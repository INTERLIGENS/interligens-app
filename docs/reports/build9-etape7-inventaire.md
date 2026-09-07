# BUILD 9 · ÉTAPE 7 — inventaire avant demande d'exemption

Branche `feat/cc-offline-161-casefile-versioning`, depuis `main` refermé
(guard `ce13d0c0…13e50`). **Aucune exemption ouverte.** Inventaire rendu avant
toute demande, comme pour l'étape 5.

---

## L'ÉNONCÉ, ET CE QUE LA MESURE EN FAIT

> Étape 7 — les presets TS / JSON / CASE_DB cessent d'être des autorités
> concurrentes. C'est là que `src/app/api/casefile/route.ts` sera traité.

L'étape 5 supposait **un** fichier gelé de plus. La mesure en donne **douze**,
et six d'entre eux alimentent `computeTigerScore`.

Ce n'est pas un dépassement de périmètre : c'est que « CASE_DB » désigne deux
choses différentes qui ont grandi ensemble.

---

## CE QUE CASE_DB EST DEVENUE — MESURÉ LE 2026-09-07

`src/lib/caseDb.ts` expose une fonction, `loadCaseByMint(mint)`, qui lit un
JSON sur le disque. **12 appelants non-test.**

### Les 10 appelants gelés (`^src/app/api/`)

| route | ce qu'elle en fait |
|---|---|
| `api/v1/score/route.ts` | **entrée de `computeTigerScore`** |
| `api/partner/v1/score-lite/route.ts` | **entrée de `computeTigerScore`** |
| `api/partner/v1/batch-score/route.ts` | **entrée de `computeTigerScore`** |
| `api/partner/v1/transaction-check/route.ts` | **entrée de `computeTigerScore`** |
| `api/v1/scan-context/route.ts` | contexte de scan (repli quand Helius et Dex sont nuls) |
| `api/scan/solana/route.ts` | contexte de scan |
| `api/scan/timeline/[address]/route.ts` | chronologie |
| `api/mobile/v1/scan/route.ts` | scan mobile (2 appels) |
| `api/report/v2/route.ts` | rapport |
| `api/pdf/casefile/route.ts` | PDF |

### Les 2 appelants hors gel

| fichier | ce qu'il en fait |
|---|---|
| `src/lib/scan/buildTigerInput/solana.ts` | **entrée de `computeTigerScore`** |
| `src/lib/publicScore/computeVerdict.ts` | **entrée de `computeTigerScore`** |

### Plus les deux routes du dossier lui-même

| fichier | ce qu'il en fait |
|---|---|
| `src/app/api/casefile/route.ts` | **gelé** — sert du JSON depuis sa `CASE_DB` en ligne |
| `src/app/api/casefile/generate/route.ts` | **gelé** — génère depuis `presets.ts` |

---

## LA CONTRADICTION, ET POURQUOI JE M'ARRÊTE

Elle est franche, et elle n'est pas de forme :

- **la présence d'un CaseFile est une entrée de TigerScore** sur 6 chemins ;
- l'arbitrage dit « aucune modification de scoring ou de méthodologie » ;
- l'énoncé de l'étape 7 dit « CASE_DB cesse d'être une autorité concurrente ».

Retirer CASE_DB de ces 6 chemins **change ce qui entre dans le score**, même si
le calcul ne bouge pas d'une ligne. La brancher sur l'autorité canonique le
change aussi : les 16 claims canoniques ne sont pas les 8 claims de
`botify.json`, et le nombre de claims est justement ce que ces appelants lisent.

Je ne tranche pas ça. Deux STOP conservés sont touchés en même temps —
**exemption de chemin gelé** et **décision de scoring**.

---

## LES TROIS DÉCOUPES POSSIBLES

Je les rends toutes les trois, avec leur coût, sans en recommander une par
défaut — le choix n'est pas technique.

### A · Le dossier seul (2 fichiers gelés)

`casefile/route.ts` et `casefile/generate/route.ts` passent au canonique. Les
12 appelants de `loadCaseByMint` **ne sont pas touchés**.

- Le gate de clôture est atteint pour les **surfaces de dossier** : API, UI, PDF.
- CASE_DB reste vivante comme **entrée de scoring**, sous un nom qui ne dit plus
  qu'elle est un dossier.
- Zéro impact scoring. Exemption la plus petite qui referme l'étape 7 telle que
  l'étape 5 l'avait annoncée.

**Ce que ça laisse ouvert** : « aucune deuxième autorité active à la clôture »
serait vrai des dossiers, faux de `loadCaseByMint`. Il faudrait le dire.

### B · Le dossier + le renommage (2 fichiers gelés, 1 hors gel)

Idem A, plus : `loadCaseByMint` est renommée en ce qu'elle est réellement
devenue — un **indicateur de présence** pour le scoring, pas un lecteur de
dossier. Aucun changement de comportement, aucune entrée de score modifiée.

- Le coût est un renommage mécanique sur 12 appelants, dont 10 gelés →
  l'exemption remonte à 12 fichiers pour un diff purement lexical.
- **C'est probablement le pire rapport risque/valeur des trois.**

### C · Le dossier + la bascule des entrées de score (12 fichiers gelés)

Les 6 chemins de scoring lisent l'autorité canonique.

- C'est la seule découpe qui rend « aucune deuxième autorité » littéralement
  vrai.
- Elle **change les entrées de TigerScore en production** : 8 claims JSON contre
  16 claims canoniques sur BOTIFY, et un dossier VINE qui n'existait pas côté
  CASE_DB.
- Elle exige une décision de méthodologie et une mesure avant/après par T1.

---

## CE QUI EST DÉJÀ FAIT, ET QUI NE DÉPEND D'AUCUNE DES TROIS

- Le régime de publication est unique sur API, UI et PDF (étape 5, mergée).
- Le lecteur canonique ne mélange plus les versions, et une modification en
  place est détectable (étape 6, PR #274).
- `presets.ts` n'est plus une autorité de **claims** : le PDF interne tire ses
  claims du canonique et **nomme sur la page** ce qu'il tient encore du preset
  (chronologie, réquisitions — aucune table ratifiée ne les porte).

---

## STOP

**Décision demandée : la découpe A, B ou C.** Puis, selon la réponse,
l'exemption correspondante — 2, 12 ou 12 fichiers gelés.

Je n'ouvre rien. Je ne présume pas que « le plus complet » est le bon : la
découpe C modifie ce qui entre dans un score publié, et ce n'est pas à moi de
le décider.
