# LE VERDICT DEVIENT UNE PROJECTION — ET LE MOT DISPARAÎT

**2026-09-16 · CC-OFFLINE-234 · D CLOSED · witness réel en production**

```
token_casefiles.verdict = LEGACY / NON-AUTHORITATIVE
```

La colonne reste **physiquement en base**. Ni migrée, ni supprimée, ni normalisée, ni gouvernée. Les
cinq valeurs historiques sont **intactes** : leur dérive reste un témoin de l'ancien modèle. **Nous
supprimons leur consommation, pas leur histoire.**

> **UNE PROJECTION NE DOIT PAS RE-RAISONNER SUR LES PREUVES.
> ELLE DOIT PROJETER UNE AUTORITÉ GOUVERNÉE EXISTANTE.**
>
> **UNE COLONNE HISTORIQUE CESSE D'ÊTRE UNE AUTORITÉ
> LORSQUE LE PRODUIT CESSE DE LA CONSOMMER COMME TEL.**

---

## 1. POURQUOI LE MOT DISPARAÎT AU LIEU D'ÊTRE REMPLACÉ

Le motif est **mécanique**, pas doctrinal. Dès qu'un dossier porte plusieurs conclusions,
« compatibles » et « contradictoires » rendent **la même sortie** — les deux, citées. Un mot qui les
distinguerait ne serait pas *dérivable* ; il ne pourrait être que **déclaré**. Et un mot déclaré est
exactement ce que D supprime.

⛔ Nous ne remplaçons pas quatre vocabulaires par un cinquième. **Nous supprimons le besoin du mot.**

```
LA DONNÉE AUTORITATIVE EST : L'ENSEMBLE DES CONCLUSIONS GOUVERNÉES.

0 conclusion  → absence nommée, une CARDINALITÉ
1 conclusion  → cette conclusion, citée par identité ET version
N conclusions → les N, déterministement, AUCUN verdict global inventé
```

`NO_GOVERNED_CONCLUSION` signifie **littéralement** « cardinalité nulle ». Ce n'est pas une
appréciation du dossier, et surtout ce n'est **pas** `UNDETERMINED` — convertir zéro conclusion en
`UNDETERMINED` reviendrait à refabriquer le verdict qu'on vient de supprimer. Un témoin l'interdit
explicitement.

---

## 2. L'AUDIENCE EST EXPLICITE, JAMAIS UN BOOLÉEN

```
COUNSEL  → AUTORITÉ DE FONDEMENT       dossier de travail — avocat, investisseur
PUBLIC   → AUTORITÉ DE PUBLICATION     surface publiée
```

`src/lib/casefile/audienceProjection.ts` — `AUDIENCES = ["COUNSEL", "PUBLIC"]`, un vocabulaire fermé
passé **en paramètre nommé**. Aucun `includePrivate=true` dispersé chez les appelants : la surface
interne écrit le mot `"COUNSEL"` à l'endroit où elle projette.

Le contrat appliqué dépend de l'audience, **et c'est la seule chose qui en dépend** :

| | contrat | conséquence |
|---|---|---|
| `COUNSEL` | `decideFoundationContract(…, deps.length)` | une inférence fondée par ses seules dépendances est admise |
| `PUBLIC` | `decidePublicationContract(…)` — **inchangé** | elle ne reçoit même pas le compte de dépendances |

⛔ **`decidePublicationContract` n'a pas été touché.** Le relâchement de CC-OFFLINE-232 ne franchit
pas la frontière : côté public, une inférence sans pièce tombe sur `EVIDENCE_REFS_EMPTY` exactement
comme avant D. Aucune voie de contournement n'a été fabriquée.

---

## 3. LE WITNESS RÉEL — LA MÊME CLAIM, LES DEUX AUDIENCES

Exécuté en lecture seule sur le dossier de production :

```
COUNSEL  · GOVERNED_CONCLUSIONS    · 1 conclusion
             VINE-CONCLUSION-01 v1 · INFERENCE · ATTACHED
               └ DERIVED_FROM → VINE-MEASURE-01 v1

PUBLIC   · NO_GOVERNED_CONCLUSION  · 0 conclusion

verdict hérité en base : « UNDETERMINED » — consommé par AUCUNE des deux
```

**`VINE-CONCLUSION-01` est FONDÉE et NON PUBLIABLE, simultanément.** Elle est le témoin de la
séparation : une claim suffisamment fondée pour un dossier privé gouverné reste interdite de
publication tant que l'autorité de publication la refuse. Elle ne devient **jamais** publique par le
seul fait de figurer dans la projection counsel.

Et la conclusion ne voyage pas seule : elle porte **son ensemble de dépendances épinglé en version**.
C'est nécessaire, et c'est écrit au §6 de CC-OFFLINE-232 — **le `contentHash` d'une inférence ne
scelle pas ses dépendances.** Auditer une inférence exige le contenu scellé **et** l'ensemble
append-only versionné ; la projection rend donc les deux.

---

## 4. LES SURFACES, CLASSIFIÉES

| Surface | Audience | Ce qui change |
|---|---|---|
| `canonicalReader` | — *(lecteur)* | remonte désormais la **version** des claims ; ajoute `loadClaimDependencies` |
| `internalView` | **COUNSEL** | `verdict` → **`conclusions: AudienceProjection`** |
| `publicProjection` | **PUBLIC** | `verdict` **retiré** de la projection |
| `TokenCasefileView` | PUBLIC | ⛔ **BLOQUÉ PAR LE GARDE** — voir §4bis |
| page BOTIFY evidence | PUBLIC | badge de verdict hérité **retiré** |
| listing `cases/page` ×2 | PUBLIC | `severityTier` n'est plus alimenté par la colonne |
| `/api/casefile` | — | **ne consommait pas la colonne** : son `verdict` est un objet dérivé du TigerScore, autre moteur, hors périmètre |

**Rayon d'impact mesuré : deux erreurs de compilation** en retirant le champ des deux projections. La
colonne était consommée bien moins largement qu'elle n'en avait l'air — ce qui explique qu'elle ait pu
dériver si longtemps.

### Trois constats relevés en passant

- **L'UI attendait un vocabulaire que la donnée ne produit pas.** `VERDICT_COLOR` connaissait
  `AVOID`, `WARNING`, `SAFE` — **une seule** des quatre valeurs réelles. Les trois autres tombaient sur
  le gris par défaut. C'était un **quatrième** registre.
- **`severityTier` en était un cinquième** : le listing public rendait la colonne comme un palier de
  sévérité, à côté de `CRITICAL` et de `null`. Il rend `null` désormais — « non établi », qui est la
  vérité tant qu'aucune conclusion n'est projetée.
- **Le badge contre le TigerScore produisait une lecture de score global** : deux machines
  différentes, une seule impression. Le badge est parti ; le score reste, sans couleur empruntée.

### ⛔ 4bis · UNE PARTIE EST BLOQUÉE PAR LE GARDE, ET ELLE LE RESTE

Le retrait du badge dans `src/components/cases/TokenCasefileView.tsx` a été **écrit, compilé et
vérifié** — puis **refusé par `guard-offline.sh`** :

```
🛑 BLOCKED — ❌ src/components/cases/TokenCasefileView.tsx (matched ^src/components/)
```

`^src/components/` est un chemin **gelé**. La seule voie est une **lease**, c'est-à-dire une autorité
humaine — et le garde le dit lui-même : *« Ne bypass pas le guard sans validation humaine
explicite. »* Il n'a donc **pas** été contourné.

Les trois fichiers concernés sont **revenus à leur état d'origine**, ensemble, parce qu'ils forment
un tout : le composant et les deux pages `cases/lab` qui l'alimentent. En livrer une moitié aurait
cassé la compilation.

**Ce qui reste donc en place, et qu'il faut savoir :** le badge de verdict et `VERDICT_COLOR`
subsistent dans `TokenCasefileView`, alimentés par une lecture Prisma **directe** de
`token_casefiles.verdict` — hors des deux projections autoritatives, qui, elles, ne le portent plus.
La surface concernée est la fiche `cases/lab`. **D est clos sur les autorités ; cette surface
d'affichage attend une lease.**

### BOTIFY — empêcher une fausse autorité, rien de plus

BOTIFY porte **0 claim fondable sur 8** et affichait un verdict hérité sur sa page de preuves. Le
badge est retiré. ⛔ Le dossier n'est **pas** réparé, ses claims ne sont **pas** classifiées : le
correctif empêche la projection d'une fausse autorité, et s'arrête là.

---

## 5. LES MUTANTS

`__tests__/casefile/cc-offline-234-projection-par-audience.test.ts` — 13 témoins.

| Mutant | Résultat |
|---|---|
| modifier `verdict` — `AVOID`, `SAFE`, `CONCENTRATION_RISK`, `NOT_A_FINDING`, n'importe quoi | **projection counsel INCHANGÉE**, à l'identique |
| 0 conclusion admissible | aucune conclusion · `NO_GOVERNED_CONCLUSION` · **jamais `UNDETERMINED`** |
| claim non fondable *(le cas BOTIFY)* | absente |
| observation fondée | absente — **une observation n'est pas une conclusion** |
| N conclusions | les N, triées, **aucun mot global** |
| inférence sans dépendance remontée | absente côté counsel — le contrat décide, pas la surface |
| pièce non `VERIFIED` | ferme la porte publique, **jamais** la porte counsel |
| claim `PUBLIC` et citante | projetée côté public — l'existant est intact |

**Le témoin essentiel** : `VINE-CONCLUSION-01` · **COUNSEL → PRÉSENTE** · **PUBLIC → ABSENTE**, sur la
même donnée, dans le même test.

Et une garantie structurelle plutôt que testée : le champ `verdict` a **quitté les types** des deux
projections. Le recopier ne compile plus.

Suite complète : **524 fichiers, 7796 tests verts.**

---

## 6. CE QUE D N'A PAS FAIT

Aucun DDL, aucune migration, aucune des cinq valeurs historiques modifiée. Aucun `PUBLIC GRANT`,
aucun `REVOKE` touché, `decidePublicationContract` inchangé. Aucun nouveau vocabulaire en base, aucune
nouvelle palette, aucun badge gris de remplacement. `ReflexAnalysis.verdict` — autre moteur, autre
contrat — non touché. `TigerScore` ni reconstruit ni audité. BOTIFY ni réparé ni classifié.

---

## 7. LA CHAÎNE, MAINTENANT

```
SUBJECT → EVIDENCE → RELATION → MEASURED LIMIT → GOVERNED INFERENCE → AUDIENCE-SCOPED PROJECTION
```

Le mot synthétique n'est plus le produit. **La chaîne de fondement l'est.**
