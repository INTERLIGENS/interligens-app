'use client';
import React from "react";

type Tier = "green" | "orange" | "red";
type Lang = "en" | "fr";

const CONTENT: Record<Tier, Record<Lang, string[]>> = {
  green: {
    en: [
      "Proceed with caution. Always double-check the final transaction details before signing.",
      "Monitor real-time alerts. Stay updated on any sudden liquidity or ownership changes.",
      "Share the report. Help the community by spreading verified safe project data."
    ],
    fr: [
      "Procédez prudemment. Vérifiez toujours les détails finaux avant de signer la transaction.",
      "Surveillez les alertes. Restez informé des changements soudains de liquidité ou d'ownership.",
      "Partagez le rapport. Aidez la communauté en diffusant des données de projets vérifiés."
    ]
  },
  orange: {
    en: [
      "Use a burner wallet. Never connect your main bags to unverified contracts.",
      "Revoke active approvals. Clean up permissions to prevent delayed draining attacks.",
      "Limit your exposure. Only invest what you can afford to lose here."
    ],
    fr: [
      "Utilisez un burner wallet. Ne connectez jamais vos fonds principaux aux contrats suspects.",
      "Révoquez les approvals. Nettoyez les permissions pour éviter tout siphonnage différé.",
      "Limitez votre exposition. N'investissez que ce que vous êtes prêt à perdre ici."
    ]
  },
  red: {
    en: [
      "Do not interact. This contract shows critical vulnerabilities or malicious patterns.",
      "Revoke all permissions. Use a revoke tool immediately to secure your assets.",
      "Report the scam. Signal this threat to protect other users from loss."
    ],
    fr: [
      "N'interagissez pas. Ce contrat présente des vulnérabilités critiques ou des schémas malveillants.",
      "Révoquez les permissions. Utilisez immédiatement un outil de révocation pour sécuriser vos actifs.",
      "Signalez l'arnaque. Alertez la communauté pour protéger les autres utilisateurs du vol."
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
            <span className="wtdnDot">{i + 1}</span>
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
          font-size:14px;
          font-weight:850;
          letter-spacing:.2px;
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
          width:22px;
          height:22px;
          border-radius:999px;
          display:inline-flex;
          align-items:center;
          justify-content:center;
          font-size:12px;
          font-weight:800;
          border:1px solid rgba(255,255,255,.14);
          background:rgba(255,255,255,.06);
          flex:0 0 auto;
        }
        .wtdnText{
          font-size:12.5px;
        }
      `}</style>
    </section>
  );
}
