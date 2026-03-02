'use client';
import React from "react";
import { getActionCopy } from "@/lib/copy/actions";

type Tier = "green" | "orange" | "red";
type Lang = "en" | "fr";

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
  scanType = "token",
}: {
  lang?: Lang;
  tier: any;
  show: boolean;
  scanType?: "token" | "wallet";
}) {
  if (!show) return null;

  const t = normalizeTier(tier);
  const tierMap: Record<Tier, "GREEN" | "ORANGE" | "RED"> = { green: "GREEN", orange: "ORANGE", red: "RED" };
  const copy = getActionCopy({ scan_type: scanType, tier: tierMap[t], chain: "SOL" });
  const lines = lang === "fr" ? copy.fr : copy.en;
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
        .wtdn{margin-top:14px;padding:16px;border-radius:18px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.05)}
        .wtdnTitle{font-size:12px;font-weight:900;letter-spacing:.18em;text-transform:uppercase;opacity:.95;margin-bottom:10px}
        .wtdnList{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px}
        .wtdnItem{display:flex;align-items:flex-start;gap:10px;line-height:1.25;opacity:.92}
        .wtdnDot{width:8px;height:8px;border-radius:999px;margin-top:5px;border:1px solid rgba(255,255,255,.18);background:rgba(248,91,5,.85);flex:0 0 auto}
        .wtdnText{font-size:12.5px}
      `}</style>
    </section>
  );
}
