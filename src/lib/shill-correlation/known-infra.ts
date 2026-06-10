// src/lib/shill-correlation/known-infra.ts
// PHASE 4.6 — bot/MEV infrastructure addresses used as a DISCRIMINATING signal
// for the bot_infra exclusion. A wallet whose recent transactions interact with
// these is structurally automated.
//
// DELIBERATELY CONSERVATIVE: we only include addresses that separate bots from
// humans. The pump.fun fee account (CebN5WGQ4jvEPvsVU4EoHEpgzq1VV7AbicfhtW4xC9iM)
// is INTENTIONALLY EXCLUDED — every pump.fun buyer, including the real
// shill-followers we are hunting, pays it, so it would over-exclude true
// positives. Jito tip programs are paid almost exclusively by MEV/bundle/sniper
// bots, so they discriminate well.

export interface KnownInfra {
  address: string;
  label: string;
  sourceUrl: string;
}

export const KNOWN_INFRA: KnownInfra[] = [
  {
    address: "GJHtFqM9agxPmkeKjHny6qiRKrXZALvvFGiKf11QE7hy",
    label: "Jito Tip Payment Program (MEV bundle tips)",
    sourceUrl: "https://jito-foundation.gitbook.io/mev/mev-payment-and-distribution/on-chain-addresses",
  },
  {
    address: "DzvGET57TAgEDxvm3ERUM4GNcsAJdqjDLCne9sdfY4wf",
    label: "Jito Tip Distribution Program",
    sourceUrl: "https://jito-foundation.gitbook.io/mev/mev-payment-and-distribution/on-chain-addresses",
  },
];

export const KNOWN_INFRA_SET: ReadonlySet<string> = new Set(
  KNOWN_INFRA.map((i) => i.address),
);

export function infraLabel(address: string): string | undefined {
  return KNOWN_INFRA.find((i) => i.address === address)?.label;
}
