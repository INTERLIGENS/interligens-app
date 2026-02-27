import React from "react";

type Tier = "green" | "orange" | "red" | undefined;
type Level = "low" | "high";
type Weather = any;

function levelFromTier(tier: Tier): Level {
  if (tier === "red" || tier === "orange") return "high";
  return "low";
}

function pillClasses(level: Level) {
  return level === "high"
    ? "border-orange-500/60 bg-orange-500/10 text-orange-300"
    : "border-emerald-500/60 bg-emerald-500/10 text-emerald-300";
}

function Chip({ text, level }: { text: string; level: Level }) {
  return (
    <span
      className={[
        "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest",
        pillClasses(level),
      ].join(" ")}
    >
      {text}
    </span>
  );
}

export default function MiniSignalRow({
  lang,
  tier,
  weather,
  show,
}: {
  lang: "en" | "fr";
  tier: Tier;
  weather: Weather;
  show: boolean;
}) {
  if (!show) return null;

  const level: Level = levelFromTier(tier);
  const kolLevel = level;
  const exitLevel = level;
  const whaleLevel = level;

  const t = {
    kolTitle:  lang === "fr" ? "PRESSION KOL"    : "KOL PRESSURE",
    exitTitle: lang === "fr" ? "SÉCURITÉ SORTIE" : "EXIT SECURITY",
    whaleTitle:lang === "fr" ? "ALERTE BALEINES" : "WHALE ALERT",
    kolValue:  "Call pressure",
    exitValue: lang === "fr" ? "Liquidité" : "Liquidity",
    whaleValue:"Whale risk",
    low:       "LOW",
    high:      "HIGH",
    protected: lang === "fr" ? "protégée" : "protected",
    exposed:   lang === "fr" ? "exposée"  : "exposed",
  };

  const exitState = exitLevel === "high" ? t.exposed : t.protected;

  const cardCls  = "min-w-0 rounded-2xl border border-zinc-800 bg-black/30 px-3 py-2";
  const titleCls = "text-[10px] font-extrabold uppercase tracking-[0.25em] text-slate-300";
  const rowCls   = "mt-1 flex items-center justify-between gap-2";
  const textCls  = "min-w-0 truncate text-xs font-semibold text-slate-100";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div className={cardCls}>
        <div className={titleCls}>{t.kolTitle}</div>
        <div className={rowCls}>
          <span className={textCls}>{t.kolValue}</span>
          <Chip text={kolLevel === "high" ? t.high : t.low} level={kolLevel} />
        </div>
      </div>
      <div className={cardCls}>
        <div className={titleCls}>{t.exitTitle}</div>
        <div className={rowCls}>
          <span className={textCls}>{t.exitValue}: {exitState}</span>
          <Chip text={exitLevel === "high" ? t.high : t.low} level={exitLevel} />
        </div>
      </div>
      <div className={cardCls}>
        <div className={titleCls}>{t.whaleTitle}</div>
        <div className={rowCls}>
          <span className={textCls}>{t.whaleValue}</span>
          <Chip text={whaleLevel === "high" ? t.high : t.low} level={whaleLevel} />
        </div>
      </div>
    </div>
  );
}
