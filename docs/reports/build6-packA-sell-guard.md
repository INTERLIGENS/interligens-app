# BUILD 6 — PACK A : garde SELL, renommage `proceeds`, promotion

Branche `feat/cc-offline-137-coexit-sell-guard`, depuis `main = 15ab6bf`.
Ordre imposé respecté : **garde → tests → re-run → promotion**.

## 1. Le garde SELL — par provenance, jamais par montant

### Pourquoi pas un montant

Distinguer un remboursement de loyer d'un paiement par sa **valeur en lamports**
aurait été une heuristique déguisée en règle. Le loyer dépend de la taille du
compte, il change avec les paramètres du protocole, et n'importe quel paiement
peut tomber dessus. Un seuil aurait produit des faux positifs *et* des faux
négatifs, sans qu'aucun des deux ne se voie.

**Aucune constante de loyer n'existe dans le module** — vérifié par test sur les
quatre fichiers source.

### Le mécanisme

Deux conditions de provenance, toutes deux démontrables depuis la transaction :

1. **LE LIEN D'ÉCHANGE.** Une contrepartie ne compte que si elle provient d'un
   compte **qui a reçu le mint du sujet dans la même transaction**. C'est ce qui
   fait l'échange : ce qui sort revient transformé, du même acteur. Mesuré sur
   VINE : **453 échanges sur 453** le vérifient.
2. **LE LOYER.** Du SOL qui sort d'un **compte de token** est la récupération du
   loyer de ce compte au moment où il se ferme. Un compte de token n'est pas une
   contrepartie commerciale, c'est un contenant.

### Fail-closed

Une contrepartie qui ne satisfait pas (1), ou qui tombe sous (2), n'est pas
« probablement une vente » : elle n'est pas démontrée, donc elle n'est pas
affirmée. L'événement redevient `OUTGOING_TRANSFER`, et le motif est écrit dans
sa provenance :

| motif | signification |
|---|---|
| `counterparty_rejected_rent_recovery` | l'actif vient d'un compte de token qui se ferme |
| `counterparty_rejected_provenance_undemonstrated` | l'actif vient d'une source qui n'a pas reçu le mint |

**L'absence de `tokenBalanceChanges` n'assouplit pas le garde** : il ne peut plus
reconnaître les comptes de token, mais la règle (1) — la plus contraignante —
continue de s'appliquer. Un test le fixe.

`events.swap` **n'entre nulle part** dans la décision : ni dans `extract.ts`, ni
même dans le type d'entrée. Un test le vérifie sur le source.

### Gates de mutation (12 cas, synthétiques)

VINE ne contient **aucune** contrepartie en SOL natif : la branche « loyer » n'y
a jamais été exercée. Ces cas sont donc synthétiques — et c'est précisément
pourquoi ils existent. Une branche jamais parcourue n'est pas une branche sûre,
c'est une branche dont on ignore le comportement.

| mutation | rougit si… |
|---|---|
| loyer traité comme contrepartie | un SOL sorti d'un compte de token devient un SELL |
| montant utilisé comme discriminant | le verdict change avec la valeur (1 / 890 880 / 2 039 280 / 999 999 999 → tous refusés pareil) |
| vrai paiement écarté par sa valeur | un paiement de 2 039 280 lamports **venant du pool** cesse d'être un SELL |
| constante de loyer dans le module | `2_039_280`, `890_880`, `RENT_*`, `rentExempt` apparaissent |
| provenance indistincte promue | une contrepartie venue d'un tiers non lié devient un SELL |
| absence de `tokenBalanceChanges` | l'absence de donnée ouvre la porte au lieu de la fermer |
| `events.swap` comme autorité | le mot apparaît dans le code de décision ou le type d'entrée |
| route multi-sauts cassée | les 9 `CLOSE_ACCOUNT` réels de VINE cessent d'être des SELL |

## 2. Renommage `proceeds` → `observedCounterparty*`

`proceeds` se lisait comme « produit de la vente », et invitait à en faire une
base de calcul de plus-value. **Mesuré le 2026-09-05 sur VINE : dans 30 échanges
sur 453, le sujet reçoit l'actif de contrepartie plusieurs fois dans la même
transaction.** Le champ n'en porte qu'une occurrence — celle qui démontre
l'échange.

| avant | après |
|---|---|
| `proceeds: { mint, amount } \| null` | `observedCounterpartyAsset: string \| null` |
| | `observedCounterpartyAmount: number \| null` |
| | `observedCounterpartyMeaning: string \| null` |

Le sens **voyage avec le champ** (`OBSERVED_COUNTERPARTY_MEANING`) :

> Directly observed counterparty asset attributed to the demonstrated exchange.
> NOT a guarantee of total proceeds — a transaction may return the asset several
> times. NEVER usable alone for P&L.

Un test vérifie qu'aucun **identifiant** ne s'appelle plus `proceeds` : le mot ne
survit que dans la phrase qui le nie.

## 3. Re-run VINE — régression

Corpus **déjà collecté** relu (2 788 tx). **Appels Helius de ce pack : 0.**
Paramètres ratifiés inchangés : T0 `2025-01-23T01:24:50.743Z`, 15 wallets,
fenêtre canonique 60 s.

| mesure | avant garde | après garde | delta |
|---|---|---|---|
| ExitEvents | 458 | 458 | **0** |
| SELL | 453 | 453 | **0** |
| OUTGOING_TRANSFER | 5 | 5 | **0** |

Motifs de provenance après garde : `swap_counter_asset_same_tx` 453 ·
`token_leaves_wallet_no_counter_asset` 5. **Événements retranchés par le garde :
0** — conforme à l'attendu, VINE ne contient aucune contrepartie en SOL natif.

Co-sortie, mêmes paramètres, résultats identiques au run F1 :

| fenêtre | groupes | sujets max | paires |
|---|---|---|---|
| 10 s | 7 | 5 | 79 |
| **60 s** ◀ canonique | **6** | **9** | **425** |
| 300 s | 5 | 9 | 1 023 |
| 1 800 s | 4 | 9 | 2 917 |

## 4. Promotion

Le garde étant posé et prouvé, **`SELL` signifie désormais « échange démontré par
provenance »**. Il n'existe plus d'état intermédiaire : un acte dont l'échange
n'est pas démontré n'est pas un `SELL_CANDIDATE`, c'est un `OUTGOING_TRANSFER`
portant le motif du refus.

Sur VINE, après garde : **453/453 SELL** portent une contrepartie non nulle,
`rowNature = PRIMARY_OBSERVATION`, et le meaning du champ.

Deux tests fixent l'implication dans les deux sens : tout `SELL` implique une
contrepartie démontrée et `PRIMARY_OBSERVATION` ; tout non-`SELL` implique
`observedCounterpartyAsset = null` et un motif de refus.

## 5. Attestation

- **0 appel Helius** sur ce pack.
- **Aucun write prod**, **aucune DDL**.
- Aucun paramètre ratifié modifié ; aucun tuning sur VINE.
- Aucun cast masquant (`as never` / `as unknown as`) dans le module.
- Guard de chemins vert, hors chemin gelé.

**STOP conditions rencontrées : aucune.**
