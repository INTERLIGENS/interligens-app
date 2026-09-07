# BUILD 9 — P0 · qualification des six blocs + resolver

Branche `feat/cc-offline-159-build9-casefile`, depuis `main = 2f3761b`.
Lecture seule : 1 passe SELECT en `READ ONLY` + `ROLLBACK`, lecture de fichiers.
**0 Helius, 0 write, 0 DDL, 0 collecte, 0 réinterprétation.**

---

## STATUS

**La question n'a pas une réponse, elle en a douze.** Les six blocs ne sont pas
homogènes : à l'intérieur d'un même bloc, un élément porte une signature de
transaction et le suivant ne porte rien.

Réponse courte : **BOTIFY ne migre presque rien, VINE migre une moitié
identifiable.** La DDL n'est nécessaire que pour ce qui migre réellement, et ce
périmètre est nettement plus étroit que les six blocs.

---

## QUALIFICATION — bloc par bloc, élément par élément

Critère appliqué, sans assouplissement : **un élément est démontré s'il porte
une provenance vérifiable** — URL résolvable, signature de transaction, ou
référence qui résout contre un registre déclaré. Un raisonnement, une
justification ou une plausibilité ne sont pas des provenances.

### BOTIFY

| bloc | source | éléments | avec provenance |
|---|---|---|---|
| `timeline` | preset TS **en dur** | 7 | **0** |
| `shillers` | preset TS **en dur** | 6 | **0** |
| `wallets_onchain` | preset TS **en dur** | 4 | **0** |
| `smoking_guns` | preset TS **en dur** | 6 | **0** |
| `requisitions` | preset TS **en dur** | 3 | **0** |
| **`claims`** | `data/cases/botify.json` | **8** | **8** |

**Zéro URL et zéro champ de provenance dans les 26 éléments du preset.** Ce
n'est pas une couverture faible, c'est une absence totale : le fichier ne
contient pas une seule occurrence de `http`, `tx`, `signature`, `solscan`,
`thread_url` ou `source_url` sur ces cinq blocs.

Les 8 `claims` sont l'exception, et elles sont propres : chacune porte un
`thread_url` et/ou des `evidence_refs`, **les 8 références résolvent** contre
les 8 `sources` déclarées, et chaque source porte `captured_at`, `filename` et
`type`. Vérifié sur les deux copies du fichier — 0 référence cassée dans
chacune.

### VINE

| bloc | éléments | avec provenance | nature de la provenance |
|---|---|---|---|
| `timeline` | 10 | **0** | aucun champ de source |
| `shillers` | 9 | **9** | `tweet_url` |
| `wallets_onchain` | 4 | **4** | `solscan_url` |
| `new_claims` | 9 | **8** | `thread_url` (C13 n'en a pas) |
| `smoking_guns` | 13 | **1** | SG-1 seul : `first_tx_signature` + `block_time_utc` + `ata` + `public_source` |
| `requisitions` | 6 | **0** | `justification` est un raisonnement, pas une source |

**Le détail des smoking guns compte**, parce que la moyenne le masquerait :

- **SG-1** — signature de transaction, horodatage on-chain, ATA, source
  publique. Démontré.
- **SG-2, SG-3, SG-4, SG-6, SG-7, SG-8** — nomment une ou plusieurs adresses
  (`parent_wallet`, `children_wallets`, `shared_wallet`, `consolidator_totals`)
  mais **sans aucune signature ni URL**. *Nommer une adresse n'est pas prouver
  ce qu'elle a fait.*
- **SG-5, SG-9, SG-10, SG-11** — ni adresse, ni source.
- **SG-12, SG-13** — citent des déclarations (`rus_public_statement`,
  `key_verbatim_quotes`) sans lien résolvable.

À porter au crédit du fichier : il déclare **4 `findings_not_confirmed`** avec
leur `scope_checked`. Le corpus dit lui-même ce qu'il n'a pas établi.

### Les `evidence_refs` de VINE ne résolvent pas

39 références distinctes. **6 sont des chemins, et les 6 existent** —
`vine-insider-network.json`, `vine-telegram-analysis.json` (784 Ko,
280 861 messages), 4 scripts OSINT. **Les 33 autres sont de la prose** :

```
« X posts Feb 14-15 2025 »
« Telegram mod roles (screenshots TBC) »
« Helius getSignaturesForAddress + getTransaction (200 pre-launch TX parsed per wallet) »
« Google Sheet ID 1y6-fljb5gnIDPw7bgILwbOxFvyNUOoIT5IwpxNmbnH0 »
```

Et `vine-osint.json` **ne contient aucun bloc `sources`** — il n'existe donc
aucun registre contre lequel ces références pourraient résoudre.

Le point important : **le corpus sous-jacent existe** (les 6 fichiers cités sont
là), mais la référence n'est pas machine-résolvable. Ce n'est pas une donnée
absente ; c'est un lien non câblé. La qualification exacte de cette classe
revient à BUILD 10 — je la constate, je ne la tranche pas.

Une référence dit littéralement **« screenshots TBC »** : une preuve annoncée
comme restant à confirmer, citée à l'appui d'une assertion publiable.

---

## RÉPONSE À LA QUESTION POSÉE

**Ni « étendre le schéma », ni « rétrécir le dossier » — les deux, par bloc.**

**Migrent** (démontrés, admissibles tels quels) :

| | éléments |
|---|---|
| BOTIFY `claims` + `sources` | 8 + 8 |
| VINE `shillers` | 9 |
| VINE `wallets_onchain` | 4 |
| VINE `new_claims` | 8 sur 9 |
| VINE `smoking_guns` | **1 sur 13** |
| **total** | **38 éléments** |

**Ne migrent pas** : les 26 éléments du preset BOTIFY, les 10 `timeline` VINE,
les 12 autres `smoking_guns`, les 6 `requisitions`, la `new_claim` C13 — soit
**55 éléments sans provenance vérifiable**.

Donc : la DDL est bien une **conséquence**, mais son périmètre n'est pas « les
six blocs ». Trois structures suffisent à porter les 38 éléments démontrés —
`claims` (avec un registre `sources` résolvable), `shillers`, `wallets_onchain`
— plus un emplacement pour le `smoking_gun` unique qui l'est.

`timeline` et `requisitions` **ne portent aujourd'hui aucun fait démontré, chez
aucune des deux fixtures.** Les créer en base reviendrait à créer un schéma pour
du contenu que rien ne soutient — ce que l'arbitrage interdit explicitement.

---

## P0 — RESOLVER ET RÉFÉRENCES CASSÉES

### Les 20 preuves publiques n'ont rien pour être résolues

| clef | lignes | `canonicalMint` | `tokenSymbol` | `kolHandle` | `sha256` | `sourceUrl` | `observedAt` |
|---|---|---|---|---|---|---|---|
| `BOTIFY-MAIN` | 8 | 0 | 0 | 0 | **0** | 0 | 7 |
| `BOTIFY` | 5 | 0 | 0 | 0 | **0** | 0 | 5 |
| `GHOST` | 5 | 0 | 0 | 0 | **0** | 0 | 4 |
| `GHOST-RUG` | 1 | 0 | 0 | 0 | **0** | 0 | 0 |
| `SERIAL-12RUGS` | 1 | 0 | 0 | 0 | **0** | 0 | 1 |

Elles ne portent **ni mint, ni symbole, ni handle, ni URL — et aucun `sha256`**.
Seul `observedAt` est là, sur 17 des 20. Ce ne sont pas seulement des preuves
non résolvables : ce sont des artefacts **non vérifiables**, et ce sont les
seules que le produit publie.

### La forme réelle des 1 171 `relationKey` — deux formes, et elles s'excluent

| forme | lignes | clefs | publiques | avec `canonicalMint` |
|---|---|---|---|---|
| `handle:TICKER` | 1 149 | 280 | **0** | 204 |
| `TICKER` nu | 22 | 6 | **20** | **0** |

**Aucune n'est un `ref` de dossier.** Et la partition est nette : tout ce qui
porte un mint est non public, tout ce qui est public n'en porte pas.

### Les 50 captures VINE

Toutes `reviewStatus='approved'`, toutes `isPublic=false`, **toutes avec un
`sha256`**, `snapshotType='osint_x_search'`, `evidenceLevel` nul, `canonicalMint`
nul. Ce sont des artefacts **vérifiables mais non publiés et non rattachés** —
l'inverse exact des 20 publiques.

### Le pont fonctionne déjà, là où on l'a câblé

| `ref` | mint déclaré | preuves joignables par `canonicalMint` |
|---|---|---|
| `IL-CONC-BLACKBULL-001` | `9cRCn9…pump` (SOL) | **14** |
| `IL-PND-LAB-001` | `0x7ec4…93A` (BNB) | 0 |

BLACKBULL démontre que la jointure `token_casefiles.contractAddresses` →
`EvidenceSnapshot.canonicalMint` **rend déjà 14 preuves**. Le mécanisme du
resolver existe et fonctionne ; il n'a simplement jamais été appliqué au corpus
publié.

### Références cassées — bilan

| corpus | références | cassées |
|---|---|---|
| `data/cases/botify.json` | 8 | **0** |
| `src/data/cases/botify.json` | 8 | **0** |
| `vine-osint.json` — chemins | 6 | **0** |
| `vine-osint.json` — prose | 33 | **non résolvables par construction** |

---

## CE QUE CELA CHANGE POUR LE BUILD

1. **La DDL est une conséquence, sur un périmètre réduit** — trois structures,
   pas six. Preuve fournie, à porter à l'architecte.
2. **Le dossier BOTIFY publié rétrécit légitimement** : 26 de ses 34 éléments ne
   portent aucune provenance. Il ne reste que les 8 `claims`, qui sont solides.
3. **Le resolver n'a pas à être inventé** : la jointure mint fonctionne déjà et
   rend 14 preuves sur BLACKBULL. Ce qui manque, c'est le backfill de
   `canonicalMint` sur les 20 lignes publiques — et elles n'ont rien pour le
   déduire.
4. **Les 20 preuves publiques sont sans `sha256`.** Avant de les rattacher, il
   faudra décider si un artefact non vérifiable peut rester publié. C'est une
   décision de publication, donc pas la mienne.

---

## STOP

**Un seul, et il est étroit.** Les 20 preuves actuellement publiques ne portent
aucun `sha256` : elles sont invérifiables. Les rattacher à un dossier canonique
les rendrait *plus visibles* sans les rendre plus solides.

Trois issues, et le choix est un arbitrage de publication :
dépublier en attendant un hash · les rattacher en signalant l'absence de hash
via G7 · les laisser hors du corpus rattaché.

Je ne tranche pas. Le reste de P0 n'en dépend pas et peut continuer.
