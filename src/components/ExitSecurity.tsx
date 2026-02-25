'use client';
import React from "react";

type Lang = "en" | "fr";
type Tier = "green" | "orange" | "red";

function normTier(t: any): Tier {
  const s = String(t ?? "").toLowerCase();
  if (s.includes("green")) return "green";
  if (s.includes("orange")) return "orange";
  return "red";
}

function levelToBadge(t: Tier) {
  if (t === "green") return "LOW";
  if (t === "orange") return "HIGH";
  return "CRIT";
}

function LockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" className="ico">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        d="M7 11V8a5 5 0 0 1 10 0v3M6 11h12v10H6V11Z"
      />
    </svg>
  );
}

export default function ExitSecurity({
  lang = "en",
  tier,
  weather,
  show,
}: {
  lang?: Lang;
  tier: any;
  weather?: any | null;
  show: boolean;
}) {
  if (!show) return null;

  let t = normTier(tier);

  // V1 bonus (no external API): if trust is red, escalate one level
  const trust = weather?.trust?.level;
  if (trust === "red" && t === "green") t = "orange";
  if (trust === "red" && t === "orange") t = "red";

  const label =
    lang === "fr"
      ? t === "green"
        ? "Liquidité : protégée"
        : t === "orange"
          ? "Liquidité : exposée"
          : "Liquidité : critique"
      : t === "green"
        ? "Liquidity: protected"
        : t === "orange"
          ? "Liquidity: exposed"
          : "Liquidity: critical";

  return (
    <section className="mini">
      <div className="miniTitle">Exit security</div>

      <div className={`miniRow ${t}`}>
        <div className="left">
          <LockIcon />
          <span className="text">{label}</span>
        </div>
        <span className={`badge ${levelToBadge(t).toLowerCase()}`}>{levelToBadge(t)}</span>
      </div>

      <style jsx>{`
        .mini{margin-top:12px}
        .miniTitle{
          font-size:12px;font-weight:900;letter-spacing:.18em;
          text-transform:uppercase;opacity:.85;margin-bottom:8px
        }
        .miniRow{
          display:flex;justify-content:space-between;align-items:center;gap:12px;
          padding:10px 12px;border-radius:14px;
          border:1px solid rgba(255,255,255,.12);
          background:rgba(255,255,255,.06);
        }
        .left{display:flex;align-items:center;gap:10px}
        .ico{opacity:.9}
        .text{font-size:12.5px;font-weight:750;opacity:.95}
        .badge{
          font-size:11px;font-weight:900;letter-spacing:.14em;
          padding:6px 10px;border-radius:999px;
          border:1px solid rgba(255,255,255,.12);
          background:rgba(0,0,0,.25);
          opacity:.9
        }
        .badge.low{border-color:rgba(0,255,120,.35);color:rgba(0,255,120,.95);background:rgba(0,255,120,.06)}
        .badge.high{border-color:rgba(255,170,0,.45);color:rgba(255,170,0,.95);background:rgba(255,170,0,.08)}
        .badge.crit{border-color:rgba(255,70,70,.55);color:rgba(255,70,70,.95);background:rgba(255,70,70,.08)}
        .miniRow.green{border-color:rgba(0,255,120,.22)}
        .miniRow.orange{border-color:rgba(255,170,0,.28)}
        .miniRow.red{border-color:rgba(255,70,70,.28)}
      `}</style>
    </section>
  );
}
