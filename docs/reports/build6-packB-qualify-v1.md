# BUILD 6 — PACK B : `coordinated-exit/qualify@v1`

Branche `feat/cc-offline-138-coexit-qualify-v1`, depuis `main = c955320`.
Caractérisation, pas jugement. Zéro Helius, zéro write prod, zéro DDL.

## 1. L'artefact gelé

`content/methodologies/coordinated-exit/v1.md` — `status: FROZEN`,
`effectiveFrom: 2026-09-05`.

```
contentSha256  ab993adca19a31473143f444358a4cdf69aa7eafea80e55adc2e40eaa92ca06c
```

**Trois sha concordants** : frontmatter du `.md`, recalcul du corps gelé, miroir
TypeScript. Miroir **octet-pour-octet**.
`resolveMethodRef("coordinated-exit/qualify@v1")` résout sur le composant
`qualify`.

L'artefact porte, en toutes lettres et vérifié par test :

- `SELL requires demonstrated transactional counterparty provenance`
- `Rent recovery is not sale consideration`
- `NARROW_WINDOW_CLUSTER IS NOT COORDINATED_EXIT`
- `observedCounterpartyAmount IS NEVER SUMMED`

## 2. L'invariant structurel est exécutable

`SELL_PROVENANCE_INVARIANT` n'est pas un commentaire : c'est le texte que
`assertSellProvenanceInvariant` applique, et l'erreur qu'elle lève le porte.

Un événement typé `SELL` dont la provenance de contrepartie n'est pas démontrée
est **refusé à l'entrée**, et le refus **lève** plutôt qu'il ne dégrade :
caractériser une vente non démontrée poserait le groupe entier sur une preuve
qui n'existe pas.

## 3. La catégorie — une seule, délibérément

`NARROW_WINDOW_CLUSTER` : au moins deux sujets distincts sortant du même mint
dans la fenêtre canonique. C'est **structurel** — cela redit en un mot ce qui a
été observé.

**Ce n'est pas `COORDINATED_EXIT`.** Aucune proximité temporelle, si serrée
soit-elle, ne démontre l'intention, la coordination, le dump ou la faute. Des
wallets se groupent parce qu'un graphique a bougé, qu'un post est tombé, qu'un
stop-loss s'est déclenché, qu'un opérateur détient plusieurs clés. Ce sont des
mondes différents qui produisent les mêmes secondes.

Le démenti **voyage avec la catégorie** (`categoryMeaning`) et se retrouve dans
les réserves du `natureBasis`.

V1 ne définit qu'une catégorie, et c'est un choix documenté : une seconde —
« serré » contre « lâche » — exigerait un seuil qu'aucune mesure n'appuie. Les
dimensions sont publiées ; le lecteur trace la ligne à découvert.

## 4. Gates de mutation (17 nouveaux tests)

| mutation | rougit si… |
|---|---|
| score émis | `score` / `risk` / `severity` / `verdict` / `guilt` / `dump` / `rug` / `intent` sort ailleurs que dans une réserve qui le nie |
| catégorie assimilée | `category` vaut `COORDINATED_EXIT`, ou le démenti disparaît |
| proximité affirmant l'intention | un écart de 0 s produit autre chose que la même catégorie et les mêmes clés |
| venue inventé | un venue non unanime (partiel ou divergent) est nommé |
| materiality affirmée | le statut n'est pas `NOT_MEASURABLE` par défaut |
| `observedCounterpartyAmount` lu | l'identifiant apparaît dans le code **exécutable** de `qualify.ts` |
| montant fuité | une valeur de contrepartie (777 777 / 888 888) ou leur somme sort |
| composition mal comptée | `sell + outgoingTransfer ≠ total` |
| `methodRef` non résolvable | la référence ne résout pas sur l'artefact gelé |
| `INFERENCE` en base | `inputNatures` le contient |
| couverture censurée | rapportée complète, ou la réserve `FLOOR` manque |
| invariant SELL | un SELL sans provenance entre dans une caractérisation |

**Note de méthode.** Trois de ces tests ont d'abord rougi sur mes propres
réserves : les phrases qui interdisent un usage contiennent le mot interdit. Les
tests scannent désormais le **code exécutable** — commentaires et littéraux de
chaîne retirés — parce que ce qu'on cherche est un **identifiant lu ou écrit**,
pas un mot prononcé.

## 5. Application aux 6 groupes VINE

Corpus F1 déjà collecté, paramètres ratifiés inchangés (T0
`2025-01-23T01:24:50.743Z`, fenêtre canonique 60 s). **0 appel Helius.**

| # | début UTC | sujets | paires ≤60 s | min/méd | span | venue | SELL/OUT | couverture | matérialité |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 2025-01-23 01:28:16 | **9** | 334 | 0 / 33 s | 191 s | RAYDIUM | 37 / 0 | complète | NOT_MEASURABLE |
| 2 | 2025-01-23 01:39:16 | 4 | 53 | 0 / 37 s | 185 s | RAYDIUM | 22 / 0 | complète | NOT_MEASURABLE |
| 3 | 2025-01-23 01:51:41 | 5 | 19 | 3 / 20 s | 49 s | RAYDIUM | 7 / 0 | complète | NOT_MEASURABLE |
| 4 | 2025-01-23 04:52:26 | 2 | 2 | 37 / 55 s | 55 s | — | 2 / 1 | complète | NOT_MEASURABLE |
| 5 | 2025-03-29 02:49:04 | 2 | 16 | 13 / 38 s | 337 s | — | 25 / 0 | complète | NOT_MEASURABLE |
| 6 | 2025-03-29 03:03:34 | 2 | 1 | 53 / 53 s | 62 s | — | 3 / 0 | complète | NOT_MEASURABLE |

Les trois premiers groupes portent une **destination démontrée unanime** :
`5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1`. Les trois autres n'en ont pas —
le champ est `null`, pas un majoritaire.

Contrôles sur les 6 : catégorie `NARROW_WINDOW_CLUSTER` partout · nature
`INFERENCE` partout · `inputNatures` sans `INFERENCE` · `methodRef` résolvable ·
matérialité `NOT_MEASURABLE` partout · démenti porté par chaque caractérisation.

**Aucun montant de contrepartie ne sort.** Vérifié structurellement : ni
`observedCounterpartyAmount` ni `observedCounterpartyAsset` n'existe comme clé
dans la sortie. Un contrôle par sous-chaîne avait signalé une « fuite » — c'était
le nombre `98` apparaissant à l'intérieur d'une signature base58 (`…m898QXM…`).
Collision, pas fuite.

## 6. Attestation

- **0 appel Helius** sur ce pack.
- **Aucun write prod**, **aucune DDL**.
- Aucun paramètre F1 rouvert, aucun tuning sur VINE.
- Aucun seuil introduit — V1 n'a qu'une catégorie.
- **Aucun verdict** : ni coordination, ni dump, ni intention, ni culpabilité.
- Aucun cast masquant dans le module.

**STOP conditions rencontrées : aucune.**
