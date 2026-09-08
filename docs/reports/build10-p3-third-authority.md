# BUILD 10 · P3 — LA TROISIÈME AUTORITÉ CASEFILE, FERMÉE

`main = ebf2059` · guard `ce13d0c0…13e50` · **0 exemption, aucun chemin gelé
franchi.** 0 write, 0 DDL, 0 collecte, 0 RPC.

## Le chemin gelé attendu n'existait pas

L'arbitrage annonçait « `/cases/` est très probablement gelé — attends-toi à
une demande d'exemption ». **Mesuré : il est LIBRE.** Les motifs gelés sont
`^src/app/api/` et `^src/components/` ; `src/app/en/cases/` n'est ni l'un ni
l'autre. Aucune exemption n'a été demandée ni nécessaire.

## Ce que la surface portait

| constat | mesure |
|---|---|
| claims en dur | **8**, avec un état de publication affirmé — **10 occurrences** |
| wallets en dur | **15** |
| arêtes de graphe | **8** |
| mint publié | la clé **synthétique** de 43 caractères |
| mot interdit par le contrat de wording | **2 occurrences** |

## Ce qu'elle est devenue

Une projection de l'autorité canonique. Elle lit
`loadPublicProjection(BOTIFY_CASEFILE_REF)` et **rien d'autre**.

Aujourd'hui aucun claim BOTIFY n'est `PUBLIC` : la page rend **zéro allégation
et le dit**. Ce n'est pas une page vide, c'est une page qui déclare pourquoi
elle l'est.

**L'état de chaque claim vient de l'autorité** (`{c.state}`), il n'est jamais
écrit en dur. Le `tigerScore` NULL rend « not established », sans `/100`.

### Le graphe de wallets est RETIRÉ, et il ne revient pas

`token_casefiles."keyWallets"` est **vide sur BOTIFY**, et c'est une valeur
**ratifiée**. Reconstituer un graphe aurait redonné à la page sa propre source
de vérité — précisément ce que P3 ferme. La section rend un retrait structuré
nommant le champ `keyWallets`.

> C'était l'interdit explicite de l'arbitrage : *« une nouvelle autorité locale
> pour sauver la page. Si la seule façon de la garder est de lui donner sa
> propre source de vérité, elle sort de la publication. »* Elle n'est pas
> sortie — mais sa section sans source, si.

## LE REGISTRE — ce qui empêche une quatrième

`src/lib/casefile/surfaceRegistry.ts` déclare **13 surfaces**. Le registre ne
vérifie rien : c'est `__tests__/casefile/surface-registry.test.ts` qui **refuse
toute surface non déclarée**.

La troisième autorité n'a pas échappé aux gates par négligence — elle a échappé
parce qu'elle n'était **dans aucune carte**. Une revue humaine ne trouve que ce
qu'elle sait chercher ; un scan trouve ce que personne n'a déclaré.

### La garde a trouvé QUATRE surfaces que je n'avais pas vues

| surface | autorité | statut |
|---|---|---|
| `src/app/en/cases/page.tsx` | CANONICAL | index, public |
| `src/app/fr/cases/page.tsx` | CANONICAL | index, public |
| `src/app/api/admin/export/botify/route.ts` | **PRESET** | lit **encore** `botify.json` |
| `src/app/api/report/casefile/route.ts` | **PRESET** | lit **encore** `botify.json` via `require()` |

Les deux dernières sont des **lecteurs d'autorité legacy toujours vivants**.
Vérifié : **admin-only** (`requireAdminApi` / `checkAuth`), donc hors du gate
« toute surface publique lit le canonique ». Chemins **gelés** : P3 les
**déclare honnêtement**, il ne les corrige pas.

> Déclarer `CANONICAL` une surface qui ne l'est pas ne tromperait que la
> prochaine personne qui lira le fichier. Elles sont déclarées `PRESET`.

### Une note portée au registre plutôt que corrigée

`src/app/fr/cases/page.tsx` **pointe vers `/fr/cases/botify`, qui n'existe
pas** — seule la locale `en` porte cette page. Constaté, consigné dans la note
du registre, **non corrigé** : créer une page fr est une décision de
publication.

## PREUVE

| mutant | tests tués |
|---|---|
| une surface retirée du registre | 1 |
| une surface `PRESET` déclarée publique | 2 |
| l'état de publication réécrit en dur | 1 |

Plus 9 assertions de fermeture : plus aucun claim, wallet ou arête en dur ·
aucun état de publication écrit en dur · mint synthétique disparu · mot interdit
disparu · lecture canonique · `tigerScore` NULL sans `/100` · graphe retiré avec
sa raison · absence de claim **dite**.

```
suite       5023 verts / 5025, 0 rouge   (baseline 5010)
typecheck   vert
lint        0 erreur
guard       ce13d0c0…13e50, aucun chemin gelé, 0 exemption
```

### Un libellé cité en commentaire, retiré

Mon premier jet expliquait le retrait **en citant le libellé retiré** dans un
commentaire JSX. Le test l'a attrapé. La règle vaut aussi pour les commentaires :
citer une pièce retirée pour expliquer son retrait la remet dans le source.

## CE QUI N'EST PAS FAIT — les trous de preuve

Conformément à la consigne — *ne PAS « compléter » automatiquement, d'abord
fermer le pipe ou rendre l'absence explicite, ne pas créer de refs
artificielles pour rendre un audit vert* — les trois trous mesurés en S0 sont
**laissés en l'état** :

- **VINE à 0 `CaseFileSource`** malgré 39 `evidence_refs` en amont ;
- **C13** exclu par `filter(c => c.thread_url)` sans que rien ne le dise ;
- **plafond de provenance BOTIFY** — `sourceUrl`, `sha256`, `snapshotId` à 0/8.

Ils exigent soit une écriture prod (interdite ici), soit une décision de
publication. Rendre l'absence explicite **sur la surface** est fait : la page
et le PDF déclarent désormais qu'aucun claim n'est publiable, et nomment le
champ. Le reste est un STOP de décision, pas un travail de code.
