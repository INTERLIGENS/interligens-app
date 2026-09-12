// ─── SURFACE NETWORK GRAPH — LE CONTAINMENT PORTE SUR LA TOPOLOGIE ───────
//
// ██  « Protected/nominative content cannot acquire publication authority   ██
// ██    merely because it is embedded in a graph node, edge, label or note. »██
//
// Le containment porte donc sur les NŒUDS, les ARÊTES, les LABELS et les
// NOTES — pas sur un champ.
//
// ─── IL NE VA PAS DANS `schema.ts`, ET C'EST UNE RÈGLE, PAS UN GOÛT ─────
//
// Un `parse` qui redacte est un filtre d'affichage déguisé en parseur. La
// mesure qui fonde tout ce chantier est précisément qu'on ne peut pas
// distinguer une décision d'accès d'un filtre d'affichage dans le texte. Y
// cacher le containment reproduirait la faute au lieu de la fermer.
//
// ─── CE QUI EST MESURÉ, ET COMMENT ──────────────────────────────────────
//
// Le premier inventaire de ce graphe cherchait des MOTIFS DE TEXTE (« Mom »,
// « Dad », « family », « insider supply ») et rendait 9 nœuds sur 41. C'était
// FAUX PAR DÉFAUT : le `group` DÉCLARÉ en rend **13**, et les quatre manqués
// sont les plus lourds — des noms civils complets que le motif ne pouvait pas
// voir (« Sam O'Leary (SAMBO) », « Djordje Stupar », « Parth Kapadia »,
// « Ryan Arriaga »).
//
// UN GREP N'EST PAS UNE PROVENANCE. Le critère est ici la propriété DÉCLARÉE
// par la donnée elle-même.
//
// Fondations mesurées sur les 13 nœuds nominatifs :
//
//   FONDÉS    2   bkokoski → « Brandon Kokoski »  (displayName publié IDENTIQUE)
//                 GordonGekko → « GordonGekko »
//   NON FONDÉS 11
//     · 6 `wallet_family` — BK Mom, BK Dad, BK Carter, BK Illya, SAM Mum,
//       SAM Dad. Aucun `KolProfile`, donc AUCUNE décision de publication ne
//       peut exister à leur sujet. Il n'y a pas de fondation à chercher : il
//       ne peut pas y en avoir. C'est un refus, pas une qualification.
//       (« BK Illya » n'est même pas un lien de parenté — c'est un prénom.)
//     · 3 sans `KolProfile` du tout — Parth Kapadia, Ryan Arriaga,
//       @mariaqueennft.
//     · 2 SUJETS PUBLIÉS DONT LE LABEL N'EST PAS COUVERT :
//         sxyz500  publié, displayName « Sxyz500 »,  le graphe dit « Sam O'Leary (SAMBO) »
//         planted  publié, displayName « planted »,  le graphe dit « Djordje Stupar »
//
// Ces deux derniers sont le cas le plus net : LE SUJET EST PUBLIÉ ET LE LABEL
// NE L'EST PAS. La décision fonde le `displayName` publié, pas un libellé
// arbitraire écrit à côté. Une garde qui aurait testé « ce sujet est-il
// publié ? » les aurait laissés passer tous les deux.

import type { NetworkEdge, NetworkGraph, NetworkNode } from "@/lib/network/schema";
import { fondationPossiblePour, type CheminDeDonnee } from "../fondations";

/**
 * LES GROUPES QUI DÉSIGNENT UNE PERSONNE.
 *
 * Lu sur la propriété déclarée par la donnée, jamais sur son texte. Un nœud
 * `token` dont le label contiendrait « Dad » n'est pas nominatif ; un nœud
 * `wallet_family` dont le label serait anodin l'est.
 */
export const GROUPES_NOMINATIFS = [
  "person",
  "wallet_family",
  "handle",
  "source",
  "email",
] as const;

/** Les porteurs de contenu du graphe qui n'ont AUCUNE fondation possible. */
export const PORTEURS_DU_GRAPHE = [
  "NetworkNode.notes",
  "NetworkEdge.label",
  "NetworkGraph.timeline",
  "NetworkGraph.metrics",
  "NetworkGraph.sourceOfTruth",
  "NetworkNode.totalScammedUsd",
] as const satisfies readonly CheminDeDonnee[];

/** Constante servie à la place de la métadonnée d'ingénierie. Identique pour tous. */
export const SOURCE_NON_GOUVERNEE =
  "Source metadata withheld — no publication decision covers this content.";

export function estNominatif(n: Pick<NetworkNode, "group">): boolean {
  return (GROUPES_NOMINATIFS as readonly string[]).includes(n.group);
}

/** Ce que la route a lu dans le magasin gouverné, par clé de sujet. */
export interface DecisionDeSujet {
  readonly handle: string;
  readonly publishStatus: string;
  readonly displayName: string | null;
}

export type MotifDeRetrait =
  | "AUCUN_SUJET_GOUVERNE"
  | "SUJET_NON_PUBLIE"
  | "LABEL_NON_COUVERT_PAR_LA_DECISION"
  | "EXTREMITE_RETIREE";

export interface GrapheContenu {
  readonly graphe: NetworkGraph;
  /** Pour le JOURNAL. Ne doit JAMAIS atteindre la charge émise. */
  readonly retraits: ReadonlyArray<{ id: string; motif: MotifDeRetrait }>;
}

/**
 * LES CLÉS DE SUJET D'UN NŒUD — il en faut DEUX, et la mesure l'impose.
 *
 * Le nœud `bkokoski` porte `handle: "@KokoskiB"`, et AUCUN `KolProfile` ne
 * s'appelle `kokoskib` : le profil publié a le handle `bkokoski`, qui est
 * l'`id` du nœud. Le graphe et la base ne nomment donc pas la même personne
 * de la même façon, et une résolution qui n'aurait essayé que `handle`
 * aurait refusé le seul nœud parfaitement fondé du corpus.
 *
 * On essaie les deux, dans l'ordre, et la PREMIÈRE décision trouvée décide.
 * Ce n'est pas une tolérance : c'est la reconnaissance mesurée que la clé
 * d'un nœud de graphe n'est pas normalisée. `CANONICAL_SUBJECT_HANDLE` ne
 * s'applique pas ici — il porte sur `KolProfile.handle`, pas sur un
 * identifiant de nœud écrit à la main.
 */
function clesDuNoeud(n: NetworkNode): readonly string[] {
  const brut = [n.handle, n.id].filter((x): x is string => typeof x === "string" && x.length > 0);
  return brut.map((x) => x.replace(/^@+/, "").toLowerCase());
}

function decisionDuNoeud(
  n: NetworkNode,
  decisions: ReadonlyMap<string, DecisionDeSujet>,
): DecisionDeSujet | undefined {
  for (const cle of clesDuNoeud(n)) {
    const d = decisions.get(cle);
    if (d !== undefined) return d;
  }
  return undefined;
}

/**
 * CONTENIR — et les trois règles sont indépendantes.
 *
 * 1. NOTES — retirées sur TOUS les nœuds, sans exception. `NetworkNode.notes`
 *    n'a aucune fondation possible. Les retirer partout est ce qui rend le
 *    retrait invisible : une note présente ici et absente là dirait laquelle
 *    portait quelque chose.
 * 2. LABELS D'ARÊTE — idem, retirés partout. « BOTIFY co-founders » affirme
 *    une relation entre deux personnes nommées, et rien ne l'autorise.
 * 3. NŒUDS NOMINATIFS — gardés seulement si une décision couvre LEUR LABEL.
 *    Les arêtes qui touchent un nœud retiré partent avec lui : une arête
 *    pendante désignerait l'absent.
 */
export function contenirGraphe(
  graphe: NetworkGraph,
  decisions: ReadonlyMap<string, DecisionDeSujet>,
): GrapheContenu {
  // Garde de cohérence : si la table venait à fonder ces chemins, ce module
  // devrait être réécrit — pas contourné en silence.
  for (const chemin of PORTEURS_DU_GRAPHE) {
    if (fondationPossiblePour(chemin) !== null) {
      throw new Error(
        `networkGraph: ${chemin} a acquis une fondation — le containment doit etre reecrit explicitement`,
      );
    }
  }

  const retraits: Array<{ id: string; motif: MotifDeRetrait }> = [];
  const gardes = new Set<string>();
  const noeuds: NetworkNode[] = [];

  for (const n of graphe.nodes) {
    if (estNominatif(n)) {
      const d = decisionDuNoeud(n, decisions);
      if (d === undefined) {
        retraits.push({ id: n.id, motif: "AUCUN_SUJET_GOUVERNE" });
        continue;
      }
      if (d.publishStatus !== "published") {
        retraits.push({ id: n.id, motif: "SUJET_NON_PUBLIE" });
        continue;
      }
      // ██ LA LIGNE QUI ATTRAPE sxyz500 ET planted ██
      // Le sujet est publié ; son LABEL ne l'est pas. La décision fonde le
      // `displayName` publié, pas un libellé arbitraire écrit à côté.
      if (d.displayName === null || d.displayName !== n.label) {
        retraits.push({ id: n.id, motif: "LABEL_NON_COUVERT_PAR_LA_DECISION" });
        continue;
      }
    }
    // ── LE CHAMP QUE LE BALAYAGE A ATTRAPÉ ────────────────────────────────
    //
    // `totalScammedUsd` vit sur le NŒUD, pas seulement dans `metrics` : le
    // nœud `bkokoski` en porte 4 500 000. C'est un montant encaissé par une
    // personne nommée, et les proceeds relèvent de
    // `KolProfile.proceedsPublication` — une décision DISTINCTE de
    // `publishStatus`. Un sujet publié n'a pas ses montants publiés par ce
    // seul fait ; `proceedsGate` tient cette séparation partout ailleurs, et
    // elle tient ici aussi. Le graphe n'a aucun moyen de présenter cette
    // décision-là, donc le champ part — y compris sur les nœuds fondés.
    const {
      notes: _notes,
      memberResolutionMatrix: _matrice,
      totalScammedUsd: _proceeds,
      ...reste
    } = n;
    void _notes;
    void _matrice;
    void _proceeds;
    gardes.add(n.id);
    noeuds.push(reste as NetworkNode);
  }

  const aretes: NetworkEdge[] = [];
  for (const e of graphe.edges) {
    if (!gardes.has(e.source) || !gardes.has(e.target)) {
      retraits.push({ id: `${e.source}→${e.target}`, motif: "EXTREMITE_RETIREE" });
      continue;
    }
    const { label: _label, ...reste } = e;
    void _label;
    aretes.push(reste as NetworkEdge);
  }

  // ─── LES TROIS PORTEURS QUE LE RULING NE NOMMAIT PAS, ET QUI SONT DE LA
  //     MÊME CLASSE ────────────────────────────────────────────────────────
  //
  // « nodes, edges, labels, notes » couvrait ce qui avait été mesuré. En
  // mesurant la charge entière, trois autres porteurs apparaissent, et
  // l'invariant s'applique mot pour mot : le contenu n'acquiert pas d'autorité
  // en changeant de contenant.
  //
  //   timeline      « BK Mom begins 10-week GHOST cashout ($5,207, 26 tx) »,
  //                 « Djordje Stupar (@planted) admits… » — 6 des 23 événements.
  //   metrics       `totalScammedUsd_bkokoski: 4500000`, `sam_relay_cashout…` —
  //                 des montants PAR SUJET NOMMÉ, la classe que
  //                 `proceedsPublication` gouverne ailleurs. Et `personCount: 6`,
  //                 qui dirait combien de nœuds nominatifs ont été retirés.
  //   sourceOfTruth « INTERLIGENS prod DB (5 profiles, 29 evidences, 47
  //                 wallets…) » — métadonnée d'ingénierie, classe C1.
  //
  // `timeline` et `metrics` sont OPTIONNELS dans le type : on les retire.
  // `sourceOfTruth` est REQUIS : le retirer casserait le contrat de forme, donc
  // il est remplacé à l'identique — même règle que l'Explorer, et pour la même
  // raison : la forme de la surface décide de la forme du refus.
  const { timeline: _timeline, metrics: _metrics, ...racine } = graphe;
  void _timeline;
  void _metrics;

  return {
    graphe: {
      ...racine,
      sourceOfTruth: SOURCE_NON_GOUVERNEE,
      nodes: noeuds,
      edges: aretes,
    },
    retraits,
  };
}
