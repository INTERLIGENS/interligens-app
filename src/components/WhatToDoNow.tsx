'use client';
import React from "react";

type Tier = "green" | "orange" | "red";
type Lang = "en" | "fr";

const CONTENT: Record<Tier, Record<Lang, string[]>> = {
  green: {
    en: [
      "Verify URL/contract before signing.",
      "Start with a small test amount, then scale up.",
      "Add to watchlist: monitor liquidity + control changes."
    ],
    fr: [
      "Valide l’URL / contrat avant de signer.",
      "Teste une petite somme, puis augmente progressivement.",
      "Mets en watchlist : surveille liquidité + changements de contrôle."
    ]
  },
  orange: {
    en: [
      "Use a burner wallet. Never your main wallet.",
      "Revoke approvals before interacting.",
      "Keep exposure minimal. No big amount."
    ],
    fr: [
      "Burner wallet obligatoire. Jamais ton wallet principal.",
      "Révoque les approvals avant toute interaction.",
      "Exposition minimale : aucun gros montant."
    ]
  },
  red: {
    en: [
      "STOP: do not interact (swap / sign / approve).",
      "Revoke everything + move funds to a clean wallet if needed.",
      "Report it and share the report to protect others."
    ],
    fr: [
      "STOP : aucune interaction (swap / signature / approval).",
      "Révoque tout + migre vers un wallet propre si besoin.",
      "Signale et partage le rapport (protéger les autres)."
    ]
  }
};

function normalizeTier(input: any): Tier {
  const s = String(input ?? "").toLowerCase();
  if (s.includes("green")) return "green";
  if (s.includes("orange")) return "orange";
  return "red";
}

export default function WhatToDoNow({
  lang = "en",
  tier,
  show,
}: {
  lang?: Lang;
  tier: any;
  show: boolean;
}) {
  if (!show) return null;

  const t = normalizeTier(tier);
  const lines = CONTENT[t][lang] ?? CONTENT[t].en;

  const title = lang === "fr" ? "À faire maintenant" : "What to do now";

  return (
    <section className="wtdn">
      <div className="wtdnTitle">{title}</div>

      <ul className="wtdnList">
        {lines.slice(0, 3).map((x, i) => (
          <li key={i} className="wtdnItem">
            <span className="wtdnDot" />
            <span className="wtdnText">{x}</span>
          </li>
        ))}
      </ul>

      <style jsx>{`
        .wtdn{
          margin-top:14px;
          padding:16px;
          border-radius:18px;
          border:1px solid rgba(255,255,255,.12);
          background:rgba(255,255,255,.05);
        }
        .wtdnTitle{
          font-size:12px;
          font-weight:900;
          letter-spacing:.18em;
          text-transform:uppercase;
          opacity:.95;
          margin-bottom:10px;
        }
        .wtdnList{
          list-style:none;
          margin:0;
          padding:0;
          display:flex;
          flex-direction:column;
          gap:10px;
        }
        .wtdnItem{
          display:flex;
          align-items:flex-start;
          gap:10px;
          line-height:1.25;
          opacity:.92;
        }
        .wtdnDot{
          width:8px;
          height:8px;
          border-radius:999px;
          margin-top:5px;
          border:1px solid rgba(255,255,255,.18);
          background:rgba(248,91,5,.85);
          flex:0 0 auto;
        }
        .wtdnText{
          font-size:12.5px;
        }
      `}</style>
    </section>
  );
}
