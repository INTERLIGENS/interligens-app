# BUILD 9 — `tigerScore` nullable · audit des lecteurs

Lecture seule. **Aucune correction appliquée** : deux des quatre maillons sont
sur chemin gelé, et ils commandent les deux autres.

---

## STATUS

**Le contrat CaseFile sait déjà représenter l'absence.** Aucun champ
`scoreStatus` n'est nécessaire — la vérification demandée est faite, et elle est
concluante.

Six lecteurs seulement touchent `token_casefiles.tigerScore`. Aucun ne plante
sur `NULL`, aucun ne le convertit en `0` — mais **deux affichent une absence
comme si c'était une valeur**, et un **classe les non-scorés en tête de liste**.

---

## LE CONTRAT SAIT DÉJÀ DIRE « ABSENT »

Vérifié avant toute proposition, comme demandé.

`CasefilesIndexView` — la carte de la liste — est **déjà écrite pour un score
nullable**, parce qu'elle sert aussi `platformRiskScore` :

```tsx
score: number | null;
…
{c.score != null ? (
  <span …>{c.score}<span>/100</span></span>
) : c.severityTier ? (
  <span …>{c.severityTier}</span>      ← replie sur le verdict
) : null}
```

`TokenCasefileView` — la fiche — emploie `—` partout où une valeur manque :
`data.tgeDate ?? "—"`, `data.decimals ?? "—"`, `data.publishedDate ?? "—"`, et
`data.insiderExitNotionalValueUsd != null &&` pour les blocs conditionnels.

**Le vocabulaire de l'absence existe : `—` sur la fiche, repli sur le verdict
dans la liste.** Rien à inventer.

---

## LES SIX LECTEURS

Le nom `tigerScore` est très répandu dans le dépôt (scans, alertes KOL, MM,
vault, simulateur, fixtures). **Seuls ceux qui passent par
`prisma.tokenCaseFile` lisent la colonne en cause** — les autres portent des
scores calculés à la volée sur d'autres objets.

| # | lecteur | ce qu'il fait d'un `NULL` | gelé |
|---|---|---|---|
| 1 | `prisma/schema.prod.prisma:715` — `tigerScore Int` | **type ment** : Prisma rendra `null` dans un champ typé `number`. Pas de plantage, mais TypeScript croit à un nombre | **oui** `^prisma/` |
| 2 | `src/components/cases/TokenCasefileView.tsx:32` — `tigerScore: number` | type non nullable, hérité de 1 | **oui** `^src/components/` |
| 3 | `src/components/cases/TokenCasefileView.tsx:225` — `{data.tigerScore}/100` | React rend `null` comme vide → affiche **« /100 »**, un cadre de score vide avec la couleur du verdict | **oui** |
| 4 | `src/app/en/cases/page.tsx:70` + `fr` — `orderBy: { tigerScore: "desc" }` | Postgres place les `NULL` **en PREMIER** en `DESC` → un dossier non scoré s'affiche **en tête**, à la place du plus grave | non |
| 5 | `src/app/en/cases/page.tsx:76` + `fr` — `score: r.tigerScore` | **sûr** — `CasefilesIndexView` gère déjà `null` et replie sur le verdict | non |
| 6 | `src/app/en/cases/lab/page.tsx:100` + `fr` — `tigerScore: r.tigerScore` | passe la valeur à 2 ; casse au typecheck dès que 1 est corrigé | non |

**Aucun lecteur ne convertit `NULL` en `0`.** Le seul `?? 0` de la famille
(`src/lib/vault/buildCaseIntelligencePack.ts:637`) porte sur `VaultCaseEntity`,
un autre modèle, déjà nullable — hors périmètre.

### Les deux vrais défauts

**Le cadre de score vide (#3).** `{data.tigerScore}/100` avec `null` rend
« /100 » dans un encadré coloré par le verdict. Ce n'est pas un plantage : c'est
pire, c'est un score absent qui a l'apparence d'un score. Le contrat dit `—`.

**Le tri (#4).** `ORDER BY "tigerScore" DESC` place les `NULL` en premier en
Postgres. BOTIFY et VINE, non scorés, ouvriraient la liste des dossiers publiés
comme s'ils étaient les plus sévères. Correction : `nulls: "last"`.

---

## LA CHAÎNE DE DÉPENDANCE

Les quatre corrections ne sont pas indépendantes :

```
1. schema.prod.prisma  Int → Int?          (GELÉ)
        │
        ├──> 2/3. TokenCasefileView  type + rendu `—`   (GELÉ)
        │              │
        │              └──> 6. lab/page.tsx ×2   (libre, mais casse au typecheck sans 2)
        │
        └──> 4. cases/page.tsx ×2  `nulls: "last"`   (libre, mais l'option Prisma
                                    n'est typée que si le champ est nullable)
```

**Tout part du schéma.** Tant que `tigerScore` y est `Int`, Prisma refuse
l'option `nulls` et type le champ `number` — les deux corrections « libres » ne
compilent pas. Il n'y a donc pas de sous-ensemble applicable seul.

C'est pourquoi je n'ai rien corrigé : appliquer les fichiers libres seuls
laisserait l'arbre rouge au typecheck.

---

## INVENTAIRE POUR EXEMPTION — 2 fichiers

| fichier | pour | pourquoi inévitable |
|---|---|---|
| `prisma/schema.prod.prisma` | `tigerScore Int` → `Int?` | le modèle doit refléter la colonne ; sans lui TypeScript ment et l'option `nulls` reste indisponible |
| `src/components/cases/TokenCasefileView.tsx` | type `number \| null` + rendu `—` | c'est la fiche publique ; elle afficherait « /100 » sur un score absent |

**Non demandés** : `prisma/seed-lab.ts` (gelé, mais LAB reste à 91 — aucune
modification) ; les quatre fichiers `src/app/…/cases/` sont libres et suivront
dans la même PR.

Aucun wildcard. Deux fichiers nommés.

---

## URGENCE : AUCUNE

La colonne est nullable en base, mais **aucune ligne ne porte `NULL`** —
BLACKBULL vaut 0, LAB vaut 91. Rien ne casse aujourd'hui. Le défaut n'apparaît
qu'à l'insertion de BOTIFY et VINE, c'est-à-dire au bloc 4.

**L'ordre correct est donc : corriger les lecteurs d'abord, insérer ensuite.**

---

## LE BLOC 4

Il insère déjà `tigerScore` **absent de la liste de colonnes**, donc `NULL` par
omission maintenant que la contrainte est levée. **Aucune régénération n'est
nécessaire** — le générateur n'a jamais posé de score, c'est ce qui a produit
l'erreur `23502`.

Vérifié : `tigerScore` n'apparaît nulle part dans
`docs/prep/patches/BUILD9/04_migration_38.sql`.

Je propose d'ajouter **un post-check** au bloc 4 — que les deux dossiers entrent
bien avec `tigerScore IS NULL`, et que BLACKBULL et LAB restent à 0 et 91. Il ne
change rien à ce qui est inséré.

---

## DONNÉES EXISTANTES

Non touchées. BLACKBULL reste à **0**, LAB à **91**. Le `0` de BLACKBULL — un
dossier dont le verdict est `CONCENTRATION_RISK` et le score zéro — reste le
sujet distinct que vous avez identifié, et je n'y touche pas.

---

## STOP

**Exemption de chemins gelés**, 2 fichiers, inventaire ci-dessus. Je n'ouvre
rien avant votre retour.

Aucun autre STOP : pas de champ inventé, pas de sentinelle, pas de
`computeTigerScore` exécuté, aucune collecte.
