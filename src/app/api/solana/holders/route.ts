import { NextResponse } from "next/server";
import { fetchTop10HolderPct } from "@/lib/token/holderConcentration";

interface HoldersEntry { top10_pct: number | null; top1_pct: number | null; top3_pct: number | null; excluded_count: number; fetched_at: string; ts: number }
const cache = new Map<string, HoldersEntry>();
const TTL = 5 * 60_000;
/** Un echec de fournisseur n'est cache que 60 s : voir le commentaire du GET. */
const FAILURE_TTL = 60_000;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mint = searchParams.get("mint")?.trim() ?? "";
  if (!mint) return NextResponse.json({ ok: false, reason: "missing mint" });

  const hit = cache.get(mint);
  if (hit && Date.now() - hit.ts < TTL)
    return NextResponse.json({ ok: true, chain: "SOL", mint, top10_pct: hit.top10_pct, top1_pct: hit.top1_pct, top3_pct: hit.top3_pct, excluded_count: hit.excluded_count, holders_source: "cache", fetched_at: hit.fetched_at, cache_hit: true });

  const holders = await fetchTop10HolderPct(mint);
  const fetched_at = new Date().toISOString();

  // La source historique (public-api.solscan.io) est MORTE — HTTP 404 verifie
  // le 2026-08-16. Elle est remplacee par le RPC Solana (Helius puis public),
  // via src/lib/token/holderConcentration.ts.
  //
  // Second defaut corrige ici : cette route rendait `ok: true` sur une panne
  // TOTALE, avec `holders_source: "unavailable"`. Un consommateur testant
  // `if (res.ok)` en concluait que tout allait bien. Un drapeau de succes qui
  // ment est pire qu'une absence de drapeau.
  if (!holders.available) {
    // L'echec est mis en cache, mais BRIEVEMENT : re-tenter a chaque requete
    // pendant une panne de fournisseur ferait de cette route un amplificateur.
    // 60 s et non 5 min : une panne transitoire ne doit pas geler la mesure.
    cache.set(mint, {
      top10_pct: null, top1_pct: null, top3_pct: null,
      excluded_count: 0, fetched_at, ts: Date.now() - (TTL - FAILURE_TTL),
    });
    return NextResponse.json({
      ok: false,
      chain: "SOL",
      mint,
      top10_pct: null,
      holders_source: "unavailable",
      reason: holders.reason,
      fetched_at,
      cache_hit: false,
    });
  }

  cache.set(mint, {
    top10_pct: holders.top10Pct, top1_pct: holders.top1Pct, top3_pct: holders.top3Pct,
    excluded_count: 0, fetched_at, ts: Date.now(),
  });
  return NextResponse.json({
    ok: true,
    chain: "SOL",
    mint,
    top10_pct: holders.top10Pct,
    top1_pct: holders.top1Pct,
    top3_pct: holders.top3Pct,
    excluded_count: 0,
    holders_source: holders.source,
    holders_counted: holders.holdersCounted,
    fetched_at,
    cache_hit: false,
  });
}
