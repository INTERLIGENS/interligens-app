/**
 * OFAC SDN ingest — parses the consolidated sanctions XML for
 * DigitalCurrencyAddress elements and upserts them into AddressLabel.
 *
 * Source: https://sanctionslistservice.ofac.treas.gov/api/download/sdn.xml
 *         (mirror of the Treasury SDN list; US Government work, public
 *         domain under 17 USC §105).
 *
 * Chain mapping (OFAC currency codes → our label chain string):
 *   XBT  → BTC          XRP  → XRP          XDC  → XDC
 *   ETH  → EVM          USDT → EVM          USDC → EVM
 *   BSC  → EVM          TRX  → TRON         LTC  → LTC
 *   XMR  → XMR          ZEC  → ZEC          DASH → DASH
 *   XVG  → XVG          BCH  → BCH          BSV  → BSV
 *   ARB  → EVM          ETC  → ETC          SOL  → SOL
 *
 * Everything unknown is stored as "OTHER".
 */

import { prisma } from "@/lib/prisma";

const SDN_URL =
  "https://sanctionslistservice.ofac.treas.gov/api/download/sdn.xml";

const CHAIN_MAP: Record<string, string> = {
  XBT: "BTC",
  BTC: "BTC",
  ETH: "EVM",
  USDT: "EVM",
  USDC: "EVM",
  BSC: "EVM",
  ARB: "EVM",
  MATIC: "EVM",
  SOL: "SOL",
  TRX: "TRON",
  LTC: "LTC",
  XMR: "XMR",
  ZEC: "ZEC",
  DASH: "DASH",
  XVG: "XVG",
  BCH: "BCH",
  BSV: "BSV",
  XRP: "XRP",
  ETC: "ETC",
  XDC: "XDC",
};

type ParsedEntry = {
  address: string;
  chain: string;
  entityName: string;
  sdnId: string;
};

function mapChain(code: string): string {
  return CHAIN_MAP[code.toUpperCase()] ?? "OTHER";
}

/**
 * Tiny purpose-built XML parser for SDN digital-currency rows. Avoids a
 * parser dependency (we only need 3 attributes per match).
 *
 * Matches:
 *   <sdnEntry><uid>N</uid> … <lastName>NAME</lastName> …
 *     <idList> … <id>
 *       <idType>Digital Currency Address - XBT</idType>
 *       <idNumber>bc1q…</idNumber>
 *     </id> … </idList>
 *   </sdnEntry>
 */
export function parseSdnXml(xml: string): ParsedEntry[] {
  const out: ParsedEntry[] = [];
  const entryRe = /<sdnEntry>([\s\S]*?)<\/sdnEntry>/g;
  let m: RegExpExecArray | null;
  while ((m = entryRe.exec(xml)) !== null) {
    const body = m[1];
    const uid = /<uid>(\d+)<\/uid>/.exec(body)?.[1] ?? "";
    const lastName = /<lastName>([^<]+)<\/lastName>/.exec(body)?.[1] ?? "";
    const firstName = /<firstName>([^<]+)<\/firstName>/.exec(body)?.[1] ?? "";
    const entityName = [firstName, lastName].filter(Boolean).join(" ").trim() || "SDN entity";

    const idList = /<idList>([\s\S]*?)<\/idList>/.exec(body)?.[1] ?? "";
    const idRe = /<id>([\s\S]*?)<\/id>/g;
    let im: RegExpExecArray | null;
    while ((im = idRe.exec(idList)) !== null) {
      const idBody = im[1];
      const idType = /<idType>([^<]+)<\/idType>/.exec(idBody)?.[1] ?? "";
      const idNumber = /<idNumber>([^<]+)<\/idNumber>/.exec(idBody)?.[1] ?? "";
      if (!idType || !idNumber) continue;
      const match = /^Digital Currency Address - (\w+)/i.exec(idType.trim());
      if (!match) continue;
      out.push({
        address: idNumber.trim(),
        chain: mapChain(match[1]),
        entityName,
        sdnId: uid,
      });
    }
  }
  return out;
}

export type OfacIngestResult = {
  fetched: number;
  upserted: number;
  errors: number;
  durationMs: number;
};

export async function ingestOfac(): Promise<OfacIngestResult> {
  const startedAt = Date.now();
  const res = await fetch(SDN_URL, {
    headers: {
      "user-agent": "interligens-intel-ingest/1 (+https://interligens.com)",
      accept: "application/xml",
    },
  });
  if (!res.ok) {
    throw new Error(`ofac_fetch_failed_${res.status}`);
  }
  const xml = await res.text();
  const entries = parseSdnXml(xml);

  let upserted = 0;
  let errors = 0;
  for (const e of entries) {
    try {
      const sourceUrl = `https://sanctionssearch.ofac.treas.gov/Details.aspx?id=${e.sdnId}`;
      // AddressLabel has a composite @@unique([chain, address, labelType, label, sourceUrl]) —
      // upsert on dedup_key keeps reruns idempotent.
      await prisma.addressLabel.upsert({
        where: {
          dedup_key: {
            chain: e.chain,
            address: e.address,
            labelType: "SANCTIONS",
            label: "OFAC SDN",
            sourceUrl,
          },
        },
        update: {
          entityName: e.entityName,
          isActive: true,
          lastSeenAt: new Date(),
        },
        create: {
          chain: e.chain,
          address: e.address,
          labelType: "SANCTIONS",
          label: "OFAC SDN",
          confidence: "high",
          entityName: e.entityName,
          sourceName: "OFAC SDN",
          sourceUrl,
          evidence: `Sanctioned entity UID ${e.sdnId}`,
          visibility: "public",
          license: "US Government work (17 USC §105, public domain)",
          tosRisk: "low",
          isActive: true,
        },
      });
      upserted++;
    } catch (err) {
      errors++;
      console.error("[ofac] upsert failed for", e.address, err);
    }
  }

  return {
    fetched: entries.length,
    upserted,
    errors,
    durationMs: Date.now() - startedAt,
  };
}
