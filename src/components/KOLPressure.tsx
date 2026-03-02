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

function SpeakerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" className="ico">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        d="M4 10v4h3l5 4V6L7 10H4Z"
      />
      <path fill="none" stroke="currentColor" strokeWidth="2" d="M16 9a4 4 0 0 1 0 6" />
      <path fill="none" stroke="currentColor" strokeWidth="2" d="M18 7a7 7 0 0 1 0 10" />
    </svg>
  );
}

export default function KOLPressure({
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

  // V1 bonus: if manipulation OR alerts is red, escalate one level
  const manip = weather?.manipulation?.level;
  const alerts = weather?.alerts?.level;
  if ((manip === "red" || alerts === "red") && t === "green") t = "orange";
  if ((manip === "red" || alerts === "red") && t === "orange") t = "red";

  const label =
    lang === "fr"
      ? t === "green"
        ? "Signaux KOL : sains"
        : t === "orange"
          ? "Signaux KOL : promo agressive"
          : "Signaux KOL : shill coordonné"
      : t === "green"
        ? "KOL signals: clean"
        : t === "orange"
          ? "KOL signals: aggressive promotion"
          : "KOL signals: coordinated shill";

  return (
    <section className="mini">
      <div className="miniTitle">{lang === 'fr' ? 'PRESSION KOL' : 'KOL PRESSURE'}</div>

      <div className={`miniRow ${t}`}>
        <div className="left">
          <SpeakerIcon />
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
        .left{display:flex;align-items:center;gap:10px;min-width:0}
        .ico{opacity:.9;flex:0 0 auto}
        .text{font-size:12.5px;font-weight:750;opacity:.95;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .badge{
          font-size:11px;font-weight:900;letter-spacing:.14em;
          padding:6px 10px;border-radius:999px;
          border:1px solid rgba(255,255,255,.12);
          background:rgba(0,0,0,.25);
          opacity:.9;flex:0 0 auto
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
