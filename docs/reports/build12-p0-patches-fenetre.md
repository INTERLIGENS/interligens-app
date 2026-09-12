# LES PATCHES DE LA FENÊTRE — écrits, NON APPLIQUÉS

Trois chemins gelés, aucun wildcard. Ce fichier existe pour que le temps de la
fenêtre soit occupé **uniquement par le merge**.

```
^src/app/api/watchlist/route\.ts$
^src/app/api/explorer/route\.ts$
^src/app/api/investigators/network-graph/route\.ts$
```

Tout ce que ces patches appellent est **déjà écrit, déjà testé, déjà mergé hors
fenêtre**. Aucun d'eux n'ajoute de logique : ils branchent.

---

## 1. `src/app/api/watchlist/route.ts` — RETRAIT CAUSAL

**Imports à ajouter :**

```ts
import { admettreAnonyme, repondre } from '@/lib/governance/audienceProjection'
import { projeterWatchlist } from '@/lib/governance/surfaces/watchlist'
```

**Le corps du `GET` se réduit à ceci, et tout le reste part :**

```ts
export async function GET() {
  // COLLECTION AUTHORITY — l'appartenance à la Watchlist est elle-même une
  // assertion publiée, et aucune décision ne la fonde. Le refus est au niveau
  // de la COLLECTION : il ne porte ni compte, ni longueur, ni clé par membre,
  // ni ordre — les six différentiels mesurés ne peuvent plus rien reconstruire.
  //
  // AUCUNE DONNÉE N'EST DÉTRUITE. handlesV2 garde ses 108 entrées, la base
  // garde ses lignes, le cron garde sa source de vérité. C'est l'ÉMISSION qui
  // s'arrête. La Watchlist reste un outil interne d'enquête.
  const admission = admettreAnonyme(
    "watchlist retiree de la projection servie — voir docs/reports/build12-p0-published-content-authority.md §6.2",
  )
  return repondre(projeterWatchlist(admission, []))
}
```

**Ce qui disparaît du fichier :** `buildKolCanonicalSnapshotBatch`, `handlesV2`,
`parseBehaviorFlags`, `isProceedsPublished`, `redactMonetary`, `prisma` — et
les ~230 lignes qui construisaient les entrées. Les imports devenus inutiles
partent avec.

**Ce qui rend le retrait CAUSAL :** si quelqu'un rebranche la route demain, il
ne peut pas faire repartir le contenu sans **écrire** une décision
d'appartenance. `projeterWatchlist` lève si la table des fondations en déclarait
une, et `repondre` n'accepte rien d'autre qu'un `Admissible`.

**Déjà vert hors fenêtre :** `__tests__/governance/p0-b-collection-servie.test.ts`
— 107 membres irréprochables refusés, 11 / 1 / 0 membres rendant la MÊME suite
d'octets, ordre inversé idem, zéro chiffre dans le corps.

**Les pages sont déjà prêtes** (hors gel, mergées) : `src/app/{en,fr}/watchlist/page.tsx`
reconnaissent `{ refus: true }` et rendent un état de retrait au lieu du
bandeau « UNDER ACTIVE SURVEILLANCE ».

---

## 2. `src/app/api/investigators/network-graph/route.ts` — CONTAINMENT DU GRAPHE

**Le fichier entier devient :**

```ts
import { NextResponse } from "next/server";
import { enforceInvestigatorAccess } from "@/lib/investigators/accessGate";
import { parseNetworkGraph } from "@/lib/network/schema";
import { prisma } from "@/lib/prisma";
import { FILTRE_SUJET_ADMISSIBLE } from "@/lib/governance/autoriteSujet";
import {
  contenirGraphe,
  type DecisionDeSujet,
} from "@/lib/governance/surfaces/networkGraph";
import rawData from "@/data/scamUniverse.json";

// Le parse reste au chargement — il valide la FORME. Le containment, lui, ne
// peut pas y vivre : un parse qui redacte est un filtre d'affichage deguise en
// parseur, et c'est exactement l'indistinguabilite que ce chantier ferme.
const parsed = parseNetworkGraph(rawData);

export async function GET() {
  await enforceInvestigatorAccess();

  // LA MÊME autorite de publication que toutes les autres surfaces
  // nominatives, consommee par import.
  const publies = await prisma.kolProfile.findMany({
    where: FILTRE_SUJET_ADMISSIBLE,
    select: { handle: true, publishStatus: true, displayName: true },
  });
  const decisions = new Map<string, DecisionDeSujet>(
    publies.map((p) => [p.handle.toLowerCase(), p]),
  );

  const { graphe, retraits } = contenirGraphe(parsed, decisions);
  if (retraits.length > 0) {
    // Les motifs partent au JOURNAL, jamais dans la charge.
    console.info("[network-graph] retraits", { total: retraits.length });
  }

  return NextResponse.json(graphe, {
    headers: { "cache-control": "private, max-age=0, must-revalidate" },
  });
}
```

**Déjà vert hors fenêtre :** `__tests__/governance/p0-f-network-graph.test.ts`,
18 tests sur la charge RÉELLEMENT servie.

**⚠ Un point de forme reste ouvert et il est déclaré :** cette route rend encore
un `NextResponse.json` direct, pas un `repondre(...)`. La marque n'est donc pas
portante à SON terminal. C'est le même arbitrage que l'Explorer (§3 ci-dessous),
et il se tranche une fois pour les deux.

---

## 3. `src/app/api/explorer/route.ts` — LE TERMINAL, ET LE RETRAIT DES HUIT

Le containment des `summary` est déjà mergé hors fenêtre. Ce qui suit est le
reste, et il se déploie en **trois parties dont une seule est gelée**.

### 3.a — `src/lib/explorer/explorerItems.ts` — HORS GEL

Les huit champs sans fondation possible cessent d'être produits. `DossierItem`
perd : `kind`, `evidenceDepth`, `documentationStatus`, `strongestFlags`,
`topCoordinationSignal`, `sharedActorGroup`, `multiLaunchRecurrence`,
`linkedActorsCount`.

Les quatre fondés restent, chacun enveloppé dans l'unité que sa décision
fonde :

```ts
const membre = {
  id:            gouverner("STATE", d.id, decisionDeSurface),
  title:         gouverner("OBSERVATION", d.title, decisionDeSurface),
  summary:       gouverner("ASSERTION", d.summary, decisionDeSurface),
  href:          gouverner("STATE", d.href, decisionDeSurface),
  primaryDate:   gouverner("OBSERVATION", d.primaryDate, decisionDeSurface),
  linkedActors:  gouverner("ASSERTION", d.linkedActors, decisionActeurs),
  proceedsObservedTotal: gouverner("OBSERVATION", d.proceedsObservedTotal, decisionProceeds),
  proceedsCoverage:      gouverner("OBSERVATION", d.proceedsCoverage, decisionProceeds),
  snapshotCount:         gouverner("OBSERVATION", d.snapshotCount, decisionPreuves),
}
```

### 3.b — les pages — HORS GEL, ET ELLES NE SONT PAS OPTIONNELLES

**C'est la partie que la mesure a rendue obligatoire.** Retirer les champs sans
toucher les pages crée DEUX assertions fausses, par des replis `??` de la même
famille que le `?? 0` qui faisait lire `SIGNAL` à RAVE-DUMP :

| page | ligne | ce que le repli invente |
|---|---|---|
| `en/explorer/page.tsx` | 170 | `KIND_BADGE[d.kind] ?? KIND_BADGE.case` → **les quatorze lisent « CASE CLUSTER »**, dont neuf lancements de token et une fraude de plateforme. **Dix assertions fausses.** |
| `en/explorer/page.tsx` | 171 | `DOC_BADGE[d.documentationStatus] ?? DOC_BADGE.partial` → **les quatorze lisent « PARTIAL »**, dont neuf qui étaient `DOCUMENTED`. **Neuf niveaux rabaissés.** |

Les deux replis deviennent : **valeur absente → aucun badge**, jamais un badge
par défaut. `evidenceDepth` (l. 172) est déjà sûr — il rend `null` sans valeur.
Idem `fr/` et `[caseId]/page.tsx:102`, qui porte le même badge de documentation.

Prouvé par `__tests__/governance/p0-explorer-retrait-des-huit.test.ts`, mergé
hors fenêtre.

### 3.c — `src/app/api/explorer/route.ts` — LE SEUL FICHIER GELÉ

```ts
import { admettreOperateur, repondre } from '@/lib/governance/audienceProjection'
import { declarerCollection, projeterCollectionAdmissible } from '@/lib/governance/appartenance'

// La collection Explorer est NON_ASSERTIVE, et c'est DÉCLARÉ, jamais déduit :
// les quatorze dossiers sont des lancements de tokens, des cases et une
// plateforme — pas des personnes. Figurer dans cette liste n'affirme rien sur
// un sujet, contrairement à la Watchlist. La dispense porte sur
// l'APPARTENANCE seule : chaque champ de chaque membre présente toujours sa
// décision, et le type l'exige.
const admission = admettreOperateur('investigator_session')
const collection = declarerCollection('ExplorerDossiers', 'NON_ASSERTIVE', null)
return repondre(projeterCollectionAdmissible(admission, collection, membres))
```

**Aucune re-vérification dans la route.** Le terminal délègue à
`projeterCollection` ; une route qui referait le test pourrait le refaire
autrement.

### Ce que le lecteur voit disparaître de l'écran

| # | ce qui n'apparaît plus |
|---|---|
| 1 | le badge de type en tête de carte — **TOKEN LAUNCH**, **CASE CLUSTER**, **PLATFORM FRAUD** |
| 2 | le badge de force de preuve — **STRONG EVIDENCE**, **COMPREHENSIVE EVIDENCE** |
| 3 | le badge de documentation — **DOCUMENTED** en vert, **PARTIAL** en orange, sur la carte ET en tête du dossier détaillé |
| 4 | les deux pastilles de comportement héritées des acteurs — « Repeated cashout », « Complex fund movement » |
| 5 | la pastille rouge de coordination — **« Coordinated promotion »**, **« Shared actor group »** |
| 6 | *rien* : `sharedActorGroup` est déclaré dans le type du client et **jamais peint**. Il ne part que sur le fil. |
| 7 | la pastille rouge **« Same actor group across N dossiers »** |
| 8 | la ligne **« N linked actors documented »** sous les pastilles d'acteurs — et le « +N » qui comptait les acteurs non affichés |

Restent à l'écran : le titre, la date, les pastilles d'acteurs nommés, le
montant observé (un seul dossier sur quatorze en porte un), le compte de
preuves (**zéro sur les quatorze**), et un résumé identique pour treize.



---

## LA DANSE, DANS L'ORDRE

1. `hotfix/guard-p0-collection-authority` — **le système de garde SEUL** au diff
   (`scripts/guard-offline.sh` + `.github/workflows/guard-offline.yml`), ajout du
   bloc d'exemption pour `^feat/cc-offline-[0-9]+-p0-collection-authority$`
   avec les trois chemins, **aucun wildcard**.
2. `gh pr view --json headRefName,files` **AVANT** d'attendre la CI.
3. Merge de l'exemption (`--rebase --delete-branch`, jamais `--admin`).
4. Branche `feat/cc-offline-NNN-p0-collection-authority` : les trois patches
   ci-dessus, plus rien.
5. Tests + mutants verts (ils le sont déjà : le code appelé est mergé).
6. Merge dans la fenêtre.
7. **Fermeture immédiate** par la même voie : retrait du bloc d'exemption,
   garde **byte-identique** à son état d'avant, zéro exemption résiduelle.
8. Preuve positive **dans les deux formes** :
   - une branche conforme NON exemptée touchant `^src/app/api/` est **bloquée** ;
   - le nom naguère exempté, **rejoué**, est **bloqué** lui aussi.
