// ─── BUILD 9 / ÉTAPE 7 — LE SCOREUR LEGACY DE LA ROUTE CASEFILE ────────────
//
// ██  DÉPLACÉ VERBATIM. Aucune règle n'est modifiée, aucun seuil déplacé.   ██
//
// ─── Pourquoi le sortir de la route ───────────────────────────────────────
//
// L'étape 7 bascule `/api/casefile` de sa `CASE_DB` en ligne vers l'autorité
// canonique. L'arbitrage exige que la sémantique de score ne bouge pas.
//
// Tant que ces deux fonctions vivaient DANS la route — un chemin gelé, sans
// export — cette exigence ne pouvait être qu'AFFIRMÉE. Ici, elle se teste :
// on donne au scoreur le jeu d'identifiants de la CASE_DB, puis celui de
// l'autorité canonique, et on compare les sorties.
//
// C'est tout le déplacement. Pas une ligne de règle n'a changé, et le fichier
// n'a pas vocation à évoluer : toute modification de ces seuils est une
// décision de scoring, qui se ratifie ailleurs.
//
// ─── Ce que ce score N'EST PAS ────────────────────────────────────────────
//
// Ce n'est PAS `computeTigerScore`. C'est un scoreur local, propre à cette
// route, qui rend RED / ORANGE / GREEN. Les six entrées de `computeTigerScore`
// restent en HOLD, intouchées, et leur bascule éventuelle est une décision
// séparée.

/** La forme minimale qu'un claim doit avoir pour être scoré : son identifiant. */
export interface ScorableClaim {
  id: string;
  status?: string;
}

export interface EvidenceLink {
  claim_id: string;
  on_chain_checks: Array<{ check: string; result: string }>;
  final_status: string;
}

export interface OnChainForScore {
  distribution?: { top10_pct?: string | null };
  markets?: { liquidity_usd?: number | null };
}

/**
 * Corrobore les claims par les mesures on-chain. Verbatim.
 *
 * Les règles sont indexées sur les IDENTIFIANTS de claim (`C1`, `C5`, `C7`) —
 * jamais sur leur contenu. C'est ce qui rend la bascule d'autorité neutre pour
 * le score : le jeu d'identifiants est le même des deux côtés.
 */
export function linkEvidence(
  claims: readonly ScorableClaim[],
  onChain: OnChainForScore | null,
): EvidenceLink[] {
  return claims.map((c) => {
    const checks: Array<{ check: string; result: string }> = [];
    let status = c.status ?? "Referenced";
    const top10 = parseFloat(onChain?.distribution?.top10_pct ?? "0");
    const liq = Number(onChain?.markets?.liquidity_usd ?? 0);

    if ((c.id === "C5" || c.id === "C7") && top10 > 40) {
      checks.push({ check: "top10_concentration", result: `Top-10: ${top10}%` });
      status = "Corroborated";
    }
    if (c.id === "C1" && liq > 0 && liq < 100000) {
      checks.push({ check: "low_liquidity", result: `Liquidity: $${liq.toLocaleString()}` });
      status = "Corroborated";
    }
    return { claim_id: c.id, on_chain_checks: checks, final_status: status };
  });
}

export interface LegacyScore {
  score: number;
  tier: "RED" | "ORANGE" | "GREEN";
}

/**
 * Le score de la route CaseFile. Verbatim, seuils inclus.
 *
 * Le journal d'erreur « claims=0 » de l'origine dépendait de `casefileLookupKey`
 * et du mint : il est remonté dans la route, qui est le seul endroit à
 * connaître le mint reçu. Le CALCUL, lui, n'en a jamais eu besoin.
 */
export function computeLegacyCaseScore(
  claims: readonly ScorableClaim[],
  linking: readonly EvidenceLink[],
  onChain: OnChainForScore | null,
): LegacyScore {
  let score = 0;
  const ids = new Set(claims.map((c) => c.id));

  if (["C2", "C3", "C4"].some((id) => ids.has(id))) score += 25;
  if (ids.has("C5")) score += 20;
  if (ids.has("C7")) score += 15;
  if (ids.has("C1")) score += 5;
  if (ids.has("C8")) score += 5;

  const corroborated = linking.filter((l) => l.final_status === "Corroborated").length;
  score += Math.min(corroborated * 5, 15);
  const top10 = parseFloat(onChain?.distribution?.top10_pct ?? "0");
  if (top10 > 40) score += 10;

  // Guardrail: >= 6 claims => RED
  if (claims.length >= 6 && score < 70) score = 70;

  score = Math.min(100, Math.max(0, score));
  const tier = score >= 70 ? "RED" : score >= 35 ? "ORANGE" : "GREEN";
  return { score, tier };
}
