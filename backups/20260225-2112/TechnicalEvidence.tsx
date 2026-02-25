'use client';
import React from "react";

type Lang = "en" | "fr";
type Chain = "ethereum" | "solana";

type Item = {
  label: string;
  value_example: string;
  why_it_matters_en: string;
  why_it_matters_fr: string;
};

const DATA: Record<Chain, Item[]> = {
  ethereum: [
    {
      label: "Unlimited Approvals",
      value_example: "0xfff...ffff",
      why_it_matters_en: "Grants full access to your tokens; a malicious contract can drain your wallet anytime.",
      why_it_matters_fr: "Donne un accès total à vos jetons ; un contrat malveillant peut vider votre wallet à tout moment."
    },
    {
      label: "Counterparty Reputation",
      value_example: "Unknown / New (Age: 2h)",
      why_it_matters_en: "Interaction with fresh addresses often indicates sybil attacks or temporary rug-pull setups.",
      why_it_matters_fr: "L'interaction avec des adresses récentes indique souvent des attaques Sybil ou des rug-pulls."
    },
    {
      label: "Hidden DelegateCall",
      value_example: "Detected in Proxy",
      why_it_matters_en: "Allows the contract to execute external logic, potentially bypassing all safety guards.",
      why_it_matters_fr: "Permet au contrat d'exécuter une logique externe, contournant potentiellement les sécurités."
    },
    {
      label: "Liquidity Lock Status",
      value_example: "Unlocked (0%)",
      why_it_matters_en: "Devs can withdraw all funds instantly, leaving holders with worthless tokens.",
      why_it_matters_fr: "Les dév peuvent retirer les fonds instantanément, rendant les jetons sans valeur."
    }
  ],
  solana: [
    {
      label: "Freeze Authority",
      value_example: "Enabled (Active)",
      why_it_matters_en: "The mint authority can freeze your tokens, preventing any sell or transfer operations.",
      why_it_matters_fr: "L'autorité de mint peut geler vos jetons, empêchant toute vente ou transfert."
    },
    {
      label: "Mutable Metadata",
      value_example: "True",
      why_it_matters_en: "The project can change the token's name/image to impersonate others or hide its identity.",
      why_it_matters_fr: "Le projet peut changer le nom/image du jeton pour usurper une identité ou se cacher."
    },
    {
      label: "Unknown Programs",
      value_example: "3 IDs (Unverified)",
      why_it_matters_en: "The transaction interacts with unofficial programs that haven't been audited or open-sourced.",
      why_it_matters_fr: "La transaction interagit avec des programmes non officiels, sans audit ni code ouvert."
    },
    {
      label: "Mint Account Ownership",
      value_example: "Non-Renounced",
      why_it_matters_en: "The owner can mint infinite tokens at will, crashing the price instantly.",
      why_it_matters_fr: "Le propriétaire peut créer des jetons à l'infini, faisant chuter le prix instantanément."
    }
  ]
};

export default function TechnicalEvidence({
  lang = "en",
  chain = "solana",
  show = true,
}: {
  lang?: Lang;
  chain?: Chain;
  show?: boolean;
}) {
  if (!show) return null;

  const isFR = lang === "fr";
  const title = isFR ? "Preuves techniques" : "Technical Evidence";
  const subtitle = isFR
    ? "Signaux concrets + pourquoi ça compte."
    : "Concrete signals + why they matter.";

  

  const badge = chain === "ethereum" ? "ETH" : "SOL";const items = DATA[chain] ?? DATA.solana;

  return (
    <section className="tev">
      <div className="tevHead">
        <div className="tevTitle">{title}</div>
        <div className="tevSub">{subtitle}</div>
        <div className="tevBadge">{badge}</div>
      </div>

      <div className="tevGrid">
        {items.map((it, idx) => (
          <div key={idx} className="tevCard">
            <div className="tevTop">
              <div className="tevLabel">{it.label}</div>
              <div className="tevVal">{it.value_example}</div>
            </div>
            <div className="tevWhy">{isFR ? it.why_it_matters_fr : it.why_it_matters_en}</div>
          </div>
        ))}
      </div>

      <style jsx>{`
        .tev{margin-top:12px}
        .tevHead{margin-bottom:10px;display:flex;justify-content:space-between;gap:12px;align-items:flex-start}
.tevBadge{padding:6px 10px;border-radius:999px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);font-size:12px;font-weight:850;letter-spacing:.12em;opacity:.9}
        .tevTitle{font-size:12px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;opacity:.9}
        .tevSub{font-size:12px;opacity:.7;margin-top:4px}
        .tevGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
        @media (max-width:860px){.tevGrid{grid-template-columns:1fr}}
        .tevCard{padding:12px;border-radius:14px;border:1px solid rgba(255,255,255,.10);background:rgba(0,0,0,.18)}
        .tevTop{display:flex;justify-content:space-between;gap:10px;align-items:baseline;flex-wrap:wrap}
        .tevLabel{font-size:13px;font-weight:750}
        .tevVal{font-size:12px;opacity:.75;font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace}
        .tevWhy{margin-top:8px;font-size:12.5px;opacity:.88;line-height:1.3}
      `}</style>
    </section>
  );
}
