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

## 3. `src/app/api/explorer/route.ts` — LE POINT QUI ATTEND UN ARBITRAGE

Le containment est **déjà fait et testé** chez le producteur
(`src/lib/explorer/explorerItems.ts`, hors gel, mergé) : les treize `summary`
non gouvernés sont remplacés par une chaîne identique, le quatorzième — le seul
gouverné, CBEX — passe intact.

Ce qui reste à trancher est **la forme du terminal**, pas le containment.
Voir la note d'arbitrage envoyée avec ce lot.

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
