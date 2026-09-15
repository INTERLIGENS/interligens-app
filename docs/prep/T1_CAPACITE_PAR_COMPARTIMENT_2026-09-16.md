# T1-CAPACITÉ-PAR-COMPARTIMENT — 2026-09-16

> **Storage authority selects an object's governed compartment; access capability must be
> scoped to that compartment and to the minimum operations required. A credential for one
> governed compartment must never become fallback capability for another.**

Branche : `feat/cc-offline-194-capacite-par-compartiment`, depuis `origin/main` = `76e4b80`.

**Aucune écriture R2. Aucun appel TSA. Le contenu d'`interligens-evidence` n'a pas été
inspecté. Aucun credential Cloudflare créé ni modifié. Aucun DDL, aucun déploiement.**

Ma proposition précédente — un credential unique couvrant les deux compartiments — était le
mauvais correctif, et le ruling le dit exactement : *« corriger une limitation de code en
augmentant le blast radius d'un secret »*. La limitation était dans le code. C'est le code
qui change.

---

## 1 · La table compartiment → capacité, et sa fermeture

| compartiment | fente | opérations minimales | motif |
|---|---|---|---|
| `interligens-evidence` | `R2_EVIDENCE_ACCESS_KEY_ID` / `_SECRET_ACCESS_KEY` | **READ+WRITE** | compartiment canonique : les pièces y naissent et y sont relues |
| `interligens-reports` | `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | **READ** | compartiment legacy : on y relit ce que le registre y situe. **Rien n'y écrit.** |

**Quatre variables distinctes, aucune partagée.** Un témoin le vérifie par construction
(`new Set([...4 noms]).size === 4`).

**`operationsMinimales` est DÉCLARATIF, et je le dis plutôt que de le laisser croire :** ce
dépôt ne peut pas vérifier la portée réelle d'un jeton R2 — seul Cloudflare la connaît. La
valeur énonce ce qui **doit** être provisionné, pour qu'un relecteur voie d'un coup d'œil que
`reports` n'exige **aucune** écriture. Elle ne garde rien à l'exécution et ne prétend pas le
faire.

### La preuve que la table est fermée — en deux endroits, parce qu'un seul ne suffisait pas

1. La **déclaration** est en dur et gelée (`Object.freeze` sur la table et sur chaque entrée),
   sans aucune lecture d'environnement.
2. ⚠️ **Et la résolution aussi.** Mon premier témoin n'inspectait que la déclaration — le
   mutant M5, qui injectait un `env.R2_CAPACITE_CLE_OVERRIDE` dans `capaciteDuCompartiment`,
   est **resté vert**. Fermer la table ne sert à rien si celui qui la lit accepte une
   surcharge. Le témoin ajouté compte les accès à l'environnement dans le corps de la
   fonction : il doit y en avoir **exactement deux**, tous deux indexés par
   `env[attendu.variableCle]` / `env[attendu.variableSecret]`, et **aucun** accès par point.

**`R2_EVIDENCE_* || R2_*` a disparu du chemin gouverné** — les quatre occurrences dans
`compartment.ts` (deux par porte) sont supprimées, et un témoin vérifie qu'aucune ne revient.

---

## 2 · Les cinq preuves

**(a) `reports` désigné → credential `reports`.** L'espion observe un seul appel au
constructeur, portant `ak-REPORTS` / `sk-REPORTS`. Aucune trace de `EVIDENCE` dans ce qui a
été remis.

**(b) `evidence` désigné → credential `evidence`.** Symétrique : `ak-EVIDENCE` /
`sk-EVIDENCE`, aucune trace de `REPORTS`.

**(c) fente vide → `CAPABILITY_UNAVAILABLE`, et l'espion n'a RIEN vu.**

C'est le point où une preuve faible aurait été facile. *« Le credential de l'autre n'est pas
essayé »* ne se démontre **pas** par l'absence d'erreur : un refus peut venir de dix causes,
et un refus obtenu après une tentative ressemble exactement à un refus obtenu sans tentative.

Le constructeur de client est donc **injectable** — pas par commodité de test, mais pour
rendre la garantie **observable**. Le témoin vide la fente d'un compartiment **en laissant
l'autre pleine** (le repli serait donc possible), et constate :

- `ok === false`, cause `CAPABILITY_UNAVAILABLE` ;
- **zéro construction de client** — aucun secret n'a été remis, donc aucune tentative n'a eu
  lieu, avec quelque credential que ce soit ;
- le refus **nomme la variable à réparer**, celle de ce compartiment, et dit explicitement que
  celui de l'autre n'a pas été essayé.

Joué dans **les deux sens** : `reports` vide / `evidence` plein, puis l'inverse.

**(d) `CAPABILITY_UNAVAILABLE` est distincte des cinq causes existantes.** Les six refus sont
produits par le chemin complet et comparés : **six textes, six valeurs différentes**
(`new Set(...).size === 6`), et `CAPABILITY_UNAVAILABLE` n'apparaît que dans le sien. Elle est
en particulier distincte de `evidence_credentials_unconfigured`, qui dit désormais une autre
chose : *le compte R2* n'est pas configuré — partagé par tous les compartiments, autre
variable, autre réparation.

**(e) La mesure de fermeture est inchangée.**

```
1 · NOMMÉES par le registre gouverné : 31 / 31
      → interligens-reports : 31
2 · RÉSOLUES (nommées ET desservies)  : 31 / 31
```

Le séquençage annoncé s'est vérifié : le credential actuel reste dans la fente `evidence`,
`reports` est repassé sur le principal, **rien n'a bougé**.

La porte de **naissance** obéit à la même table : fente `evidence` vide → `CAPABILITY_UNAVAILABLE`,
aucun repli sur le principal.

---

## 3 · Les cinq mutants

`bash scripts/evidence-chain/mutants-capacite-par-compartiment.sh` — **5 / 5 rouges.**

| | faute réintroduite | |
|---|---|---|
| M1 | un credential Evidence ouvre `reports` | 🔴 |
| M2 | un credential `reports` ouvre `evidence` | 🔴 |
| M3 | le repli `\|\|` réintroduit | 🔴 |
| M4 | `CAPABILITY_UNAVAILABLE` dégradée en une cause existante | 🔴 |
| M5 | la table lue depuis l'environnement | 🔴 *(vert au premier essai — voir §1)* |

Suite complète : **511 fichiers, 7 561 tests verts** · `tsc` 0 · ESLint 0.

**Quatorze témoins ont dû changer de fixture**, et c'est l'effet voulu : ouvrir
`interligens-evidence` avec le credential générique n'est plus possible. Les environnements de
test portaient l'ancien modèle à repli ; ils portent désormais **les deux fentes**, avec des
marqueurs distincts — ce qui les rend plus forts, puisqu'on peut maintenant affirmer *laquelle*
a servi et pas seulement que « ça a marché ».

---

## 4 · ⚠️ Un site legacy porte encore le repli, et il est mal ciblé aujourd'hui

Je ne l'ai pas modifié — il est hors du chemin gouverné et le corriger changerait le
comportement de trois scripts que la fenêtre ne couvre pas. Mais il doit être su.

`src/lib/evidence-chain/r2.ts` · `evidenceR2ConfigFromEnv()` lit encore :

```
R2_EVIDENCE_ACCESS_KEY_ID || R2_ACCESS_KEY_ID
R2_EVIDENCE_SECRET_ACCESS_KEY || R2_SECRET_ACCESS_KEY
R2_EVIDENCE_BUCKET_NAME || R2_BUCKET_NAME
```

Elle sert `recover-snapshots-d.ts`, `backfill-evidence.ts` et `migrate-snapshots.ts` —
conservés précisément pour lire `interligens-reports`. Or **depuis que
`R2_EVIDENCE_BUCKET_NAME` est posée**, ces trois replis résolvent désormais vers
`interligens-evidence`, **avec le credential evidence**. Ce n'est pas une conséquence de mon
correctif : c'est déjà l'état actuel, et il précède cette fenêtre.

Rien n'a été exécuté, donc rien n'est arrivé. Mais ces trois scripts pointent aujourd'hui sur
un compartiment qui n'est pas le leur, avec une capacité en écriture. C'est une décision à
prendre — pas un contournement à glisser ici.

---

## État à la clôture

- Capacité **scopée par compartiment**, plus aucun repli entre les deux fentes.
- **31 NOMMÉES → 31 RÉSOLUES**, inchangé.
- Le remplacement du credential evidence par un jeton scopé sur `interligens-evidence` **seul**
  est désormais sans risque pour `reports` : les deux fentes sont indépendantes, et une fente
  vide refuse au lieu d'emprunter l'autre. C'était tout l'objet de la fenêtre.
- Aucun appel TSA.
