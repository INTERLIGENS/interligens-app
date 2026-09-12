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
