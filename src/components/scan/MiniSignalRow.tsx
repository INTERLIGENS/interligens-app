import React from "react";
import { computeExitDoor, type MarketInput } from "@/lib/risk/exitDoor";
import { computeWhaleLevel } from "@/lib/risk/whales";
import { computeCabalScore } from "@/lib/risk/cabal";

type Tier = "green" | "orange" | "red" | undefined;
type Weather = any;

function chip(level: "low"|"med"|"high"|"open"|"tight"|"blocked") {
  if (level === "low"  || level === "open")   return "border-emerald-500/60 bg-emerald-500/10 text-emerald-300";
  if (level === "med"  || level === "tight")  return "border-orange-500/60 bg-orange-500/10 text-orange-300";
  return "border-red-500/60 bg-red-500/10 text-red-300";
}

function Chip({ text, level }: { text: string; level: string }) {
  return (
    <span className={[
      "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest",
      chip(level as any),
    ].join(" ")}>
      {text}
    </span>
  );
}

const cardCls  = "min-w-0 rounded-2xl border border-zinc-800 bg-black/30 px-3 py-2";
const titleCls = "text-[10px] font-extrabold uppercase tracking-[0.25em] text-slate-300 mb-1";
const rowCls   = "flex items-center justify-between gap-2";
const valCls   = "min-w-0 truncate text-xs font-semibold text-zinc-400 flex-1";

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

  // 1) KOL PRESSURE — from weather.manipulation or tier
  const manip = weather?.manipulation?.level ?? "";
  const kolLvl: "low"|"med"|"high" =
    manip === "red" ? "high" : manip === "orange" ? "med" :
    tier === "red"  ? "high" : tier === "orange"  ? "med" : "low";
  const kolBadge = kolLvl === "high" ? (lang === "fr" ? "ÉLEVÉ" : "HIGH")
    : kolLvl === "med"  ? (lang === "fr" ? "MOYEN" : "MED") : (lang === "fr" ? "FAIBLE" : "LOW");
  const kolVal = lang === "fr"
    ? `Influence : ${kolLvl === "high" ? "Élevée" : kolLvl === "med" ? "Moyenne" : "Faible"}`
    : `Influence: ${kolLvl === "high" ? "High" : kolLvl === "med" ? "Med" : "Low"}`;

  // 2) CAN I SELL? — computeExitDoor
  const market: MarketInput = rawSummary?.markets ?? rawSummary?.market ?? { data_unavailable: true };
  const exit = computeExitDoor(market);
  const exitLvl = exit.level === "OPEN" ? "open" : exit.level === "TIGHT" ? "tight" : "blocked";
  const exitBadge = lang === "fr" ? exit.label_fr : exit.label_en;
  const exitVal = lang === "fr"
    ? (exit.level === "OPEN" ? "Vendable" : exit.level === "TIGHT" ? "Sortie difficile" : "Pas de sortie")
    : (exit.level === "OPEN" ? "Sellable" : exit.level === "TIGHT" ? "Hard to sell" : "No exit");

  // 3) WHALES
  const top10 = rawSummary?.top10_pct ?? rawSummary?.holder_top10_pct ?? null;
  const whale = computeWhaleLevel({ top10_pct: top10 });
  const whaleLvl = whale.level === "LOW" ? "low" : whale.level === "MED" ? "med" : "high";
  const whaleBadge = lang === "fr" ? whale.label_fr : whale.label_en;
  const whaleVal = top10 != null ? `Top10: ${top10}%` : "Top10: —";

  // 4) CABAL SCORE
  const cabal = computeCabalScore({
    chain: rawSummary?.chain,
    address: rawSummary?.address,
    off_chain: rawSummary?.off_chain,
    tiger_drivers: rawSummary?.tiger_drivers ?? [],
    market: { volume_24h_usd: market.volume_24h_usd, liquidity_usd: market.liquidity_usd },
    spenders: rawSummary?.spenders,
    unlimitedCount: rawSummary?.unlimitedCount,
  });
  const cabalLvl = cabal.tier === "HIGH" ? "high" : cabal.tier === "MED" ? "med" : "low";
  const cabalVal = lang === "fr"
    ? `${cabal.tier === "HIGH" ? "Élevé" : cabal.tier === "MED" ? "Moyen" : "Faible"} ${cabal.score}`
    : `${cabal.tier} ${cabal.score}`;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div className={cardCls}>
        <div className={titleCls}>{lang === "fr" ? "PRESSION KOL" : "KOL PRESSURE"}</div>
        <div className={rowCls}>
          <span className={valCls}>{kolVal}</span>
          <Chip text={kolBadge} level={kolLvl} />
        </div>
      </div>
      <div className={cardCls}>
        <div className={titleCls}>{lang === "fr" ? "PUIS-JE VENDRE ?" : "CAN I SELL?"}</div>
        <div className={rowCls}>
          <span className={valCls}>{exitVal}</span>
          <Chip text={exitBadge} level={exitLvl} />
        </div>
      </div>
      <div className={cardCls}>
        <div className={titleCls}>{lang === "fr" ? "BALEINES" : "WHALES"}</div>
        <div className={rowCls}>
          <span className={valCls}>{whaleVal}</span>
          <Chip text={whaleBadge} level={whaleLvl} />
        </div>
      </div>
      <div className={cardCls}>
        <div className={titleCls}>{lang === "fr" ? "SCORE CABAL" : "CABAL SCORE"}</div>
        <div className={rowCls}>
          <span className={valCls}>{cabalVal}</span>
          <Chip text={lang === "fr" ? cabal.label_fr : cabal.label_en} level={cabalLvl} />
        </div>
      </div>
    </div>
  );
}
