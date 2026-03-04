import React from "react";
import { computeExitDoor, type MarketInput } from "@/lib/risk/exitDoor";
import { computeWhaleLevel } from "@/lib/risk/whales";
import { computeCabalScore } from "@/lib/risk/cabal";

type Tier = "green" | "orange" | "red" | undefined;
type Weather = any;

function pillClasses(level: "low" | "med" | "high" | "open" | "tight" | "blocked") {
  if (level === "low" || level === "open")    return "border-emerald-500/60 bg-emerald-500/10 text-emerald-300";
  if (level === "med"  || level === "tight")  return "border-orange-500/60 bg-orange-500/10 text-orange-300";
  return "border-red-500/60 bg-red-500/10 text-red-300";
}

function Chip({ text, level }: { text: string; level: string }) {
  return (
    <span className={["shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest", pillClasses(level as any)].join(" ")}>
      {text}
    </span>
  );
}

export default function MiniSignalRow({
  lang, tier, weather, show, rawSummary,
}: {
  lang: "en" | "fr";
  tier: Tier;
  weather: Weather;
  show: boolean;
  rawSummary?: any;
}) {
  if (!show) return null;

  // ── Exit Door ──
  const market: MarketInput = rawSummary?.markets ?? rawSummary?.market ?? {
    data_unavailable: true,
  };
  const exit = computeExitDoor(market);

  // ── Whale Weight ──
  const top10_pct = rawSummary?.top10_pct ?? rawSummary?.holder_top10_pct ?? null;
  const whale = computeWhaleLevel({ top10_pct });

  // ── Cabal Score ──
  const cabal = computeCabalScore({
    off_chain: rawSummary?.off_chain,
    tiger_drivers: rawSummary?.tiger_drivers ?? [],
    market: { volume_24h_usd: market.volume_24h_usd ?? rawSummary?.volume_24h_usd, liquidity_usd: market.liquidity_usd ?? rawSummary?.liquidity_usd },
  });

  const exitLevel   = exit.level === "OPEN" ? "open" : exit.level === "TIGHT" ? "tight" : "blocked";
  const whaleLevel  = whale.level === "LOW" ? "low" : whale.level === "MED" ? "med" : "high";
  const cabalLevel  = cabal.tier === "LOW" ? "low" : cabal.tier === "MED" ? "med" : "high";

  const exitBadge   = lang === "fr" ? exit.label_fr  : exit.label_en;
  const whaleBadge  = lang === "fr" ? whale.label_fr : whale.label_en;
  const cabalBadge  = lang === "fr" ? cabal.label_fr : cabal.label_en;
  const exitWhy     = lang === "fr" ? exit.why_fr    : exit.why_en;
  const whaleWhy    = lang === "fr" ? whale.why_fr   : whale.why_en;
  const cabalWhy    = lang === "fr" ? cabal.why_fr   : cabal.why_en;

  const cardCls  = "min-w-0 rounded-2xl border border-zinc-800 bg-black/30 px-3 py-2";
  const titleCls = "text-[10px] font-extrabold uppercase tracking-[0.25em] text-slate-300";
  const rowCls   = "mt-1 flex items-center justify-between gap-2";
  const textCls  = "min-w-0 truncate text-xs font-semibold text-zinc-400";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {/* EXIT DOOR */}
      <div className={cardCls}>
        <div className={titleCls}>{lang === "fr" ? "SORTIE" : "EXIT DOOR"}</div>
        <div className={rowCls}>
          <span className={textCls}>{exitWhy}</span>
          <Chip text={exitBadge} level={exitLevel} />
        </div>
      </div>

      {/* WHALE WEIGHT */}
      <div className={cardCls}>
        <div className={titleCls}>{lang === "fr" ? "BALEINES" : "WHALES"}</div>
        <div className={rowCls}>
          <span className={textCls}>{whale.top10_pct != null ? `Top10: ${whale.top10_pct}%` : `Top10: — ${whaleWhy}`}</span>
          <Chip text={whaleBadge} level={whaleLevel} />
        </div>
      </div>

      {/* CABAL SCORE */}
      <div className={cardCls}>
        <div className={titleCls}>{lang === "fr" ? "SCORE CABAL" : "CABAL SCORE"}</div>
        <div className={rowCls}>
          <span className={textCls}>{cabalWhy}</span>
          <Chip text={`${cabalBadge} ${cabal.score}`} level={cabalLevel} />
        </div>
      </div>
    </div>
  );
}
