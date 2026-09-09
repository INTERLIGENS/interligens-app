// ─────────────────────────────────────────────────────────────────────────────
// Case Intelligence — OFAC SDN Ingestor
// Fetches SDN XML, extracts digital currency addresses from <sdnEntry> nodes.
// ─────────────────────────────────────────────────────────────────────────────

import { XMLParser } from "fast-xml-parser";
import { normalizeAddress } from "../normalize";
import type { SourceRaw } from "./types";

const SDN_URL = "https://www.treasury.gov/ofac/downloads/sdn.xml";

// ─── AT — CE QUE L'OFAC DIT, ET CE QU'IL NE DIT PAS ───────────────────────
//
// ██  Un JETON n'est pas une CHAÎNE.                                       ██
//
// L'OFAC publie `<idType>Digital Currency Address - USDT</idType>` et RIEN
// d'autre : ni champ de chaîne, ni remarque. Vérifié sur la source le
// 2026-09-09 (sdn.xml, 28 Mo).
//
// La table d'origine posait `USDT: "ethereum"` et `USDC: "ethereum"`. Or USDT
// vit sur Ethereum, sur TRON (TRC-20) et sur Bitcoin (Omni). Déduire la chaîne
// du jeton, c'est deviner — et la mesure du 2026-09-09 dit ce que ça coûte :
// 86 entités étiquetées `ethereum` dont 79 sont de forme TRON et 7 de forme
// Bitcoin, toutes portant `currencyType: USDT`.
//
// Ne restent ici QUE les codes qui DÉSIGNENT une chaîne. `ERC20` en fait
// partie : par définition, un jeton ERC-20 vit sur Ethereum. `USDT` et `USDC`
// n'en font pas partie, et leur absence est le correctif.
const CURRENCY_TO_CHAIN: Record<string, string> = {
  ETH: "ethereum",
  ERC20: "ethereum",
  BTC: "bitcoin",
  XBT: "bitcoin",
  SOL: "solana",
  XMR: "monero",
  LTC: "litecoin",
  ZEC: "zcash",
  TRX: "tron",
  BSC: "bsc",
  ARB: "arbitrum",
  DASH: "dash",
};

/**
 * La chaîne, DÉRIVÉE d'un code qui la désigne — ou `undefined`.
 *
 * `undefined` se propage en `chain = NULL` (`ingest.ts:565`, `r.chain ?? null`)
 * : c'est une absence TYPÉE, pas une valeur par défaut. Une entité dont la
 * chaîne n'est pas dite par la source reste sans chaîne, et se voit.
 *
 * On NE DÉDUIT PAS la chaîne de la forme de l'adresse. Une adresse TRON
 * commence par T et une Bitcoin par 1/3/bc1, mais la forme n'est pas une
 * autorité — c'est le raisonnement qui a fabriqué `inferredChain` faux dans
 * token-resolution/v3, et que `evmAmbiguous` refuse explicitement.
 */
function mapChain(currencyType: string | null): string | undefined {
  if (currencyType === null) return undefined;
  return CURRENCY_TO_CHAIN[currencyType.toUpperCase()];
}

/**
 * Le code de devise annoncé par l'OFAC, ou `null` s'il n'en annonce aucun.
 *
 * Le défaut d'origine rendait le littéral `"ETH"` quand la regex ne matchait
 * pas : un `idType` inattendu devenait silencieusement de l'Ethereum. Une
 * valeur par défaut n'est pas une lecture de la source.
 */
function extractCurrencyType(idType: string): string | null {
  // Format: "Digital Currency Address - USDT"
  const match = idType.match(/Digital Currency Address\s*-\s*(\w+)/i);
  return match ? match[1].toUpperCase() : null;
}

export async function fetchOfac(): Promise<SourceRaw[]> {
  const res = await fetch(SDN_URL);
  if (!res.ok) throw new Error(`OFAC fetch failed: ${res.status}`);
  const xml = await res.text();

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
  });
  const doc = parser.parse(xml);

  const entries = doc?.sdnList?.sdnEntry;
  if (!entries) return [];

  const list = Array.isArray(entries) ? entries : [entries];
  const results: SourceRaw[] = [];

  for (const entry of list) {
    const ids = entry.idList?.id;
    if (!ids) continue;

    const idArr = Array.isArray(ids) ? ids : [ids];
    for (const id of idArr) {
      const idType = typeof id.idType === "string" ? id.idType : "";
      if (!idType.toLowerCase().includes("digital currency address")) continue;

      const address = id.idNumber;
      if (!address || typeof address !== "string") continue;

      const currencyType = extractCurrencyType(idType);

      results.push({
        sourceSlug: "ofac",
        sourceTier: 1,
        entityType: "ADDRESS",
        value: normalizeAddress(address),
        chain: mapChain(currencyType),
        riskClass: "SANCTION",
        matchBasis: "EXACT_ADDRESS",
        jurisdiction: "US",
        listType: "SDN",
        externalUrl: "https://sanctionssearch.ofac.treas.gov/",
        meta: { currencyType },
      });
    }
  }

  return results;
}
